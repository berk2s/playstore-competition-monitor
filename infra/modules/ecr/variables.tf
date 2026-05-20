variable "name_prefix" {
  type = string
}

variable "repository_names" {
  type        = set(string)
  description = "Short names of the ECR repositories to create (e.g. [\"api\", \"worker\", \"web\"])."
}

variable "tags" {
  type    = map(string)
  default = {}
}
