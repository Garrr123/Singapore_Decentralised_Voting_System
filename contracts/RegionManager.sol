// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VoterContract.sol";
import "./BaseFactory.sol";

contract RegionManager is BaseFactory {
    // Function to get voting details by region
    function getVotingDetailsByRegion(string memory region) public view returns (
        address votingContractAddress, 
        string memory regionName, 
        uint minVotingAge, 
        uint maxVoters, 
        uint256 votingDate, 
        uint256 votingStartTime, 
        uint256 votingEndTime
    ) {
        votingContractAddress = regionToContract[region];
        require(votingContractAddress != address(0), "Region not found");
        VoterContract votingContract = VoterContract(votingContractAddress);
        return (
            votingContractAddress, 
            votingContract.region(), 
            votingContract.minVotingAge(), 
            votingContract.maxVoters(), 
            votingContract.votingDate(), 
            votingContract.votingStartTime(), 
            votingContract.votingEndTime()
        );
    }

    // Function to check if a voting contract is a GRC
    function isVotingContractGRC(string memory region) public view returns (bool) {
        address votingContractAddress = regionToContract[region];
        require(votingContractAddress != address(0), "Region not found");

        VoterContract votingContract = VoterContract(votingContractAddress);
        return votingContract.isGRC();
    }
}
