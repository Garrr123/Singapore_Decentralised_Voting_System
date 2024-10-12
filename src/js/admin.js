const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../build/contracts/VoterContract.json');
const VotingContract = contract(votingArtifacts);
const votingFactoryArtifacts = require('../../build/contracts/VotingFactory.json');
const VotingFactoryContract = contract(votingFactoryArtifacts);
require('dotenv').config();


var networkAddress = process.env.ADDRESS;

if (!networkAddress) {
  networkAddress = "172.20.10.3"
}

window.Admin = {
  init: async function () {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' }).then(async function (accounts) {
        if (accounts.length === 0) {
          console.error("No accounts found");
          return;
        }
        Admin.account = accounts[0];

        const web3 = new Web3(window.ethereum);
        VotingFactoryContract.setProvider(web3.currentProvider);
        VotingContract.setProvider(web3.currentProvider);
        VotingFactoryContract.defaults({ from: accounts[0], gas: 6654755 });
        VotingContract.defaults({ from: accounts[0], gas: 6654755 });


        Admin.web3 = web3;
        Admin.factoryInstance = await VotingFactoryContract.deployed();
        console.log("VotingFactory Contract Address:", Admin.factoryInstance.address);

        // Check if Admin.account is the owner
        const ownerAddress = await Admin.factoryInstance.owner();
        console.log("Owner Address:", ownerAddress);
        console.log("Admin Account:", Admin.account);


        document.getElementById('region').addEventListener('change', Admin.handleRegionChange);
        document.getElementById('retrieveTeams').addEventListener('click', Admin.retrieveTeams); // For retrieving teams
        document.getElementById('addSelectedTeams').addEventListener('click', Admin.addSelectedTeams); // For adding selected teams
        document.getElementById('getCandidates').addEventListener('click', Admin.retrieveCandidates); // New handler to retrieve candidates
        document.getElementById('addSelectedCandidates').addEventListener('click', Admin.addSelectedCandidates); // Add selected candidates

        document.getElementById('getWinningCandidatesButton').addEventListener('click', Admin.getWinningCandidates);
        document.getElementById('endVotingButton').addEventListener('click', Admin.endVotingForAllRegions);


        // Fetch regions and populate the dropdowns
        await Admin.fetchAllRegions();

      }).catch(function (error) {
        console.error("Failed to request accounts:", error);
      });
    } catch (error) {
      console.error("Initialization failed:", error);
    }
  },

  fetchAllRegions: async function () {
    try {
      console.log("VotingFactory Contract Address when correct 1:", Admin.factoryInstance.address);

      const regions = await Admin.factoryInstance.getAllRegions();
      Admin.populateRegionDropdown(regions);
      if (regions.length > 0) {
        Admin.handleRegionChange(); // Trigger the first region to load initially
      }
    } catch (error) {
      console.error("Failed to fetch regions:", error);
    }
  },

  populateRegionDropdown: function (regions) {
    const regionSelect = document.getElementById('region');
    regionSelect.innerHTML = ''; 
    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.text = region;
      regionSelect.add(option);
    });
    
  },

  retrieveTeams: async function () {
    const teamCheckboxes = document.getElementById('teamCheckboxes');
    teamCheckboxes.innerHTML = ''; // Clear previous checkboxes

    // Get the selected region from the dropdown
    const selectedRegion = document.getElementById('region').value;

    try {
        console.log("Regions populated:", selectedRegion);
        const response = await fetch(`http://${networkAddress}:8000/teams?region_name=${selectedRegion}`);
        const teams = await response.json();

        // Populate checkboxes with team names and IDs
        teams.forEach(team => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = team.id; // Keep the value as team ID
            checkbox.setAttribute('data-name', team.name); // Store the team name in a data attribute
            checkbox.id = `team-${team.id}`;

            const label = document.createElement('label');
            label.htmlFor = `team-${team.id}`;
            label.textContent = team.name; // Display the team name

            const div = document.createElement('div');
            div.appendChild(checkbox);
            div.appendChild(label);

            teamCheckboxes.appendChild(div);
        });

        document.getElementById('teamForm').style.display = 'block';
    } catch (err) {
        console.error("Failed to retrieve teams:", err);
    }
},

  retrieveCandidates: async function () {
    const selectedRegion = document.getElementById('region').value;
    const selectedTeam = document.getElementById('team').value;

    const region = document.getElementById('region').value;
    console.log("VotingFactory Contract Address when correct 2:", Admin.factoryInstance.address);

    const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(region);
    const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

    console.log(`Fetched contract address for region ${region}:`, selectedRegion);
    // Check if the region is GRC or SMC
    const isGRC = await contractInstance.methods.isGRC().call();
    let apiUrl;

    // If it's GRC, we also need the team, otherwise, we don't.
    if (isGRC) {
        if (!selectedRegion || !selectedTeam) {
            alert('Please select both a region and a team.');
            return;
        }
        apiUrl = `http://${networkAddress}:8000/grccandidates?region_name=${selectedRegion}&team_name=${selectedTeam}`;
    } else {
        if (!selectedRegion) {
            alert('Please select a region.');
            return;
        }
        apiUrl = `http://${networkAddress}:8000/smccandidates?region_name=${selectedRegion}`;
    }
    console.log("2")
    try {
        const response = await fetch(apiUrl);
        const candidates = await response.json();
        console.log("this is " , candidates);

        const candidateCheckboxes = document.getElementById('candidateCheckboxes');
        candidateCheckboxes.innerHTML = ''; // Clear previous checkboxes

        if (candidates.length === 0) {
          candidateCheckboxes.innerHTML = '<p>No candidates found for the selected region and team.</p>';
      } else {
          candidates.forEach(candidate => {
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
      
              // Check if the candidate has "candidate_name" (for SMC) or "name" (for GRC)
              const candidateName = candidate.candidate_name || candidate.name;  // Use candidate_name for SMC, name for GRC
              const partyName = candidate.party_name || candidate.party;  // Use party_name for SMC, party for GRC
      
              checkbox.value = candidateName;  // Store candidate's name
              checkbox.setAttribute('data-party', partyName);  // Store party as a data attribute
              checkbox.id = `candidate-${candidate.id}`;
      
              const label = document.createElement('label');
              label.htmlFor = `candidate-${candidate.id}`;
              label.textContent = `Candidate: ${candidateName}, Party: ${partyName}`;  // Display the candidate name and party
      
              const div = document.createElement('div');
              div.appendChild(checkbox);
              div.appendChild(label);
      
              candidateCheckboxes.appendChild(div);
          });
      
          document.getElementById('candidateForm').style.display = 'block';
      }
      

    } catch (err) {
        console.error("Failed to retrieve candidates:", err);
    }
},

