const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("dotenv").config();

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.4",
    optimizer: {
      enabled: true,
      runs: 1000,
    }
  },
  networks: {
    ropsten: {
      url: 'https://ropsten.infura.io/v3/f63d9cc7ac8c404aa9d17f0d30fe9146',
    },
    hardhat: {
      gas: 10_000_000,
      mining: {
        auto: true,
        interval: 100
      }
    }
  }
};

