output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "Public DNS for the application load balancer."
}

output "cloudfront_domain" {
  value       = module.cloudfront.domain_name
  description = "CloudFront distribution serving the screenshots bucket."
}

output "screenshots_bucket" {
  value = module.screenshots.bucket_name
}

output "ecr_repositories" {
  value = module.ecr.repository_urls
}

output "redis_endpoint" {
  value     = module.redis.endpoint
  sensitive = true
}

output "nat_public_ip" {
  value       = module.network.nat_public_ip
  description = "Allowlist this IP in MongoDB Atlas (Network Access to IP Access List)."
}
