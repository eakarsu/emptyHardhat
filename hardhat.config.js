import { configVariable, defineConfig } from 'hardhat/config'
import hardhatEthers from '@nomicfoundation/hardhat-ethers'
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers'
import hardhatMocha from '@nomicfoundation/hardhat-mocha'
import hardhatNetworkHelpers from '@nomicfoundation/hardhat-network-helpers'

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha, hardhatNetworkHelpers],
  solidity: {
    version: '0.8.36',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    production: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('RPC_URL'),
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
  },
  test: { mocha: { timeout: 20000 } },
})
