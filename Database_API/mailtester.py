import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import dotenv

dotenv.load_dotenv()

def send_test_email():
    # Set your SendGrid API key here
    api_key = os.getenv('SENDGRID_API_KEY')  # Ensure the environment variable is set correctly
    if not api_key:
        print("API Key is missing!")
        return

    # Define the sender and receiver emails
    sender_email = os.getenv('EMAIL_USER')  # Ensure the sender email is verified on SendGrid
    print(api_key)
    receiver_email = 'drogon1248@hotmail.com'  # Replace with the receiver's email

    # Create the email content
    message = Mail(
        from_email=sender_email,
        to_emails=receiver_email,
        subject='Test Email from SendGrid',
        html_content='<strong>This is a test email to check if the SendGrid API key is working.</strong>'
    )

    try:
        # Initialize the SendGrid client with the API key
        sg = SendGridAPIClient(api_key)
        print(sg)
        # Send the email
        response = sg.send(message)
        print(response)

        # Output the response status and body for debugging
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.body}")
        print(f"Response Headers: {response.headers}")

        if response.status_code == 202:
            print("Test email sent successfully!")
        else:
            print("Failed to send test email. Check the response details above.")

    except Exception as e:
        print(f"Error sending test email: {e}")

if __name__ == "__main__":
    send_test_email()
