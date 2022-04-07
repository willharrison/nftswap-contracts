"use strict";

require("@nomiclabs/hardhat-ethers");

const { expect } = require("chai");
const {
  swapped,
  bothCanDeposit,
  bothCancelled } = require("./helpers/nftswap-test-helpers");

const oneHundredGwei = 100_000_000_000

describe("NftSwap", function() {
  beforeEach(async function() {
    this.largeGas = {
      gasLimit: 400_000
    };

    this.smallGas = {
      gasLimit: 200_000
    };

    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]; // used as msg.sender
    this.bob = this.signers[1];
    this.carol = this.signers[2];

    const NftSwap = await ethers.getContractFactory("NftSwap");
    this.swap = await NftSwap.deploy();
    await this.swap.deployed();

    // creating middlemanAlice just for test readability
    this.swapAlice = await this.swap.connect(this.alice);
    this.swapBob = await this.swap.connect(this.bob);
    this.swapCarol = await this.swap.connect(this.carol);

    const Dummy = await ethers.getContractFactory("DummyNFT");
    // deploy two instances of DummyNFT so that we have two
    // different NFTs to exchange
    this.nft1Alice = await Dummy.deploy();
    this.nft2Alice = await Dummy.deploy();
    this.nft3Alice = await Dummy.deploy();
    await this.nft1Alice.deployed();
    await this.nft2Alice.deployed();
    await this.nft3Alice.deployed();

    // mint both of the first for alice
    await this.nft1Alice.mint();
    await this.nft2Alice.mint();
    await this.nft3Alice.mint(); // 3 is not in the agreement between alice and bob

    this.nft1Bob = await this.nft1Alice.connect(this.bob);
    this.nft2Bob = await this.nft2Alice.connect(this.bob);

    // mint both of the second for bob
    await this.nft1Bob.mint();
    await this.nft2Bob.mint();

    this.nft1Carol = await this.nft1Alice.connect(this.carol);

    await this.nft1Carol.mint();
  });

  it("alice cannot approve herself", async function() {
    await expect(this.swapAlice.approve(this.alice.address, this.smallGas))
        .to.be.revertedWith("you cannot approve yourself");
  });

  it("alice cannot cancel when there is nothing to cancel", async function() {
    await expect(this.swapAlice.cancel(this.smallGas))
        .to.be.revertedWith("nothing to cancel");
  });

  describe("fees", function() {
    beforeEach(async function() {
      await this.swap.setFee(oneHundredGwei);
    });

    it("requires fee for approval", async function() {
      await expect(this.swapAlice.approve(this.bob.address, this.smallGas))
        .to.be.revertedWith("fee is required to approve target");
    });

    it("allows approval when fees sent", async function() {
      await this.swapAlice.approve(this.bob.address, {
        ...this.smallGas,
        value: oneHundredGwei
      })

      const alicesAgreement = await this.swapAlice.agreement(this.alice.address, this.smallGas);
      expect(this.bob.address).to.equal(alicesAgreement);
    });
  });

  describe("alice creates agreement with bob", function() {
    beforeEach(async function() {
      this.alicesNft = 1;
      this.bobsNft = 2;

      this.agreementArgsAlice = [
        [this.nft1Alice.address, this.nft2Alice.address], [this.alicesNft, this.alicesNft],
        [this.nft1Alice.address, this.nft2Alice.address], [this.bobsNft, this.bobsNft]
      ];

      this.agreementArgsBob = [
        [this.nft1Bob.address, this.nft2Bob.address], [this.alicesNft, this.alicesNft],
        [this.nft1Bob.address, this.nft2Bob.address], [this.bobsNft, this.bobsNft]
      ];

      await this.swapAlice.approve(this.bob.address);
      await this.swapBob.approve(this.alice.address);
      await this.swapAlice.create(...this.agreementArgsAlice, this.largeGas);
    });

    swapped(false, this.smallGas);
    bothCanDeposit(true, this.smallGas);
    bothCancelled(false, this.smallGas);

    it("alice and bob have the correct agreement set", async function() {
      const alicesAgreement = await this.swapAlice.agreement(this.alice.address, this.smallGas);
      const bobsAgreement = await this.swapBob.agreement(this.bob.address, this.smallGas);

      expect(this.bob.address).to.equal(alicesAgreement);
      expect(this.alice.address).to.equal(bobsAgreement);
    });

    it("alice cannot deposit nft3 because it is not in the agreement", async function() {
      await this.nft3Alice.approve(this.swap.address, this.alicesNft);
      await expect(
          this.swapAlice.deposit(this.nft3Alice.address, this.alicesNft, this.smallGas))
        .to.be.revertedWith("that nft is not under management");
    });

    describe("alice cancels", function() {
      beforeEach(async function() {
        await this.swapAlice.cancel(this.smallGas);
      });

      swapped(false, this.smallGas);
      bothCanDeposit(false, this.smallGas);

      it("agreement set to address 0", async function() {
        expect(await this.swapAlice.agreement(this.alice.address, this.smallGas))
          .to
          .equal(ethers.constants.AddressZero);
      });

      it("bob can see that it is cancelled", async function() {
        expect(
          await this.swapBob.agreement(this.alice.address, this.smallGas))
            .to.equal(ethers.constants.AddressZero);
      });

      it("alice cannot attempt to enter new agreement with bob", async function() {
        await expect(this.swapAlice.approve(this.bob.address))
          .to.be.reverted;
      });

      describe("bob also cancels agreement", async function() {
        beforeEach(async function() {
          await this.swapBob.cancel(this.smallGas);
        });

        it("alice and bob can create new agreement with each other", async function() {
          await this.swapAlice.approve(this.bob.address);
          await this.swapBob.approve(this.alice.address);
          await this.swapAlice.create(...this.agreementArgsAlice, this.largeGas);
        });
      });
    });

    describe("alice deposits nft2", async function() {
      beforeEach(async function() {
        await this.nft2Alice.approve(this.swap.address, this.alicesNft);
        await this.swapAlice.deposit(this.nft2Alice.address, this.alicesNft, this.smallGas);
      });

      it("returns the correct managed assets list", async function() {
        const managedAssets = await this.swapAlice['listManagedAssets()']();
        expect(managedAssets[0][0]).to.equal(ethers.constants.AddressZero);
        expect(parseInt(managedAssets[1][0]._hex, 16)).to.equal(0);
        expect(managedAssets[0][1]).to.equal(this.nft2Alice.address);
        expect(parseInt(managedAssets[1][1]._hex, 16)).to.equal(this.alicesNft);
      });
    });

    describe("alice deposits nft1", function() {
      beforeEach(async function() {
        await this.nft1Alice.approve(this.swap.address, this.alicesNft);
        await this.swapAlice.deposit(this.nft1Alice.address, this.alicesNft, this.smallGas);
      });

      it("returns the correct managed assets list", async function() {
        const managedAssets = await this.swapAlice['listManagedAssets()']();
        expect(managedAssets[0][0]).to.equal(this.nft1Alice.address);
        expect(parseInt(managedAssets[1][0]._hex, 16)).to.equal(this.alicesNft);
        expect(managedAssets[0][1]).to.equal(ethers.constants.AddressZero);
        expect(parseInt(managedAssets[1][1]._hex, 16)).to.equal(0);
      });

      swapped(false, this.smallGas);

      it("bob cannot withdraw alices nft1", async function() {
        await expect(this.swapBob.withdraw(this.nft1Bob.address, this.alicesNft, this.smallGas))
          .to.be.revertedWith("you don't own this nft");
      });

      it("nft1 is now owned by nftswap", async function() {
        expect(await this.nft1Alice.ownerOf(this.alicesNft)).to.equal(this.swap.address);
      });

      it("agreement can not be cancelled by alice", async function() {
        await expect(this.swapAlice.cancel(this.smallGas)).to.be.revertedWith("withdraw nfts first");
      });

      describe("bob cancels the agreement", function() {
        beforeEach(async function() {
          await this.swapBob.cancel(this.smallGas);
        });

        it("alice market as cannot deposit", async function() {
          expect(await this.swapAlice.canDeposit(this.smallGas)).to.equal(false);
        });

        it("alice cannot deposit nft2", async function() {
          await expect(this.swapAlice.deposit(this.nft2Alice.address, this.alicesNft, this.smallGas))
            .to.be
            .reverted;
        });

        describe("alice withdraws nft1", function() {
          beforeEach(async function() {
            await this.swapAlice.withdraw(this.nft1Alice.address, this.alicesNft, this.smallGas);
            expect(await this.nft1Alice.ownerOf(this.alicesNft))
              .to.equal(this.alice.address);
          });

          it("alice can cancel agreement", async function() {
            await this.swapAlice.cancel(this.smallGas);
            expect(await this.swapAlice.agreement(this.alice.address, this.smallGas))
                .to.equal(ethers.constants.AddressZero);
          });
        });
      });

      describe("alice withdraws", function() {
        beforeEach(async function() {
          await this.swapAlice.withdraw(this.nft1Alice.address, this.alicesNft, this.smallGas);
        });

        it("nft is now owned by alice", async function() {
          expect(await this.nft1Alice.ownerOf(this.alicesNft)).to.equal(this.alice.address);
        });

        it("agreement can now be cancelled by alice", async function() {
          await this.swapAlice.cancel(this.smallGas);
          expect(await this.swapAlice.agreement(this.alice.address, this.smallGas))
            .to.equal(ethers.constants.AddressZero);
        });
      });

      describe("alice deposits nft2", function() {
        beforeEach(async function() {
          await this.nft2Alice.approve(this.swap.address, this.alicesNft);
          await this.swapAlice.deposit(this.nft2Alice.address, this.alicesNft, this.smallGas);
        });

        swapped(false, this.smallGas);

        it("returns the correct managed assets list", async function() {
          const managedAssets = await this.swapAlice['listManagedAssets()']();
          expect(managedAssets[0][0]).to.equal(this.nft1Alice.address);
          expect(parseInt(managedAssets[1][0]._hex, 16)).to.equal(this.alicesNft);
          expect(managedAssets[0][1]).to.equal(this.nft2Alice.address);
          expect(parseInt(managedAssets[1][1]._hex, 16)).to.equal(this.alicesNft);
        });

        it("nft2 is owned by nftswap", async function() {
          expect(await this.nft2Alice.ownerOf(this.alicesNft))
            .to.equal(this.swap.address);
        });

        describe("bob deposits his nft1 and nft2", async function() {
          beforeEach(async function() {
            await this.nft1Bob.approve(this.swap.address, this.bobsNft);
            await this.nft2Bob.approve(this.swap.address, this.bobsNft);
            await this.swapBob.deposit(this.nft1Bob.address, this.bobsNft, this.smallGas);
            await this.swapBob.deposit(this.nft2Bob.address, this.bobsNft, this.smallGas);
          });

          swapped(true, this.smallGas);
          bothCanDeposit(false, this.smallGas);
          // both are marked as cancelled because the swap has occured, so
          // the original agreement is now gone.
          bothCancelled(true, this.smallGas);

          it("returns the correct managed assets list", async function() {
            const managedAssets = await this.swapAlice['listManagedAssets()']();
            expect(managedAssets[0][0]).to.equal(this.nft1Alice.address);
            expect(parseInt(managedAssets[1][0]._hex, 16)).to.equal(this.bobsNft);
            expect(managedAssets[0][1]).to.equal(this.nft2Alice.address);
            expect(parseInt(managedAssets[1][1]._hex, 16)).to.equal(this.bobsNft);
          });

          it("bob's nft1 and nft2 are owned by nftswap", async function() {
            expect(await this.nft1Bob.ownerOf(this.bobsNft))
              .to.equal(this.swap.address);
            expect(await this.nft2Bob.ownerOf(this.bobsNft))
              .to.equal(this.swap.address);
          });

          it("alice cannot create new agreement with bob", async function() {
            await expect(this.swapAlice.create(...this.agreementArgsAlice, this.largeGas))
              .to.be.reverted;
          });

          it("alice cannot create agreement with carol", async function() {
            const args = [
              [this.nft1Alice.address, this.nft2Alice.address], [this.bobsNft, this.bobsNft],
              [this.nft1Alice.address], [3]
            ];

            await expect(this.swapAlice.create(...args, this.largeGas)).to.be.reverted;
          });

          it("bob cannot create new agreement with alice", async function() {
            await expect(this.swapBob.create(...this.agreementArgsBob, this.largeGas))
              .to.be.reverted;
          });

          it("neither alice nor bob cannot withdraw their nfts", async function() {
            await expect(this.swapAlice.withdraw(this.nft1Alice.address, this.alicesNft, this.smallGas))
              .to.be.reverted;
            await expect(this.swapAlice.withdraw(this.nft2Alice.address, this.alicesNft, this.smallGas))
              .to.be.reverted;
            await expect(this.swapBob.withdraw(this.nft1Bob.address, this.bobsNft, this.smallGas))
              .to.be.reverted;
            await expect(this.swapBob.withdraw(this.nft2Bob.address, this.bobsNft, this.smallGas))
              .to.be.reverted;
          });

          describe("alice withdraws bobs nft1 and nft2", function() {
            beforeEach(async function() {
              await this.swapAlice.withdraw(this.nft1Alice.address, this.bobsNft, this.smallGas);
              await this.swapAlice.withdraw(this.nft2Alice.address, this.bobsNft, this.smallGas);
            });

            it("alice now owns bobs nfts", async function() {
              expect(await this.nft1Alice.ownerOf(this.bobsNft))
                .to.equal(this.alice.address);
              expect(await this.nft2Alice.ownerOf(this.bobsNft))
                .to.equal(this.alice.address);
            });

            it("nftswap still owns alices nfts", async function() {
              expect(await this.nft1Alice.ownerOf(this.alicesNft))
                .to.equal(this.swap.address);
              expect(await this.nft2Alice.ownerOf(this.alicesNft))
                .to.equal(this.swap.address);
            });

            it("alice is no longer in swapped state", async function() {
              expect(await this.swapAlice.swapsCanBeWithdrawn(this.smallGas)).to.equal(false);
            });

            it("bob is still in swapped state", async function() {
              expect(await this.swapBob.swapsCanBeWithdrawn(this.smallGas)).to.equal(true);
            });

            it("alice can create agreement with carol", async function() {
              const args = [
                [this.nft1Alice.address, this.nft2Alice.address], [this.bobsNft, this.bobsNft],
                [this.nft1Alice.address], [3]
              ];

              await this.swapAlice.approve(this.carol.address);
              await this.swapCarol.approve(this.alice.address);
              await this.swapAlice.create(...args, this.largeGas);
            });

            describe("bob withdraws alices nft1", function() {
              beforeEach(async function() {
                await this.swapBob.withdraw(this.nft1Bob.address, this.alicesNft, this.smallGas);
              });

              it("bob owns alices nft1", async function() {
                expect(await this.nft1Bob.ownerOf(this.alicesNft))
                  .to.equal(this.bob.address);
              });

              it("bob still in swapped state", async function() {
                expect(await this.swapBob.swapsCanBeWithdrawn(this.smallGas)).to.equal(true);
              });

              describe("bob withdraws alices nft2", function() {
                beforeEach(async function() {
                  await this.swapBob.withdraw(this.nft2Bob.address, this.alicesNft, this.smallGas);
                });

                it("bob owns alices nft2", async function() {
                  expect(await this.nft2Bob.ownerOf(this.alicesNft))
                    .to.equal(this.bob.address);
                });

                it("bob no longer in swapped state", async function() {
                  expect(await this.swapBob.swapsCanBeWithdrawn(this.smallGas)).to.equal(false);
                });
              });
            })
          });
        });
      });
    });

    it("they cannot withdraw each others nfts", async function() {
      await expect(this.swapAlice.withdraw(this.nft1Alice.address, this.bobsNft, this.smallGas))
        .to.be
        .revertedWith("you don't own this nft");
      await expect(this.swapAlice.withdraw(this.nft2Alice.address, this.bobsNft, this.smallGas))
        .to.be
        .revertedWith("you don't own this nft");
      await expect(this.swapBob.withdraw(this.nft1Alice.address, this.alicesNft, this.smallGas))
        .to.be
        .revertedWith("you don't own this nft");
      await expect(this.swapBob.withdraw(this.nft2Alice.address, this.alicesNft, this.smallGas))
        .to.be
        .revertedWith("you don't own this nft");
    });
  });
});
