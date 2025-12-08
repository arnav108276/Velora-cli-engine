# AWS EKS Setup Guide for Velora

This guide will help you set up an AWS EKS cluster for deploying services using Velora CLI.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- kubectl installed
- eksctl installed

## Step 1: Install Required Tools

### 1.1 Install AWS CLI

#### macOS:
```bash
brew install awscli
```

#### Linux:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

#### Windows:
Download and install from: https://aws.amazon.com/cli/

### 1.2 Install kubectl

#### macOS:
```bash
brew install kubectl
```

#### Linux:
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

#### Windows:
```bash
curl -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
# Add to PATH
```

### 1.3 Install eksctl

#### macOS:
```bash
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl
```

#### Linux:
```bash
curl --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

#### Windows:
```bash
choco install eksctl
```

## Step 2: Configure AWS Credentials

```bash
aws configure
```

Enter your credentials:
- **AWS Access Key ID**: From your .env file (AWS_ACCESS_KEY_ID)
- **AWS Secret Access Key**: From your .env file (AWS_SECRET_ACCESS_KEY)
- **Default region**: `ap-south-1` (Mumbai)
- **Default output format**: `json`

Verify configuration:
```bash
aws sts get-caller-identity
```

## Step 3: Create EKS Cluster

### Option A: Quick Setup (Recommended)

Create a cluster with 2 nodes:
```bash

eksctl create cluster --name arnav-velora2 --region ap-south-1 --nodes 2 --node-type t3.medium --managed

# Wait for cluster to be ready (~15-20 minutes)

