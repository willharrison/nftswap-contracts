const { expect, assert } = require("chai");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");

describe("DummyNFT", function() {
  it("works", async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]; // used as msg.sender
    this.bob = this.signers[1];

    const Dummy = await ethers.getContractFactory("DummyNFT");
    this.dummy = await Dummy.deploy();
    await this.dummy.deployed();

    // await this.dummy.mint();
    // this.dummyBob = await this.dummy.connect(this.bob);
    // await this.dummyBob.mint();

    // const ownerOf1 = await this.dummy.ownerOf(1);
    // const ownerOf2 = await this.dummy.ownerOf(2);

    // expect(this.alice.address).to.equal(ownerOf1);
    // expect(this.bob.address).to.equal(ownerOf2);
  });
});