// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VoterContract.sol";
import "./BaseFactory.sol";

contract VotingFactory is BaseFactory {

    struct TokenToContract {
        bytes32 token;
        address contractAddress;
    }

    event VotingContractDeployed(address votingContractAddress, string region);
    event TokenToContractUpdated(bytes32 votingToken, address contractAddress);

    function createVotingContract(
        string memory region, 
        bool isGRC, 
        uint256 votingDate, 
        uint256 votingStartTime, 
        uint256 votingEndTime, 
        uint minVotingAge, 
        uint maxVoters
    ) 
        public 
    {
        VoterContract newVotingContract = new VoterContract(
            msg.sender, 
            region, 
            isGRC, 
            votingDate, 
            votingStartTime, 
            votingEndTime, 
            minVotingAge, 
            maxVoters
        );
        address votingContractAddress = address(newVotingContract);
        deployedVotingContracts.push(votingContractAddress);
        votingContractRegions[votingContractAddress] = region;
        regionToContract[region] = votingContractAddress;
        regions.push(region);
        emit VotingContractDeployed(votingContractAddress, region);
    }

    function getDeployedVotingContracts() public view returns (address[] memory) {
        return deployedVotingContracts;
    }

    function getAllTokenToContractMappings() public view returns (TokenToContract[] memory) {
        uint length = tokenKeys.length;
        TokenToContract[] memory mappings = new TokenToContract[](length);

        for (uint i = 0; i < length; i++) {
            bytes32 token = tokenKeys[i];
            mappings[i] = TokenToContract({token: token, contractAddress: tokenToContract[token]});
        }

        return mappings;
    }

    function getVotingContractByToken(bytes32 votingToken) public view returns (address) {
        return tokenToContract[votingToken];
    }

    function getAllRegions() public view returns (string[] memory) {
        return regions;
    }

    function updateTokenToContract(bytes32 votingToken, address contractAddress) public {
        tokenToContract[votingToken] = contractAddress;
        tokenKeys.push(votingToken);
        emit TokenToContractUpdated(votingToken, contractAddress); 
    }
}
