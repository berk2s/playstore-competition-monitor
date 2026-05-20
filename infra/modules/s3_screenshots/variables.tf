variable "name_prefix" {
  type = string
}

variable "transition_days" {
  type    = number
  default = 90
}

variable "expiration_days" {
  type    = number
  default = 365
}

variable "tags" {
  type    = map(string)
  default = {}
}
