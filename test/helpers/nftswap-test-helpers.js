const { expect } = require("chai");

module.exports.swapped = function(val, opts = {}) {
  it(`both alice and bob marked as has swapped: ${val}`, async function() {
    expect(await this.swapAlice.swapsCanBeWithdrawn(opts)).to.equal(val);
    expect(await this.swapBob.swapsCanBeWithdrawn(opts)).to.equal(val);
  });
}

module.exports.bothCanDeposit = function(val, opts = {}) {
  it(`both alice and bob marked as able to deposit: ${val}`, async function() {
    expect(await this.swapAlice.canDeposit(opts)).to.equal(val);
    expect(await this.swapBob.canDeposit(opts)).to.equal(val);
  });
}

module.exports.bothCancelled = function(val, opts = {}) {
  // it(`both alice and bob marked as cancelled: ${val}`, async function() {
  //   expect(await this.swapAlice.cancelled(opts)).to.equal(val);
  //   expect(await this.swapBob.cancelled(opts)).to.equal(val);
  // });
}