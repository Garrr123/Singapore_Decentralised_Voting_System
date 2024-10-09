from typing import List
import dotenv
import os
import mysql.connector
from fastapi import FastAPI, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import errorcode
import jwt
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from pydantic import BaseModel
import qrcode
from io import BytesIO
import base64
from web3 import Web3
import json
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


dotenv.load_dotenv()

app = FastAPI()
networkAddress = os.getenv("ADDRESS")
ganachePort = os.getenv("ganachePort")

origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    f"http://{networkAddress}:8080",
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    cnx = mysql.connector.connect(
        user=os.getenv('MYSQL_USER'),
        password=os.getenv('MYSQL_PASSWORD'),
        host=os.getenv('MYSQL_HOST'),
        database=os.getenv('MYSQL_DB'),
    )
    cursor = cnx.cursor()
    print("Database connected successfully!")
    
    cursor.execute("SHOW COLUMNS FROM voters")
    columns = cursor.fetchall()
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("Something is wrong with your user name or password")
    elif err.errno == errorcode.ER_BAD_DB_ERROR:
        print("Database does not exist")

class UserLogin(BaseModel):
    voter_id: str
    password: str

class VotingTokenRequest(BaseModel):
    voter_id: str
    user_wallet: str

class Team(BaseModel):
    id: int
    name: str

class GRCCandidate(BaseModel):
    id: int
    name: str
    team: str

class SMCCandidate(BaseModel):
    id: int
    candidate_name: str
    party_name: str
    region_code: str

web3 = Web3(Web3.HTTPProvider(f'http://{networkAddress}:{ganachePort}'))

