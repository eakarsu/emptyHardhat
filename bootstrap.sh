#!/bin/sh

cd /home/Research/emptyHardhat
npx hardhat node --show-stack-traces --verbose &

sleep 10s

cd /home/Research/aave
npm run aave:fork:main > ../erol-enzyme-aave-fork-protocol/aave.out
#unpause lending pool
npx hardhat unpause  --localuseraddress 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 --hardhathost http://localhost:8545

cd /home/Research/enzyme
npx hardhat --network localhost deploy > ../erol-enzyme-aave-fork-protocol/enzyme.out
cat ../erol-enzyme-aave-fork-protocol/enzyme.out

#fix yearn vault issue
npx hardhat yearnvault --yearnvaultgovernance 0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52  --yvault 0x19d3364a399d251e894ac732651be8b0e4e85001 --hardhathost http://localhost:8545

#initialize aave lending pool
cd /home/Research/erol-enzyme-aave-fork-protocol
./plugEnzyme.sh
npm run build
npm run dev

tail -F -n0 /etc/hosts
