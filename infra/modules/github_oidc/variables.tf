variable "name_prefix" {
  type = string
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "allowed_branches" {
  type        = list(string)
  default     = ["main"]
  description = "Branches whose workflows may assume the role."
}

variable "ecr_repository_arns" {
  type        = list(string)
  description = "ARNs of ECR repos the workflow may push to."
}

variable "ecs_cluster_arn" {
  type = string
}

variable "ecs_service_arns" {
  type        = list(string)
  description = "ARNs of ECS services the workflow may UpdateService on."
}

variable "create_oidc_provider" {
  type        = bool
  default     = true
  description = "Set to false if a GitHub OIDC provider already exists in this AWS account (only one is allowed per account)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
