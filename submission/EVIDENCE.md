# ENSP461 evidence index

All command output is from the local lab unless a row says otherwise.

| Rubric item | Evidence | Result |
|---|---|---|
| Registration, login, CRUD, account isolation, restart persistence | [API test output](evidence/api.txt), [integration assertions](../test/api.test.js) | Passed |
| Compose readiness and volume | [Compose output](evidence/compose.txt) | Healthy, HTTP 200, existing `task-manager_tasks` volume |
| ARM64 image, Pods, Services, ConfigMap, Secret references, PVC and probes | [kind output](evidence/kind.txt) | Verified on `kind-task-lab` |
| Scaling, Service port-forward, persistence, rolling update and rollback | [kind output](evidence/kind.txt) | 2/2 replicas, task retrieved after Pod restart, distinct ARM64 image, baseline restored |
| Terraform | [Terraform output](evidence/terraform.txt) | Init, validate, no-change plan and apply |
| Ansible | [Apple Silicon output](evidence/ansible-macos.txt), [Ubuntu syntax check](evidence/ansible.txt) | Workstation run passed. Ubuntu host provisioning was syntax-checked only |
| Git branching, merge and conflict resolution | [Commit record](evidence/git.txt), [branch demonstration](branch-demo.md) | Local conflict resolved on demo branches and merged into `main` |
| Jenkins build and Trivy | Local build `ci-local #1`; [standalone Trivy retry](evidence/trivy.txt) | App tests, image packaging and readiness passed in Jenkins. The build failed at the vulnerability database download. The standalone retry also failed to download the database. SonarQube quality gate remains unverified |
| Private GitHub, push trigger and registry publication | [Runbook](../docs/RUNBOOK.md) | Pending authorization and credentials |
| Kubernetes container and application archives | [Fluentd output](evidence/fluentd.txt) | Agent and collector ready, archive claim bound, app and kube-system records counted |
| Prometheus and Grafana | [Verification script](../ops/verify-monitoring.sh) | Helm release `metrics` failed readiness while monitoring images remained in `ContainerCreating`; Prometheus queries and Grafana dashboard checks have not passed |
| Argo CD Git reconciliation and blue-green promotion | [Sync output](evidence/gitops.txt), [GitOps template](../ops/gitops.yaml) | Argo CD synced baseline and preview commits from a local Git mirror. Preview readiness passed. Preview version, live promotion, Git revert and private GitHub reconciliation remain unverified |
| Observer Role | [kind output](evidence/kind.txt) | Deployment reads and Pod logs allowed, Secret reads and deployment deletes denied |
| Report screenshot | [Task board](../docs/task-board.png) | Screenshot supplied with the repository |
| Ten-minute presentation | [PowerPoint deck](presentation.pptx) | Eight slides with speaker notes; package has not been rendered in PowerPoint for visual QA |
| Technical report | [PDF report](technical-report.pdf), [editable source](../docs/REPORT.md) | PDF is 5 pages; editable source is current |
| Architecture diagram | [PDF diagram](architecture.pdf), [editable source](../docs/ARCHITECTURE.md) | One-page diagram; PDF currently depicts Prometheus/Grafana as runtime even though installation is still pending. The Markdown diagram marks this status accurately |
| Demo video | [Recording script](recording-script.md) | 12:30 fallback script |

The demo release changes the HTML title. The current lab topology uses a shared local SQLite PVC. The hosted delivery path requires an authorized private GitHub repository, a Jenkins webhook route, and a scoped registry credential.
