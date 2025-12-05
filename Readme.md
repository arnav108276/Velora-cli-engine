# Velora - Cloud-Native Internal Developer Platform

🚀 **Complete Developer Platform for Service Creation, Deployment, and Management**

Velora is a comprehensive Internal Developer Platform (IDP) that automates service creation, CI/CD pipelines, and Kubernetes deployments. Create services with a single command and get automated GitHub repos, Docker builds, and live deployments.

## 🌟 Features

- **CLI-based Service Creation** - Create services with templates in seconds
- **Auto GitHub Integration** - Automatic repository creation with starter code
- **CI/CD Automation** - Jenkins pipelines with security scanning

- **Kubernetes Deployment** - Auto-scaling deployments on AWS EKS
- **Web Dashboard** - Monitor services, pipelines, and developers
- **Email Notifications** - Deployment status and alerts
- **Multiple Service Types** - API, Frontend, Worker, Database services

## 📁 Project Structure

```
velora/
├── backend/                 # FastAPI backend server
├── frontend/               # React web dashboard
├── cli/                   # Node.js CLI tool
├── infrastructure/        # AWS, Jenkins, ArgoCD setup scripts
├── templates/            # Service templates (generated)
└── docs/                # Documentation
```

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** 16+ and **npm/yarn**
- **Python** 3.9+ and **pip**
- **MongoDB** (local or cloud)
- **Docker** (for service templates)
- **Git** for version control

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd velora

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install

# Install CLI dependencies
cd ../cli
npm install
```

### 2. Configure Environment Variables

#### Backend Environment (Required)
Edit `/app/backend/.env` with your actual API keys:

```bash
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=velora

# CORS Configuration
CORS_ORIGINS=http://localhost:3005

# GitHub Integration (Required for repo creation)

# Docker Hub Integration (Required for image pushing)
DOCKER_USERNAME=your_dockerhub_username_here
DOCKER_TOKEN=your_dockerhub_token_here

# Email Notifications (Gmail SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail_address_here
SMTP_PASSWORD=your_gmail_app_password_here

# Frontend URL
FRONTEND_URL=http://localhost:3005

# AWS Configuration (for cloud deployment)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
```

#### Frontend Environment
The frontend `.env` is already configured for local development:

```bash
REACT_APP_BACKEND_URL=http://localhost:8002
```

### 3. Generate Required API Keys

#### GitHub Personal Access Token
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "Velora IDP"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
   - ✅ `user` (Read user profile data)
5. Click "Generate token"
6. Copy the token and add to `backend/.env` as `GITHUB_TOKEN`

#### Docker Hub Access Token
1. Go to [Docker Hub > Account Settings > Security](https://hub.docker.com/settings/security)
2. Click "New Access Token"
3. Name: "Velora IDP"
4. Permissions: "Read, Write, Delete"
5. Click "Generate"
6. Copy the token and add to `backend/.env` as `DOCKER_TOKEN`
7. Add your Docker Hub username as `DOCKER_USERNAME`

#### Gmail App Password (for notifications)
1. Enable 2-Factor Authentication on your Gmail account
2. Go to [Google Account Settings > Security > App passwords](https://myaccount.google.com/apppasswords)
3. Select app: "Mail", Select device: "Other (Custom name)"
4. Enter name: "Velora IDP"
5. Click "Generate"
6. Copy the 16-character password and add to `backend/.env` as `SMTP_PASSWORD`
7. Add your Gmail address as `SMTP_USERNAME`

#### AWS Access Keys (for cloud deployment)
1. Go to [AWS Console > IAM > Users](https://console.aws.amazon.com/iam/home#/users)
2. Click "Add user"
3. Username: "velora-cli"
4. Access type: "Programmatic access"
5. Attach policies:
   - `AmazonEKSClusterPolicy`
   - `AmazonEKSWorkerNodePolicy`
   - `AmazonEKS_CNI_Policy`
   - `AmazonEC2ContainerRegistryReadOnly`
   - `ElasticLoadBalancingFullAccess`
6. Click "Create user"
7. Copy `Access Key ID` and `Secret Access Key`
8. Add to `backend/.env` as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### 4. Setup MongoDB

#### Option A: Local MongoDB
```bash
# Install MongoDB
# macOS
brew install mongodb-community

