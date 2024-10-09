const Web3 = require('web3');
const contract = require('@truffle/contract');
const jwt = require('jsonwebtoken');
const votingArtifacts = require('../../build/contracts/VoterContract.json');
const VotingContract = contract(votingArtifacts);
const votingFactoryArtifacts = require('../../build/contracts/VotingFactory.json');
const VotingFactoryContract = contract(votingFactoryArtifacts);
require('dotenv').config();

window.App = {
  votingToken: null, // Define votingToken here

  getSecretKey: async function() {
    const response = await fetch('/get-secret-key');
    const data = await response.json();
    return data.secretKey;
  },

  eventStart: async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      console.error("Missing voting token in URL");
      return;
    }

    try {
      App.secretKey = await App.getSecretKey();
      const decoded = jwt.verify(token, App.secretKey);
      App.votingToken = decoded.voting_token; // Set votingToken here

      window.ethereum.request({ method: 'eth_requestAccounts' }).then(async function(accounts) {
        if (accounts.length === 0) {
          console.error("No accounts found");
          return;
        }
        App.account = accounts[0];

        const web3 = new Web3(window.ethereum);
        VotingFactoryContract.setProvider(web3.currentProvider);
        VotingContract.setProvider(web3.currentProvider);
        VotingFactoryContract.defaults({ from: accounts[0], gas: 6654755 });
        VotingContract.defaults({ from: accounts[0], gas: 6654755 });

        const factoryInstance = await VotingFactoryContract.deployed();
        const votingContractAddress = await factoryInstance.getVotingContractByToken(App.votingToken);

        if (!votingContractAddress || votingContractAddress === '0x0000000000000000000000000000000000000000') {
          console.error("Voting contract not found for the provided token");
          return;
        }

        App.contractInstance = new web3.eth.Contract(VotingContract.abi, votingContractAddress);

        $("#accountAddress").html("Your Account: " + accounts[0]);

        App.contractInstance.methods.getVotingTimes().call().then(function(result) {
          const votingDate = new Date(result[0] * 1000).toDateString();
          const startTime = new Date(result[1] * 1000).toLocaleTimeString();
          const endTime = new Date(result[2] * 1000).toLocaleTimeString();
          $("#votingDate").text(votingDate);
          $("#votingTimes").text(`${startTime} - ${endTime}`);
        }).catch(function(err) {
          console.error("ERROR in getVotingTimes: " + err.message);
        });

        App.contractInstance.methods.isGRC().call().then(async function(isGRC) {
          if (isGRC) {
            // Display teams for GRC
            for (let i = 1; i <= await App.contractInstance.methods.countTeams().call(); i++) {
              const team = await App.contractInstance.methods.teams(i).call();
              let candidatesHTML = `<div class="team-header">
                                      <input type="radio" name="team" value="${team.id}" class="form-check-input">
                                      <label>${team.name}</label>
                                      <ul>`;
        
              for (let j = 1; j <= team.candidateCount; j++) {
                // Fetch candidate details
                const candidate = await App.contractInstance.methods.getTeamCandidate(team.id, j).call();
                const candidateParty = candidate[1] || "Party Not Found";
                candidatesHTML += `<li>${candidateParty}</li>`;
              }
              candidatesHTML += `</ul></div>`;
              $("#candidateContent").append(candidatesHTML);
            }
          } else {
            // Handle SMC display as usual
            for (let i = 1; i <= await App.contractInstance.methods.getCandidateCount().call(); i++) {
              const candidate = await App.contractInstance.methods.getCandidate(i).call();
              const candidateHTML = `<tr>
                                      <td><input type="radio" name="candidate"class="form-check-input">${candidate.name}</td>
                                      <td>${candidate.party}</td>
                                    </tr>`;
              $("#boxCandidate").append(candidateHTML);
            }
          }
        
          $("#voteButton").attr("disabled", false);
        }).catch(err => console.error("Error determining GRC or SMC:", err.message));

        App.contractInstance.methods.checkVote(App.account).call().then(function(voted) {
          if (!voted) {
            $("#voteButton").attr("disabled", false);
          }
        }).catch(function(err) {
          console.error("ERROR in checkVote: " + err.message);
        });

      }).catch(function(error) {
        console.error("Failed to request accounts:", error);
      });

    } catch (error) {
      console.error("Invalid token:", error);
    }
  },

  vote: function() {
    console.log("Starting vote function...");
    const token = new URLSearchParams(window.location.search).get('token');
    console.log("Voting token from URL:", token);
    
    if (!token) {
      $("#msg").html("<p>Invalid or missing voting token. Please login again.</p>");
      return;
    }
  
    let selectionID;
  
    App.contractInstance.methods.isGRC().call().then(isGRC => {
      console.log("Is GRC:", isGRC);
  
      if (isGRC) {
        selectionID = $("input[name='team']:checked").val();
        console.log("Selected Team ID:", selectionID);
        
        if (!selectionID) {
          $("#msg").html("<p>Please select a team.</p>");
          return;
        }
        
        console.log("Attempting to send voteGRC transaction with token:", App.votingToken);
        App.contractInstance.methods.voteGRC(parseInt(selectionID), App.votingToken).send({ from: App.account, gas: 500000 })
          .then(result => handleVoteSuccess(result))
          .catch(err => {
            console.error("Vote transaction error:", JSON.stringify(err, null, 2)); // Detailed error info
            handleVoteError(err);
          });
  
      } else {
        selectionID = $("input[name='candidate']:checked").val();
        console.log("Selected Candidate ID:", selectionID);
        
        if (!selectionID) {
          $("#msg").html("<p>Please select a candidate.</p>");
          return;
        }
        
        console.log("Attempting to send voteSMC transaction with token:", App.votingToken);
        App.contractInstance.methods.voteSMC(parseInt(selectionID), App.votingToken).send({ from: App.account, gas: 500000 })
          .then(result => handleVoteSuccess(result))
          .catch(err => {
            console.error("Vote transaction error:", JSON.stringify(err, null, 2)); // Detailed error info
            handleVoteError(err);
          });
      }
    }).catch(err => {
      console.error("Error in vote process:", err.message);
    });
  }
};

function handleVoteSuccess(result) {
  $("#voteButton").attr("disabled", true);
  $("#msg").html("<p>Voted successfully</p>");
  console.log("Vote transaction result:", result);
}

function handleVoteError(err) {
  console.error("Vote transaction error:", err.message);
  $("#msg").html("<p>Error processing vote. Please try again.</p>");
}

document.addEventListener("DOMContentLoaded", function() {
  const voteButton = document.getElementById("voteButton");
  if (voteButton) {
    voteButton.onclick = function() {
      App.vote();
    };
  }

  window.App.eventStart();
});
