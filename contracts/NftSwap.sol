//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract NftSwap is ERC721Holder, Ownable {

  event Approved(address by, address target);
  event Created(address by, address target);
  event Cancelled(address by);
  event Deposited(address by, address assetContract, uint id);
  event Withdrawn(address by, address assetContract, uint id);

  struct AssetBundle {
    address[] contracts;
    uint256[] ids;
  }

  // currently only one agreement can be active for a participant
  mapping(address => address) public agreement;
  mapping(address => AssetBundle) assets;

  uint fee = 0 gwei;

  function setFee(uint feeInGwei) external onlyOwner {
    fee = feeInGwei;
  }

  function approve(address _agreement) external payable {
    require(agreement[msg.sender] == address(0),
      "you must cancel your current agreement");
    require(msg.sender != _agreement,
      "you cannot approve yourself");

    // verify players have no managed assets
    require(!assetManagementIsSetUp(msg.sender));
    require(!assetManagementIsSetUp(_agreement), "target must cancel their current agreement");

    require(msg.value == fee, "fee is required to approve target");
    (bool sent,) = owner().call{value: msg.value}("");
    require(sent, "failed to send fees");

    agreement[msg.sender] = _agreement;

    emit Approved(msg.sender, _agreement);
  }

  function create(
    address[] calldata player1NftAddresses, uint256[] calldata player1NftIds,
    address[] calldata player2NftAddresses, uint256[] calldata player2NftIds
  ) external {
    // verify each player has allowed the other player
    require(agreement[agreement[msg.sender]] == msg.sender, "each party much approve the other");

    // verify players have no managed assets
    require(!assetManagementIsSetUp(msg.sender), "you already have a swap pending");
    require(!assetManagementIsSetUp(agreement[msg.sender]), "they already have a swap pending");

    // verify input is correct
    require(player1NftAddresses.length > 0, "each party must swap 1 asset");
    require(player2NftAddresses.length > 0, "each party must swap 1 asset");
    require(player1NftAddresses.length == player1NftIds.length, "different address and id count");
    require(player2NftAddresses.length == player2NftIds.length, "different address and id count");

    // verify players own the nfts they're trading
    require(ownedByAddress(msg.sender, player1NftAddresses, player1NftIds), "you do not own some or all of these assets");
    require(
      ownedByAddress(
        agreement[msg.sender], player2NftAddresses, player2NftIds), "they do not own some or all of these assets");

    assets[msg.sender] = AssetBundle(player1NftAddresses, player1NftIds);
    assets[agreement[msg.sender]] =
      AssetBundle(player2NftAddresses, player2NftIds);

    emit Created(msg.sender, agreement[msg.sender]);
  }

  function cancel() external {
    require(agreement[msg.sender] != address(0), "nothing to cancel");
    require(!swapsCanBeWithdrawn(), "withdraw nfts first");

    // check to make sure nothing has been deposited
    require(
      ownedByAddress(
        msg.sender, assets[msg.sender].contracts, assets[msg.sender].ids),
      "withdraw nfts first");

    // we cannot delete the agreement for user 2 because they might have
    // already deposited assets. they will need to withdraw and cancel on
    // their own.
    delete agreement[msg.sender];
    delete assets[msg.sender];

    emit Cancelled(msg.sender);
  }

  function deposit(address assetContract, uint id) external payable {
    require(canDeposit(), "requirements not met to deposit");
    require(assetUnderManagement(assetContract, id),
      "that nft is not under management");

    IERC721 depositContract = IERC721(assetContract);
    depositContract.safeTransferFrom(msg.sender, address(this), id);

    address target = agreement[msg.sender];
    AssetBundle memory ab1 = assets[msg.sender];
    AssetBundle memory ab2 = assets[target];

    if (ownedByAddress(address(this), ab1.contracts, ab1.ids) &&
        ownedByAddress(address(this), ab2.contracts, ab2.ids)) {
      assets[msg.sender] = ab2;
      assets[target] = ab1;
      delete agreement[msg.sender];
      delete agreement[target];
    }

    emit Deposited(msg.sender, assetContract, id);
  }

  function withdraw(address assetContract, uint id) external {
    require(assetUnderManagement(assetContract, id), "you don't own this nft");

    IERC721 depositContract = IERC721(assetContract);
    depositContract.safeTransferFrom(address(this), msg.sender, id);

    // after everything has been withdrawn, we can close out
    // the agreement on msg.senders end
    if (swapsCanBeWithdrawn()) {

      if (ownedByAddress(msg.sender,
        assets[msg.sender].contracts,
        assets[msg.sender].ids)) {
        delete assets[msg.sender];
        delete agreement[msg.sender];
      }
    }

    emit Withdrawn(msg.sender, assetContract, id);
  }

  function canDeposit() public view returns (bool) {
    address target = agreement[msg.sender];
    return
      // msg.sender and target must have each other as agreements
      agreement[target] == msg.sender &&
      assetManagementIsSetUp(msg.sender) &&
      assetManagementIsSetUp(target);
  }

  function assetManagementIsSetUp(address target) public view returns (bool) {
    return
      assets[target].contracts.length != 0 &&
      assets[target].contracts.length == assets[target].ids.length;
  }

  function listManagedAssets() public view returns (address[] memory, uint[] memory) {
    return listManagedAssets(msg.sender);
  }

  function listManagedAssets(address target) public view returns (address[] memory, uint[] memory) {
    AssetBundle memory ab = assets[target];

    uint[] memory ids = new uint[](ab.ids.length);
    address[] memory contracts = new address[](ab.ids.length);

    for (uint i = 0; i < ab.ids.length; i++) {
      if (IERC721(ab.contracts[i]).ownerOf(ab.ids[i]) == address(this)) {
        contracts[i] = ab.contracts[i];
        ids[i] = ab.ids[i];
      }
    }

    return (contracts, ids);
  }

  function listUnmanagedAssets() public view returns (address[] memory, uint[] memory) {
    return listUnmanagedAssets(msg.sender);
  }

  function listUnmanagedAssets(address target) public view returns (address[] memory, uint[] memory) {
    AssetBundle memory ab = assets[target];

    uint[] memory ids = new uint[](ab.ids.length);
    address[] memory contracts = new address[](ab.ids.length);

    for (uint i = 0; i < ab.ids.length; i++) {
      if (IERC721(ab.contracts[i]).ownerOf(ab.ids[i]) != address(this)) {
        contracts[i] = ab.contracts[i];
        ids[i] = ab.ids[i];
      }
    }

    return (contracts, ids);
  }

  function swapsCanBeWithdrawn() public view returns (bool) {
    return
      agreement[msg.sender] == address(0) &&
      assets[msg.sender].contracts.length != 0;
  }

  function assetUnderManagement(
    address assetContract, uint id
  ) internal view returns (bool) {
    return assetUnderManagement(msg.sender, assetContract, id);
  }

  function assetUnderManagement(
    address owner, address assetContract, uint id
  ) internal view returns (bool) {
    for (uint i = 0; i < assets[owner].contracts.length; i++) {
      if (assets[owner].contracts[i] == assetContract &&
          assets[owner].ids[i] == id) {
        return true;
      }
    }
    return false;
  }

  function ownedByAddress(
    address target, address[] memory contracts, uint256[] memory ids
  ) internal view returns (bool) {
    require(contracts.length == ids.length);

    IERC721 c;
    for (uint i = 0; i < contracts.length; i++) {
      c = IERC721(contracts[i]);
      if (c.ownerOf(ids[i]) != target) {
        return false;
      }
    }
    return true;
  }
}