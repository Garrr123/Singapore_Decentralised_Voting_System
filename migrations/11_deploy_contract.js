var VotingFactory = artifacts.require("VotingFactory");
var VoterContract = artifacts.require("VoterContract");

module.exports = async function(deployer, network, accounts) {
  // Deploy the VotingFactory contract
  await deployer.deploy(VotingFactory);
  const votingFactoryInstance = await VotingFactory.deployed();

  
  const defaultRegion = "defaultRegion";
  const isGRC = true;  // Assuming this is a GRC, change to false if it's an SMC
  const votingDate = Math.floor(Date.now() / 1000);  // current time in seconds
  const votingStartTime = votingDate + (8 * 60 * 60);  // 8 AM (assuming start time is 8 AM)
  const votingEndTime = votingDate + (20 * 60 * 60);  // 8 PM (assuming end time is 8 PM)
  const minVotingAge = 18;
  const maxVoters = 1000;
  
  // Deploy the VoterContract with the isGRC flag
  await deployer.deploy(VoterContract, accounts[0],    
    votingFactoryInstance.address,  // VotingFactory's address as the factory
    defaultRegion, 
    isGRC,
    votingDate, 
    votingStartTime, 
    votingEndTime, 
    minVotingAge, 
    maxVoters);
};
