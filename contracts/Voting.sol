pragma solidity ^0.5.15;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    mapping (uint => Candidate) public candidates;
    mapping (address => bool) public voters;
    address public owner;
    bool public votingReset;

    uint public countCandidates;
    uint256 public votingEnd;
    uint256 public votingStart;

    constructor() public {
        owner = msg.sender;
    }

    function addCandidate(string memory name, string memory party) public returns(uint) {
        require(msg.sender == owner, "Only the owner can add candidates");
        countCandidates++;
        candidates[countCandidates] = Candidate(countCandidates, name, party, 0);
        return countCandidates;
    }

    function vote(uint candidateID) public {
        require((votingStart <= now) && (votingEnd > now), "Voting is not active");
        require(candidateID > 0 && candidateID <= countCandidates, "Invalid candidate ID");
        require(!voters[msg.sender], "You have already voted");
        voters[msg.sender] = true;
        candidates[candidateID].voteCount++;
    }

    function checkVote() public view returns(bool){
        return voters[msg.sender];
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
            voters[address(i)] = false;
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
