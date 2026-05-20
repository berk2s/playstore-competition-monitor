variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs the ElastiCache subnet group will cover."
}

variable "ingress_security_group_ids" {
  type        = list(string)
  description = "Source security groups allowed to reach Redis on port 6379."
}

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "engine_version" {
  type    = string
  default = "7.1"
}

variable "parameter_group_name" {
  type    = string
  default = "default.redis7"
}

variable "tags" {
  type    = map(string)
  default = {}
}
