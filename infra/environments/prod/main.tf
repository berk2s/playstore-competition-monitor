locals {
  name_prefix  = "${var.project}-${var.environment}"
  short_prefix = "pcm-${var.environment}"

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  images = {
    api    = "${module.ecr.repository_urls["api"]}:latest"
    worker = "${module.ecr.repository_urls["worker"]}:latest"
    web    = "${module.ecr.repository_urls["web"]}:latest"
  }
}

module "network" {
  source      = "../../modules/network"
  name_prefix = local.name_prefix
  tags        = local.tags
}

module "ecr" {
  source           = "../../modules/ecr"
  name_prefix      = local.name_prefix
  repository_names = ["api", "worker", "web"]
  tags             = local.tags
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${local.name_prefix}/redis-url"
  description             = "Redis URL for BullMQ (managed by Terraform)"
  recovery_window_in_days = 0
  tags                    = local.tags
}

module "alb" {
  source      = "../../modules/alb"
  name_prefix = local.name_prefix
  alb_name    = "${local.short_prefix}-alb"
  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.public_subnet_ids
  tags        = local.tags
}

module "screenshots" {
  source      = "../../modules/s3_screenshots"
  name_prefix = local.name_prefix
  tags        = local.tags
}

module "cloudfront" {
  source                      = "../../modules/cloudfront"
  name_prefix                 = local.name_prefix
  bucket_id                   = module.screenshots.bucket_id
  bucket_arn                  = module.screenshots.bucket_arn
  bucket_regional_domain_name = module.screenshots.bucket_regional_domain_name
  tags                        = local.tags
}

module "ecs_cluster" {
  source      = "../../modules/ecs_cluster"
  name_prefix = local.name_prefix
  secret_arns = [
    var.mongo_uri_secret_arn,
    aws_secretsmanager_secret.redis_url.arn,
  ]
  tags = local.tags
}

resource "aws_lb_target_group" "api" {
  name        = "${local.short_prefix}-api"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = module.network.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.tags
}

resource "aws_lb_target_group" "web" {
  name        = "${local.short_prefix}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.network.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.tags
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = module.alb.listener_arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health", "/ready"]
    }
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = module.alb.listener_arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}

module "ecs_api" {
  source                     = "../../modules/ecs_service"
  name_prefix                = local.name_prefix
  service_name               = "api"
  region                     = var.region
  cluster_id                 = module.ecs_cluster.cluster_id
  execution_role_arn         = module.ecs_cluster.execution_role_arn
  image                      = local.images.api
  container_port             = 4000
  cpu                        = var.api_cpu
  memory                     = var.api_memory
  desired_count              = var.api_desired_count
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  ingress_security_group_ids = [module.alb.security_group_id]
  target_group_arn           = aws_lb_target_group.api.arn

  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "API_PORT", value = "4000" },
    { name = "STORAGE_DRIVER", value = "s3" },
    { name = "PUBLIC_ASSET_BASE_URL", value = "https://${module.cloudfront.domain_name}" },
    { name = "CORS_ORIGIN", value = "http://${module.alb.alb_dns_name}" },
  ]

  secrets = [
    { name = "MONGO_URI", valueFrom = var.mongo_uri_secret_arn },
    { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
  ]

  tags = local.tags
}

data "aws_iam_policy_document" "worker_s3" {
  statement {
    actions   = ["s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${module.screenshots.bucket_arn}/*"]
  }
}

module "ecs_worker" {
  source                = "../../modules/ecs_service"
  name_prefix           = local.name_prefix
  service_name          = "worker"
  region                = var.region
  cluster_id            = module.ecs_cluster.cluster_id
  execution_role_arn    = module.ecs_cluster.execution_role_arn
  task_role_policies = {
    s3 = data.aws_iam_policy_document.worker_s3.json
  }
  image                 = local.images.worker
  cpu                   = var.worker_cpu
  memory                = var.worker_memory
  desired_count         = var.worker_desired_count
  vpc_id                = module.network.vpc_id
  subnet_ids            = module.network.private_subnet_ids

  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "STORAGE_DRIVER", value = "s3" },
    { name = "S3_BUCKET", value = module.screenshots.bucket_name },
    { name = "S3_REGION", value = var.region },
    { name = "PUBLIC_ASSET_BASE_URL", value = "https://${module.cloudfront.domain_name}" },
    { name = "CAPTURE_CRON", value = var.capture_cron },
    { name = "CAPTURE_CONCURRENCY", value = var.capture_concurrency },
  ]

  secrets = [
    { name = "MONGO_URI", valueFrom = var.mongo_uri_secret_arn },
    { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
  ]

  tags = local.tags
}

module "ecs_web" {
  source                     = "../../modules/ecs_service"
  name_prefix                = local.name_prefix
  service_name               = "web"
  region                     = var.region
  cluster_id                 = module.ecs_cluster.cluster_id
  execution_role_arn         = module.ecs_cluster.execution_role_arn
  image                      = local.images.web
  container_port             = 3000
  cpu                        = var.web_cpu
  memory                     = var.web_memory
  desired_count              = var.web_desired_count
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  ingress_security_group_ids = [module.alb.security_group_id]
  target_group_arn           = aws_lb_target_group.web.arn

  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "HOSTNAME", value = "0.0.0.0" },
  ]

  tags = local.tags
}

module "redis" {
  source      = "../../modules/redis"
  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.private_subnet_ids
  ingress_security_group_ids = [
    module.ecs_api.security_group_id,
    module.ecs_worker.security_group_id,
  ]
  node_type = var.redis_node_type
  tags      = local.tags
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = module.redis.url
}
