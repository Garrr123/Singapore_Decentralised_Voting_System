// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VoterContract {
    struct GRCCandidate {
        uint id;
        string name;
    }

    struct SMCCandidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Team {
        uint id;
        string name;
        uint voteCount;
        mapping(uint => GRCCandidate) candidates;
        uint candidateCount;
    }

    struct Voter {
        bool hasVoted;
        bytes32 votingToken;
        address account;
        string region;
    }

    mapping(uint => Team) public teams;
    mapping(uint => SMCCandidate) public candidates;
    mapping(address => Voter) public voters;
    mapping(bytes32 => address) public tokenToVoter;
    address public owner;
    string public region;
    bool public isGRC;
    uint public countTeams;
    uint public countCandidates;
    uint256 public votingDate;
    uint256 public votingStartTime;
    uint256 public votingEndTime;
    uint public minVotingAge;
    uint public maxVoters;
    bool public votingEnded;

    event VotingTokenGenerated(address indexed voter, bytes32 votingToken);
    event VoterRegistered(address indexed voter, bytes32 votingToken);
    event VotingTimeDebug(uint256 votingStartTime, uint256 votingEndTime, uint256 currentTime, uint256 votingDate);
    event VotingEnded(string region);
    event TeamsAdded(string[] teamNames);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier votingNotEnded() {
        require(!votingEnded, "Voting ended");
        _;
    }

    constructor(
        address creator,
        string memory _region,
        bool _isGRC,
        uint256 _votingDate,
        uint256 _votingStartTime,
        uint256 _votingEndTime,
        uint _minVotingAge,
        uint _maxVoters
    ) {
        owner = creator == address(0) ? msg.sender : creator;
        region = bytes(_region).length == 0 ? "default" : _region;
        isGRC = _isGRC;
        votingDate = _votingDate == 0 ? block.timestamp : _votingDate;
        votingStartTime = _votingStartTime;
        votingEndTime = _votingEndTime;
        minVotingAge = _minVotingAge == 0 ? 18 : _minVotingAge;
        maxVoters = _maxVoters == 0 ? 1000 : _maxVoters;
        votingEnded = false;
    }

    function registerVoter(address voterAccount, string memory voterRegion) public votingNotEnded {
        require(voters[voterAccount].votingToken == 0, "Voter already registered");
        voters[voterAccount] = Voter(false, 0, voterAccount, voterRegion);
        emit VoterRegistered(voterAccount, 0);
    }

    function generateVotingToken(address voterAccount) public votingNotEnded returns(bytes32) {
        require(voters[voterAccount].votingToken == 0, "Voting token already generated");
        bytes32 token = keccak256(abi.encodePacked(voterAccount, block.timestamp));
        voters[voterAccount].votingToken = token;
        tokenToVoter[token] = voterAccount;
        emit VotingTokenGenerated(voterAccount, token);
        return token;
    }

    function addTeams(string[] memory teamNames) public onlyOwner {
        require(isGRC, "Only GRC contracts can add teams");
        require(teamNames.length > 0, "Team names array cannot be empty");

        for (uint i = 0; i < teamNames.length; i++) {
            require(bytes(teamNames[i]).length > 0, "Team name cannot be empty");

            countTeams++;
            teams[countTeams].id = countTeams;
            teams[countTeams].name = teamNames[i];
            teams[countTeams].voteCount = 0;
            teams[countTeams].candidateCount = 0;
        }

        emit TeamsAdded(teamNames); 
    }

    function addCandidatesToTeam(uint teamID, string[] memory candidateNames) public onlyOwner votingNotEnded {
        require(isGRC, "Only GRC regions can add candidates to teams");
        require(teamID > 0 && teamID <= countTeams, "Invalid team ID");
        Team storage team = teams[teamID];

        for (uint i = 0; i < candidateNames.length; i++) {
            team.candidateCount++;
            team.candidates[team.candidateCount] = GRCCandidate(team.candidateCount, candidateNames[i]);
        }
    }

    function addCandidatesSMC(string[] memory candidateNames, string[] memory candidateParties) public onlyOwner votingNotEnded {
        require(!isGRC, "Only SMC regions can add individual candidates");
        require(candidateNames.length > 0 && candidateNames.length == candidateParties.length, "Candidate names and parties must be provided equally");

        for (uint i = 0; i < candidateNames.length; i++) {
            countCandidates++;
            candidates[countCandidates] = SMCCandidate(countCandidates, candidateNames[i], candidateParties[i], 0);
        }
    }

    function voteGRC(uint teamID, bytes32 votingToken) public votingNotEnded {
        require(isGRC, "Not GRC");
        //require(votingStartTime <= block.timestamp && votingEndTime > block.timestamp && isSameDay(block.timestamp, votingDate), "Voting time error");
        require(teamID > 0 && teamID <= countTeams, "Invalid team ID");
        require(!voters[msg.sender].hasVoted && voters[msg.sender].votingToken == votingToken, "Voter error");

        voters[msg.sender].hasVoted = true;
        teams[teamID].voteCount++;
    }

    function voteSMC(uint candidateID, bytes32 votingToken) public votingNotEnded {
        require(!isGRC, "Not SMC");
        require(votingStartTime <= block.timestamp && votingEndTime > block.timestamp && isSameDay(block.timestamp, votingDate), "Voting time error");
        require(candidateID > 0 && candidateID <= countCandidates, "Invalid candidate ID");
        require(!voters[msg.sender].hasVoted && voters[msg.sender].votingToken == votingToken, "Voter error");

        voters[msg.sender].hasVoted = true;
        candidates[candidateID].voteCount++;
    }

    function isSameDay(uint256 time1, uint256 time2) public pure returns (bool) {
        return (time1 / 86400 == time2 / 86400);
    }

    function getCurrentTime() public view returns (uint, uint) {
        return (block.timestamp, votingDate);
    }

    function setVotingTimes(uint256 _votingDate, uint256 _startTime, uint256 _endTime) public onlyOwner {
        require(_endTime > _startTime, "Invalid time range");
        votingDate = _votingDate;
        votingStartTime = _startTime;
        votingEndTime = _endTime;
    }

    function getVotingTimes() public view returns (uint256, uint256, uint256) {
        return (votingDate, votingStartTime, votingEndTime);
    }

    function getCandidate(uint candidateID) public view returns (uint, string memory, string memory, uint, string memory) {
        if (isGRC) {
            for (uint t = 1; t <= countTeams; t++) {
                Team storage team = teams[t];
                if (candidateID > 0 && candidateID <= team.candidateCount) {
                    GRCCandidate storage candidate = team.candidates[candidateID];
                    return (candidate.id, candidate.name, "", 0, team.name);
                }
            }
            revert("Candidate not found");
        } else {
            require(candidateID > 0 && candidateID <= countCandidates, "Invalid candidate ID");
            SMCCandidate storage candidate = candidates[candidateID];
            return (candidate.id, candidate.name, candidate.party, candidate.voteCount, "");
        }
    }

    function getTeamCandidate(uint teamID, uint candidateID) public view returns (uint, string memory) {
        require(teamID > 0 && teamID <= countTeams, "Invalid team ID");
        require(candidateID > 0 && candidateID <= teams[teamID].candidateCount, "Invalid candidate ID");

        GRCCandidate storage candidate = teams[teamID].candidates[candidateID];
        return (candidate.id, candidate.name);
    }

    function getTeamCandidateCount(uint teamID) public view returns (uint) {
        require(teamID > 0 && teamID <= countTeams, "Invalid team ID");
        return teams[teamID].candidateCount;
    }

    function getResultsGRC(uint teamID) public view returns (uint[] memory, string[] memory) {
        require(votingEnded && isGRC, "Results error");
        Team storage team = teams[teamID];
        uint[] memory ids = new uint[](team.candidateCount);
        string[] memory names = new string[](team.candidateCount);

        for (uint i = 1; i <= team.candidateCount; i++) {
            GRCCandidate storage candidate = team.candidates[i];
            ids[i-1] = candidate.id;
            names[i-1] = candidate.name;
        }
        return (ids, names);
    }

    function getResultsSMC() public view returns (uint[] memory, string[] memory, string[] memory, uint[] memory) {
        require(votingEnded && !isGRC, "Results error");
        uint[] memory ids = new uint[](countCandidates);
        string[] memory names = new string[](countCandidates);
        string[] memory parties = new string[](countCandidates);
        uint[] memory voteCounts = new uint[](countCandidates);

        for (uint i = 1; i <= countCandidates; i++) {
            SMCCandidate storage candidate = candidates[i];
            ids[i-1] = candidate.id;
            names[i-1] = candidate.name;
            parties[i-1] = candidate.party;
            voteCounts[i-1] = candidate.voteCount;
        }
        return (ids, names, parties, voteCounts);
    }

    function endVoting() public onlyOwner {
        votingEnded = true;
        emit VotingEnded(region);
    }

    function checkVotingStatus() public view returns (bool) {
        return votingEnded;
    }

    function checkVote(address voterAccount) public view returns (bool) {
        return voters[voterAccount].hasVoted;
    }

    function getRegionByToken(bytes32 votingToken) public view returns (string memory) {
        address voterAccount = tokenToVoter[votingToken];
        require(voterAccount != address(0), "Token not found");
        return voters[voterAccount].region;
    }

    function getCandidateCount() public view returns (uint) {
        if (isGRC) {
            uint totalCandidates = 0;
            for (uint t = 1; t <= countTeams; t++) {
                totalCandidates += teams[t].candidateCount;
            }
            return totalCandidates;
        } else {
            return countCandidates;
        }
    }
}
