# Task Manager deployment runbook

## 1. Git and Jenkins

Initialize Git in the extracted folder, commit the files and push to a private GitHub repository you control.

```sh
git init -b main
git add .
git commit -m "Add Task Manager application and delivery pipeline"
git remote add origin https://github.com/YOUR_ACCOUNT/task-manager.git
git push -u origin main
git switch -c feature/demo-copy
```

For the Git rubric, change the same sentence on two branches, commit both changes, merge the second branch into the first and resolve the conflict. Use a pull request to merge the result into `main`. Record the pull request and commit graph.

Create a Jenkins Multibranch Pipeline for the GitHub repository. Use the GitHub, GitHub Branch Source, Pipeline, Credentials Binding and SonarQube Scanner plugins. Configure GitHub push events for `https://YOUR_JENKINS/github-webhook/` and verify delivery in GitHub. Use a private repository or configured protections so only trusted users can define workloads on the builder. Keep credentials on the controller and scope image-publishing credentials to the repository folder.

Provide a dedicated Linux agent labeled `task-builder` with Node.js 24, Docker, Trivy, SonarScanner CLI and registry access. Docker access grants host-level privileges. Use an isolated builder. In Jenkins configure the SonarQube server as `SonarQube` with its token stored in Jenkins Credentials. Configure the SonarQube webhook at `https://YOUR_JENKINS/sonarqube-webhook/` and set a shared webhook secret in both services. Run a branch build and verify tests and scanning. On main, verify the quality gate too.

Create a username/password credential with ID `registry-publisher`. Use a scoped registry access token as the password. On the main job set `IMAGE_REPOSITORY` to a fully qualified path such as `docker.io/YOUR_ACCOUNT/task-manager` and set `PUBLISH=true` for the release build. Configure those values as job defaults for recurring publish builds if desired. The pipeline archives the pushed digest in `image-digest.txt`. For the lab use a pullable repository or separately provision registry pull credentials in the namespace and add `imagePullSecrets` to both deployments.