async def authenticate(voter_id: str, password: str):
    print("Authenticating voter_id:", voter_id)
    try:
        cursor.execute("SELECT password FROM voters WHERE voter_id = %s", (voter_id,))
        result = cursor.fetchone()
        print("Password retrieved from DB:", result)
        if not result or result[0] != password:
            print("Authentication failed for voter_id:", voter_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid voter ID or password"
            )
        print("Authentication successful for voter_id:", voter_id)
    except mysql.connector.Error as err:
        print("Database error during authentication:", err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

@app.post("/login")
async def login(user: UserLogin):
    print("Login request received for voter_id:", user.voter_id)
    voter_id = user.voter_id
    password = user.password
    await authenticate(voter_id, password)
    role = await get_role(voter_id, password)
    print("Role retrieved for voter_id:", voter_id, "Role:", role)
    token = jwt.encode({'password': password, 'voter_id': voter_id, 'role': role}, os.getenv('SECRET_KEY'), algorithm='HS256')
    print("JWT token generated for voter_id:", voter_id)
    return {'token': token, 'role': role}

@app.post("/send-voting-token")
async def send_voting_token(request: VotingTokenRequest):
    voter_id = request.voter_id
    user_wallet = request.user_wallet
    try:
        voter_region = await get_region(voter_id)
        print(f"Retrieved region: {voter_region}")

        with open('../build/contracts/VotingFactory.json') as f:
            factory_contract_data = json.load(f)
            factory_contract_abi = factory_contract_data['abi']
            factory_contract_address = factory_contract_data['networks']['1337']['address']
        
        factory_contract_address = web3.to_checksum_address(factory_contract_address)
        voting_factory_contract = web3.eth.contract(address=factory_contract_address, abi=factory_contract_abi)
        print(f"Factory contract address: {factory_contract_address}")

        voting_contract_address = voting_factory_contract.functions.getVotingContractByRegion(voter_region).call()
        print(f"Voter contract address for region {voter_region}: {voting_contract_address}")
        
        with open('../build/contracts/VoterContract.json') as f:
            contract_data = json.load(f)
            contract_abi = contract_data['abi']
        
        voting_contract_address = web3.to_checksum_address(voting_contract_address)
        voting_contract = web3.eth.contract(address=voting_contract_address, abi=contract_abi)
        print(f"Using VoterContract at address: {voting_contract_address}")

        account = web3.eth.account.from_key(os.getenv('PRIVATE_KEY'))
        nonce = web3.eth.get_transaction_count(account.address)
        print(f"Account address: {account.address}, Nonce: {nonce}")
        
        balance = web3.eth.get_balance(account.address)
        current_gas_price = web3.to_wei('1', 'gwei')
        estimated_gas = 50000
        estimated_gas_cost = estimated_gas * current_gas_price

        print("Balance: ", balance)
        print("Estimated gas cost: ", estimated_gas_cost,"  ", current_gas_price)

        # Register voter
        register_txn = voting_contract.functions.registerVoter(user_wallet, voter_region).build_transaction({
            'chainId': 1337,
            'gas': 200000,
            'gasPrice': web3.to_wei('1', 'gwei'),
            'nonce': nonce,
        })
        
        signed_register_txn = web3.eth.account.sign_transaction(register_txn, private_key=os.getenv('PRIVATE_KEY'))
        register_tx_hash = web3.eth.send_raw_transaction(signed_register_txn.rawTransaction)
        register_tx_receipt = web3.eth.wait_for_transaction_receipt(register_tx_hash)
        print(f"Register transaction hash: {register_tx_hash.hex()}, Receipt: {register_tx_receipt}")

        if not register_tx_receipt['logs']:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No logs found in transaction receipt")

        # Generate voting token
        nonce += 1
        generate_token_txn = voting_contract.functions.generateVotingToken(user_wallet).build_transaction({
            'chainId': 1337,
            'gas': 200000,
            'gasPrice': web3.to_wei('1', 'gwei'),
            'nonce': nonce,
        })
        
        signed_generate_token_txn = web3.eth.account.sign_transaction(generate_token_txn, private_key=os.getenv('PRIVATE_KEY'))
        generate_token_tx_hash = web3.eth.send_raw_transaction(signed_generate_token_txn.rawTransaction)
        generate_token_tx_receipt = web3.eth.wait_for_transaction_receipt(generate_token_tx_hash)
        print(f"Generate voting token transaction hash: {generate_token_tx_hash.hex()}, Receipt: {generate_token_tx_receipt}")

        if not generate_token_tx_receipt['logs']:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No logs found in transaction receipt")

        log = generate_token_tx_receipt['logs'][0]
        try:
            decoded_logs = voting_contract.events.VotingTokenGenerated().process_log(log)
            voting_token = web3.to_hex(decoded_logs['args']['votingToken'])
            print(f"Generated voting token: {voting_token}")
        except Exception as e:
            print(f"Error decoding log: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding log: {e}")

      # Update token to contract mapping in VotingFactory
        nonce += 1
        update_token_txn = voting_factory_contract.functions.updateTokenToContract(voting_token, voting_contract_address).build_transaction({
            'chainId': 1337,
            'gas': 200000,
            'gasPrice': web3.to_wei('1', 'gwei'),
            'nonce': nonce,
        })
        
        signed_update_token_txn = web3.eth.account.sign_transaction(update_token_txn, private_key=os.getenv('PRIVATE_KEY'))
        update_token_tx_hash = web3.eth.send_raw_transaction(signed_update_token_txn.rawTransaction)
        update_token_tx_receipt = web3.eth.wait_for_transaction_receipt(update_token_tx_hash)
        print(f"Update token to contract transaction hash: {update_token_tx_hash.hex()}, Receipt: {update_token_tx_receipt}")

        # Check if logs are emitted
        if not update_token_tx_receipt['logs']:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No logs found in transaction receipt")

        print("this is a try" , os.getenv('SECRET_KEY'))
        qr_token = jwt.encode({'voting_token': voting_token, 'exp': datetime.utcnow() + timedelta(hours=1)}, os.getenv('SECRET_KEY'), algorithm='HS256')


        mapped_contract_address = voting_factory_contract.functions.getVotingContractByToken(voting_token).call()
        print(f"Mapped contract address for token {voting_token}: {mapped_contract_address}")

        if mapped_contract_address != voting_contract_address:
            print(f"Error: Mapped contract address ({mapped_contract_address}) does not match expected address ({voting_contract_address})")

        voting_url = f"http://{networkAddress}:8080/index.html?token={qr_token}"
        email = await get_email(voter_id)
        
        send_email_with_qr(email, voting_url, voting_token)
        add_register_record(voter_id)

        return {'message': 'Voting token sent successfully'}

    except Exception as e:
        print(f"Internal server error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}")

async def get_region(voter_id: str):
    try:
        print("voter id is " , voter_id)
        cursor.execute("SELECT RegionCode FROM voterregion WHERE id = %s", (voter_id,))
        region_code = cursor.fetchone()
        print("Region code is", region_code)
        
        region_code = region_code[0]  # Extract the region code from the tuple

        if not region_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Region code not found for voter"
            )
        
        cursor.execute("SELECT RegionName FROM regioncode WHERE RegionCode = %s", (region_code,))
        region = cursor.fetchone()
        print("Region is", region)
        
        if region:
            return region[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Region name not found for the provided region code"
            )
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

async def get_role(voter_id: str, password: str):
    try:
        cursor.execute("SELECT role FROM voters WHERE voter_id = %s AND password = %s", (voter_id, password,))
        role = cursor.fetchone()
        if role:
            return role[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid voter id or password"
            )
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

async def get_email(voter_id: str):
    try:
        cursor.execute("SELECT email FROM votersmail WHERE id = %s", (voter_id,))
        email = cursor.fetchone()
        if email:
            return email[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found for voter"
            )
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

