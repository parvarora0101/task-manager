variable "name" {
  type = string
}

resource "terraform_data" "kind" {
  input            = var.name
  triggers_replace = [var.name]

  provisioner "local-exec" {
    command = "if kind get clusters | grep -Fxq \"$TASK_CLUSTER\"; then echo \"Reusing existing kind cluster $TASK_CLUSTER\"; else kind create cluster --name \"$TASK_CLUSTER\" --wait 120s; fi"
    environment = {
      TASK_CLUSTER = self.input
    }
  }
}

output "context" {
  value = "kind-${terraform_data.kind.output}"
}
