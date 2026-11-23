# Capstone Evidence Index

All commands assume the repository root. Secrets are referenced by metadata only; never capture Secret data, registry credentials, session cookies, or token-bearing environment variables.

| Rubric item | Evidence and reproducible command | Result |
|---|---|---|
| App tests, registration/login, CRUD, isolation, persistence | `npm test` | **Verified:** 1 test passed, 0 failed. Output was produced after local network permission allowed loopback binding. |
| Compose readiness and named volume | `docker compose up --build -d`; `docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{console.log(r.status);if(!r.ok)process.exit(1)})"`; `docker compose down` | **Verified:** HTTP 200. `tasks` volume preserved. |
| kind install/context/ARM64 image | `kind version`; `kubectl --context kind-task-lab get nodes -o wide`; `docker image inspect task-manager:local --format '{{.Os}}/{{.Architecture}}'` | **Verified:** existing kind v0.33.0, ARM64 node, ARM64 image loaded. |
| Secret, ConfigMap, PVC, probes, Pods, Services | `kubectl --context kind-task-lab -n task-manager get pods,svc,configmap,pvc,role`; inspect deployments with `kubectl ... get deploy -o yaml` | **Verified:** blue and green Ready; 1 GiB PVC Bound; readiness/liveness probes; Secret reference present. Do not print Secret data. |
| Cluster Service access | `kubectl --context kind-task-lab -n task-manager port-forward svc/task-manager 3000:3000`; `curl -i http://localhost:3000/health/ready` | **Verified:** HTTP 200 through local port-forward. |
| Scaling, rolling update, rollback | `kubectl ... scale deployment/task-blue --replicas=2`; `kubectl ... set image deployment/task-blue app=task-manager:v2`; `kubectl ... rollout history deployment/task-blue`; `kubectl ... rollout undo deployment/task-blue` | **Verified mechanics:** completed, then restored to one replica and `task-manager:local`. `v2` reused same image bits. |
| Kubernetes persistence across restart | `node ops/verify-k8s-persistence.mjs` | **Verified:** generated disposable task was retrieved after scaling and restarting blue. Script avoids printing generated credentials. |
| Observer allowed/denied access | `kubectl --context kind-task-lab auth can-i get pods -n task-manager --as=system:serviceaccount:task-manager:task-observer-demo`; repeat for `get pods/log` and `get secrets` | **Verified:** yes, yes, no. Demo RoleBinding remains namespaced. |
| Terraform validation and plan | `terraform -chdir=ops/terraform validate`; `terraform -chdir=ops/terraform plan` | **Verified:** valid; final plan says no changes. Module reuses a matching kind cluster and has no destroy provisioner. |
| Ansible deployment route | `ANSIBLE_LOCAL_TEMP=/private/tmp/task-ansible-tmp ANSIBLE_REMOTE_TEMP=/private/tmp/task-ansible-tmp ansible-playbook -i 'localhost,' ops/ansible/deploy.yml` | **Verified:** 6 OK, 5 changed, 0 failed. Workstation deployment used; Ubuntu x86-64 host preparation was not run. |
| Git repository, branch merge, conflict, private URL | `git status`; `git remote -v` | **Blocked:** directory has no `.git`; `gh` unavailable; user has not supplied authorized private remote. |
| Jenkins, GitHub push trigger, SonarQube, Trivy, publish | Jenkinsfile is present; run configured multibranch job after connecting services | **Unverified:** no Jenkins/SonarQube instance, credentials or build URL. |
| Prometheus, Grafana metrics | `ops/monitoring/*` manifests are prepared | **Unverified:** Helm install did not complete; no dashboard or metrics scrape evidence. |
| Fluentd archive | `ops/logging/fluentd.yaml` is prepared | **Unverified:** not applied; no archive evidence. |
| Argo CD blue-green Git promotion and revert | `ops/gitops.yaml` template and `k8s/` selectors | **Unverified:** no repository URL or Argo CD instance; no Git commits/transitions. |
| Technical report, architecture, demo | `docs/REPORT.md`, `docs/ARCHITECTURE.md`, `docs/DEMO.md` | **Prepared:** report records results and limits; architecture is standalone Mermaid source; DEMO is timed speaking/recording script. |
| PowerPoint and video | requested output files | **Unavailable here:** artifact authoring runtime dependency and video recording capability were unavailable. No simulation is represented as evidence. |

## Evidence capture checklist for the remaining services

When the private remote and credentials are available, add sanitized screenshots or URLs for: branch graph and resolved conflict; GitHub webhook delivery; Jenkins test, quality gate, Trivy report and image digest; Argo CD healthy sync for preview, promotion, and revert; Grafana HTTP, CPU, memory and replica panels; Fluentd archive file containing a generated request log; and the observer `yes/yes/no` checks. Mask account identifiers when needed and never include credential values.
