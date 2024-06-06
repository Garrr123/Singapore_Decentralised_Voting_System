const Web3 = require('web3');
const contract = require('@truffle/contract');
const jwt = require('jsonwebtoken');
const ethers = require('ethers');
const votingArtifacts = require('../../build/contracts/Voting.json');
const VotingContract = contract(votingArtifacts);

window.App = {
  eventStart: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userRole = urlParams.get('role');

    window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(accounts) {
      if (accounts.length === 0) {
        console.error("No accounts found");
        return;
      }
      VotingContract.setProvider(window.ethereum);
      App.account = accounts[0];
      VotingContract.defaults({ from: accounts[0], gas: 6654755 });

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

      $("#accountAddress").html("Your Account: " + accounts[0]);

      VotingContract.deployed().then(function(instance) {
        if (userRole === 'admin') {
          $('#adminFunctions').show();
          $('#addCandidate').click(function() {
            var nameCandidate = $('#name').val();
            var partyCandidate = $('#party').val();
            instance.addCandidate(nameCandidate, partyCandidate, { from: App.account }).then(function(result) {
              console.log("Candidate added successfully");
            }).catch(function(err) {
              console.error("Error adding candidate:", err.message);
            });
          });

          $('#addDate').click(function() {
            var startDate = Date.parse(document.getElementById("startDate").value) / 1000;
            var endDate = Date.parse(document.getElementById("endDate").value) / 1000;
            instance.setDates(startDate, endDate).then(function(rslt) {
              console.log("Dates set successfully");
            }).catch(function(err) {
              console.error("Error setting dates:", err.message);
            });
          });
        }

        instance.getDates().then(function(result) {
          var startDate = new Date(result[0] * 1000);
          var endDate = new Date(result[1] * 1000);
          $("#dates").text(startDate.toDateString("#DD#/#MM#/#YYYY#") + " - " + endDate.toDateString("#DD#/#MM#/#YYYY#"));
        }).catch(function(err) {
          console.error("ERROR! " + err.message);
        });

        instance.getCountCandidates().then(function(countCandidates) {
          for (var i = 0; i < countCandidates; i++) {
            instance.getCandidate(i + 1).then(function(data) {
              var id = data[0];
              var name = data[1];
              var party = data[2];
              var voteCount = data[3];
              var viewCandidates = `<tr><td> <input class="form-check-input" type="radio" name="candidate" value="${id}" id=${id}>` + name + "</td><td>" + party + "</td><td>" + voteCount + "</td></tr>";
              $("#boxCandidate").append(viewCandidates);
            });
          }
          window.countCandidates = countCandidates;
        });

        instance.checkVote().then(function(voted) {
          console.log(voted);
          if (!voted) {
            $("#voteButton").attr("disabled", false);
          }
        });
      }).catch(function(err) {
        console.error("ERROR! " + err.message);
      });
    }).catch(function(error) {
      console.error("Failed to request accounts:", error);
    });
  },

  verifyVotingToken: function() {
    const token = localStorage.getItem('votingToken');
    if (!token) {
      console.error("No voting token found");
      return false;
    }
    console.log("Voting token found:", token);
    return true;
  },

  getToken: function() {
    VotingContract.deployed().then(function(instance) {
      instance.voters(App.account).then(function(voter) {
        const token = voter.votingToken;
        if (token) {
          $("#votingTokenDisplay").text(`Your Voting Token: ${token}`);
          localStorage.setItem('votingToken', token); // Store the token in localStorage
        } else {
          console.error("No voting token found for this account");
        }
      }).catch(function(err) {
        console.error("Error obtaining voting token:", err.message);
      });
    }).catch(function(err) {
      console.error("ERROR! " + err.message);
    });
  },

  registerVoter: function() {
    VotingContract.deployed().then(function(instance) {
      instance.generateVotingToken().then(function(token) {
        localStorage.setItem('votingToken', token);
        instance.registerVoter(token).then(function() {
          console.log("Voter registered with token:", token);
        }).catch(function(err) {
          console.error("Error registering voter:", err.message);
        });
      }).catch(function(err) {
        console.error("Error generating voting token:", err.message);
      });
    }).catch(function(err) {
      console.error("ERROR! " + err.message);
    });
  },

  vote: function() {
    if (!App.verifyVotingToken()) {
      $("#msg").html("<p>Invalid or missing voting token. Please login again.</p>");
      return;
    }

    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $("#msg").html("<p>Please vote for a candidate.</p>");
      return;
    }

    const votingToken = localStorage.getItem('votingToken');

    VotingContract.deployed().then(function(instance) {
      // Call the vote function with the stored voting token
      instance.vote(parseInt(candidateID), votingToken).then(function(result) {
        $("#voteButton").attr("disabled", true);
        $("#msg").html("<p>Voted</p>");
        window.location.reload(1);
      }).catch(function(err) {
        console.error("Vote transaction error:", err.message);
        console.error("Vote transaction error data:", err.data);
      });
    }).catch(function(err) {
      console.error("Vote transaction error:", err.message);
      console.error("Vote transaction error data:", err.data);
    });
  }
};

document.addEventListener("DOMContentLoaded", function() {
  // Event listener for the reset button
  const resetButton = document.getElementById("resetButton");
  if (resetButton) {
    resetButton.onclick = function() {
      resetVoting();
    };
  }

  const goToCountryConfig = document.getElementById("goToCountryConfig");
  if (goToCountryConfig) {
    goToCountryConfig.onclick = function() {
      window.location.replace(`http://192.168.1.6:8080/countryconfig.html?Authorization=Bearer ${localStorage.getItem('jwtTokenAdmin')}`);
    };
  }

  // Event listener for the getToken button
  const getTokenButton = document.getElementById("getTokenButton");
  if (getTokenButton) {
    getTokenButton.onclick = function() {
      App.getToken();
    };
  }

  // Event listener for the registerVoter button
  const registerVoterButton = document.getElementById("registerVoterButton");
  if (registerVoterButton) {
    registerVoterButton.onclick = function() {
      App.registerVoter();
    };
  }

  window.App.eventStart();
});

function resetVoting() {
  if (!window.ethereum) {
    console.error("MetaMask or compatible wallet not detected");
    return;
  }

  window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(accounts) {
    var defaultAccount = accounts[0]; // Assuming the first account is the default
    if (!defaultAccount) {
      console.error("No accounts found");
      return;
    }

    VotingContract.deployed().then(function(instance) {
      // Call resetVoting function with the sender's address
      instance.resetVoting({ from: defaultAccount }).then(function(result) {
        console.log("Voting reset successfully");
      }).catch(function(error) {
        console.error("Failed to reset voting:", error);
      });
    }).catch(function(err) {
      console.error("Error deploying contract:", err);
    });
  }).catch(function(error) {
    console.error("Failed to request accounts:", error);
  });
}
