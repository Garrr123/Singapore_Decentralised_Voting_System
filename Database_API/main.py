import dotenv
import os
import mysql.connector
from fastapi import FastAPI, HTTPException, status, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import errorcode
import jwt
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from pydantic import BaseModel
import qrcode
from io import BytesIO
import base64

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
    print("Columns in voters table:", columns)
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("Something is wrong with your user name or password")
    elif err.errno == errorcode.ER_BAD_DB_ERROR:
        print("Database does not exist")
    else:
        print(err)

# Pydantic models
class UserLogin(BaseModel):
    voter_id: str
    password: str

class VotingTokenRequest(BaseModel):
    voter_id: str
    voting_token: str

# Define the authentication middleware
async def authenticate(token: str):
    try:
        cursor.execute("SELECT * FROM voters WHERE voter_id = %s", (token,))
        print("Authenticate query executed")  # Debugging statement
        if token not in [row[0] for row in cursor.fetchall()]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Forbidden"
            )
    except Exception as e:
        print(f"Authentication error: {e}")
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

    # Assuming authentication is successful, generate a token
    token = jwt.encode({'password': password, 'voter_id': voter_id, 'role': role}, os.getenv('SECRET_KEY'), algorithm='HS256')

    return {'token': token, 'role': role}

@app.post("/send-voting-token")
async def send_voting_token(request: VotingTokenRequest):
    voter_id = request.voter_id
    voting_token = request.voting_token

    qr_token = jwt.encode({'voter_id': voter_id, 'voting_token': voting_token, 'exp': datetime.utcnow() + timedelta(hours=1)}, os.getenv('SECRET_KEY'), algorithm='HS256')

    voting_url = f"http://192.168.1.6:8080/index.html?token={qr_token}"
    email = await get_email(voter_id)
    send_email_with_qr(email, voting_url)
    add_register_record(voter_id)

    return {'message': 'Voting token sent successfully'}

async def get_role(voter_id: str, password: str):
    try:
        print("Executing get_role query")  
        cursor.execute("SELECT role FROM voters WHERE voter_id = %s AND password = %s", (voter_id, password,))
        role = cursor.fetchone()
        print("Role fetched:", role)  
        if role:
            return role[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid voter id or password"
            )
    except mysql.connector.Error as err:
        print("Error during get_role:", err)  # Debugging statement
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

async def get_email(voter_id: str):
    try:
        print("Executing get_email query")  # Debugging statement
        cursor.execute("SELECT email FROM votersmail WHERE id = %s", (voter_id,))
        email = cursor.fetchone()
        print("Email fetched:", email)  # Debugging statement
        if email:
            return email[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found for voter"
            )
    except mysql.connector.Error as err:
        print("Error during get_email:", err)  # Debugging statement
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

def send_email_with_qr(email: str, voting_url: str):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(voting_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Save the image to a BytesIO object
    byte_io = BytesIO()
    img.save(byte_io, 'PNG')
    byte_io.seek(0)

    base64_img = base64.b64encode(byte_io.read()).decode('utf-8')
    img_html = f'<img src="data:image/png;base64,{base64_img}" alt="QR Code">'

    sender_email = os.getenv('EMAIL_USER')
    receiver_email = email
    subject = "Your QR Code for Voting"
    body = f"Dear Voter,<br><br>Here is your QR code for voting. Please scan it to proceed with your voting process.<br><br>{img_html}"

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'html'))

    try:
        smtp_server = smtplib.SMTP(os.getenv('SMTP_SERVER'), os.getenv('SMTP_PORT'))
        smtp_server.starttls()
        smtp_server.login(sender_email, os.getenv('EMAIL_PASSWORD'))
        smtp_server.send_message(msg)
        smtp_server.quit()
        print("Email sent successfully!")
    except Exception as e:
        print(f"Error sending email: {str(e)}")

def add_register_record(voter_id: str):
    try:
        current_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO inboundregister (id, updateDate) VALUES (%s, %s)", (voter_id, current_datetime))
        cnx.commit()
        print("Record added to inboundregister table successfully!")
    except mysql.connector.Error as err:
        print(f"Error adding record: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error adding record to database"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