addSelectedCandidates: async function () {
  const selectedCandidateNames = [];
  const selectedCandidateParties = [];

  // Collect selected candidates from checkboxes
  document.querySelectorAll('#candidateCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
    selectedCandidateNames.push(checkbox.value);
    selectedCandidateParties.push(checkbox.getAttribute('data-party'));
  });

  if (selectedCandidateNames.length === 0) {
    alert('Please select at least one candidate.');
    return;
  }
  console.log("VotingFactory Contract Address when correct 3:", Admin.factoryInstance.address);

  const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(document.getElementById('region').value);
  const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

  const isGRC = await contractInstance.methods.isGRC().call();

  try {
    if (isGRC) {
      // For GRC, add candidates to a specific team
      const teamId = document.getElementById('team').value;
      if (!teamId) {
        alert('Please select a team.');
        return;
      }

      const existingCandidates = await Admin.checkExistingCandidates(contractInstance, teamId, selectedCandidateNames);
      if (existingCandidates.length > 0) {
        alert(`The following candidates are already added: ${existingCandidates.join(', ')}`);
        return;
      }

      await contractInstance.methods.addCandidatesToTeam(teamId, selectedCandidateNames).send({ from: Admin.account });
      alert('Selected candidates added to the team successfully');
    } else {
      // For SMC, ensure both arrays are passed to addCandidatesSMC
      const existingCandidates = await Admin.checkExistingCandidatesSMC(contractInstance, selectedCandidateNames);
      if (existingCandidates.length > 0) {
        alert(`The following candidates are already added: ${existingCandidates.join(', ')}`);
        return;
      }

      // Pass both candidate names and parties arrays as parameters
      await contractInstance.methods.addCandidatesSMC(selectedCandidateNames, selectedCandidateParties).send({ from: Admin.account });
      alert('Selected candidates added successfully for SMC');
    }

    Admin.updateDashboard(document.getElementById('region').value);
  } catch (err) {
    console.error("Error adding selected candidates:", err.message);
  }
},

  handleRegionChange: async function () {
    const region = document.getElementById('region').value;
    const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(region);
    const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

    const isGRC = await contractInstance.methods.isGRC().call();
    Admin.toggleForms(isGRC);

    Admin.updateDashboard(region);

    if (isGRC) {
      Admin.fetchTeams(contractInstance);
    }
  },

  toggleForms: function (isGRC) {
    document.querySelector('.add-candidate').style.display = 'block';
    document.querySelector('#teamSelector').style.display = isGRC ? 'block' : 'none';

    const retrieveTeamsSection = document.querySelector('.retrieve-teams');
    if (isGRC) {
        retrieveTeamsSection.style.display = 'block';  // Show button for GRC
    } else {
        retrieveTeamsSection.style.display = 'none';  // Hide button for non-GRC
    }
  },

  fetchTeams: async function () {
    const region = document.getElementById('region').value;
    const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(region);
    const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

    const teamSelect = document.getElementById('team'); // Dropdown for candidate form
    teamSelect.innerHTML = ''; // Clear previous options

    try {
        const countTeams = await contractInstance.methods.countTeams().call(); // Get the number of teams in the contract

        if (countTeams === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.text = 'No teams available';
            teamSelect.add(defaultOption);
            return;
        }

        for (let t = 1; t <= countTeams; t++) {
            const team = await contractInstance.methods.teams(t).call(); // Fetch each team by its index
            const teamName = team.name;  // Use team name here
            const option = document.createElement('option');
            option.value = t;  // Keep the value as the team ID
            option.text = teamName;  // Display the team name
            teamSelect.add(option);
        }

        // Show the team selector dropdown (assuming it's hidden by default)
        document.getElementById('teamSelector').style.display = 'block';

    } catch (err) {
        console.error("Failed to fetch teams from the smart contract:", err);
    }
},

