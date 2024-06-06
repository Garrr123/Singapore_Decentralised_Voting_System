const Web3 = require('web3');
const contract = require('@truffle/contract');

const countryConfigArtifacts = require('../../build/contracts/CountryConfiguration.json');
const CountryConfigContract = contract(countryConfigArtifacts);

window.App = {
  eventStart: function() {
    // Request accounts from Metamask
    window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(accounts) {
      if (accounts.length === 0) {
        console.error("No accounts found");
        return;
      }
      // Set the provider for CountryConfigContract
      CountryConfigContract.setProvider(window.ethereum);
      // Set the default account for transactions
      CountryConfigContract.defaults({ from: accounts[0], gas: 6654755 });

      // Load account data
      App.account = accounts[0];
      $("#accountAddress").html("Your Account: " + accounts[0]);

      $(document).ready(function(){
        $('#addCountryConfig').click(function() {
          var countryName = $('#countryName').val();
          var areaName = $('#areaName').val();
          var regionName = $('#regionName').val();
          var votingStart = new Date($('#votingStart').val()).getTime() / 1000;
          var votingEnd = new Date($('#votingEnd').val()).getTime() / 1000;
          var minVotingAge = parseInt($('#minVotingAge').val());
          var maxCandidates = parseInt($('#maxCandidates').val());
          var maxVotesPerVoter = parseInt($('#maxVotesPerVoter').val());
          var regionVotingStart = new Date($('#regionVotingStart').val()).getTime() / 1000;
          var regionVotingEnd = new Date($('#regionVotingEnd').val()).getTime() / 1000;
          var regionMinVotingAge = parseInt($('#regionMinVotingAge').val());
          var regionMaxCandidates = parseInt($('#regionMaxCandidates').val());
          var regionMaxVotesPerVoter = parseInt($('#regionMaxVotesPerVoter').val());

          // Create a struct object with all parameters
          var countryData = {
            name: countryName,
            areaName: areaName,
            regionName: regionName,
            votingStart: votingStart,
            votingEnd: votingEnd,
            minVotingAge: minVotingAge,
            maxCandidates: maxCandidates,
            maxVotesPerVoter: maxVotesPerVoter,
            regionVotingStart: regionVotingStart,
            regionVotingEnd: regionVotingEnd,
            regionMinVotingAge: regionMinVotingAge,
            regionMaxCandidates: regionMaxCandidates,
            regionMaxVotesPerVoter: regionMaxVotesPerVoter
          };

          CountryConfigContract.deployed().then(function(instance){
            instance.addCountry(countryData, { from: App.account }).then(function(result){
              console.log("Country configuration added successfully");
            }).catch(function(err){
              console.error("ERROR! " + err.message)
            });
          }).catch(function(error) {
            console.error("Failed to request accounts:", error);
          });
        });
      });
    });
  }
};

window.addEventListener("load", function() {
  if (typeof web3 !== "undefined") {
    console.warn("Using web3 detected from external source like Metamask");
    window.eth = new Web3(window.ethereum);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:9545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for deployment. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    window.eth = new Web3(new Web3.providers.HttpProvider("http://192.168.1.6:9545"));
  }

  window.App.eventStart();
});
