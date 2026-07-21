import { ethers as ethersLibrary } from 'ethers'
import { network } from 'hardhat'

const { ethers } = await network.create()
const chain = await ethers.provider.getNetwork()
const chainId = chain.chainId.toString()
const local = chainId === '31337'
if (!local) {
  if (process.env.ALLOW_LIVE_DEPLOY !== 'I_UNDERSTAND_THIS_DEPLOYS_IMMUTABLE_CODE') throw new Error('Live deployment is disabled')
  if (!process.env.EXPECTED_CHAIN_ID || process.env.EXPECTED_CHAIN_ID !== chainId) throw new Error(`Expected chain ${process.env.EXPECTED_CHAIN_ID || '<unset>'}, connected to ${chainId}`)
}
const escrow = await ethers.deployContract('MilestoneEscrow')
await escrow.waitForDeployment()
const address = await escrow.getAddress()
const code = await ethers.provider.getCode(address)
console.log(JSON.stringify({ contract: 'MilestoneEscrow', address, chainId, deployer: (await ethers.getSigners())[0].address, runtimeCodeHash: ethersLibrary.keccak256(code) }, null, 2))
