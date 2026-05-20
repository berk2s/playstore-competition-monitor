variable "name_prefix" {
  type        = string
  description = "Project + environment prefix (e.g. playstore-competition-monitor-prod)."
}

variable "service_name" {
  type        = string
  description = "Short service name (e.g. api, worker, web)."
}

variable "region" {
  type = string
}

variable "cluster_id" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_policies" {
  type        = map(string)
  default     = {}
  description = "Map of inline IAM policies (name => JSON) attached to the per-service task role."
}

variable "image" {
  type        = string
  description = "Full container image URI (ECR or public)."
}

variable "container_port" {
  type        = number
  default     = null
  description = "If set, the container exposes this port and a port mapping is added."
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "environment" {
  type    = list(object({ name = string, value = string }))
  default = []
}

variable "secrets" {
  type    = list(object({ name = string, valueFrom = string }))
  default = []
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs the tasks run in."
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "ingress_security_group_ids" {
  type        = list(string)
  default     = []
  description = "Source security groups allowed to reach container_port (e.g. the ALB SG)."
}

variable "target_group_arn" {
  type        = string
  default     = null
  description = "Optional ALB target group to register tasks against."
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
