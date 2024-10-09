const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingFactoryArtifacts = require('./build/contracts/VotingFactory.json');
const VotingFactoryContract = contract(votingFactoryArtifacts);
require('dotenv').config();

const app = express();

let web3;
if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    web3 = new Web3(window.ethereum);
} else {
    console.log("Using Ganache");
    web3 = new Web3(new Web3.providers.HttpProvider(`http://${process.env.ADDRESS}:${process.env.ganachePort}`));
}

VotingFactoryContract.setProvider(web3.currentProvider);

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/login.html'));
});

app.get('/index.html', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send("Missing token");
  }

  try {
    console.log("Token is:", token);
    console.log("This is secret key:", process.env.SECRET_KEY);
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const votingToken = decoded.voting_token;

    console.log("Voting token is:", votingToken);

    const votingFactoryInstance = await VotingFactoryContract.deployed();
    console.log("VotingFactory contract address:", votingFactoryInstance.address);

    // Fetch all token-to-contract mappings for debugging purposes
    const mappings = await votingFactoryInstance.getAllTokenToContractMappings.call();
    const tokens = mappings.map(mapping => mapping.token);
    const contractAddresses = mappings.map(mapping => mapping.contractAddress);
    console.log("All token-to-contract mappings:", tokens, contractAddresses);

    const votingContractAddress = await votingFactoryInstance.getVotingContractByToken.call(votingToken);
    console.log("This is the voting contract address:", votingContractAddress);

    if (!votingContractAddress || votingContractAddress === '0x0000000000000000000000000000000000000000') {
      return res.status(404).send("Voting contract not found");
    }

    res.sendFile(path.join(__dirname, 'src/html/index.html'), { contractAddress: votingContractAddress, mappings: { tokens, contractAddresses } });
  } catch (error) {
    console.error("Invalid token:", error);
    res.status(401).send("Invalid token");
  }
});

app.get('/results/:region', async (req, res) => {
  const { region } = req.params;

  try {
    const votingFactoryInstance = await VotingFactoryContract.deployed();
    const votingContractAddress = await votingFactoryInstance.getVotingContractByRegion.call(region);

    if (!votingContractAddress || votingContractAddress === '0x0000000000000000000000000000000000000000') {
      return res.status(404).send("Voting contract not found");
    }

    const voterContractArtifacts = require('./build/contracts/VoterContract.json');
    const VoterContract = contract(voterContractArtifacts);
    VoterContract.setProvider(web3.currentProvider);

    const votingContract = await VoterContract.at(votingContractAddress);
    const results = await votingContract.getResults.call();

    const candidates = results[0].map((id, index) => ({
      id,
      name: results[1][index],
      party: results[2][index],
      voteCount: results[3][index]
    }));

    res.json({ region, candidates });
  } catch (error) {
    console.error("Error getting results:", error);
    res.status(500).send("Internal server error");
  }
});

// Secure endpoint to get the secret key
app.get('/get-secret-key', (req, res) => {
  try {
    res.json({ secretKey: process.env.SECRET_KEY });
  } catch (error) {
    res.status(403).send('Forbidden');
  }
});

app.get('/js/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/login.js'));
});

app.get('/css/login.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/login.css'));
});

app.get('/css/index.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/index.css'));
});

app.get('/css/admin.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/admin.css'));
});

app.get('/assets/eth5.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/assets/eth5.jpg'));
});

app.get('/js/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/app.js'));
});

app.get('/js/admin.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/admin.js'));
});

app.get('/js/countryconfig.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/countryconfig.js'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/admin.html'));
});

app.get('/success.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/success.html'));
});

app.get('/countryconfig.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/countryconfig.html'));
});

app.get('/dist/login.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/login.bundle.js'));
});

app.get('/dist/admin.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/admin.bundle.js'));
});

app.get('/dist/app.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/app.bundle.js'));
});

app.get('/dist/countryconfig.bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/dist/countryconfig.bundle.js'));
});

// Serve the favicon.ico file
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/favicon.ico'));
});

// Start the server
const localIP = process.env.ADDRESS; 
app.listen(8080, localIP, () => {
  console.log(`Server listening on http://${localIP}:8080`);
});
