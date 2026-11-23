terraform {
  required_version = ">= 1.6, < 2"
}

variable "cluster_name" {
  type    = string
  default = "task-lab"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,25}$", var.cluster_name))
    error_message = "Use 1–26 lowercase letters, numbers or hyphens, starting with a letter."
  }
}

module "cluster" {
  source = "./modules/cluster"
  name   = var.cluster_name
}

output "kubectl_context" {
  value = module.cluster.context
}