# Ubuntu
sudo apt install mongodb

# Start MongoDB
mongod --dbpath ./data/db
```

#### Option B: MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Get connection string and update `MONGO_URL` in `backend/.env`

### 5. Start the Services

#### Terminal 1: Backend
#### For Linux/MAC
```bash
cd backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8002 --reload
```
#### For Windows
```bash
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8002 --reload
```

#### Terminal 2: Frontend
```bash
cd frontend
yarn start
```

#### Terminal 3: CLI Setup
```bash
cd cli
npm link  # Install CLI globally

# Configure CLI
velora config setup
# Enter API URL: http://localhost:8002/api
# GitHub token: (paste your token)
# Docker registry: (your Docker Hub username)
# Docker token: (paste your Docker Hub token)
```

### 6. Create Your First Service

```bash
# Create an API service
velora create my-first-api --type api --description "My awesome API service"

# Monitor the service
velora status my-first-api --follow

# List all services
velora list

# Access the web dashboard
open http://localhost:3005
```

## 🌐 Web Dashboard

Access the web dashboard at [http://localhost:3005](http://localhost:3005)

### Available Pages:
- **Dashboard** - Overview of services and analytics
- **Services** - Manage and monitor all services
- **Create Service** - Web interface for service creation
- **Service Details** - Detailed view with logs and pipeline status
- **Admin Dashboard** - Platform-wide analytics
- **Developer Management** - Manage team members

## 🛠️ CLI Commands

### Service Management
```bash
# Create a new service
velora create <name> --type <api|frontend|worker|database> --description "..."

# List all services
velora list [--status <status>] [--type <type>] [--format <table|json>]

# Check service status
velora status <name> [--follow] [--json]

# View service logs
velora logs <name> [--follow] [--lines <number>]

# Deploy/rollback service
velora deploy <name> [--rollback] [--follow]

# Delete service
velora delete <name> [--force]
```

### Configuration
```bash
# Interactive setup
velora config setup

# Set configuration value
velora config set <key> <value>

# Get configuration value
velora config get <key>

# List all configuration
velora config list

# Reset to defaults
velora config reset
```

## 🔄 Service Types

### 🔌 API Service
- **Framework**: FastAPI with automatic OpenAPI docs
- **Features**: Health checks, metrics, auto-scaling
- **Template includes**: Dockerfile, Helm chart, Jenkinsfile

### 🌐 Frontend Service  
- **Framework**: React with modern tooling
- **Features**: CDN integration, SSL certificates
- **Template includes**: Build optimization, static hosting

### ⚙️ Worker Service
- **Framework**: Background job processing
- **Features**: Queue integration, auto-scaling
- **Template includes**: Job scheduling, monitoring

### 🗄️ Database Service
- **Options**: PostgreSQL, MongoDB, Redis
- **Features**: Persistent storage, automated backups
- **Template includes**: StatefulSets, volumes

## ☁️ Cloud Deployment (AWS)

### Prerequisites for Cloud Deployment
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Install kubectl
curl -o kubectl https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/kubectl
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 1. Setup AWS Infrastructure
```bash
# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: ap-south-1 (Mumbai)

# Create EKS cluster and infrastructure
cd infrastructure
chmod +x aws-setup.sh
./aws-setup.sh
```

### 2. Install Jenkins
```bash
chmod +x jenkins-setup.sh
./jenkins-setup.sh
```

### 3. Install ArgoCD
```bash
chmod +x argocd-setup.sh
./argocd-setup.sh
```

### 4. Deploy Velora Web Application
```bash
chmod +x deploy-velora-web.sh
./deploy-velora-web.sh
```

## 🚨 Troubleshooting

### Backend Not Starting
```bash
# Check logs
tail -n 100 /var/log/supervisor/backend.*.log

# Check MongoDB connection
mongosh $MONGO_URL

# Verify environment variables
cd backend && python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ.get('MONGO_URL'))"
```

### Frontend Build Errors
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules yarn.lock
yarn install

# Check for port conflicts
lsof -i :3003
```

### CLI Connection Issues
```bash
# Test API connection
curl http://localhost:8002/api/health

# Check CLI configuration
velora config list

# Reset CLI configuration
velora config reset
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for developers, by developers**

*Happy coding! 🚀*

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
