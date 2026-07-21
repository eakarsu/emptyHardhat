#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-check}"
case "$mode" in
  check) cd "$project_dir"; exec npm run check ;;
  local-node) cd "$project_dir"; exec npm run node ;;
  deploy-local) cd "$project_dir"; exec npm run deploy:local ;;
  deploy-production)
    : "${RPC_URL:?Set RPC_URL through the secret store}"
    : "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY through the secret store}"
    : "${EXPECTED_CHAIN_ID:?Set EXPECTED_CHAIN_ID}"
    : "${ALLOW_LIVE_DEPLOY:?Set the documented live-deployment acknowledgement}"
    cd "$project_dir"; exec npm run deploy:production
    ;;
  *) echo "Usage: $0 {check|local-node|deploy-local|deploy-production}" >&2; exit 64 ;;
esac
