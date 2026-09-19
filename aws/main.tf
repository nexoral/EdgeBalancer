terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
  required_version = ">= 1.3"

  backend "s3" {
    bucket       = "edgebalancer-tfstate-hyd"
    key          = "aws/terraform.tfstate"
    region       = "ap-south-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = trimspace(var.aws_region)
}

# ===================================================================
# AWS ECS + FARGATE (serverless compute — no instances to manage)
#
# Architecture (minimal, no NAT — tasks run in public subnets):
#   Internet → Cloudflare → ALB (HTTPS) → ECS Fargate Task → app:8000
#                                              ↓
#                                 ElastiCache Valkey (Serverless)
#
# Auto-scaling: app autoscaling — min 1 task, target-tracking on CPU
# (max 100 — App Autoscaling requires a max, this is effectively uncapped)
# Region: ap-south-2 (Hyderabad)
# ===================================================================

# ─── VPC (2 AZs, public subnets only) ─────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "edgebalancer-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "edgebalancer-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags                    = { Name = "public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags                    = { Name = "public-b" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# ─── Security Groups ──────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "edgebalancer-alb-sg"
  description = "HTTPS from Cloudflare to ALB"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "edgebalancer-ecs-sg"
  description = "Fargate task SG"
  vpc_id      = aws_vpc.main.id
  ingress {
    description     = "ALB to app"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "valkey" {
  name        = "edgebalancer-valkey-sg"
  description = "Valkey (ElastiCache Serverless)"
  vpc_id      = aws_vpc.main.id
  ingress {
    description     = "ECS to Valkey"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── IAM: task execution role (the ONLY role — image pull + logs) ─
resource "aws_iam_role" "ecs_task_execution" {
  name = "edgebalancer-ecs-task-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_exec" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─── CloudWatch Log Group (managed by TF — IAM policy has logs:*) ──
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/edgebalancer"
  retention_in_days = 7
  tags              = { Name = "edgebalancer-logs" }
}

# ─── ECS Cluster (Fargate) ────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "edgebalancer"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = "edgebalancer-ecs" }
}

# ─── ECS Task Definition (Fargate) ────────────────────────────────
resource "aws_ecs_task_definition" "app" {
  family                   = "edgebalancer-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name  = "edgebalancer-app"
      image = var.docker_image
      portMappings = [{
        containerPort = 8000
        protocol      = "tcp"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "edgebalancer"
        }
      }
      environment = [
        { name = "PORT", value = "8000" },
        { name = "REDIS_URL", value = "rediss://${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:6379" },
        { name = "JWT_SECRET", value = var.jwt_secret },
        { name = "MONGODB_URI", value = var.mongodb_uri },
        { name = "ENCRYPTION_KEY", value = var.encryption_key },
        { name = "CLIENT_URL", value = var.client_url },
        { name = "CORS_ORIGIN", value = var.cors_origin },
        { name = "FIREBASE_PROJECT_ID", value = var.firebase_project_id },
        { name = "FIREBASE_CLIENT_EMAIL", value = var.firebase_client_email },
        { name = "FIREBASE_PRIVATE_KEY", value = var.firebase_private_key },
        { name = "MISTRAL_API_KEY", value = var.mistral_api_key },
        { name = "OPENROUTER_API_KEY", value = var.openrouter_api_key },
        { name = "CLOUDFLARE_OAUTH_CLIENT_ID", value = var.cloudflare_oauth_client_id },
        { name = "CLOUDFLARE_OAUTH_CLIENT_SECRET", value = var.cloudflare_oauth_client_secret },
        { name = "CLOUDFLARE_OAUTH_REDIRECT_URI", value = var.cloudflare_oauth_redirect_uri },
        { name = "CASHFREE_APP_ID", value = var.cashfree_app_id },
        { name = "CASHFREE_SECRET_KEY", value = var.cashfree_secret_key },
        { name = "CASHFREE_ENV", value = var.cashfree_env },
      ]
    }
  ])
}

# ─── Load Balancer (stable HTTPS endpoint) ────────────────────────
resource "aws_lb" "main" {
  name               = "edgebalancer-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public.id, aws_subnet.public_b.id]
  security_groups    = [aws_security_group.alb.id]
  tags               = { Name = "edgebalancer-alb" }
}

resource "aws_lb_target_group" "app" {
  name        = "edgebalancer-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200-299"
  }
}

# Cloudflare Origin cert imported to ACM (same cert as the k3s setup)
resource "aws_acm_certificate" "cloudflare_origin" {
  certificate_body = var.cf_origin_cert
  private_key      = var.cf_origin_key
  tags             = { Name = "edgebalancer-cloudflare-cert" }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate.cloudflare_origin.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ─── ECS Service (Fargate, 1 task, your app) ──────────────────────
resource "aws_ecs_service" "app" {
  name            = "edgebalancer"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  lifecycle {
    ignore_changes = [desired_count]
  }

  network_configuration {
    subnets          = [aws_subnet.public.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "edgebalancer-app"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.https]
}

# ─── App Autoscaling (min 1, scale on CPU) ─────────────────────────
resource "aws_appautoscaling_target" "ecs" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 1
  max_capacity       = 100
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "edgebalancer-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = "ecs:service:DesiredCount"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# ─── ElastiCache Valkey (Serverless — no nodes, no subnet group) ───
resource "aws_elasticache_serverless_cache" "valkey" {
  engine = "valkey"
  name   = "edgebalancer-valkey"

  security_group_ids = [aws_security_group.valkey.id]
  subnet_ids         = [aws_subnet.public.id, aws_subnet.public_b.id]

  cache_usage_limits {
    data_storage {
      maximum = 5
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = 1000
    }
  }
  tags = { Name = "edgebalancer-valkey" }
}

# ─── Outputs (used by GitHub Actions for force-deploy) ────────────
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "alb_dns" {
  value = aws_lb.main.dns_name
}

output "valkey_endpoint" {
  value = "${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:${aws_elasticache_serverless_cache.valkey.endpoint[0].port}"
}