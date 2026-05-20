variable "region" {
  type    = string
  default = "eu-west-3"
}

variable "project" {
  type    = string
  default = "playstore-competition-monitor"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "mongo_uri_secret_arn" {
  type        = string
  description = "Secrets Manager ARN holding the MongoDB Atlas connection URI (created out of band)."
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "worker_cpu" {
  type    = number
  default = 1024
}

variable "worker_memory" {
  type        = number
  default     = 2048
  description = "Chromium needs headroom - 2 GB minimum."
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "capture_cron" {
  type    = string
  default = "0 * * * *"
}

variable "capture_concurrency" {
  type    = string
  default = "2"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}
