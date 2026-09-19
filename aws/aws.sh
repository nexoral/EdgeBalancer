#!/usr/bin/env bash
# aws/aws.sh — interactive account bootstrap / teardown for EdgeBalancer.
#   ./aws.sh            -> prompt: activate (ready for CI/CD terraform) or down (full delete)
#   ./aws.sh activate   -> create prerequisites non-interactively
#   ./aws.sh down       -> full delete non-interactively (still asks for confirmation)
#
#   activate: creates S3 tfstate bucket + IAM terraform-deploy user/policy + access key.
#             Terraform itself ONLY runs in .github/workflows/deploy.yml (CI/CD), never locally.
#   down:     deletes EVERYTHING with edgebalancer* prefix + S3 bucket + terraform-deploy user/policy
#             via aws CLI only (no terraform destroy locally). Safe to re-run.
#
#   Scope: only resources whose names contain/prefix edgebalancer* or the single bucket
#          edgebalancer-tfstate-hyd. Default VPC, unrelated buckets, EC2, etc. are never touched.
set -uo pipefail

BUCKET="edgebalancer-tfstate-hyd"
REGION="ap-south-2"
USER="terraform-deploy"
POLICY="TerraformEdgeBalancer"
POLICY_FILE="$(mktemp)"

# Force all regional AWS calls to ap-south-2 (your aws configure default is ap-south-1,
# but the stack lives in ap-south-2 — without this, down misses the ALB/ECS/VPC)
export AWS_DEFAULT_REGION="$REGION"
export AWS_REGION="$REGION"

