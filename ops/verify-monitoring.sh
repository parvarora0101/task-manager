#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
kubectl_cmd=(kubectl --context kind-task-lab)
tmp=$(mktemp -d)
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -r "$tmp"
}
trap cleanup EXIT
forward() {
  "${kubectl_cmd[@]}" -n "$1" port-forward "svc/$2" "$3" > "$tmp/$2.log" 2>&1 &
  pids+=("$!")
}
forward monitoring metrics-kube-prometheus-sta-prometheus 39090:9090
forward monitoring metrics-grafana 33001:80
forward task-manager task-manager 33002:3000
for url in http://127.0.0.1:39090/-/ready http://127.0.0.1:33001/api/health http://127.0.0.1:33002/health/ready; do
  curl -fsS --retry 30 --retry-connrefused --retry-delay 2 "$url"
  printf '\n'
done
echo 'Generate 80 application requests across multiple scrape intervals'
for batch in {1..4}; do
  for request in {1..20}; do curl -fsS http://127.0.0.1:33002/ >/dev/null; done
  sleep 16
done
node --input-type=module <<'JS'
const queries = [
  ['HTTP 200 rate', 'sum(rate(task_http_requests_total{status="200"}[5m]))'],
  ['CPU cores', 'rate(task_process_cpu_seconds_total[5m])'],
  ['Resident memory bytes', 'task_process_resident_memory_bytes'],
  ['Available replicas', 'kube_deployment_status_replicas_available{namespace="task-manager"}'],
];
for (const [label, query] of queries) {
  const url = new URL('http://127.0.0.1:39090/api/v1/query');
  url.searchParams.set('query', query);
  const response = await fetch(url);
  const payload = await response.json();
  const samples = payload.data?.result ?? [];
  if (!response.ok || !samples.length || samples.some(sample => !Number.isFinite(Number(sample.value[1])))) {
    throw new Error(`Missing Prometheus sample for ${label}`);
  }
  console.log(label, samples.map(x => [x.metric.deployment ?? x.metric.pod ?? 'all', x.value[1]]));
}
JS
"${kubectl_cmd[@]}" -n monitoring get secret metrics-grafana -o json |
  node -e '
    let raw = "";
    process.stdin.setEncoding("utf8").on("data", chunk => raw += chunk).on("end", async () => {
      const { data } = JSON.parse(raw);
      const decode = key => Buffer.from(data[key], "base64").toString();
      const authorization = "Basic " + Buffer.from(decode("admin-user") + ":" + decode("admin-password")).toString("base64");
      const response = await fetch("http://127.0.0.1:33001/api/dashboards/uid/task-manager", { headers: { authorization } });
      if (!response.ok) throw new Error("Grafana dashboard request returned HTTP " + response.status);
      const { dashboard } = await response.json();
      if (dashboard.panels.length !== 4) throw new Error("Expected four Grafana panels");
      console.log("Grafana dashboard:", dashboard.title);
      console.log("Panels:", dashboard.panels.map(panel => panel.title).join(" | "));
    });
  '
