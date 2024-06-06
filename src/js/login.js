const Web3 = require('web3');
const contract = require('@truffle/contract');
const jwt = require('jsonwebtoken');
const votingArtifacts = require('../../build/contracts/Voting.json');
const VotingContract = contract(votingArtifacts);

window.addEventListener('load', async () => {
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum);
    await window.ethereum.enable();
  } else {
    console.warn('No web3 provider detected. Install MetaMask or use a compatible browser.');
  }

  VotingContract.setProvider(window.web3.currentProvider);
});

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const voter_id = document.getElementById('voter-id').value;
  const password = document.getElementById('password').value;
  const token = voter_id;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    const response = await fetch('http://192.168.1.6:8000/login', {
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
      localStorage.setItem('votingToken', data.voting_token);
      window.location.replace(`http://192.168.1.6:8080/admin.html?role=admin&Authorization=Bearer ${localStorage.getItem('jwtTokenAdmin')}`);
    } else if (data.role === 'user') {
      try {
        const qrResponse = await fetch('http://192.168.1.6:8000/send-voting-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ voter_id: voter_id })
        });

        if (!qrResponse.ok) {
          throw new Error('Failed to send voting token');
        }

        // Redirect to success page after registration
        window.location.replace(`http://192.168.1.6:8080/success.html`);
      } catch (error) {
        console.error('Failed to send voting token:', error.message);
      }
    }
  } catch (error) {
    console.error('Login failed:', error.message);
  }
});
