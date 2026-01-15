#!/bin/bash

# Enhanced EC2 Network Diagnostic Script
# Checks Security Groups, NACLs, Route Tables, and Internet Gateway

INSTANCE_ID="i-08f6a5547dfea58a0"
AWS_REGION="us-east-1"

echo "=== Enhanced EC2 Network Diagnostic ==="
echo "Instance: $INSTANCE_ID"
echo "Region: $AWS_REGION"
echo ""

# Get instance details
echo "📋 Fetching instance configuration..."
INSTANCE_INFO=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" --output json)

PUBLIC_IP=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].PublicIpAddress')
PRIVATE_IP=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].PrivateIpAddress')
SUBNET_ID=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].SubnetId')
VPC_ID=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].VpcId')
SG_ID=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].SecurityGroups[0].GroupId')
STATE=$(echo "$INSTANCE_INFO" | jq -r '.Reservations[0].Instances[0].State.Name')

echo "✅ Instance Details:"
echo "   State: $STATE"
echo "   Public IP: $PUBLIC_IP"
echo "   Private IP: $PRIVATE_IP"
echo "   VPC: $VPC_ID"
echo "   Subnet: $SUBNET_ID"
echo "   Security Group: $SG_ID"
echo ""

# Get current public IP
MY_IP=$(curl -s https://checkip.amazonaws.com)
echo "🌐 Your public IP: $MY_IP"
echo ""

# Check 1: Security Group (already known to be OK, but let's confirm)
echo "🔍 [1/5] Checking Security Group Rules..."
SG_RULES=$(aws ec2 describe-security-groups --region "$AWS_REGION" --group-ids "$SG_ID" --output json)
SSH_RULE=$(echo "$SG_RULES" | jq -r '.SecurityGroups[0].IpPermissions[] | select(.FromPort == 22 and .ToPort == 22)')

if [ -n "$SSH_RULE" ]; then
    echo "   ✅ Security Group allows SSH (port 22)"
    ALLOWED_IPS=$(echo "$SSH_RULE" | jq -r '.IpRanges[].CidrIp')
    echo "   Allowed from: $ALLOWED_IPS"
else
    echo "   ❌ Security Group does NOT allow SSH"
fi
echo ""

# Check 2: Network ACL
echo "🔍 [2/5] Checking Network ACL (NACL)..."
NACL_INFO=$(aws ec2 describe-network-acls --region "$AWS_REGION" --filters "Name=association.subnet-id,Values=$SUBNET_ID" --output json)
NACL_ID=$(echo "$NACL_INFO" | jq -r '.NetworkAcls[0].NetworkAclId')

echo "   NACL ID: $NACL_ID"

# Check inbound rules
INBOUND_RULES=$(echo "$NACL_INFO" | jq -r '.NetworkAcls[0].Entries[] | select(.Egress == false)')
SSH_NACL_ALLOW=$(echo "$INBOUND_RULES" | jq -r 'select(.Protocol == "6" and .RuleAction == "allow" and (.PortRange.From <= 22 and .PortRange.To >= 22))')

if [ -n "$SSH_NACL_ALLOW" ] || echo "$INBOUND_RULES" | jq -e 'select(.Protocol == "-1" and .RuleAction == "allow")' > /dev/null; then
    echo "   ✅ NACL allows inbound SSH traffic"
else
    echo "   ❌ NACL may be blocking inbound SSH traffic"
    echo "   Inbound rules:"
    echo "$INBOUND_RULES" | jq -r '. | "      Rule \(.RuleNumber): \(.Protocol) \(.PortRange.From // "all")-\(.PortRange.To // "all") from \(.CidrBlock) -> \(.RuleAction)"'
fi

# Check outbound rules (for return traffic)
OUTBOUND_RULES=$(echo "$NACL_INFO" | jq -r '.NetworkAcls[0].Entries[] | select(.Egress == true)')
EPHEMERAL_ALLOW=$(echo "$OUTBOUND_RULES" | jq -e 'select(.Protocol == "-1" and .RuleAction == "allow")' > /dev/null && echo "yes" || echo "no")

if [ "$EPHEMERAL_ALLOW" == "yes" ]; then
    echo "   ✅ NACL allows outbound traffic (return path)"
else
    echo "   ⚠️  NACL outbound rules (check ephemeral ports 1024-65535):"
    echo "$OUTBOUND_RULES" | jq -r '. | "      Rule \(.RuleNumber): \(.Protocol) \(.PortRange.From // "all")-\(.PortRange.To // "all") to \(.CidrBlock) -> \(.RuleAction)"'
fi
echo ""

# Check 3: Internet Gateway
echo "🔍 [3/5] Checking Internet Gateway..."
IGW_INFO=$(aws ec2 describe-internet-gateways --region "$AWS_REGION" --filters "Name=attachment.vpc-id,Values=$VPC_ID" --output json)
IGW_ID=$(echo "$IGW_INFO" | jq -r '.InternetGateways[0].InternetGatewayId')

if [ "$IGW_ID" != "null" ] && [ -n "$IGW_ID" ]; then
    echo "   ✅ Internet Gateway attached: $IGW_ID"
else
    echo "   ❌ No Internet Gateway attached to VPC"
    echo "   Without IGW, instance cannot receive traffic from internet"
fi
echo ""

# Check 4: Route Table
echo "🔍 [4/5] Checking Route Table..."
RT_INFO=$(aws ec2 describe-route-tables --region "$AWS_REGION" --filters "Name=association.subnet-id,Values=$SUBNET_ID" --output json)

if [ "$(echo "$RT_INFO" | jq -r '.RouteTables | length')" -eq 0 ]; then
    # No explicit association, check main route table
    RT_INFO=$(aws ec2 describe-route-tables --region "$AWS_REGION" --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" --output json)
    echo "   Using main route table for VPC"
fi

RT_ID=$(echo "$RT_INFO" | jq -r '.RouteTables[0].RouteTableId')
echo "   Route Table: $RT_ID"

# Check for route to IGW
IGW_ROUTE=$(echo "$RT_INFO" | jq -r '.RouteTables[0].Routes[] | select(.GatewayId and (.GatewayId | startswith("igw-")))')

if [ -n "$IGW_ROUTE" ]; then
    DEST=$(echo "$IGW_ROUTE" | jq -r '.DestinationCidrBlock')
    GW=$(echo "$IGW_ROUTE" | jq -r '.GatewayId')
    echo "   ✅ Route to Internet Gateway found: $DEST -> $GW"
else
    echo "   ❌ No route to Internet Gateway (0.0.0.0/0 -> igw-xxx)"
    echo "   Routes:"
    echo "$RT_INFO" | jq -r '.RouteTables[0].Routes[] | "      \(.DestinationCidrBlock // .DestinationPrefixListId) -> \(.GatewayId // .NatGatewayId // .NetworkInterfaceId // "local")"'
fi
echo ""

# Check 5: Public IP
echo "🔍 [5/5] Checking Public IP Assignment..."
if [ "$PUBLIC_IP" != "null" ] && [ -n "$PUBLIC_IP" ]; then
    echo "   ✅ Public IP assigned: $PUBLIC_IP"
else
    echo "   ❌ No public IP assigned"
    echo "   Cannot SSH without public IP or bastion host"
fi
echo ""

# Summary and recommendations
echo "=== DIAGNOSIS SUMMARY ==="
echo ""

ISSUES=0

if [ -z "$SSH_RULE" ]; then
    echo "❌ Issue 1: Security Group not allowing SSH"
    ISSUES=$((ISSUES + 1))
fi

if [ -z "$SSH_NACL_ALLOW" ] && ! echo "$INBOUND_RULES" | jq -e 'select(.Protocol == "-1" and .RuleAction == "allow")' > /dev/null; then
    echo "❌ Issue 2: Network ACL may be blocking SSH"
    echo "   Action: Check NACL $NACL_ID inbound rules"
    echo "   Required: Allow TCP port 22 from 0.0.0.0/0 or $MY_IP/32"
    ISSUES=$((ISSUES + 1))
fi

if [ "$IGW_ID" == "null" ] || [ -z "$IGW_ID" ]; then
    echo "❌ Issue 3: No Internet Gateway attached to VPC"
    echo "   Action: Attach an Internet Gateway to VPC $VPC_ID"
    ISSUES=$((ISSUES + 1))
fi

if [ -z "$IGW_ROUTE" ]; then
    echo "❌ Issue 4: No route to Internet Gateway in route table"
    echo "   Action: Add route in Route Table $RT_ID"
    echo "   Required: 0.0.0.0/0 -> $IGW_ID"
    ISSUES=$((ISSUES + 1))
fi

if [ "$PUBLIC_IP" == "null" ] || [ -z "$PUBLIC_IP" ]; then
    echo "❌ Issue 5: No public IP assigned"
    echo "   Action: Assign Elastic IP or enable auto-assign public IP on subnet"
    ISSUES=$((ISSUES + 1))
fi

echo ""
if [ $ISSUES -eq 0 ]; then
    echo "✅ All network configuration looks correct!"
    echo ""
    echo "If SSH still times out, possible causes:"
    echo "1. Instance OS firewall blocking SSH"
    echo "2. SSH daemon not running on instance"
    echo "3. Your local firewall blocking outbound SSH"
    echo "4. ISP blocking port 22"
    echo ""
    echo "Try using EC2 Instance Connect or Session Manager as alternative:"
    echo "   aws ec2-instance-connect send-ssh-public-key --region $AWS_REGION --instance-id $INSTANCE_ID --instance-os-user ec2-user --ssh-public-key file://~/.ssh/id_rsa.pub"
else
    echo "⚠️  Found $ISSUES network configuration issue(s)"
    echo "Please fix the issues above and try again."
fi
echo ""
echo "SSH Command: ssh -i pinyin_ec2.pem ec2-user@$PUBLIC_IP"
