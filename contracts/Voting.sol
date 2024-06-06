pragma solidity ^0.5.15;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Voter {
        bool hasVoted;
        bytes32 votingToken;
        address account;
    }

    mapping (uint => Candidate) public candidates;
    mapping (address => Voter) public voters;
    address public owner;
    bool public votingReset;

    uint public countCandidates;
    uint256 public votingEnd;
    uint256 public votingStart;

    event VotingTokenGenerated(address indexed voter, bytes32 votingToken);

    constructor() public {
        owner = msg.sender;
    }

    function addCandidate(string memory name, string memory party) public returns(uint) {
        require(msg.sender == owner, "Only the owner can add candidates");
        countCandidates++;
        candidates[countCandidates] = Candidate(countCandidates, name, party, 0);
        return countCandidates;
    }

    function registerVoter(bytes32 votingToken, address voterAccount) public {
        require(voters[voterAccount].votingToken == 0, "Voter already registered");
        voters[voterAccount] = Voter(false, votingToken, voterAccount);
    }

    function vote(uint candidateID, bytes32 votingToken) public {
        require((votingStart <= now) && (votingEnd > now), "Voting is not active");
        require(candidateID > 0 && candidateID <= countCandidates, "Invalid candidate ID");
        require(!voters[msg.sender].hasVoted, "You have already voted");
        require(voters[msg.sender].votingToken == votingToken, "Invalid voting token");
        require(voters[msg.sender].account == msg.sender, "Unauthorized voter");
        voters[msg.sender].hasVoted = true;
        candidates[candidateID].voteCount++;
    }

    function checkVote() public view returns(bool) {
        return voters[msg.sender].hasVoted;
    }

    function generateVotingToken() public returns(bytes32) {
        require(voters[msg.sender].votingToken == 0, "Voting token already generated");
        bytes32 token = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        emit VotingTokenGenerated(msg.sender, token);
        return token;
    }

    function getCountCandidates() public view returns(uint) {
        return countCandidates;
    }

    function getCandidate(uint candidateID) public view returns (uint, string memory, string memory, uint) {
        return (candidateID, candidates[candidateID].name, candidates[candidateID].party, candidates[candidateID].voteCount);
    }

    function setDates(uint256 _startDate, uint256 _endDate) public onlyOwner {
        require((votingEnd == 0) && (votingStart == 0) && (_endDate > _startDate), "Invalid date range");
        votingEnd = _endDate;
        votingStart = _startDate;
    }

    function getDates() public view returns (uint256, uint256) {
        return (votingStart, votingEnd);
    }

    function resetVoting() public onlyOwner {
        require(!votingReset, "Voting has already been reset");
        
        // Reset all voters to false
        for (uint i = 1; i <= countCandidates; i++) {
            delete voters[address(i)];
        }
        
        // Reset voting dates
        votingStart = 0;
        votingEnd = 0;

        // Mark voting as reset
        votingReset = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    function unlockReset() public onlyOwner {
        require(votingReset, "Voting has not been reset yet");
        votingReset = false;
    }
}
