var Voting = artifacts.require("Voting.sol")
var CountryConfig = artifacts.require("CountryConfiguration")

module.exports = function(deployer) {
  deployer.deploy(Voting)
  deployer.deploy(CountryConfig)
}
