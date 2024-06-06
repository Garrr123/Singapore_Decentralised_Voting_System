import dotenv
import os
import mysql.connector
from fastapi import FastAPI, HTTPException, status, Request
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

dotenv.load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://192.168.1.6:8080",
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

web3 = Web3(Web3.HTTPProvider('http://localhost:7546'))

try:
    with open('../build/contracts/voting.json') as f:
        contract_data = json.load(f)
        contract_abi = contract_data['abi']
        contract_address = contract_data['networks']['1337']['address']
except FileNotFoundError:
    print("Contract ABI file not found")
    contract_abi = None
    contract_address = None
except json.JSONDecodeError:
    print("Error decoding JSON from contract ABI file")
    contract_abi = None
    contract_address = None

contract_address = web3.to_checksum_address(contract_address)
voting_contract = web3.eth.contract(address=contract_address, abi=contract_abi)

async def authenticate(token: str):
    try:
        cursor.execute("SELECT * FROM voters WHERE voter_id = %s", (token,))
        if token not in [row[0] for row in cursor.fetchall()]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Forbidden"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden"
        )

@app.post("/login")
async def login(user: UserLogin, request: Request):
    voter_id = user.voter_id
    password = user.password
    
    await authenticate(request.headers.get('authorization').replace("Bearer ", ""))
    role = await get_role(voter_id, password)
    token = jwt.encode({'password': password, 'voter_id': voter_id, 'role': role}, os.getenv('SECRET_KEY'), algorithm='HS256')

    return {'token': token, 'role': role}

@app.post("/send-voting-token")
async def send_voting_token(request: VotingTokenRequest):
    voter_id = request.voter_id

    account = web3.eth.account.from_key(os.getenv('PRIVATE_KEY'))
    nonce = web3.eth.get_transaction_count(account.address)
    
    transaction = voting_contract.functions.generateVotingToken().build_transaction({
        'chainId': 1337,
        'gas': 70000,
        'gasPrice': web3.to_wei('1', 'gwei'),
        'nonce': nonce,
    })
    
    signed_txn = web3.eth.account.sign_transaction(transaction, private_key=os.getenv('PRIVATE_KEY'))
    tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)


    if not tx_receipt['logs']:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No logs found in transaction receipt")

    log = tx_receipt['logs'][0]
    decoded_logs = voting_contract.events.VotingTokenGenerated().process_log(log)
    voting_token = web3.to_hex(decoded_logs['args']['votingToken'])

    try:
        transaction = voting_contract.functions.registerVoter(voting_token, account.address).build_transaction({
            'chainId': 1337,
            'gas': 70000,
            'gasPrice': web3.to_wei('1', 'gwei'),
            'nonce': nonce + 1,
        })
        signed_txn = web3.eth.account.sign_transaction(transaction, private_key=os.getenv('PRIVATE_KEY'))

        tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)

        tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    except Exception as e:

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error registering voter: {e}")
    
    qr_token = jwt.encode({'voter_id': voter_id, 'voting_token': voting_token, 'exp': datetime.utcnow() + timedelta(hours=1)}, os.getenv('SECRET_KEY'), algorithm='HS256')

    voting_url = f"http://192.168.1.6:8080/index.html?token={qr_token}"
    email = await get_email(voter_id)
    
    send_email_with_qr(email, voting_url, voting_token)
    add_register_record(voter_id)

    return {'message': 'Voting token sent successfully'}

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
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(voting_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    byte_io = BytesIO()
    img.save(byte_io, 'PNG')
    byte_io.seek(0)

    base64_img = base64.b64encode(byte_io.read()).decode('utf-8')
    img_html = f'<img src="data:image/png;base64,{base64_img}" alt="QR Code">'

    sender_email = os.getenv('EMAIL_USER')
    receiver_email = email
    subject = "Your QR Code for Voting"
    body = f"Dear Voter,<br><br>Here is your QR code for voting. Please scan it to proceed with your voting process.<br><br>{img_html}<br><br>Your Voting Token: {voting_token}"

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'html'))

    # Attach the smart contract file
    try:
        with open('../build/contracts/voting.json', 'rb') as attachment:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= voting.json',
            )
            msg.attach(part)
    except FileNotFoundError:
        print("Smart contract file not found for attachment")

    try:
        smtp_server = smtplib.SMTP(os.getenv('SMTP_SERVER'), os.getenv('SMTP_PORT'))
        smtp_server.starttls()
        smtp_server.login(sender_email, os.getenv('EMAIL_PASSWORD'))
        smtp_server.send_message(msg)
        smtp_server.quit()
    except Exception as e:
        print(f"Error sending email: {e}")

def add_register_record(voter_id: str):
    try:
        current_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO inboundregister (id, updateDate) VALUES (%s, %s)", (voter_id, current_datetime))
        cnx.commit()
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error adding record to database"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
