#!/bin/bash

cat artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json | jq .abi > ../nftswap-ui/src/abis/erc721.json
cat artifacts/contracts/NftSwap.sol/NftSwap.json | jq .abi > ../nftswap-ui/src/abis/nftswap.json
