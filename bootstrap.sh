#!/bin/sh

cd /home/Research/emptyHardhat
npx hardhat node &

sleep 10s

cd /home/Research/aave
npm run aave:fork:main

cd /home/Research/enzyme
npx hardhat --network localhost deploy