# Milestone Escrow

This repository is a tenant-governed milestone escrow, not the former public Greeter/forking sample. A tenant payer locks an exact native-token amount against a terms hash; a distinct tenant provider submits an evidence hash; a distinct tenant reviewer releases the provider's pull payment or resolves a dispute. Unsubmitted work can be cancelled or refunded after its deadline. Every authority and state change emits an event.

The contract intentionally stores only opaque tenant/terms/evidence/reason hashes, addresses, deadlines, and amounts. A public chain provides integrity, not confidentiality—never put personal, commercial, beneficiary, credential, or document content on-chain.

```sh
npm ci
./bootstrap.sh check
./bootstrap.sh local-node
./bootstrap.sh deploy-local
```

Live deployment fails closed and requires the explicit environment contract in `.env.example`, an expected chain ID, and the acknowledgement value. Read `RUNBOOK.md` before deploying or registering a tenant. No production address is claimed by this repository.
