module.exports = {

  compilers: {
    solc: {
      version: "0.8.0",      // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
       optimizer: {
         enabled: true,      // Enable the optimizer
         runs: 200           // Optimize for how many times you intend to run the code
       }
     }
    }
  },
  migrations_directory: "./migrations",
  networks: {
    development: {
      host: "172.20.10.3",
      port: 7545,
      network_id: "*" 
    }
  }
}
