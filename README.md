# Task Manager

**ENSP461 · DevOps & Automation Lab**

Task Manager is a private, per-account task board. Users register and sign in, create and edit tasks, set deadlines, move work through three statuses, and delete tasks. The project uses Node.js 24 and SQLite with no application packages to install. The capstone deployment uses Jenkins, Docker, Kubernetes, Ansible, Terraform, Prometheus, Grafana, Fluentd, SonarQube, Trivy and Argo CD.

## Run on your computer

Open the source checkout in VS Code. Install Node.js 24, then run:

```sh
npm test
npm start
```

Open <http://localhost:3000> and create an account with a password of at least 12 characters. The app creates `data/tasks.sqlite` on first run. Keep using the same browser hostname so the configured origin and session cookie match.

If you have Docker Compose:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

The Compose `tasks` named volume persists across a normal `docker compose down`. Avoid `docker compose down -v` when you want to keep the lab data.

Both runs use port 3000, so stop the first before starting the second. Compose stores data in a named volume. A normal `docker compose down` preserves it.

## Project files

| File or folder | Contents |
|---|---|
| `server.js`, `public/` | Node REST API and responsive task board |
| `test/` | HTTP integration test covering authentication, CRUD, access control and restart persistence |
| `Jenkinsfile` | Push-triggered CI, main-branch SonarQube gate, container smoke test, Trivy and registry publishing |
| `compose.yaml`, `Dockerfile` | Local container run and reusable app image |
| `k8s/` | Blue and green Deployments, Services, ConfigMap, PVC, probes and read-only observer Role |
| `ops/` | Ansible, Terraform, Argo CD, monitoring, logging and backup |
| [Deployment runbook](docs/RUNBOOK.md) | Configuration, GitHub and Jenkins setup, blue-green release and rollback |
| [Technical report](submission/technical-report.pdf) | Architecture diagram, design decisions, verification and remaining lab evidence |
| [Demo script](submission/recording-script.md) | Timed ten-minute presentation and twelve-minute recording script |
| [Evidence index](submission/EVIDENCE.md) | Rubric mapping to commands and verified or remaining results |

The provided folder may be an extracted source tree without Git metadata. Run `git init -b main` only when you are ready to create local history, then add an authorized private GitHub remote. No remote URL or hosted CI result is implied by this source copy.

## Apple Silicon kind deployment

Install Docker Desktop, Node.js 24, kind, kubectl, Terraform and Ansible. Start Docker Desktop. Reuse the existing `task-lab` cluster when it is present. For a fresh setup:

```sh
terraform -chdir=ops/terraform init
terraform -chdir=ops/terraform plan -out=lab.plan
terraform -chdir=ops/terraform apply lab.plan
ansible-playbook -i localhost, ops/ansible/workstation.yml
kubectl --context kind-task-lab -n task-manager get deploy,pods,svc,pvc
```

Use the [runbook](docs/RUNBOOK.md) to verify rollouts, install observability and connect GitOps. The [standalone architecture diagram](submission/architecture.pdf) shows the app and delivery paths.

## REST API

All requests and responses use JSON except where indicated. The client receives an opaque session cookie after registration or login. Send the exact `APP_ORIGIN` in the Origin header for writes. Every task lookup is scoped to the signed-in account.

| Method | Path | Payload or format |
|---|---|---|
| POST | `/api/register`, `/api/login` | `email`, `password` |
| GET | `/api/me` | Signed-in email |
| POST | `/api/logout` | 204 |
| GET | `/api/tasks?page=1` | Up to 50 records and `hasMore` |
| POST | `/api/tasks` | `title`, optional `notes`, `status` and `due` |
| GET | `/api/tasks/{id}` | Task with revision |
| PUT | `/api/tasks/{id}` | Task fields plus current `revision`. A stale revision returns 409. |
| DELETE | `/api/tasks/{id}` | 204 |
| GET | `/health/live`, `/health/ready` | Kubernetes probes |
| GET | `/metrics` | Prometheus exposition with bearer authentication |

Status values are `todo`, `doing`, `done`. Due dates use `YYYY-MM-DD` or an empty string. Errors include an HTTP status, a message and a request ID.

## Deployment scope

The default deployment is a single-node lab installation. Blue and green use the same persistent SQLite database and must stay on one node with a local filesystem. Local volume storage is a single point of failure. An Internet-facing installation needs a TLS reverse proxy with matching `APP_ORIGIN`, controlled registration and a backup policy. Multi-node availability requires migrating to a database designed for networked access, such as PostgreSQL.
