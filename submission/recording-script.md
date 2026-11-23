# Task Manager demonstration recording

**Target length 12 minutes 30 seconds**
**ENSP461 DevOps & Automation Lab · Kartik Manchanda**

Open the architecture PDF, the task board, a clean terminal, and the evidence index before starting. Use a disposable account with a password manager or a hidden input. Keep credential dialogs, registry login, Secret contents and private account data out of the frame. Use the evidence index for any integrations still awaiting access.

| Running time | Show and do | Narration |
|---|---|---|
| 0:00–0:50 | Open the architecture PDF. Trace the browser, app and database path. | State the problem. A release must be reproducible, observable and reversible while preserving user data. |
| 0:50–2:35 | Open the board on localhost. Sign in, create a task, change its status, then delete it. Show `npm test` and the assertions in `test/api.test.js`. | Explain owner isolation and optimistic updates. Call out restart persistence and the three denied cross-account operations. |
| 2:35–3:20 | Show `docker compose ps` and `curl -fsS http://localhost:3000/health/ready`. | Show the existing named volume and how it survives container replacement. |
| 3:20–4:40 | Show the Terraform and Ansible evidence files. Run `kubectl --context kind-task-lab -n task-manager get deploy,pods,svc,pvc`. | Explain the no-change Terraform apply, ARM64 Ansible route, and two release slots using one PVC. |
| 4:40–6:20 | Scroll through `submission/evidence/kind.txt`. Highlight scale to 2/2, task recovery, new image and rollback. | Explain the distinction between Pod replacement and data loss. Reopen a port-forward if its Pod has been replaced. |
| 6:20–7:30 | Show the observer permission outcomes and the Fluentd archive counts. | Explain the Role boundary and trace CRI container logs from the node to the Fluentd collector. |
| 7:30–8:45 | Show the Prometheus queries and Grafana panel names if verified. Generate local traffic and show the HTTP series. | Point out the CPU counter rate, resident memory gauge, and available replicas. Use evidence for verified results. |
| 8:45–10:35 | Show `git log --graph --oneline --all` and the GitOps evidence. Compare preview and live, then show selector promotion and revert. | Explain the conflict and the resolved commit. If the Git mirror was used, identify it as a local source and show the Argo sync revisions. |
| 10:35–11:35 | Show the actual Jenkins build if available, then the Jenkinsfile stages. | State the verification status of tests, image packaging, scanning, SonarQube, push trigger and registry publication. |
| 11:35–12:30 | Open the evidence index and submission folder. | Close with what ran, access pending for the hosted workflow, and why a production multi-node deployment needs a network database. |

During the recording, replay saved output for long-running operations and identify it as captured evidence. Start recording only after checking that the selected screen contains the lab windows and disposable data. Export the recording in MP4 format after checking the duration and audio.
