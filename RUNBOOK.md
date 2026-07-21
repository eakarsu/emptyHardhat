# Milestone Escrow operations runbook

## Acceptance and trust model

The primary user is a tenant payer procuring one milestone from a provider. Acceptance requires: platform registration of the tenant; tenant-admin assignment of distinct payer, provider, and reviewer addresses; an exact funded amount; a nonzero off-chain terms digest; a bounded future deadline; provider submission of a nonzero evidence digest; and independent reviewer release. The provider then withdraws through pull payment. The payer may cancel before evidence or refund after an unmet deadline. Either payer or provider may dispute submitted evidence, but only the independent reviewer resolves it.

The contract does not validate real-world work, identities, fiat value, sanctions, tax, licensing, or document rights. Tenant IDs and digests are identifiers, not privacy controls. Keep source records off-chain in an access-controlled evidence store and document the digest algorithm/canonicalization outside this contract.

## Build and local verification

Use Node 22. Install the pinned lockfile with `npm ci`; do not use packages from the historical lockfile. Run:

```sh
./bootstrap.sh check
./bootstrap.sh local-node
./bootstrap.sh deploy-local
```

The check compiles the pinned Solidity version with optimizer settings, runs role/state/payment/deadline/dispute tests on an isolated in-process chain, and runs Solhint. The default Docker artifact repeats these checks as an unprivileged user and does not start a public RPC node.

## Production deployment

Obtain independent Solidity security review and legal/financial approval. Use a dedicated hardware-backed deployer, a private authenticated RPC endpoint, the exact intended chain ID, and organization change control. Load `.env.example` values from the deployment secret store and run:

```sh
./bootstrap.sh deploy-production
```

The deploy script refuses live networks unless `ALLOW_LIVE_DEPLOY=I_UNDERSTAND_THIS_DEPLOYS_IMMUTABLE_CODE` and `EXPECTED_CHAIN_ID` matches the connected chain. Capture its JSON plus transaction receipt and all evidence listed in `deployments/README.md`; verify identical compiler inputs/source on the chain explorer before registering a tenant. Transfer platform and tenant administration with the two-step functions and verify the acceptance event before retiring the former key.

The contract is intentionally not upgradeable. A future schema/logic migration means deploying a reviewed new contract, stopping new intake in the external client, allowing or resolving all old funded jobs, reconciling pending withdrawals and contract balance, registering tenants on the new address, then updating the client allowlist. Never claim the old balance is migrated merely because a UI points elsewhere.

## Monitoring, reconciliation, and recovery

Index all contract events with block number/hash, transaction hash, chain ID, contract address, and confirmation depth. Alert on unexpected owner/admin proposals, tenant/role changes, disputes, overdue funded jobs, failed withdrawals, pending withdrawals older than policy, contract balance versus liabilities, reorgs, RPC divergence, and event-indexer lag. Reconcile `address(this).balance` to the sum of pending withdrawals plus amounts in `Funded`, `EvidenceSubmitted`, and `Disputed` jobs.

The blockchain is the authoritative state backup. Operate two independent archival/indexing providers, checkpoint deployment metadata and event exports in immutable storage, and rehearse rebuilding the index from the deployment block. Recovery never rewrites chain history: reconnect to a verified node, validate chain ID/address/runtime-code hash, replay confirmed events, compare sampled on-chain jobs/balances, and resume reads before writes.

On key compromise, submit an owner/admin transfer from the uncompromised current key if possible, revoke affected tenant roles, pause the external client, preserve event/RPC evidence, and communicate affected jobs. The contract has no emergency seizure or platform pause; this limits administrator power but makes key custody and client-side intake controls critical.

## Historical secret response and external gates

The prior Git history contains an Alchemy endpoint key and hard-coded development private keys. They were removed from the working runtime/configuration, but history was preserved; the Alchemy credential must be revoked/rotated. The development keys are publicly known Hardhat keys and must never hold real assets. Production remains blocked on external audit, chain/RPC choice, key custody, identity-to-address verification, evidence governance, tax/legal review, monitoring, event reorg policy, and an incident/recovery drill.
