output "role_arn" {
  value       = aws_iam_role.deployer.arn
  description = "Paste this into the deploy workflow's role-to-assume."
}

output "oidc_provider_arn" {
  value = local.oidc_provider_arn
}