# Get the cluster security group ID
CLUSTER_SG=$(aws eks describe-cluster \
  --name arnav-velora2 \
  --region ap-south-1 \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId' \
  --output text)

echo "Cluster Security Group ID: $CLUSTER_SG"

# Get the node security group ID
NODE_SG=$(aws ec2 describe-security-groups \
  --filters "Name=tag:aws:eks:cluster-name,Values=arnav-velora2" \
  --query 'SecurityGroups[?contains(GroupName, `node`)].GroupId' \
  --output text \
  --region ap-south-1)

echo "Node Security Group ID: $NODE_SG"

# Add inbound rule for NodePort range (30000-32767) to node security group
aws ec2 authorize-security-group-ingress \
  --group-id $NODE_SG \
  --protocol tcp \
  --port 30000-32767 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1

echo "✅ Security group configured for NodePort access (30000-32767)"

# Also add rule to cluster security group for complete access
aws ec2 authorize-security-group-ingress \
  --group-id $CLUSTER_SG \
  --protocol tcp \
  --port 30000-32767 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1 2>/dev/null || echo "Rule may already exist on cluster SG"

echo "✅ Cluster setup complete with security groups configured!"


```


## Step 4: Verify Cluster

Check cluster status:
```bash
# Check cluster
aws eks describe-cluster --name arnav-velora2 --region ap-south-1

# Check nodes
kubectl get nodes

# Expected output:
# NAME                                           STATUS   ROLES    AGE   VERSION
# ip-192-168-xx-xxx.ap-south-1.compute.internal  Ready    <none>   5m    v1.28.x
# ip-192-168-xx-xxx.ap-south-1.compute.internal  Ready    <none>   5m    v1.28.x
```

Check kubectl context:
```bash
kubectl config current-context
# Should show: arnav-velora2.ap-south-1.eksctl.io
```

## Step 5: Configure kubectl for EKS (If needed)

If kubectl is not automatically configured:
```bash
aws eks update-kubeconfig --name arnav-velora2 --region ap-south-1
```

## Step 6: Test Deployment

Deploy a test application:
```bash
# Create a test deployment
kubectl create deployment nginx --image=nginx

# Expose it with NodePort
kubectl expose deployment nginx --type=NodePort --port=80

# Get NodePort
kubectl get service nginx

# Get Node IP
kubectl get nodes -o wide
```

Access your test app: `http://<NODE_IP>:<NODE_PORT>`

## Step 7: Install Semgrep (For Security Scanning)

### macOS:
```bash
brew install semgrep
```

### Linux/Windows:
```bash
pip install semgrep
```

Or using Docker:
```bash
docker pull returntocorp/semgrep
```

Verify installation:
```bash
semgrep --version
```

## Step 8: Configure Velora CLI

Run the setup:
```bash
cd /app/Velora--0.0.2/cli
npm install
npm link

velora config setup
```

Enter the following when prompted:
- **API URL**: `http://localhost:8002/api`
- **Username**: Your username (e.g., `arnav`)
- **GitHub Token**: Your GitHub personal access token
- **Docker Username**: Your Docker Hub username
- **Docker Token**: Your Docker Hub token

## Step 9: Start Velora Backend

```bash
cd /app/Velora--0.0.2/backend
pip install -r requirements.txt
python3 -m uvicorn server:app --host 0.0.0.0 --port 8002 --reload
```

## Step 10: Test the Full Workflow

### Create a test service:
```bash
# Create a simple API service
mkdir -p /tmp/test-api
cd /tmp/test-api

# Create a simple FastAPI app
cat > main.py << 'EOF'
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from Velora!"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
EOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.110.1
uvicorn==0.25.0
EOF

# Dockerfile is auto-generated by Velora

# Create service with Velora
velora create 8dec `
  --type api `
  --description "Test API Service" `
  --location app
```

### Deploy to EKS:
```bash
velora deploy test-api
```

Expected output:
```
🔍 Checking prerequisites...
✅ kubectl installed
🔍 Looking up service: test-api...
✅ Found service: test-api
🔍 Checking EKS cluster: arnav-velora2...
✅ EKS cluster is active
🚀 Deploying test-api to EKS...
✅ kubectl configured for EKS cluster
✅ Kubernetes manifests generated
✅ Deployed to Kubernetes
✅ Pods are ready
✅ Service deployed successfully

🎉 Deployment completed successfully!

📋 Access Information:
  Service URL: http://xx.xx.xx.xx:xxxxx
  Node IP: xx.xx.xx.xx
  NodePort: xxxxx
```

### Test the deployed service:
```bash
# Get the service URL from the deploy output
curl http://<NODE_IP>:<NODE_PORT>/
# Expected: {"message":"Hello from Velora!"}

curl http://<NODE_IP>:<NODE_PORT>/health
# Expected: {"status":"healthy"}
```

## Cost Optimization

### EKS Cluster Costs:
- **Control Plane**: $0.10/hour (~$73/month)
- **Worker Nodes** (2x t3.medium): $0.0416/hour each (~$60/month total)
- **Total**: ~$133/month

### To minimize costs:

1. **Stop cluster when not in use**:
```bash
eksctl scale nodegroup --cluster=arnav-velora2 --nodes=0 velora-workers
```

2. **Delete cluster completely**:
```bash
eksctl delete cluster --name arnav-velora2 --region ap-south-1
```

3. **Use Fargate** (serverless):
```bash
eksctl create cluster \
  --name arnav-velora2 \
  --region ap-south-1 \
  --fargate
```

## Troubleshooting

### Issue: "kubectl: command not found"
**Solution**: Reinstall kubectl following Step 1.2

### Issue: "error: You must be logged in to the server (Unauthorized)"
**Solution**: Update kubeconfig
```bash
aws eks update-kubeconfig --name arnav-velora2 --region ap-south-1
```

### Issue: "Cluster not found"
**Solution**: Check cluster exists
```bash
aws eks list-clusters --region ap-south-1
```

### Issue: Pods stuck in "Pending" state
**Solution**: Check node resources
```bash
kubectl describe nodes
kubectl get pods -o wide
```

### Issue: Service not accessible
**Solution**: Check security groups
```bash
# Get node security group
aws eks describe-cluster --name arnav-velora2 --region ap-south-1 \
  --query 'cluster.resourcesVpcConfig.securityGroupIds' --output text

# Add inbound rule for NodePort range (30050-32767)
# Via AWS Console or CLI
```

## Multi-Tenancy Features

Velora now supports multi-tenancy! Each user (identified by username + first 4 chars of GitHub token) has isolated services:

- User A's services are NOT visible to User B
- Each user has separate MongoDB collections
- All CLI commands respect user context

### Testing Multi-Tenancy:

**User 1:**
```bash
velora config setup
# Enter username: user1
# Enter GitHub token: ghp_xxxxx...
velora create service1 --type api -d "User 1 service"
velora list
# Only shows service1
```

**User 2:**
```bash
velora config setup
# Enter username: user2
# Enter GitHub token: ghp_yyyyy...
velora create service2 --type api -d "User 2 service"
velora list
# Only shows service2 (service1 is NOT visible)
```

## Next Steps

1. Create more services with `velora create`
2. Deploy to EKS with `velora deploy`
3. Monitor with `kubectl get pods -l managed-by=velora`
4. View logs with `velora logs <service-name>`
5. Scale deployments: `kubectl scale deployment/<service-name> --replicas=3`

## Support

For issues or questions:
- Check logs: `kubectl logs -l app=<service-name>`
- Describe pods: `kubectl describe pod <pod-name>`
- Check Velora docs: `/app/Velora--0.0.2/Readme.md`

---

**Happy Deploying! 🚀**
