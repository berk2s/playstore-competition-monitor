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

output "github_actions_role_arn" {
  value       = module.github_oidc.role_arn
  description = "Paste into .github/workflows/deploy.yml as role-to-assume."
}

output "ecs_cluster_name" {
  value = "${local.name_prefix}-cluster"
}

output "ecs_service_names" {
  value = {
    api    = module.ecs_api.service_name
    worker = module.ecs_worker.service_name
    web    = module.ecs_web.service_name
  }
}
