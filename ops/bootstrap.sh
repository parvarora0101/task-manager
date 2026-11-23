#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
context=${TASK_KUBE_CONTEXT:-$(kubectl config current-context)}
[[ "$context" == kind-* ]] || { echo "Select the kind lab context first." >&2; exit 1; }
kubectl --context "$context" apply -f k8s/namespace.yaml
umask 077
token_file=$(mktemp)
trap 'rm -f "$token_file"' EXIT
if ! kubectl --context "$context" -n task-manager get secret task-secrets >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\n' > "$token_file"
  kubectl --context "$context" -n task-manager create secret generic task-secrets --from-file=token="$token_file"
fi
