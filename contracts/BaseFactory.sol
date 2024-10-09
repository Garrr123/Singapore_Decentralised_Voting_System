// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BaseFactory {
    mapping(address => string) public votingContractRegions;
    mapping(string => address) public regionToContract;
    mapping(bytes32 => address) public tokenToContract;
    address[] public deployedVotingContracts;
    bytes32[] public tokenKeys;
    string[] public regions;

    function getVotingContractByRegion(string memory region) public view returns (address) {
        return regionToContract[region];
    }
}
