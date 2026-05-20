variable "name_prefix" {
  type = string
}

variable "cidr_block" {
  type    = string
  default = "10.30.0.0/16"
}

variable "az_count" {
  type    = number
  default = 2
}

variable "tags" {
  type    = map(string)
  default = {}
}
