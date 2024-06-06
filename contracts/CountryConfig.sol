pragma solidity ^0.5.15;

contract CountryConfiguration {
    address public owner; // Declare a variable to store the contract owner's address
    
    constructor() public {
        owner = msg.sender; // Assign the deployer's address as the owner
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    struct RegionConfig {
        uint256 regionId;
        string name;
        uint256 votingStart;
        uint256 votingEnd;
        uint256 minVotingAge;
        uint256 maxCandidates;
        uint256 maxVotesPerVoter;
    }

    struct Area {
        string name;
        uint256 participantCount;
        mapping(address => bool) participants;
        mapping(uint256 => RegionConfig) regionConfigs;
        uint256 regionCount;
    }

    struct Country {
        string name;
        uint areaCount;
        mapping(uint => Area) areas;
    }

    mapping(uint => Country) public countries;
    uint public countryCount;

    function addCountry(string memory name) public {
        countryCount++;
        countries[countryCount] = Country(name, 0);
    }

    function addArea(uint countryID, string memory areaName) public {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        Country storage country = countries[countryID];
        country.areaCount++;
        country.areas[country.areaCount] = Area(areaName, 0, 0);
    }

    function addParticipant(uint countryID, uint areaID, address participant) public {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        require(areaID > 0 && areaID <= countries[countryID].areaCount, "Invalid area ID");
        Country storage country = countries[countryID];
        Area storage area = country.areas[areaID];
        require(!area.participants[participant], "Participant already exists in the area");
        area.participantCount++;
        area.participants[participant] = true;
    }

    function addRegionConfig(uint countryID, uint areaID, string memory name, uint256 start, uint256 end, uint256 minAge, uint256 maxCand, uint256 maxVotes) public {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        require(areaID > 0 && areaID <= countries[countryID].areaCount, "Invalid area ID");
        Country storage country = countries[countryID];
        Area storage area = country.areas[areaID];
        area.regionCount++;
        area.regionConfigs[area.regionCount] = RegionConfig(area.regionCount, name, start, end, minAge, maxCand, maxVotes);
    }

    function getParticipantCount(uint countryID, uint areaID) public view returns (uint) {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        require(areaID > 0 && areaID <= countries[countryID].areaCount, "Invalid area ID");
        return countries[countryID].areas[areaID].participantCount;
    }

    function isParticipant(uint countryID, uint areaID, address participant) public view returns (bool) {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        require(areaID > 0 && areaID <= countries[countryID].areaCount, "Invalid area ID");
        return countries[countryID].areas[areaID].participants[participant];
    }

    function getRegionConfig(uint countryID, uint areaID, uint regionID) public view returns (
        uint256,
        string memory,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    ) {
        require(countryID > 0 && countryID <= countryCount, "Invalid country ID");
        require(areaID > 0 && areaID <= countries[countryID].areaCount, "Invalid area ID");
        Area storage area = countries[countryID].areas[areaID];
        require(regionID > 0 && regionID <= area.regionCount, "Invalid region ID");
        RegionConfig storage regionConfig = area.regionConfigs[regionID];
        return (
            regionConfig.regionId,
            regionConfig.name,
            regionConfig.votingStart,
            regionConfig.votingEnd,
            regionConfig.minVotingAge,
            regionConfig.maxCandidates,
            regionConfig.maxVotesPerVoter
        );
    }
    function destroy() public onlyOwner {
        // Ensure only the owner can call this function
        // Perform any cleanup or transfer any remaining ether
        selfdestruct(msg.sender); // Self-destruct the contract and transfer any remaining ether to the contract owner
    }
}
