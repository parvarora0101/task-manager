# Task Manager Capstone Demo Script

**Timed 10 minute presentation and 12 minute recording script**  
PowerPoint export and video recording are not included in this workspace run. Use this script to deliver the walkthrough and record it when a recorder is available. Clearly call out planned services as unverified.

| Time | Segment | Speaker notes and on-screen action |
|---|---|---|
| 0:00–0:40 | Purpose | “This project demonstrates how a small application moves through tests, container packaging and a repeatable local deployment. I’ll separate working local evidence from service integrations that need credentials or hosted tooling.” Show the app title and report. |
| 0:40–1:50 | Application | Open the app if Compose is running. Register a disposable account, create a task, edit its status, and refresh. Mention that the automated API test separately checks a second account cannot read, change or delete the first account’s task. Avoid showing real email addresses or cookies. |
| 1:50–2:40 | Architecture | Open `docs/ARCHITECTURE.md`. Trace developer → Git/Jenkins → image → Kubernetes. Point out that private GitHub, Jenkins and Argo CD are design paths awaiting connection. Explain live blue and preview green traffic. |
| 2:40–3:35 | Automated tests | Run `npm test`. Show the test summary with one pass and zero failures. Explain registration/login, CRUD, isolation, optimistic revision checking and restart persistence. |
| 3:35–4:40 | Compose and Kubernetes | Show the Compose HTTP 200 readiness check, then `kubectl --context kind-task-lab -n task-manager get pods,svc,pvc`. Point out both Ready slots, the bound claim, and the explicit context. Do not show Secret values. |
| 4:40–5:55 | Scaling and recovery | Show the persistence verifier summary. Explain that it writes a generated disposable task, scales blue to two replicas, restarts the deployment, reconnects, then reads the task again. Show rollout history and restored image. The v2 tag reused the same image, so describe this as a rollout mechanics check. |
| 5:55–6:45 | Terraform and Ansible | Show Terraform validation and final no-change plan. Show the Ansible recap. State that Ansible ran its workstation deployment route on macOS; the Ubuntu x86-64 host preparation playbook was not run. |
| 6:45–7:35 | Access controls | Show metadata-only Secret reference and observer checks: Pods yes, pod logs yes, Secrets no. Explain that service account has no app token mount. Keep all tokens out of frame. |
| 7:35–8:30 | Pipeline and GitOps status | Show the Jenkinsfile and Argo CD template as configuration. State plainly that there is no remote, build URL, webhook, quality gate, image push, or Argo sync yet. Do not present the files as a successful run. |
| 8:30–9:20 | Monitoring and logs status | Show the prepared monitoring and Fluentd manifests. State that neither stack was installed and no metrics or archive is claimed. Show the evidence checklist for collecting them later. |
| 9:20–10:00 | Summary | Summarize the passing test, Compose readiness, healthy ARM64 cluster, bound PVC, persistence through restart, and observer RBAC. Name the remaining actions: connect private GitHub and CI credentials, then run monitoring, logging and Argo CD. |
| 10:00–12:00 | Optional recording detail | For the longer video, rerun individual commands slowly, pause on sanitized outputs, and show report and evidence index. Avoid recording user data, token files, session cookies, or Secret values. |

## Recording setup

1. Close other browser tabs and use only disposable account data.
2. Start the Compose or cluster demo and verify readiness before recording.
3. Keep terminal output visible long enough to read, but crop out home paths or account identifiers if desired.
4. Use the timings above as chapter markers. If recording is unavailable, submit this timed script and explicitly state that there is no video file.
