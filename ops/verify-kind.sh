#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C
k() { kubectl --context kind-task-lab -n task-manager "$@"; }
context=$(mktemp -d)
trap 'rm -r "$context"' EXIT
mkdir "$context/ops"
cp -R Dockerfile .dockerignore package.json server.js public "$context"
cp ops/backup.js "$context/ops/"
sed 's/<title>Task Manager<\/title>/<title>Task Manager - release 2<\/title>/' public/index.html > "$context/public/index.html"
grep -q 'Task Manager - release 2' "$context/public/index.html"
docker build -t task-manager:lab-v2 "$context"
docker image inspect task-manager:lab-v2 --format '{{.Os}}/{{.Architecture}}'
kind load docker-image task-manager:lab-v2 --name task-lab
k get deploy,pods,svc,configmap,pvc
k get secret task-secrets -o custom-columns=NAME:.metadata.name,TYPE:.type
k get deploy -o custom-columns=NAME:.metadata.name,CONFIG:.spec.template.spec.containers[0].envFrom[0].configMapRef.name,SECRET:.spec.template.spec.containers[0].env[0].valueFrom.secretKeyRef.name,READY:.spec.template.spec.containers[0].readinessProbe.httpGet.path,LIVE:.spec.template.spec.containers[0].livenessProbe.httpGet.path,CLAIM:.spec.template.spec.volumes[0].persistentVolumeClaim.claimName
node ops/verify-k8s-persistence.mjs
k get deployment task-blue
k set image deployment/task-blue app=task-manager:lab-v2
k rollout status deployment/task-blue --timeout=180s
k get deployment task-blue -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
k rollout history deployment/task-blue
k rollout undo deployment/task-blue
k rollout status deployment/task-blue --timeout=180s
k scale deployment/task-blue --replicas=1
k rollout status deployment/task-blue --timeout=180s
k get deploy task-blue task-green -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas
k create rolebinding task-observer-demo --role=task-observer --user=task-observer-demo --dry-run=client -o yaml | k apply -f -
k auth can-i get deployments --as=task-observer-demo
k auth can-i get pods --subresource=log --as=task-observer-demo
if k auth can-i get secrets --as=task-observer-demo; then exit 1; fi
if k auth can-i delete deployments --as=task-observer-demo; then exit 1; fi