References: [Jenkins SonarQube Pipeline steps](https://www.jenkins.io/doc/pipeline/steps/sonar/), [GitHub Branch Source](https://plugins.jenkins.io/github-branch-source/).

## 2. Provision the lab

On Linux, save an Ansible inventory named `inventory.ini` with the local Ubuntu host in the `lab` group.

```ini
[lab]
localhost ansible_connection=local
```

```sh
ansible-playbook -i inventory.ini ops/ansible/site.yml -e lab_operator="$USER" --ask-become-pass
```

Reopen the shell after Docker group membership changes. On Windows, use a Linux VM or a WSL2 setup with Docker integration and install kind, kubectl, Terraform, Helm and Ansible there. The provisioning play targets a systemd-based Ubuntu x86-64 host. Supply Terraform and Helm on the workstation.

```sh
terraform -chdir=ops/terraform init
terraform -chdir=ops/terraform plan -out=lab.plan
terraform -chdir=ops/terraform apply lab.plan
ansible-playbook ops/ansible/deploy.yml
kubectl -n task-manager get pods,svc,pvc
kubectl -n task-manager port-forward svc/task-manager 3000:3000
```

This provisions a single-node kind cluster using Terraform's built-in provider. The Ansible deployment loads a local image, makes a generated Secret for metrics, applies manifests and waits for both slots. The PVC expects the cluster's default dynamic StorageClass. Open <http://localhost:3000>. A process using port 3000 from another run must be stopped first.

Reference: [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/).

## 3. Scaling, rolling update and rollback

Before enabling automated Argo CD reconciliation, demonstrate Kubernetes controls directly:

```sh
kubectl -n task-manager scale deployment/task-blue --replicas=2
kubectl -n task-manager rollout status deployment/task-blue
kubectl -n task-manager get pods -l slot=blue
```

Build a second version from a visible source change, tag it `task-manager:v2`, then load it using `kind load docker-image task-manager:v2 --name task-lab`. Run:

```sh
kubectl -n task-manager set image deployment/task-blue app=task-manager:v2
kubectl -n task-manager rollout status deployment/task-blue
kubectl -n task-manager rollout history deployment/task-blue
kubectl -n task-manager rollout undo deployment/task-blue
kubectl -n task-manager rollout status deployment/task-blue
kubectl -n task-manager scale deployment/task-blue --replicas=1
```

Keep both versions schema-compatible. In a separate terminal, restart port-forwarding if its selected pod terminates. Review the app through the Service after the rollout.

## 4. Install monitoring and logging

Select and record a compatible chart version from `helm search repo prometheus-community/kube-prometheus-stack --versions`.

```sh
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm search repo prometheus-community/kube-prometheus-stack --versions
# Set CHART_VERSION to the exact chart version selected above.
helm upgrade --install metrics prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace --version "${CHART_VERSION:?Set CHART_VERSION}" \
  -f ops/monitoring/values.yaml --wait --timeout 10m
kubectl apply -f ops/monitoring/monitor.yaml -f ops/monitoring/dashboard.yaml
kubectl apply -f ops/logging/fluentd.yaml
kubectl -n task-logs rollout status deployment/collector
kubectl -n task-logs rollout status daemonset/fluentd
kubectl -n monitoring port-forward svc/metrics-grafana 3001:80
```

Use the Grafana admin credentials from the release Secret. Keep them out of screenshots and Git. Open the **Task Manager** dashboard and generate traffic for a few minutes. Prometheus discovers the live Service and scrapes its healthy endpoints with the namespace Secret. Monitored values include HTTP request rates, process CPU and memory, and available replicas for both slots.

Fluentd tails CRI stdout and stderr logs from application and Kubernetes system pods. It forwards records to a central collector with a persistent archive. Generate a request and allow time for forwarding and flushing. Inspect:

```sh
kubectl -n task-logs exec deployment/collector -- sh -c 'ls -lh /archive/containers*'
kubectl -n task-logs exec deployment/collector -- sh -c 'grep task-manager /archive/containers* | tail -n 8'
```

Use log files for a time-bounded lab demo. A long-running installation needs a durable retention policy, an authenticated encrypted forwarding channel and restricted collector access.

Reference: [Prometheus Operator troubleshooting](https://prometheus-operator.dev/docs/platform/troubleshooting/).

## 5. Argo CD and blue-green

Install an approved pinned Argo CD release into the `argocd` namespace using its standard installation manifest. Add the private Git repository to Argo CD with a read-only deploy key or scoped credential. Replace both `REPLACE_REPOSITORY` values in `ops/gitops.yaml` with that repository URL and apply the file. Bootstrap the namespace and metrics Secret first. Argo CD reconciles `k8s/` from `main`.

1. Start with live Service on blue and preview Service on green. Both slots can use the initial local image for the kind lab.
2. Commit the new immutable registry image reference to `k8s/green.yaml` using the digest from the Jenkins build. Merge via a pull request and wait for Argo CD to sync and mark green healthy.
3. Preview green with `kubectl -n task-manager port-forward svc/task-preview 3000:3000` after stopping the live port-forward. Check readiness, sign in and exercise a disposable task. Both deployments share the same data, so preview changes are visible from the live slot.
4. In a separate commit switch `task-manager` to `slot: green` and `task-preview` to `slot: blue` in `k8s/platform.yaml`. Merge, allow Argo CD to reconcile, then reconnect to the live Service. Verify its EndpointSlices and app version.
5. Roll back by reverting the selector commit and letting Argo CD reconcile. Preserve both version digests and the persistent claim. For the next release, deploy to the inactive slot.

The Git merge is the approval and release control. Jenkins has registry access and Argo CD applies the desired state with cluster access. Application pods have no mounted Kubernetes API token.

## 6. Access controls and data recovery

Assign the namespaced observer Role to a real lab identity only when needed:

```sh
kubectl -n task-manager create rolebinding task-observer-student \
  --role=task-observer --user=STUDENT_IDENTITY
kubectl auth can-i get deployments -n task-manager --as=STUDENT_IDENTITY
kubectl auth can-i get secrets -n task-manager --as=STUDENT_IDENTITY
```

Expect `yes` and `no` on a fresh cluster with no extra grants for that identity. Kubernetes Secrets require cluster-level access controls. Local application sessions use expiry and hashed tokens, and the app enables Secure cookies when `APP_ORIGIN` starts with HTTPS.

For a native run, create a consistent snapshot while the app is running:

```sh
node ops/backup.js tasks-backup.sqlite
```

Use `DATA_DIR` if the active directory differs. For containers run the same script inside the app with a destination under `/data` and export the resulting file to protected backup storage. Before restoring, stop both deployments or all app processes and keep the current database and any WAL/SHM sidecars together. Restore into a clean data directory from the snapshot with the application's file permissions, start one replica and verify readiness and representative data before restoring the desired replica count. On the lab cluster, Terraform destroy removes the kind cluster and its node-local volumes. Export backups first.