addSelectedTeams: async function () {
  const selectedTeamNames = [];

  // Collect selected teams from checkboxes (use team name instead of team ID)
  document.querySelectorAll('#teamCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
      selectedTeamNames.push(checkbox.getAttribute('data-name')); // Collect the team name
  });

  if (selectedTeamNames.length === 0) {
      alert('Please select at least one team.');
      return;
  }

  const region = document.getElementById('region').value;
  const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(region);
  const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

  try {
      // Assuming there is a function in the contract to add multiple teams by name
      await contractInstance.methods.addTeams(selectedTeamNames).send({ from: Admin.account });
      alert('Selected teams added successfully');
      Admin.updateDashboard(region);
  } catch (err) {
      console.error("Error adding selected teams:", err.message);
  }
},

  // Check for existing candidates in GRC (for a specific team)
  checkExistingCandidates: function (contractInstance, teamId, selectedCandidateNames) {
    return new Promise(async function (resolve, reject) {
      const existingCandidates = [];
      try {
        const candidateCount = await contractInstance.methods.getTeamCandidateCount(teamId).call();
        const promises = [];

        for (let i = 1; i <= candidateCount; i++) {
          promises.push(contractInstance.methods.getTeamCandidate(teamId, i).call().then(candidate => {
            if (selectedCandidateNames.includes(candidate[1])) {
              existingCandidates.push(candidate[1]);
            }
          }));
        }

        await Promise.all(promises);
        resolve(existingCandidates);
      } catch (error) {
        console.error("Error checking existing candidates:", error);
        reject(error);
      }
    });
  },

  // Check for existing candidates in SMC
  checkExistingCandidatesSMC: function (contractInstance, selectedCandidateNames) {
    return new Promise(async function (resolve, reject) {
      const existingCandidates = [];
      try {
        const candidateCount = await contractInstance.methods.getCandidateCount().call();
        const promises = [];

        for (let i = 1; i <= candidateCount; i++) {
          promises.push(contractInstance.methods.getCandidate(i).call().then(candidate => {
            if (selectedCandidateNames.includes(candidate[1])) {
              existingCandidates.push(candidate[1]);
            }
          }));
        }

        await Promise.all(promises);
        resolve(existingCandidates);
      } catch (error) {
        console.error("Error checking existing candidates in SMC:", error);
        reject(error);
      }
    });
  },

  endVotingForAllRegions: async function () {
    try {
      // Print the address of the VotingFactory contract
      console.log("VotingFactory Contract Address:", Admin.factoryInstance.address);
  
      // Attempt to end voting for all regions
      await Admin.factoryInstance.endVotingProcessForAllRegions();
      alert("Voting ended for all regions.");
    } catch (error) {
      console.error("Failed to end voting for all regions:", error);
      alert("Failed to end voting for all regions. Check console for details.");
    }
  },