def send_email_with_qr(email: str, voting_url: str, voting_token: str):
    try:
        sender_email = os.getenv('EMAIL_USER')  # Sender email should be verified in SendGrid
        print("this is sender", sender_email)
        receiver_email = email
        subject = "Your QR Code for Voting"
        body = (
            f"Dear Voter,<br><br>"
            f"You can access the voting page using the following link:<br>"
            f"<a href='{voting_url}'>Click here to vote</a>"
        )

        # Create the email content using SendGrid's Mail object
        print("this is receiver", receiver_email)
        message = Mail(
            from_email=sender_email,
            to_emails=receiver_email,
            subject=subject,
            html_content=body
        )

        # Debug: print the email body length
        print(f"Email body length: {len(body)}")

        # Send the email using SendGrid API
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        print(f"Email sent response: {response.status_code}")
        print(f"Response body: {response.body}")
        print(f"Response headers: {response.headers}")

        print(f"Email sent successfully with status code: {response.status_code}")

    except Exception as e:
        print(f"Error sending email: {e}")



def add_register_record(voter_id: str):
    try:
        current_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO inboundregister (id, updateDate) VALUES (%s, %s)", (voter_id, current_datetime))
        cnx.commit()
    except mysql.connector.Error as err:
        print(f"Error adding record to database: {err}")  # Print the detailed error message
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding record to database: {err}"
        )
    

#=======================================================================================================
@app.get("/teams", response_model=List[Team])
async def get_teams(region_name: str = Query(...)):
    # Fetch teams for a specific region
    cursor.execute("SELECT RegionCode FROM regioncode WHERE RegionName = %s", (region_name,))

    region_code = cursor.fetchone()

    if not region_code:
        raise HTTPException(status_code=404, detail="Region not found")
    
    cursor.execute("SELECT id, name FROM teams WHERE region_code = %s", (region_code[0],))
    teams = cursor.fetchall()  # Fetch all rows for the given region

    teams_list = [Team(id=team[0], name=team[1]) for team in teams]

    return teams_list

@app.get("/grccandidates", response_model=List[GRCCandidate])
async def get_grccandidates(region_name: str = Query(...), team_name: str = Query(...)):
    # Fetch RegionCode for the given region
    cursor.execute("SELECT RegionCode FROM regioncode WHERE RegionName = %s", (region_name,))
    region_code = cursor.fetchone()
    
    if not region_code:
        return []

    print("this is a test" , region_code[0])
    print("this is a test" , team_name)

    # Fetch candidates for the specific team in the given region
    cursor.execute("""
    SELECT c.id, c.candidate_name, t.name 
    FROM grc_candidates c 
    JOIN teams t ON c.team_id = t.id
    JOIN regioncode r ON r.RegionCode = c.region_code
    WHERE r.RegionCode = %s AND t.id = %s
    """, (region_code[0], team_name))
    
    candidates = cursor.fetchall()

    # Format candidates into the expected list of dictionaries
    candidates_list = [GRCCandidate(id=c[0], name=c[1], team=c[2]) for c in candidates]

    return candidates_list


@app.get("/smccandidates", response_model=List[SMCCandidate])
async def get_smc_candidates(region_name: str = Query(...)):
    # Fetch region code based on the region name
    cursor.execute("SELECT RegionCode FROM regioncode WHERE RegionName = %s", (region_name,))
    region_code = cursor.fetchone()
    
    if not region_code:
        return []  # Return empty list if no region found
    
    # Fetch candidates for the SMC region
    cursor.execute("""
        SELECT id, candidate_name, party_name, region_code
        FROM smc_candidates
        WHERE region_code = %s
    """, (region_code[0],))
    
    candidates = cursor.fetchall()

    print("this is candidates", candidates)

    # Prepare list of candidates to return
    smc_candidates_list = [SMCCandidate(id=c[0], candidate_name=c[1], party_name=c[2], region_code=c[3]) for c in candidates]

    return smc_candidates_list

#=======================================================================================================


@app.get("/results/{region}")
async def get_results(region: str):
    try:
        with open('../build/contracts/VotingFactory.json') as f:
            factory_contract_data = json.load(f)
            factory_contract_abi = factory_contract_data['abi']
            factory_contract_address = factory_contract_data['networks']['1337']['address']
        
        factory_contract_address = web3.to_checksum_address(factory_contract_address)
        voting_factory_contract = web3.eth.contract(address=factory_contract_address, abi=factory_contract_abi)

        voting_contract_address = voting_factory_contract.functions.getVotingContractByRegion(region).call()
        with open('../build/contracts/VoterContract.json') as f:
            contract_data = json.load(f)
            contract_abi = contract_data['abi']
        
        voting_contract_address = web3.to_checksum_address(voting_contract_address)
        voting_contract = web3.eth.contract(address=voting_contract_address, abi=contract_abi)

        results = voting_contract.functions.getResults().call()
        candidates = []
        for i in range(len(results[0])):
            candidate = {
                "id": results[0][i],
                "name": results[1][i],
                "party": results[2][i],
                "voteCount": results[3][i]
            }
            candidates.append(candidate)

        return {"region": region, "candidates": candidates}
    except Exception as e:
        print(f"Error getting results: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
