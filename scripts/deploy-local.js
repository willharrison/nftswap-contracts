// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  const NftSwap = await hre.ethers.getContractFactory("NftSwap");
  this.swap = await NftSwap.deploy();
  await this.swap.deployed();

  const DummyNFT = await hre.ethers.getContractFactory("DummyNFT");
  this.nft = await DummyNFT.deploy();
  await this.nft.deployed();

  this.signers = await hre.ethers.getSigners();
  this.alice = this.signers[0]; // used as msg.sender
  this.bob = this.signers[1];

  this.swapBob = await this.swap.connect(this.bob);
  this.nftBob = await this.nft.connect(this.bob);

  // mint alice
  await this.nft.mint();
  await this.nft.mint();
  await this.nft.mint(); // 3 is not in the agreement between alice and bob

  // mint bob
  await this.nftBob.mint();

  console.log(`nftswap: ${swap.address}`);
  console.log(`dummynft: ${nft.address}`);

  // ---------------------------
  // setup for manual testing
  // ---------------------------

  // // approve swap participants
  // await this.swap.approve(this.bob.address);
  // await this.swapBob.approve(this.alice.address);

  // // create swap
  // await this.swap.create(
  //   [this.nft.address, this.nft.address, this.nft.address], [1, 2, 3],
  //   [this.nft.address], [4]
  // );

  // // approve nfts for nftswap
  // await this.nft.approve(this.swap.address, 1);
  // await this.nft.approve(this.swap.address, 2);
  // await this.nft.approve(this.swap.address, 3);
  // await this.nftBob.approve(this.swap.address, 4);

  // // deposit to nftswap
  // await this.swap.deposit(this.nft.address, 1);
  // await this.swap.deposit(this.nft.address, 2);
  // await this.swap.deposit(this.nft.address, 3);
  // await this.swapBob.deposit(this.nft.address, 4);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
