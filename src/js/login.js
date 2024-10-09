const Web3 = require('web3');
const contract = require('@truffle/contract');
const jwt = require('jsonwebtoken');
const VoterContract = require('../../build/contracts/VoterContract.json');
const VoterContractArtifacts = contract(VoterContract);
const VotingFactory = require('../../build/contracts/VotingFactory.json');
const VotingFactoryArtifacts = contract(VotingFactory);
require('dotenv').config();

var networkAddress = process.env.ADDRESS;

if (!networkAddress) {
  networkAddress = "172.20.10.3"
}

console.log(process.env);

window.addEventListener('load', async () => {
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum);
    await window.ethereum.enable();
  } else {
    console.warn('No web3 provider detected. Install MetaMask or use a compatible browser.');
  }

  VoterContractArtifacts.setProvider(window.web3.currentProvider);
  VotingFactoryArtifacts.setProvider(window.web3.currentProvider);
});

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const voter_id = document.getElementById('voter-id').value;
  const password = document.getElementById('password').value;

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(`http://${networkAddress}:8000/login`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ voter_id: voter_id, password: password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    if (data.role === 'admin') {
      localStorage.setItem('jwtTokenAdmin', data.token);
      window.location.replace(`http://${networkAddress}:8080/admin.html?role=admin`);
    } else if (data.role === 'user') {
      const userAddress = (await web3.eth.getAccounts())[0];
      localStorage.setItem('jwtTokenUser', data.token);

      // Send voting token request to backend
      const qrResponse = await fetch(`http://${networkAddress}:8000/send-voting-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({ voter_id: voter_id, user_wallet: userAddress })
      });

      if (!qrResponse.ok) {
        throw new Error('Failed to send voting token');
      }

      // Redirect to success page after registration
      window.location.replace(`http://${networkAddress}:8080/success.html`);
    }
  } catch (error) {
    console.error('Login failed:', error.message);
  }
});
