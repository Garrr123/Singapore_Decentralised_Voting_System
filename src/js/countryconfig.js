const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingFactoryArtifacts = require('../../build/contracts/VotingFactory.json');
const voterContractArtifacts = require('../../build/contracts/VoterContract.json');
const VotingFactoryContract = contract(votingFactoryArtifacts);
const VoterContract = contract(voterContractArtifacts);
require('dotenv').config();

window.App = {
  eventStart: function() {
    window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(accounts) {
      if (accounts.length === 0) {
        console.error("No accounts found");
        return;
      }
      VotingFactoryContract.setProvider(window.ethereum);
      VoterContract.setProvider(window.ethereum);
      App.account = accounts[0];
      VotingFactoryContract.defaults({ from: accounts[0], gas: 6654755 });
      VoterContract.defaults({ from: accounts[0], gas: 6654755 });

      const web3 = new Web3(window.ethereum);
      web3.eth.net.getId().then(networkId => {
        console.log("Current network ID:", networkId);
        if (networkId === 1) {
          console.log("Connected to the Mainnet");
        } else if (networkId === 3) {
          console.log("Connected to the Ropsten Test Network");
        } else {
          console.log("Connected to an unknown network");
        }
      }).catch(error => {
        console.error("Error getting network ID:", error);
      });

      document.getElementById("accountAddress").innerHTML = "Your Account: " + accounts[0];

      document.getElementById('addCountryConfig').addEventListener('click', function(event) {
        event.preventDefault(); // Prevent the default form submission behavior
    
        var region = document.getElementById('region').value;
        var isGRC = document.getElementById('isGRC').checked; // Assuming you have a checkbox to determine if it's a GRC
        var votingDate = new Date(document.getElementById('votingDate').value).setHours(0,0,0,0) / 1000;
        var votingStartTime = new Date(document.getElementById('votingDate').value + " " + document.getElementById('votingStartTime').value).getTime() / 1000;
        var votingEndTime = new Date(document.getElementById('votingDate').value + " " + document.getElementById('votingEndTime').value).getTime() / 1000;
        var minVotingAge = parseInt(document.getElementById('minVotingAge').value);
        var maxVoters = parseInt(document.getElementById('maxVoters').value);
    
        VotingFactoryContract.deployed().then(function(instance) {
            return instance.createVotingContract(region, isGRC, votingDate, votingStartTime, votingEndTime, minVotingAge, maxVoters, { from: App.account });
        }).then(function(result) {
            console.log("Country configuration added successfully");
            document.getElementById("result").innerHTML = "Country configuration added successfully!";
            document.getElementById("result").style.color = "green";
            App.loadRegions(); // Load regions after adding a new one
        }).catch(function(err) {
            console.error("ERROR! " + err.message);
            document.getElementById("result").innerHTML = "Failed to add country configuration. ERROR: " + err.message;
            document.getElementById("result").style.color = "red";
        });
      });    

      document.getElementById('searchRegionButton').addEventListener('click', function(event) {
        event.preventDefault();
        var searchRegion = document.getElementById('searchRegion').value;
        App.searchRegionDetails(searchRegion);
      });

      App.loadRegions(); // Load regions when the page loads
    }).catch(function(error) {
      console.error("Failed to request accounts:", error);
      document.getElementById("result").innerHTML = "Failed to request accounts. ERROR: " + error.message;
      document.getElementById("result").style.color = "red";
    });
  },

  loadRegions: function() {
    VotingFactoryContract.deployed().then(function(instance) {
        return instance.getDeployedVotingContracts();
    }).then(function(contractAddresses) {
        var regionsList = document.getElementById("regionsList");
        regionsList.innerHTML = ""; // Clear existing list

        contractAddresses.forEach(function(address) {
            VoterContract.at(address).then(function(contractInstance) {
                return Promise.all([
                    contractInstance.region(),
                    contractInstance.minVotingAge(),
                    contractInstance.maxVoters(),
                    contractInstance.votingDate(),
                    contractInstance.votingStartTime(),
                    contractInstance.votingEndTime(),
                    address // Include the contract address
                ]);
            }).then(function(details) {
                var region = details[0];
                var minVotingAge = details[1];
                var maxVoters = details[2];
                var votingDate = new Date(details[3] * 1000).toLocaleDateString();
                var votingStartTime = new Date(details[4] * 1000).toLocaleTimeString();
                var votingEndTime = new Date(details[5] * 1000).toLocaleTimeString();
                var contractAddress = details[6]; // Get the contract address

                // Create a card for each region
                var card = document.createElement("div");
                card.className = "region-card";
                card.style = `
                    background-color: #333;
                    color: #e0e0e0;
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                `;

                card.innerHTML = `
                    <h4 style="color: #6a70dd;"><i class="fas fa-map-marker-alt"></i> ${region}</h4>
                    <p><strong>Min Voting Age:</strong> ${minVotingAge}</p>
                    <p><strong>Max Voters:</strong> ${maxVoters}</p>
                    <p><strong>Voting Date:</strong> ${votingDate}</p>
                    <p><strong>Voting Start Time:</strong> ${votingStartTime}</p>
                    <p><strong>Voting End Time:</strong> ${votingEndTime}</p>
                    <p><strong>Contract Address:</strong> <span style="color: #6a70dd;">${contractAddress}</span></p>
                `;

                regionsList.appendChild(card);
            }).catch(function(err) {
                console.error("Failed to load contract details. ERROR: " + err.message);
            });
        });
    }).catch(function(err) {
        console.error("Failed to load regions. ERROR: " + err.message);
        document.getElementById("result").innerHTML = "Failed to load regions. ERROR: " + err.message;
        document.getElementById("result").style.color = "red";
    });
  },

  searchRegionDetails: function(region) {
    VotingFactoryContract.deployed().then(function(instance) {
      return instance.getVotingDetailsByRegion(region);
    }).then(function(details) {
      var searchResult = document.getElementById("searchResult");
      var votingDate = new Date(details[3] * 1000).toLocaleDateString();
      var votingStartTime = new Date(details[4] * 1000).toLocaleTimeString();
      var votingEndTime = new Date(details[5] * 1000).toLocaleTimeString();
      searchResult.innerHTML = `<strong>Region:</strong> ${details[1]} <br>
                                <strong>Min Voting Age:</strong> ${details[2]} <br>
                                <strong>Max Voters:</strong> ${details[3]} <br>
                                <strong>Voting Date:</strong> ${votingDate} <br>
                                <strong>Voting Start Time:</strong> ${votingStartTime} <br>
                                <strong>Voting End Time:</strong> ${votingEndTime} <br>
                                <strong>Contract Address:</strong> ${details[0]}`;
    }).catch(function(err) {
      console.error("Failed to load region details. ERROR: " + err.message);
      document.getElementById("searchResult").innerHTML = "Failed to load region details. ERROR: " + err.message;
      document.getElementById("searchResult").style.color = "red";
    });
  }
};

window.addEventListener("load", function() {
  if (typeof web3 !== "undefined") {
    console.warn("Using web3 detected from external source like Metamask");
    window.web3 = new Web3(window.ethereum);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:9545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for deployment. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    window.web3 = new Web3(new Web3.providers.HttpProvider(`http://${process.env.ADDRESS}:9545`));
  }

  window.App.eventStart();
});
