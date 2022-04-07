const { ethers } = require('ethers');

async function deployContract(contractName, signer) {
  let contractFactory = await hre.ethers.getContractFactory(contractName);
  contractFactory = contractFactory.connect(signer);

  const contract = await contractFactory.deploy();
  await contract.deployed();

  return contract.address;
}

async function main() {
  const provider = new ethers.providers.InfuraProvider('ropsten',
  {
    projectId: process.env.INFURA_PROJECT_ID,
    projectSecret: process.env.INFURA_PROJECT_SECRET
  });

  let signer = new ethers.Wallet(process.env.DEPLOYER_KEY);
  signer = signer.connect(provider);

  const nftswap = await deployContract('NftSwap', signer);
  const nft = await deployContract('DummyNFT', signer);

  console.log(`nftswap address: ${nftswap}`);
  console.log(`nft address: ${nft}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
