#!/bin/bash

# Velora AWS Infrastructure Setup Script
# This script sets up the AWS infrastructure for Velora IDP
# Requires: AWS CLI, eksctl, kubectl, helm

set -e

# Configuration
CLUSTER_NAME="velora-cluster"
AWS_REGION="ap-south-1"  # Mumbai region
NODE_TYPE="t3.medium"
MIN_NODES=1
MAX_NODES=4
DESIRED_NODES=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Velora AWS Infrastructure Setup${NC}"
echo "===================================="
echo ""
echo "This script will create:"
echo "• EKS cluster in ${AWS_REGION}"
echo "• Worker node group"
echo "• Required IAM roles and policies"
echo "• VPC and networking resources"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check eksctl
if ! command -v eksctl &> /dev/null; then
    echo -e "${RED}❌ eksctl not found. Please install it first.${NC}"
    exit 1
fi

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install it first.${NC}"
    exit 1
fi

# Check helm
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ helm not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Confirm with user
echo ""
echo -e "${YELLOW}⚠️  This will create AWS resources that may incur charges.${NC}"
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled"
    exit 0
fi

# Create EKS cluster
echo ""
echo -e "${BLUE}🏗️  Creating EKS cluster...${NC}"
echo "This may take 10-15 minutes..."

cat > cluster-config.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${CLUSTER_NAME}
  region: ${AWS_REGION}
  version: "1.28"

nodeGroups:
  - name: velora-workers
    instanceType: ${NODE_TYPE}
    desiredCapacity: ${DESIRED_NODES}
    minSize: ${MIN_NODES}
    maxSize: ${MAX_NODES}
    volumeSize: 20
    ssh:
      enableSsm: true
    iam:
      withAddonPolicies:
        imageBuilder: true
        autoScaler: true
        certManager: true
        efs: true
        ebs: true
        fsx: true
        cloudWatch: true

managedNodeGroups:
  - name: velora-managed-workers
    instanceType: ${NODE_TYPE}
    desiredCapacity: ${DESIRED_NODES}
    minSize: ${MIN_NODES}
    maxSize: ${MAX_NODES}
    volumeSize: 20
    ssh:
      enableSsm: true
    iam:
      withAddonPolicies:
        imageBuilder: true
        autoScaler: true
        certManager: true
        efs: true
        ebs: true
        fsx: true
        cloudWatch: true

addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy
  - name: aws-ebs-csi-driver

cloudWatch:
  clusterLogging:
    enable: ["audit", "authenticator", "controllerManager"]
EOF

eksctl create cluster -f cluster-config.yaml

# Update kubeconfig
echo -e "${BLUE}📝 Updating kubeconfig...${NC}"
aws eks update-kubeconfig --region ${AWS_REGION} --name ${CLUSTER_NAME}

# Verify cluster
echo -e "${BLUE}🔍 Verifying cluster...${NC}"
kubectl get nodes

# Install AWS Load Balancer Controller
echo -e "${BLUE}⚖️  Installing AWS Load Balancer Controller...${NC}"

# Create IAM OIDC provider
eksctl utils associate-iam-oidc-provider --region=${AWS_REGION} --cluster=${CLUSTER_NAME} --approve

# Create IAM service account
eksctl create iamserviceaccount \
  --cluster=${CLUSTER_NAME} \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name=AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
  --approve \
  --override-existing-serviceaccounts

# Install AWS Load Balancer Controller with Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=${CLUSTER_NAME} \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=${AWS_REGION} \
  --set vpcId=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Install nginx-ingress as backup
echo -e "${BLUE}🌐 Installing NGINX Ingress Controller...${NC}"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Install cert-manager for SSL certificates
echo -e "${BLUE}🔒 Installing cert-manager...${NC}"
helm repo add jetstack https://charts.jetstack.io
helm repo update

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.crds.yaml

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.2

# Install metrics-server
echo -e "${BLUE}📊 Installing metrics-server...${NC}"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Create namespaces
echo -e "${BLUE}📁 Creating namespaces...${NC}"
kubectl create namespace velora --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace jenkins --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Save cluster information
echo -e "${BLUE}💾 Saving cluster information...${NC}"
cat > cluster-info.txt << EOF
Velora EKS Cluster Information
==============================

Cluster Name: ${CLUSTER_NAME}
Region: ${AWS_REGION}
API Server Endpoint: $(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query "cluster.endpoint" --output text)
VPC ID: $(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query "cluster.resourcesVpcConfig.vpcId" --output text)

Worker Nodes:
$(kubectl get nodes -o wide)

Load Balancer:
$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

Useful Commands:
================
# Update kubeconfig
aws eks update-kubeconfig --region ${AWS_REGION} --name ${CLUSTER_NAME}

# Check nodes
kubectl get nodes

# Check pods
kubectl get pods --all-namespaces

# Delete cluster (when no longer needed)
eksctl delete cluster --name ${CLUSTER_NAME} --region ${AWS_REGION}
EOF

echo ""
echo -e "${GREEN}✅ AWS Infrastructure setup completed!${NC}"
echo ""
echo "📋 Summary:"
echo "• EKS cluster created: ${CLUSTER_NAME}"
echo "• Region: ${AWS_REGION}"
echo "• Worker nodes: ${DESIRED_NODES} (${NODE_TYPE})"
echo "• Load balancer controller installed"
echo "• NGINX ingress controller installed"
echo "• cert-manager installed"
echo "• Namespaces created: velora, jenkins, argocd, monitoring"
echo ""
echo "📝 Cluster information saved to: cluster-info.txt"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Install Jenkins: ./jenkins-setup.sh"
echo "2. Install ArgoCD: ./argocd-setup.sh"
echo "3. Deploy Velora web application: ./deploy-velora-web.sh"
echo ""
echo -e "${BLUE}💰 Cost Estimate:${NC}"
echo "• EKS cluster: ~$73/month"
echo "• Worker nodes (${DESIRED_NODES} × ${NODE_TYPE}): ~$50/month"
echo "• Load balancer: ~$20/month"
echo "• Total: ~$143/month"
echo ""
echo -e "${RED}🚨 Remember to delete the cluster when not needed to avoid charges!${NC}"

# Clean up
rm -f cluster-config.yaml