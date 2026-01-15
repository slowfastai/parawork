#!/bin/bash

# EC2 SSH Access Diagnostic and Fix Script
# Instance: i-08f6a5547dfea58a0 (pinyin)

INSTANCE_ID="i-08f6a5547dfea58a0"
KEY_FILE="pinyin_ec2.pem"
AWS_REGION="us-east-1"

echo "=== EC2 SSH Diagnostic Script ==="
echo "Instance ID: $INSTANCE_ID"
echo "Region: $AWS_REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli  # macOS"
    echo "   Or visit: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

echo "✅ AWS CLI configured"
echo ""

# Get instance details
echo "📋 Fetching instance details..."
INSTANCE_INFO=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch instance details:"
    echo "$INSTANCE_INFO"
    exit 1
fi

# Extract key information
PUBLIC_IP=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].PublicIpAddress')
STATE=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].State.Name')
SECURITY_GROUPS=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].SecurityGroups[].GroupId')
VPC_ID=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].VpcId')

echo "Instance State: $STATE"
echo "Public IP: $PUBLIC_IP"
echo "Security Groups: $SECURITY_GROUPS"
echo ""

# Check instance state
if [ "$STATE" != "running" ]; then
    echo "⚠️  Instance is not running (state: $STATE)"
    echo "Please start the instance first."
    exit 1
fi

if [ "$PUBLIC_IP" == "null" ] || [ -z "$PUBLIC_IP" ]; then
    echo "❌ No public IP assigned to instance"
    exit 1
fi

# Get your current public IP
echo "🌐 Getting your current public IP..."
MY_IP=$(curl -s https://checkip.amazonaws.com)
if [ -z "$MY_IP" ]; then
    echo "⚠️  Could not detect your public IP"
    MY_IP="0.0.0.0/0"
    echo "Will use 0.0.0.0/0 (anywhere) for testing"
else
    echo "Your public IP: $MY_IP"
    MY_IP="$MY_IP/32"
fi
echo ""

# Check each security group for SSH access
SSH_ALLOWED=false
PRIMARY_SG=""

for SG in $SECURITY_GROUPS; do
    echo "🔍 Checking security group: $SG"
    PRIMARY_SG=$SG

    SG_RULES=$(aws ec2 describe-security-groups --region "$AWS_REGION" --group-ids "$SG" --query 'SecurityGroups[0].IpPermissions')

    # Check if SSH (port 22) is allowed
    SSH_RULE=$(echo "$SG_RULES" | jq -r '.[] | select(.FromPort == 22 and .ToPort == 22)')

    if [ -n "$SSH_RULE" ]; then
        echo "  ✅ SSH rule found on port 22"
        SSH_ALLOWED=true

        # Show allowed sources
        SOURCES=$(echo "$SSH_RULE" | jq -r '.IpRanges[].CidrIp // empty')
        if [ -n "$SOURCES" ]; then
            echo "  Allowed from: $SOURCES"
        fi
    else
        echo "  ❌ No SSH rule found on port 22"
    fi
    echo ""
done

# Offer to fix if SSH not allowed
if [ "$SSH_ALLOWED" = false ]; then
    echo "⚠️  SSH access is NOT configured!"
    echo ""
    echo "Do you want to add SSH access rule to security group $PRIMARY_SG?"
    echo "This will allow SSH from: $MY_IP"
    read -p "Add SSH rule? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Adding SSH rule..."
        aws ec2 authorize-security-group-ingress \
            --region "$AWS_REGION" \
            --group-id "$PRIMARY_SG" \
            --protocol tcp \
            --port 22 \
            --cidr "$MY_IP" 2>&1

        if [ $? -eq 0 ]; then
            echo "✅ SSH rule added successfully!"
        else
            echo "❌ Failed to add SSH rule. You may need to add it manually via AWS Console."
            echo "   Security Group ID: $PRIMARY_SG"
            echo "   Add inbound rule: SSH | TCP | Port 22 | Source: $MY_IP"
        fi
    fi
fi

# Check key file permissions
echo ""
echo "🔑 Checking SSH key file..."
if [ -f "$KEY_FILE" ]; then
    PERMS=$(stat -f "%OLp" "$KEY_FILE" 2>/dev/null || stat -c "%a" "$KEY_FILE" 2>/dev/null)
    if [ "$PERMS" != "400" ]; then
        echo "⚠️  Key file has incorrect permissions: $PERMS"
        echo "Fixing permissions..."
        chmod 400 "$KEY_FILE"
        echo "✅ Permissions set to 400"
    else
        echo "✅ Key file permissions correct (400)"
    fi
else
    echo "❌ Key file not found: $KEY_FILE"
    echo "Please ensure $KEY_FILE is in the current directory"
fi

echo ""
echo "=== Summary ==="
echo "Instance: $INSTANCE_ID (pinyin)"
echo "State: $STATE"
echo "Public IP: $PUBLIC_IP"
echo "SSH Allowed: $SSH_ALLOWED"
echo ""
echo "📝 SSH Command:"
echo "   ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
echo ""

if [ "$SSH_ALLOWED" = true ]; then
    echo "✅ You should now be able to SSH into the instance!"
    echo ""
    read -p "Try connecting now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Connecting..."
        ssh -i "$KEY_FILE" -o ConnectTimeout=10 "ec2-user@$PUBLIC_IP"
    fi
else
    echo "⚠️  Please fix the security group settings first, then try:"
    echo "   ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
fi
