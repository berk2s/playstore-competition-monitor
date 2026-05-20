variable "name_prefix" {
  type = string
}

variable "secret_arns" {
  type        = list(string)
  description = "Secrets Manager ARNs the task-execution role must be allowed to read."
  default     = []
}

variable "kms_key_arns" {
  type        = list(string)
  description = "KMS key ARNs the task-execution role may Decrypt. Only needed if any secret in secret_arns is encrypted with a customer-managed key (CMK)."
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