// Function to get and display winning candidates for each region
getWinningCandidates: async function () {
  try {
    const winningCandidates = await Admin.factoryInstance.getWinningCandidates();
    Admin.renderWinningCandidates(winningCandidates);
  } catch (error) {
    console.error("Failed to retrieve winning candidates:", error);
  }
},

// Render function for displaying winning candidates
renderWinningCandidates: function (winningCandidates) {
  const winningCandidatesContainer = document.getElementById("winningCandidatesContainer");
  winningCandidatesContainer.innerHTML = ""; // Clear previous results

  winningCandidates.forEach((winner, index) => {
    const winnerDiv = document.createElement("div");
    winnerDiv.innerHTML = `<strong>Region ${index + 1}:</strong> ${winner}`;
    winningCandidatesContainer.appendChild(winnerDiv);
  });
},

  updateDashboard: async function (region) {
    try {
      const votingContractAddress = await Admin.factoryInstance.getVotingContractByRegion(region);
      const contractInstance = new Admin.web3.eth.Contract(VotingContract.abi, votingContractAddress);

      const isGRC = await contractInstance.methods.isGRC().call();
      let dashboardContent = "<table class='table table-bordered'><thead><tr><th>Name</th><th>Votes</th></tr></thead><tbody>";

      if (isGRC) {
        const countTeams = await contractInstance.methods.countTeams().call();
        for (let t = 1; t <= countTeams; t++) {
          const team = await contractInstance.methods.teams(t).call();
          dashboardContent += `<tr><td>${team.name}</td><td>${team.voteCount}</td></tr>`;
        }
      } else {
        const countCandidates = await contractInstance.methods.getCandidateCount().call();
        dashboardContent = "<table class='table table-bordered'><thead><tr><th>Name</th><th>Party</th><th>Votes</th></tr></thead><tbody>";
        
        for (let i = 1; i <= countCandidates; i++) {
          const candidate = await contractInstance.methods.getCandidate(i).call();
          dashboardContent += `<tr><td>${candidate[1]}</td><td>${candidate[2]}</td><td>${candidate[3]}</td></tr>`;
        }
      }

      dashboardContent += "</tbody></table>";
      document.getElementById('dashboardContent').innerHTML = dashboardContent;
    } catch (err) {
      console.error(`Error updating dashboard for region ${region}:`, err.message, err);
    }
  }

};

document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem('jwtTokenAdmin');
  if (!token) {
    window.location.replace('/');
  } else {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${token}`);
    fetch('/admin.html', { headers: headers })
      .then(response => {
        if (!response.ok) {
          window.location.replace('/');
        } else {
          window.Admin.init();
        }
      })
      .catch(error => {
        console.error('Authorization failed:', error);
        window.location.replace('/');
      });
  }
});