cat > "$POLICY_FILE" <<'POLICY_JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:*",
        "ec2:*",
        "ecs:*",
        "elasticloadbalancing:*",
        "elasticache:*",
        "autoscaling:*",
        "application-autoscaling:*",
        "acm:*",
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:DeleteAlarms",
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:GetInstanceProfile",
        "iam:CreateInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:CreateServiceLinkedRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": ["ecs-tasks.amazonaws.com", "ec2.amazonaws.com"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": ["arn:aws:s3:::edgebalancer-tfstate-hyd","arn:aws:s3:::edgebalancer-tfstate-hyd/*"]
    }
  ]
}
POLICY_JSON

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then echo "aws CLI not found"; exit 1; fi
  if ! aws sts get-caller-identity >/dev/null 2>&1; then echo "aws not logged in (aws sts get-caller-identity failed)"; exit 1; fi
  echo "AWS account: $(aws sts get-caller-identity --query Account --output text)  region: $REGION  bucket: $BUCKET  user: $USER"
  echo ""
}

activate() {
  echo "=== ACTIVATE — ready account for Terraform (CI/CD only) ==="
  echo "This creates (if missing): S3 $BUCKET + IAM $USER + policy $POLICY + access key."
  echo "Terraform apply will still ONLY run in .github/workflows/deploy.yml."
  echo ""

  # --- S3 bucket ---
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    echo "S3 $BUCKET already exists — ensuring versioning + encryption"
  else
    echo "Creating S3 $BUCKET in $REGION..."
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
    echo "S3 created"
  fi
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled 2>/dev/null || true
  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]
  }' 2>/dev/null || true
  # Block public access (best practice for tfstate)
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration '{
    "BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true
  }' 2>/dev/null || true
  echo "S3 versioning + encryption ensured"

  # --- IAM policy ---
  POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY"
  if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    echo "Policy $POLICY exists — updating to latest document"
    # create new version and set as default (keep only 5 versions)
    aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "file://$POLICY_FILE" --set-as-default >/dev/null 2>&1 || true
    # prune old non-default versions if >4
    for v in $(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text 2>/dev/null); do
      aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v" 2>/dev/null || true
    done
  else
    echo "Creating policy $POLICY..."
    aws iam create-policy --policy-name "$POLICY" --policy-document "file://$POLICY_FILE" --description "Terraform deployment permissions for EdgeBalancer" >/dev/null
    POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$POLICY"
    echo "Policy created"
  fi

  # --- IAM user ---
  if aws iam get-user --user-name "$USER" >/dev/null 2>&1; then
    echo "User $USER already exists"
  else
    echo "Creating user $USER..."
    aws iam create-user --user-name "$USER" >/dev/null
    echo "User created"
  fi
  # attach policy (idempotent)
  aws iam attach-user-policy --user-name "$USER" --policy-arn "$POLICY_ARN" 2>/dev/null || true
  echo "Policy attached to $USER"

  # --- Access key (create one, print once) ---
  echo ""
  echo "Creating access key for $USER (save these — secret shown only once)..."
  # warn if already 2 keys (limit)
  EXISTING_KEYS=$(aws iam list-access-keys --user-name "$USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || true)
  KEY_COUNT=$(echo "$EXISTING_KEYS" | wc -w)
  if [ "$KEY_COUNT" -ge 2 ]; then
    echo "User already has 2 access keys — delete one first:"
    echo "  $EXISTING_KEYS"
    echo "Skipping key creation."
  else
    CREATED=$(aws iam create-access-key --user-name "$USER" --output json 2>/dev/null || true)
    if [ -n "$CREATED" ] && [ "$CREATED" != "None" ]; then
      AKID=$(echo "$CREATED" | python3 -c "import sys,json; print(json.load(sys.stdin)['AccessKey']['AccessKeyId'])" 2>/dev/null || true)
      SECRET=$(echo "$CREATED" | python3 -c "import sys,json; print(json.load(sys.stdin)['AccessKey']['SecretAccessKey'])" 2>/dev/null || true)
      echo ""
      echo "================ SAVE THESE — ADD TO GITHUB SECRETS ================"
      echo "AWS_ACCESS_KEY_ID:     $AKID"
      echo "AWS_SECRET_ACCESS_KEY: $SECRET"
      echo "AWS_REGION:            $REGION"
      echo "TFSTATE_BUCKET:        $BUCKET"
      echo "Add as GitHub repo secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
      echo "Terraform backend in aws/main.tf already points to s3://$BUCKET/aws/terraform.tfstate"
      echo "====================================================================="
    else
      echo "Failed to create access key — check iam:CreateAccessKey permission"
    fi
  fi

  echo ""
  echo "Activate done. Verify:"
  aws s3api get-bucket-versioning --bucket "$BUCKET" --query Status --output text 2>&1
  aws iam get-user --user-name "$USER" --query 'User.Arn' --output text 2>&1
  aws iam list-attached-user-policies --user-name "$USER" --query 'AttachedPolicies[].PolicyName' --output text 2>&1
  echo "Next: push to main — .github/workflows/deploy.yml will run terraform apply in CI/CD."
}

empty_and_delete_bucket() {
  local bucket="$1"
  if ! aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    echo "S3 $bucket already absent"
    return 0
  fi
  echo "Emptying S3 $bucket (all versions + delete markers)..."
  # delete in batches; repeat until empty (handles >1000)
  while true; do
    # list up to 1000 versions/markers, build delete JSON, delete
    aws s3api list-object-versions --bucket "$bucket" --query '{Objects: Versions[].{Key: Key, VersionId: VersionId}}' --output json 2>/dev/null > /tmp/vers.json || true
    aws s3api list-object-versions --bucket "$bucket" --query '{Objects: DeleteMarkers[].{Key: Key, VersionId: VersionId}}' --output json 2>/dev/null > /tmp/markers.json || true
    COUNT_V=$(python3 -c "import json,sys; d=json.load(open('/tmp/vers.json')); print(len(d.get('Objects') or []))" 2>/dev/null || echo 0)
    COUNT_M=$(python3 -c "import json,sys; d=json.load(open('/tmp/markers.json')); print(len(d.get('Objects') or []))" 2>/dev/null || echo 0)
    if [ "$COUNT_V" -eq 0 ] && [ "$COUNT_M" -eq 0 ]; then
      # also delete any non-versioned objects (if versioning was off at some point)
      aws s3 rm "s3://$bucket" --recursive 2>/dev/null || true
      break
    fi
    if [ "$COUNT_V" -gt 0 ]; then
      python3 -c "
import json
d=json.load(open('/tmp/vers.json'))
objs=d.get('Objects') or []
if objs:
    import subprocess, shlex
    payload=json.dumps({'Objects': objs[:1000], 'Quiet': True})
    open('/tmp/del.json','w').write(payload)
" 2>/dev/null || true
      if [ -f /tmp/del.json ]; then aws s3api delete-objects --bucket "$bucket" --delete file:///tmp/del.json 2>/dev/null || true; fi
    fi
    if [ "$COUNT_M" -gt 0 ]; then
      python3 -c "
import json
d=json.load(open('/tmp/markers.json'))
objs=d.get('Objects') or []
if objs:
    open('/tmp/del2.json','w').write(json.dumps({'Objects': objs[:1000], 'Quiet': True}))
" 2>/dev/null || true
      if [ -f /tmp/del2.json ]; then aws s3api delete-objects --bucket "$bucket" --delete file:///tmp/del2.json 2>/dev/null || true; fi
    fi
    sleep 1
  done
  echo "Deleting bucket $bucket..."
  aws s3api delete-bucket --bucket "$bucket" 2>/dev/null || true
  echo "S3 $bucket deleted"
}

down() {
  echo "=== DOWN — full delete of all edgebalancer* resources (via aws CLI, no terraform) ==="
  echo "This will DELETE: ECS edgebalancer, ALB edgebalancer-alb, TG edgebalancer-tg,"
  echo "  ElastiCache edgebalancer-valkey, ACM unused certs, log group /ecs/edgebalancer,"
  echo "  IAM roles edgebalancer*, S3 $BUCKET (and all versions), IAM user $USER + policy $POLICY,"
  echo "  and non-default VPCs that belong to edgebalancer."
  echo "Terraform will ONLY run in CI/CD (.github/workflows/deploy.yml) — this down is local aws CLI only."
  echo ""
  read -r -p "Type DOWN to confirm full delete: " CONFIRM
  if [ "$CONFIRM" != "DOWN" ]; then echo "Aborted"; exit 1; fi
  echo ""

  echo "=== 1. ECS service + task definitions + cluster ==="
  for s in $(aws ecs list-services --cluster edgebalancer --query 'serviceArns' --output text 2>/dev/null); do
    aws ecs update-service --cluster edgebalancer --service "$s" --desired-count 0 2>/dev/null || true
    aws ecs delete-service --cluster edgebalancer --service "$s" --force 2>/dev/null || true
  done
  sleep 5
  for t in $(aws ecs list-task-definitions --family-prefix edgebalancer --query 'taskDefinitionArns' --output text 2>/dev/null); do
    aws ecs deregister-task-definition --task-definition "$t" 2>/dev/null || true
    aws ecs delete-task-definitions --task-definitions "$t" 2>/dev/null || true
  done
  aws ecs delete-cluster --cluster edgebalancer 2>/dev/null || true

  echo "=== 2. ALB (wait until gone) + target group ==="
  ALB=$(aws elbv2 describe-load-balancers --names edgebalancer-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)
  if [ -n "$ALB" ] && [ "$ALB" != "None" ]; then
    aws elbv2 delete-load-balancer --load-balancer-arn "$ALB" 2>/dev/null || true
    for i in $(seq 1 60); do
      REMAIN=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB" --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)
      [ -z "$REMAIN" ] || [ "$REMAIN" = "None" ] && break
      sleep 10
    done
    echo "ALB deleted"
  fi
  TG=$(aws elbv2 describe-target-groups --names edgebalancer-tg --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)
  if [ -n "$TG" ] && [ "$TG" != "None" ]; then
    aws elbv2 delete-target-group --target-group-arn "$TG" 2>/dev/null || true
  fi

  echo "=== 3. ElastiCache Valkey (serverless or replication group) ==="
  SC=$(aws elasticache describe-serverless-caches --query "ServerlessCaches[?ServerlessCacheName=='edgebalancer-valkey'].ServerlessCacheName" --output text 2>/dev/null || true)
  if [ -n "$SC" ] && [ "$SC" != "None" ]; then
    aws elasticache delete-serverless-cache --serverless-cache-name edgebalancer-valkey >/dev/null 2>&1 || true
    sleep 10
    for i in $(seq 1 60); do
      REMAIN=$(aws elasticache describe-serverless-caches --serverless-cache-name edgebalancer-valkey --query 'ServerlessCaches[0].ServerlessCacheName' --output text 2>/dev/null || true)
      [ -z "$REMAIN" ] || [ "$REMAIN" = "None" ] && break
      sleep 10
    done
    echo "Serverless Valkey deleted"
  fi
  RG=$(aws elasticache describe-replication-groups --replication-group-id edgebalancer-valkey --query 'ReplicationGroups[0].ReplicationGroupId' --output text 2>/dev/null || true)
  if [ -n "$RG" ] && [ "$RG" != "None" ]; then
    aws elasticache delete-replication-group --replication-group-id edgebalancer-valkey >/dev/null 2>&1 || true
    for i in $(seq 1 120); do
      REMAIN=$(aws elasticache describe-replication-groups --replication-group-id edgebalancer-valkey --query 'ReplicationGroups[0].ReplicationGroupId' --output text 2>/dev/null || true)
      [ -z "$REMAIN" ] || [ "$REMAIN" = "None" ] && break
      sleep 10
    done
    echo "Valkey deleted"
  fi
  aws elasticache delete-cache-subnet-group --cache-subnet-group-name edgebalancer-valkey-subnet 2>/dev/null || true

  echo "=== 4. ACM certificates no longer in use (edgebalancer*) ==="
  for c in $(aws acm list-certificates --query 'CertificateSummaryList[].CertificateArn' --output text 2>/dev/null); do
    INUSE=$(aws acm describe-certificate --certificate-arn "$c" --query 'Certificate.InUseBy' --output text 2>/dev/null || true)
    if [ -z "$INUSE" ] || [ "$INUSE" = "None" ]; then
      # only delete if it looks like ours (has edgebalancer tag or domain), otherwise skip to avoid touching prod certs
      TAGS=$(aws acm list-tags-for-certificate --certificate-arn "$c" --query 'Tags[?Key==`Name`].Value' --output text 2>/dev/null || true)
      if echo "$TAGS" | grep -qi edgebalancer 2>/dev/null; then
        aws acm delete-certificate --certificate-arn "$c" 2>/dev/null || true
      fi
    fi
  done

  echo "=== 5. CloudWatch log group ==="
  aws logs delete-log-group --log-group-name /ecs/edgebalancer 2>/dev/null || true

  echo "=== 6. IAM roles edgebalancer* ==="
  for r in $(aws iam list-roles --query 'Roles[?starts_with(RoleName,`edgebalancer`)].RoleName' --output text 2>/dev/null); do
    for p in $(aws iam list-attached-role-policies --role-name "$r" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
      aws iam detach-role-policy --role-name "$r" --policy-arn "$p" 2>/dev/null || true
    done
    for p in $(aws iam list-role-policies --role-name "$r" --query 'PolicyNames' --output text 2>/dev/null); do
      aws iam delete-role-policy --role-name "$r" --policy-name "$p" 2>/dev/null || true
    done
    aws iam delete-role --role-name "$r" 2>/dev/null || true
  done
  for ip in $(aws iam list-instance-profiles --query 'InstanceProfiles[?starts_with(InstanceProfileName,`edgebalancer`)].InstanceProfileName' --output text 2>/dev/null); do
    for r in $(aws iam get-instance-profile --instance-profile-name "$ip" --query 'InstanceProfile.Roles[].RoleName' --output text 2>/dev/null); do
      aws iam remove-role-from-instance-profile --instance-profile-name "$ip" --role-name "$r" 2>/dev/null || true
    done
    aws iam delete-instance-profile --instance-profile-name "$ip" 2>/dev/null || true
  done

  echo "=== 7. S3 tfstate bucket (full) ==="
  empty_and_delete_bucket "$BUCKET"

  echo "=== 8. IAM terraform-deploy user + policy ==="
  # delete access keys first, then detach, then user, then policy
  for k in $(aws iam list-access-keys --user-name "$USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null); do
    aws iam delete-access-key --user-name "$USER" --access-key-id "$k" 2>/dev/null || true
  done
  POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text 2>/dev/null):policy/$POLICY"
  aws iam detach-user-policy --user-name "$USER" --policy-arn "$POLICY_ARN" 2>/dev/null || true
  aws iam delete-user --user-name "$USER" 2>/dev/null || true
  # delete policy versions then policy (must detach first — already done above plus roles)
  for r in $(aws iam list-entities-for-policy --policy-arn "$POLICY_ARN" --query 'PolicyRoles[].RoleName' --output text 2>/dev/null); do
    aws iam detach-role-policy --role-name "$r" --policy-arn "$POLICY_ARN" 2>/dev/null || true
  done
  for u in $(aws iam list-entities-for-policy --policy-arn "$POLICY_ARN" --query 'PolicyUsers[].UserName' --output text 2>/dev/null); do
    aws iam detach-user-policy --user-name "$u" --policy-arn "$POLICY_ARN" 2>/dev/null || true
  done
  for v in $(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text 2>/dev/null); do
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v" 2>/dev/null || true
  done
  aws iam delete-policy --policy-arn "$POLICY_ARN" 2>/dev/null || true
  echo "IAM $USER + $POLICY deleted (if existed)"

  echo "=== 9. Non-default VPCs: full internal sweep then delete (edgebalancer only) ==="
  for VPC in $(aws ec2 describe-vpcs --filters Name=is-default,Values=false --query 'Vpcs[].VpcId' --output text 2>/dev/null); do
    # only touch VPCs that look like ours (tag edgebalancer) to avoid deleting unrelated VPCs
    TAG=$(aws ec2 describe-tags --filters Name=resource-id,Values="$VPC" Name=key,Values=Name --query 'Tags[0].Value' --output text 2>/dev/null || true)
    if ! echo "$TAG" | grep -qi edgebalancer 2>/dev/null; then
      # also check if it has our subnets/sgs — if not ours, skip
      HAS_OURS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC" --query 'Subnets[].Tags[?Key==`Name`].Value' --output text 2>/dev/null | grep -c edgebalancer || true)
      if [ "$HAS_OURS" -eq 0 ]; then
        echo "Skipping VPC $VPC (not edgebalancer) — tagged $TAG"
        continue
      fi
    fi
    echo "--- sweeping $VPC ($TAG) ---"
    for eni in $(aws ec2 describe-network-interfaces --filters Name=vpc-id,Values="$VPC" --query 'NetworkInterfaces[].NetworkInterfaceId' --output text 2>/dev/null); do
      ATT=$(aws ec2 describe-network-interfaces --network-interface-ids "$eni" --query 'NetworkInterfaces[0].Attachment.AttachmentId' --output text 2>/dev/null || true)
      if [ -n "$ATT" ] && [ "$ATT" != "None" ]; then
        aws ec2 detach-network-interface --attachment-id "$ATT" 2>/dev/null || true
        sleep 3
      fi
      aws ec2 delete-network-interface --network-interface-id "$eni" 2>/dev/null || true
    done
    for s in $(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC" --query 'Subnets[].SubnetId' --output text 2>/dev/null); do
      aws ec2 delete-subnet --subnet-id "$s" 2>/dev/null || true
    done
    for r in $(aws ec2 describe-route-tables --filters Name=vpc-id,Values="$VPC" --query 'RouteTables[?Associations[0].Main!=true].RouteTableId' --output text 2>/dev/null); do
      aws ec2 delete-route-table --route-table-id "$r" 2>/dev/null || true
    done
    for s in $(aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null); do
      aws ec2 delete-security-group --group-id "$s" 2>/dev/null || true
    done
    for pass in 2 3; do
      for s in $(aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null); do
        aws ec2 delete-security-group --group-id "$s" 2>/dev/null || true
      done
    done
    IGW=$(aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values="$VPC" --query 'InternetGateways[0].InternetGatewayId' --output text 2>/dev/null || true)
    if [ -n "$IGW" ] && [ "$IGW" != "None" ]; then
      aws ec2 detach-internet-gateway --internet-gateway-id "$IGW" --vpc-id "$VPC" 2>/dev/null || true
      aws ec2 delete-internet-gateway --internet-gateway-id "$IGW" 2>/dev/null || true
    fi
    for i in $(seq 1 10); do
      if aws ec2 delete-vpc --vpc-id "$VPC" 2>/dev/null; then
        echo "VPC $VPC deleted"
        break
      fi
      echo "retry $i: $VPC still has dependencies"
      sleep 5
    done
  done

  echo ""
  echo "================ VERIFY (edgebalancer should be empty) ================"
  echo "S3 $BUCKET:            $(aws s3api head-bucket --bucket "$BUCKET" 2>&1 >/dev/null && echo 'exists' || echo 'deleted')"
  echo "IAM $USER:             $(aws iam get-user --user-name "$USER" --query 'User.UserName' --output text 2>/dev/null || echo 'deleted')"
  echo "IAM policy $POLICY:    $(aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text 2>/dev/null):policy/$POLICY" --query 'Policy.PolicyName' --output text 2>/dev/null || echo 'deleted')"
  echo "non-default VPCs:  $(aws ec2 describe-vpcs --filters Name=is-default,Values=false --query 'length(Vpcs)' --output text 2>/dev/null)"
  echo "ECS clusters:      $(aws ecs list-clusters --query 'length(clusterArns)' --output text 2>/dev/null)"
  echo "ECS services:      $(aws ecs list-services --cluster edgebalancer --query 'length(serviceArns)' --output text 2>/dev/null)"
  echo "ALBs:              $(aws elbv2 describe-load-balancers --query 'length(LoadBalancers)' --output text 2>/dev/null)"
  echo "Valkey serverless:  $(aws elasticache describe-serverless-caches --query 'length(ServerlessCaches)' --output text 2>/dev/null)"
  echo "log group:         $(aws logs describe-log-groups --log-group-name-prefix /ecs/edgebalancer --query 'length(logGroups)' --output text 2>/dev/null)"
  echo "IAM edgebalancer roles: $(aws iam list-roles --query 'Roles[?starts_with(RoleName,`edgebalancer`)].RoleName' --output text 2>/dev/null || echo 'none')"
  echo "======================================================================"
  echo "Down done. To re-activate, run: ./aws.sh activate"
}

usage() {
  echo "Usage: ./aws.sh [activate|down]"
  echo "  activate — create S3 + IAM prerequisites for Terraform CI/CD"
  echo "  down     — full delete of all edgebalancer resources (asks for confirmation)"
  echo "  (no args) — interactive prompt"
}

main() {
  case "${1:-}" in
    -h|--help|help) usage; exit 0 ;;
  esac
  require_aws
  MODE="${1:-}"
  if [ -z "$MODE" ]; then
    echo "EdgeBalancer AWS account manager"
    echo "  1) activate — ready account for Terraform (CI/CD)"
    echo "  2) down     — full delete (local aws CLI)"
    echo ""
    read -r -p "Choose [1/2/activate/down]: " MODE
    case "$MODE" in
      1|activate) MODE="activate" ;;
      2|down) MODE="down" ;;
      *) echo "Invalid choice"; exit 1 ;;
    esac
  fi
  case "$MODE" in
    activate) activate ;;
    down) down ;;
    *) usage; exit 1 ;;
  esac
  rm -f "$POLICY_FILE" /tmp/vers.json /tmp/markers.json /tmp/del.json /tmp/del2.json 2>/dev/null || true
}

main "$@"
