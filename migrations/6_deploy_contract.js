var Voting = artifacts.require("Voting")
var CountryConfig = artifacts.require("CountryConfiguration")

module.exports = function(deployer) {
  deployer.deploy(Voting)
  deployer.deploy(CountryConfig)
}
