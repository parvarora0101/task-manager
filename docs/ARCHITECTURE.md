# Task Manager Delivery Architecture

The diagram shows the intended delivery path and the local runtime topology. CI, registry publication, Argo CD, Prometheus, Grafana and Fluentd are configured in source but remain unverified until their services are connected and run. The two application slots and the kind deployment were verified locally.

```mermaid
flowchart LR
  Dev[Developer] -->|push| GitHub[Private GitHub repository\nnot connected]
  GitHub -->|webhook| Jenkins[Jenkins pipeline\nnot connected]
  Jenkins -->|tests · Sonar gate · Trivy| Registry[Image registry\nnot configured]
  Registry -->|image| K8s
  GitHub -->|desired manifests| Argo[Argo CD\nnot connected]
  Argo -->|reconcile| K8s[Kubernetes · kind-task-lab\nARM64 · verified]

  User[User traffic] --> Live[task-manager Service\nblue selector]
  Reviewer[Release review] --> Preview[task-preview Service\ngreen selector]
  Live --> Blue[Blue Deployment\n1 replica · verified]
  Preview --> Green[Green Deployment\n1 replica · verified]
  K8s --> Blue
  K8s --> Green
  Blue --> PVC[(task-data PVC · 1 GiB\nBound · shared SQLite)]
  Green --> PVC

  Blue -->|/metrics · bearer token| Prom[Prometheus\nnot installed]
  Green -->|/metrics · bearer token| Prom
  Prom --> Grafana[Grafana\nnot installed]
  Blue -->|container stdout/stderr| Fluentd[Fluentd agent and collector\nverified]
  Green -->|container stdout/stderr| Fluentd
  Fluentd --> Archive[(Persistent log archive\n2 GiB PVC · verified)]
```

## Traffic and persistence

The live Service selects `slot: blue`; the preview Service selects `slot: green`. A Git change can switch both selectors as one promotion, then revert them for rollback. Both deployments mount the same PVC. This is suitable only for the single-node lab: SQLite and a shared local filesystem do not provide safe multi-node database semantics.

## Evidence boundary

Solid topology labels marked verified were inspected against the running local cluster. Integrations explicitly marked “not connected” or “not installed” are design intent only. See [EVIDENCE.md](EVIDENCE.md) for the rubric mapping.
