variable "name_prefix" {
  type = string
}

variable "alb_name" {
  type        = string
  description = "Exact name of the ALB resource. AWS caps this at 32 chars."
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs the ALB will live in."
}

variable "tags" {
  type    = map(string)
  default = {}
}
