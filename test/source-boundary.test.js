import { expect } from 'chai'
import fs from 'node:fs'

describe('repository safety boundary', function () {
  it('contains no forking provider key or hard-coded private account', function () { const source = `${fs.readFileSync('hardhat.config.js', 'utf8')}\n${fs.readFileSync('bootstrap.sh', 'utf8')}`; expect(source).not.to.match(/alchemyapi|ac0974bec|59c6995e|5de4111a|test test test/); expect(source).to.match(/configVariable\('RPC_URL'\)/) })
  it('requires explicit chain identity and live-deployment acknowledgement', function () { const source = fs.readFileSync('scripts/deploy.js', 'utf8'); expect(source).to.match(/EXPECTED_CHAIN_ID/); expect(source).to.match(/I_UNDERSTAND_THIS_DEPLOYS_IMMUTABLE_CODE/); expect(source).to.match(/runtimeCodeHash/) })
  it('launcher has bounded explicit modes and no cross-repository automation', function () { const source = fs.readFileSync('bootstrap.sh', 'utf8'); for (const mode of ['check)', 'local-node)', 'deploy-local)', 'deploy-production)']) expect(source).to.include(mode); expect(source).not.to.match(/\/home\/Research|git clone|npm install|kill|tail -F/) })
})
