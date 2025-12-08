from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import aiohttp
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64
import boto3
from botocore.exceptions import ClientError, BotoCoreError
# Load Velora CLI config (to read docker username)


# VELORA_CONFIG = load_velora_cli_config()
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')  

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get('DB_NAME', 'velora')
main_db = client[db_name]
db = main_db  # Keep backward compatibility

# Multi-Tenancy Helper Function
def get_user_db(user_hash: str):
    """Get user-specific database collections for multi-tenancy"""
    if not user_hash:
        raise HTTPException(status_code=401, detail="User hash required. Run 'velora config setup' first.")
    
    # Use prefix-based collection names for user isolation
    return {
        'services': main_db[f"{user_hash}_services"],
        'developers': main_db[f"{user_hash}_developers"],
        'pipelines': main_db[f"{user_hash}_pipelines"],
        'templates': main_db[f"{user_hash}_templates"]
    }

# Create the main app
app = FastAPI(title="Velora IDP API", description="Cloud-Native Internal Developer Platform")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class Developer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    github_username: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_admin: bool = False

class DeveloperCreate(BaseModel):
    name: str
    email: str
    github_username: Optional[str] = None
    is_admin: bool = False

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    service_type: str  # api, frontend, worker, database
    developer_id: str
    github_repo_url: Optional[str] = None
    docker_image: Optional[str] = None
    service_url: Optional[str] = None
    status: str = "creating"  # creating, building, deploying, running, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ServiceCreate(BaseModel):
    name: str
    description: str
    service_type: str
    developer_id: str
    github_repo_url: Optional[str] = None
    docker_image: Optional[str] = None

class Pipeline(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str
    status: str = "pending"  # pending, running, success, failed
    stage: str = "initialization"
    progress: int = 0
    logs: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PipelineUpdate(BaseModel):
    status: Optional[str] = None
    stage: Optional[str] = None
    progress: Optional[int] = None
    logs: Optional[List[str]] = None

class ServiceTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    service_type: str
    description: str
    template_files: Dict[str, str]  # filename -> content
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper Functions
async def create_github_repo(repo_name: str, description: str, github_token: str) -> Dict[str, Any]:
    """Create a GitHub repository with SSL fix"""
    try:
        headers = {
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
        
        data = {
            'name': repo_name,
            'description': description,
            'private': False,
            'auto_init': True
        }
        
        # SSL FIX: Use connector with verify_ssl=True explicitly
        connector = aiohttp.TCPConnector(ssl=aiohttp.TCPConnector(verify_ssl=True))
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            async with session.post('https://api.github.com/user/repos', 
                                  headers=headers, json=data) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise HTTPException(status_code=400, detail=f"GitHub API error {response.status}: {error_text}")
    except aiohttp.ClientSSLError as ssl_error:
        logging.error(f"SSL Error with GitHub API: {str(ssl_error)}")
        raise HTTPException(status_code=500, detail="SSL certificate verification failed. Check network/proxy settings.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create GitHub repo: {str(e)}")


async def push_template_to_repo(repo_url: str, template_files: Dict[str, str], github_token: str):
    """Push template files to GitHub repository"""
    # This would integrate with GitHub API to create files
    # For now, we'll simulate this
    logging.info(f"Pushing template files to {repo_url}")

async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification via Gmail SMTP"""
    try:
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not all([smtp_username, smtp_password]):
            logging.warning("SMTP credentials not configured")
            return
        
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        text = msg.as_string()
        server.sendmail(smtp_username, to_email, text)
        server.quit()
        
        logging.info(f"Email sent to {to_email}")
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")

# API Routes

# Developer Management
@api_router.post("/developers", response_model=Developer)
async def create_developer(developer: DeveloperCreate, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    developer_dict = developer.dict()
    developer_obj = Developer(**developer_dict)
    await user_collections['developers'].insert_one(developer_obj.dict())
    return developer_obj

@api_router.get("/developers", response_model=List[Developer])
async def get_developers(x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    developers = await user_collections['developers'].find().to_list(1000)
    return [Developer(**dev) for dev in developers]

@api_router.get("/developers/{developer_id}", response_model=Developer)
async def get_developer(developer_id: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    developer = await user_collections['developers'].find_one({"id": developer_id})
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    return Developer(**developer)

# Service Management
@api_router.post("/services", response_model=Service)
@api_router.post("/services", response_model=Service)
async def create_service(service_data: ServiceCreate, background_tasks: BackgroundTasks, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)

    # Convert input data to dict
    service_dict = service_data.dict()

    # ✔ DO NOT manually pass docker_image or service_url
    service_obj = Service(**service_dict)

    # Save service in DB
    await user_collections["services"].insert_one(service_obj.dict())

    # Create pipeline
    pipeline = Pipeline(service_id=service_obj.id)
    await user_collections["pipelines"].insert_one(pipeline.dict())

    # Start async creation
    background_tasks.add_task(process_service_creation, service_obj.id, x_user_hash)

    return service_obj


@api_router.get("/services", response_model=List[Service])
async def get_services(developer_id: Optional[str] = None, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    query = {}
    if developer_id:
        query["developer_id"] = developer_id
    
    services = await user_collections['services'].find(query).to_list(1000)
    return [Service(**service) for service in services]

@api_router.get("/services/{service_id}", response_model=Service)
async def get_service(service_id: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    service = await user_collections['services'].find_one({"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return Service(**service)

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    result = await user_collections['services'].delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Also delete related pipelines
    await user_collections['pipelines'].delete_many({"service_id": service_id})
    
    return {"message": "Service deleted successfully"}

# Pipeline Management
@api_router.get("/services/{service_id}/pipeline", response_model=Pipeline)
async def get_service_pipeline(service_id: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    pipeline = await user_collections['pipelines'].find_one({"service_id": service_id}, sort=[("created_at", -1)])
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return Pipeline(**pipeline)

@api_router.put("/services/{service_id}/pipeline")
async def update_pipeline(service_id: str, update_data: PipelineUpdate, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    pipeline = await user_collections['pipelines'].find_one({"service_id": service_id}, sort=[("created_at", -1)])
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    await user_collections['pipelines'].update_one(
        {"id": pipeline["id"]}, 
        {"$set": update_dict}
    )
    
    return {"message": "Pipeline updated successfully"}

@api_router.post("/services/{service_id}/rollback")
async def rollback_service(service_id: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    service = await user_collections['services'].find_one({"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Create rollback pipeline
    pipeline = Pipeline(
        service_id=service_id,
        stage="rollback",
        status="running"
    )
    await user_collections['pipelines'].insert_one(pipeline.dict())
    
    return {"message": "Rollback initiated", "pipeline_id": pipeline.id}

# Templates
@api_router.get("/templates", response_model=List[ServiceTemplate])
async def get_templates(x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    templates = await user_collections['templates'].find().to_list(1000)
    return [ServiceTemplate(**template) for template in templates]

@api_router.get("/templates/{service_type}", response_model=ServiceTemplate)
async def get_template(service_type: str, x_user_hash: Optional[str] = Header(None)):
    user_collections = get_user_db(x_user_hash)
    template = await user_collections['templates'].find_one({"service_type": service_type})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return ServiceTemplate(**template)

# Webhooks (for CI/CD integration)
@api_router.post("/webhooks/jenkins")
async def jenkins_webhook(webhook_data: Dict[str, Any]):
    """Handle Jenkins webhook notifications"""
    service_id = webhook_data.get('service_id')
    status = webhook_data.get('status', '').lower()
    build_number = webhook_data.get('build_number')
    service_url = webhook_data.get('service_url')
    
    if not service_id:
        raise HTTPException(status_code=400, detail="Missing service_id")
    
    # Update service status
    update_data = {
        "status": "running" if status == "success" else "failed",
        "updated_at": datetime.utcnow()
    }
    
    if service_url:
        update_data["service_url"] = service_url
    
    await db.services.update_one(
        {"id": service_id},
        {"$set": update_data}
    )
    
    # Update pipeline
    pipeline_status = "success" if status == "success" else "failed"
    await db.pipelines.update_one(
        {"service_id": service_id},
        {"$set": {
            "status": pipeline_status,
            "progress": 100,
            "updated_at": datetime.utcnow()
        }},
        sort=[("created_at", -1)]
    )
    
    # Send notification email
    service = await db.services.find_one({"id": service_id})
    if service:
        developer = await db.developers.find_one({"id": service["developer_id"]})
        if developer:
            subject = f"Velora: {service['name']} Deployment {status.title()}"
            body = f"""
            <h2>Deployment Notification</h2>
            <p><strong>Service:</strong> {service['name']}</p>
            <p><strong>Status:</strong> {status.title()}</p>
            <p><strong>Build Number:</strong> {build_number}</p>
            {f'<p><strong>Service URL:</strong> <a href="{service_url}">{service_url}</a></p>' if service_url else ''}
            <p><strong>Timestamp:</strong> {datetime.utcnow().isoformat()}</p>
            
            <p>Visit your <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3005')}">Velora Dashboard</a> for more details.</p>
            """
            
            await send_email_notification(developer['email'], subject, body)
    
    return {"message": "Webhook processed successfully"}

# Velora--main/backend/server.py

# Dashboard Analytics
@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(x_user_hash: Optional[str] = Header(None)):
    """Get dashboard analytics data for the current user (Multi-tenant)"""
    user_collections = get_user_db(x_user_hash)

    # Total Services Count
    service_count_result = await user_collections['services'].aggregate([
        {"$group": {"_id": None, "count": {"$sum": 1}}}
    ]).to_list(1)
    total_services = service_count_result[0]['count'] if service_count_result else 0

    # Total Developers Count
    developer_count_result = await user_collections['developers'].aggregate([
        {"$group": {"_id": None, "count": {"$sum": 1}}}
    ]).to_list(1)
    total_developers = developer_count_result[0]['count'] if developer_count_result else 0

    # Services by status
    services_by_status = await user_collections['services'].aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)

    # Services by type
    services_by_type = await user_collections['services'].aggregate([
        {"$group": {"_id": "$service_type", "count": {"$sum": 1}}}
    ]).to_list(10)

    # Recent activities (last 10 services)
    recent_services = await user_collections['services'].find().sort("created_at", -1).limit(10).to_list(10)

    return {
        "total_services": total_services,
        "total_developers": total_developers,
        "services_by_status": {item["_id"]: item["count"] for item in services_by_status},
        "services_by_type": {item["_id"]: item["count"] for item in services_by_type},
        "recent_activities": [Service(**service) for service in recent_services]
    }

async def process_service_creation(service_id: str, user_hash: str = None):
    """Background task to process service creation (Multi-tenant)"""
    try:
        user_collections = get_user_db(user_hash) if user_hash else {
            'services': db.services,
            'pipelines': db.pipelines
        }

        # Update pipeline to running
        await user_collections['pipelines'].update_one(
            {"service_id": service_id},
            {"$set": {
                "status": "running",
                "stage": "github_repo_creation",
                "progress": 10,
                "updated_at": datetime.utcnow()
            }}
        )

        service = await user_collections['services'].find_one({"id": service_id})
        if not service:
            return

        # Get GitHub token
        github_token = os.getenv('GITHUB_TOKEN')

        # -----------------------------------------------
        # 🔥 IMPORTANT FIX:
        # DO NOT generate docker_image if CLI already sent real one
        # -----------------------------------------------
        existing_docker_image = service.get("docker_image")

        if github_token:
            try:
                # Create GitHub repository
                repo_data = await create_github_repo(
                    service['name'],
                    service['description'],
                    github_token
                )

                # Update GitHub URL
                await user_collections['services'].update_one(
                    {"id": service_id},
                    {"$set": {
                        "github_repo_url": repo_data.get("clone_url"),
                        "updated_at": datetime.utcnow()
                    }}
                )

                # Pipeline update
                await user_collections['pipelines'].update_one(
                    {"service_id": service_id},
                    {"$set": {
                        "stage": "template_generation",
                        "progress": 30,
                        "logs": ["✅ GitHub repository created successfully"],
                        "updated_at": datetime.utcnow()
                    }}
                )

                # Apply template files
                template = await user_collections['templates'].find_one(
                    {"service_type": service['service_type']}
                )

                if template:
                    await push_template_to_repo(
                        repo_data['clone_url'],
                        template['template_files'],
                        github_token
                    )

                    await user_collections['pipelines'].update_one(
                        {"service_id": service_id},
                        {"$set": {
                            "stage": "ci_cd_setup",
                            "progress": 60,
                            "logs": ["✅ Template files pushed to repository"],
                            "updated_at": datetime.utcnow()
                        }}
                    )

            except Exception as github_error:
                logging.error(f"GitHub integration failed: {str(github_error)}")
                # continue flow

        # -----------------------------------------------
        # FINAL STATUS UPDATE
        # DO NOT overwrite docker_image if CLI provided it
        # -----------------------------------------------

        await user_collections['services'].update_one(
            {"id": service_id},
            {"$set": {
                "docker_image": existing_docker_image,   # keep real image
                "status": "running",
                "service_url": service.get(
                    'service_url',
                    f"https://{service['name']}.velora.dev"
                ),
                "updated_at": datetime.utcnow()
            }}
        )

        # Mark pipeline completed
        await user_collections['pipelines'].update_one(
            {"service_id": service_id},
            {"$set": {
                "status": "success",
                "stage": "completed",
                "progress": 100,
                "logs": ["Service deployment completed successfully"],
                "updated_at": datetime.utcnow()
            }}
        )

    except Exception as e:
        user_collections = get_user_db(user_hash) if user_hash else {
            'services': db.services,
            'pipelines': db.pipelines
        }

        await user_collections['services'].update_one(
            {"id": service_id},
            {"$set": {"status": "failed", "updated_at": datetime.utcnow()}}
        )

        await user_collections['pipelines'].update_one(
            {"service_id": service_id},
            {"$set": {
                "status": "failed",
                "logs": [f"Error: {str(e)}"],
                "updated_at": datetime.utcnow()
            }}
        )

        logging.error(f"Service creation failed for {service_id}: {str(e)}")
# ==========================================
# CLOUDWATCH & ADMIN DASHBOARD ENDPOINTS
# ==========================================

class AdminAuthRequest(BaseModel):
    password: str

class CloudWatchMetricsRequest(BaseModel):
    time_range: str = "1h"  # 1h, 24h, 7d, 30d

# Admin authentication endpoint
@api_router.post("/admin/authenticate")
async def admin_authenticate(auth_request: AdminAuthRequest):
    """Authenticate admin user with password"""
    admin_password = os.getenv('ADMIN_PASSWORD', 'velora-cli-engine')
    
    if auth_request.password == admin_password:
        return {
            "authenticated": True,
            "message": "Authentication successful"
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

# Helper function to get time range
def get_time_range(time_range_str: str):
    """Convert time range string to datetime objects"""
    now = datetime.utcnow()
    
    time_ranges = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30)
    }
    
    delta = time_ranges.get(time_range_str, timedelta(hours=1))
    start_time = now - delta
    
    return start_time, now

# Helper function to initialize AWS clients
def get_aws_clients():
    """Initialize AWS clients for CloudWatch and EKS"""
    try:
        aws_region = os.getenv('AWS_REGION', 'ap-south-1')
        aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        
        if not aws_access_key or not aws_secret_key:
            raise HTTPException(
                status_code=500, 
                detail="AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file"
            )
        
        session = boto3.Session(
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        
        cloudwatch = session.client('cloudwatch')
        eks = session.client('eks')
        ec2 = session.client('ec2')
        
        return cloudwatch, eks, ec2, aws_region
    except Exception as e:
        logging.error(f"Failed to initialize AWS clients: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize AWS clients: {str(e)}")

# Get CloudWatch metrics for EKS cluster
@api_router.post("/admin/cloudwatch/metrics")
async def get_cloudwatch_metrics(metrics_request: CloudWatchMetricsRequest):
    """Get CloudWatch metrics for EKS cluster"""
    try:
        cloudwatch, eks, ec2, aws_region = get_aws_clients()
        cluster_name = os.getenv('EKS_CLUSTER_NAME', 'arnav-velora2')
        
        start_time, end_time = get_time_range(metrics_request.time_range)
        
        # Get cluster info
        try:
            cluster_info = eks.describe_cluster(name=cluster_name)
            cluster_status = cluster_info['cluster']['status']
        except ClientError as e:
            logging.error(f"Failed to get cluster info: {str(e)}")
            cluster_status = "Unknown"
        
        # Get metrics from CloudWatch
        metrics_data = {}
        
        # Define metrics to fetch
        metric_queries = [
            {
                "name": "node_cpu_utilization",
                "namespace": "ContainerInsights",
                "metric_name": "node_cpu_utilization",
                "stat": "Average"
            },
            {
                "name": "node_memory_utilization",
                "namespace": "ContainerInsights",
                "metric_name": "node_memory_utilization",
                "stat": "Average"
            },
            {
                "name": "node_network_total_bytes",
                "namespace": "ContainerInsights",
                "metric_name": "node_network_total_bytes",
                "stat": "Sum"
            },
            {
                "name": "node_filesystem_utilization",
                "namespace": "ContainerInsights",
                "metric_name": "node_filesystem_utilization",
                "stat": "Average"
            },
            {
                "name": "pod_cpu_utilization",
                "namespace": "ContainerInsights",
                "metric_name": "pod_cpu_utilization",
                "stat": "Average"
            },
            {
                "name": "pod_memory_utilization",
                "namespace": "ContainerInsights",
                "metric_name": "pod_memory_utilization",
                "stat": "Average"
            }
        ]
        
        # Fetch each metric
        for query in metric_queries:
            try:
                response = cloudwatch.get_metric_statistics(
                    Namespace=query["namespace"],
                    MetricName=query["metric_name"],
                    Dimensions=[
                        {
                            'Name': 'ClusterName',
                            'Value': cluster_name
                        }
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=300,  # 5 minutes
                    Statistics=[query["stat"]]
                )
                
                datapoints = sorted(response['Datapoints'], key=lambda x: x['Timestamp'])
                
                metrics_data[query["name"]] = {
                    "timestamps": [dp['Timestamp'].isoformat() for dp in datapoints],
                    "values": [dp.get(query["stat"], 0) for dp in datapoints],
                    "unit": datapoints[0].get('Unit', 'None') if datapoints else 'None'
                }
            except ClientError as e:
                logging.warning(f"Failed to fetch metric {query['name']}: {str(e)}")
                metrics_data[query["name"]] = {
                    "timestamps": [],
                    "values": [],
                    "unit": "None",
                    "error": str(e)
                }
        
        # Calculate current average values
        current_metrics = {}
        for metric_name, metric_data in metrics_data.items():
            if metric_data["values"]:
                current_metrics[metric_name] = {
                    "current": metric_data["values"][-1] if metric_data["values"] else 0,
                    "average": sum(metric_data["values"]) / len(metric_data["values"]) if metric_data["values"] else 0,
                    "max": max(metric_data["values"]) if metric_data["values"] else 0,
                    "min": min(metric_data["values"]) if metric_data["values"] else 0
                }
            else:
                current_metrics[metric_name] = {
                    "current": 0,
                    "average": 0,
                    "max": 0,
                    "min": 0
                }
        
        return {
            "cluster_name": cluster_name,
            "cluster_status": cluster_status,
            "time_range": metrics_request.time_range,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "metrics": metrics_data,
            "current_metrics": current_metrics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to fetch CloudWatch metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {str(e)}")

# Get pod statistics
@api_router.get("/admin/pods/stats")
async def get_pod_stats():
    """Get pod statistics for the cluster"""
    try:
        # This would typically use kubectl or Kubernetes API
        # For now, return mock data that can be replaced with real kubectl calls
        import subprocess
        
        try:
            # Try to get real pod data using kubectl
            result = subprocess.run(
                ['kubectl', 'get', 'pods', '--all-namespaces', '-o', 'json'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                pods_data = json.loads(result.stdout)
                pods = pods_data.get('items', [])
                
                total_pods = len(pods)
                running_pods = sum(1 for pod in pods if pod['status']['phase'] == 'Running')
                pending_pods = sum(1 for pod in pods if pod['status']['phase'] == 'Pending')
                failed_pods = sum(1 for pod in pods if pod['status']['phase'] == 'Failed')
                
                # Get pod resource usage
                pod_details = []
                for pod in pods[:20]:  # Limit to first 20 pods
                    pod_name = pod['metadata']['name']
                    namespace = pod['metadata']['namespace']
                    status = pod['status']['phase']
                    
                    # Get container count
                    containers = pod['spec'].get('containers', [])
                    container_count = len(containers)
                    
                    pod_details.append({
                        "name": pod_name,
                        "namespace": namespace,
                        "status": status,
                        "containers": container_count,
                        "node": pod['spec'].get('nodeName', 'N/A'),
                        "created": pod['metadata']['creationTimestamp']
                    })
                
                return {
                    "total_pods": total_pods,
                    "running_pods": running_pods,
                    "pending_pods": pending_pods,
                    "failed_pods": failed_pods,
                    "pod_details": pod_details,
                    "data_source": "kubectl"
                }
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError) as e:
            logging.warning(f"kubectl command failed: {str(e)}, using CloudWatch data")
        
        # Fallback to CloudWatch if kubectl fails
        cloudwatch, eks, ec2, aws_region = get_aws_clients()
        cluster_name = os.getenv('EKS_CLUSTER_NAME', 'arnav-velora2')
        
        # Get pod count from CloudWatch
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=5)
        
        try:
            response = cloudwatch.get_metric_statistics(
                Namespace='ContainerInsights',
                MetricName='pod_number_of_containers',
                Dimensions=[
                    {
                        'Name': 'ClusterName',
                        'Value': cluster_name
                    }
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Sum']
            )
            
            datapoints = response.get('Datapoints', [])
            total_pods = int(datapoints[-1]['Sum']) if datapoints else 0
            
            return {
                "total_pods": total_pods,
                "running_pods": total_pods,  # Approximate
                "pending_pods": 0,
                "failed_pods": 0,
                "pod_details": [],
                "data_source": "cloudwatch",
                "note": "Install kubectl for detailed pod information"
            }
        except Exception as e:
            logging.warning(f"CloudWatch pod metrics failed: {str(e)}")
            return {
                "total_pods": 0,
                "running_pods": 0,
                "pending_pods": 0,
                "failed_pods": 0,
                "pod_details": [],
                "data_source": "unavailable",
                "error": "Unable to fetch pod statistics. Ensure CloudWatch Container Insights is enabled."
            }
            
    except Exception as e:
        logging.error(f"Failed to fetch pod stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch pod stats: {str(e)}")

# Get cost estimate
@api_router.get("/admin/cost/estimate")
async def get_cost_estimate():
    """Get estimated cost for the cluster"""
    try:
        cloudwatch, eks, ec2, aws_region = get_aws_clients()
        cluster_name = os.getenv('EKS_CLUSTER_NAME', 'arnav-velora2')
        
        # Get cluster nodes
        try:
            cluster_info = eks.describe_cluster(name=cluster_name)
            vpc_id = cluster_info['cluster']['resourcesVpcConfig']['vpcId']
            
            # Get node group info
            nodegroups = eks.list_nodegroups(clusterName=cluster_name)
            
            total_cost_per_hour = 0.10  # EKS control plane cost
            total_cost_per_month = 73  # EKS control plane cost
            
            node_costs = []
            
            for ng_name in nodegroups.get('nodegroups', []):
                ng_info = eks.describe_nodegroup(
                    clusterName=cluster_name,
                    nodegroupName=ng_name
                )
                
                nodegroup = ng_info['nodegroup']
                instance_types = nodegroup.get('instanceTypes', ['t3.medium'])
                desired_size = nodegroup.get('scalingConfig', {}).get('desiredSize', 2)
                
                # Cost per instance (t3.medium in ap-south-1)
                instance_costs = {
                    't3.medium': 0.0416,
                    't3.small': 0.0208,
                    't3.large': 0.0832,
                    't3.xlarge': 0.1664
                }
                
                instance_type = instance_types[0] if instance_types else 't3.medium'
                cost_per_hour = instance_costs.get(instance_type, 0.0416)
                
                node_cost_hour = cost_per_hour * desired_size
                node_cost_month = node_cost_hour * 730  # Average hours per month
                
                total_cost_per_hour += node_cost_hour
                total_cost_per_month += node_cost_month
                
                node_costs.append({
                    "nodegroup": ng_name,
                    "instance_type": instance_type,
                    "node_count": desired_size,
                    "cost_per_hour": round(node_cost_hour, 4),
                    "cost_per_month": round(node_cost_month, 2)
                })
            
            return {
                "cluster_name": cluster_name,
                "control_plane_cost": {
                    "per_hour": 0.10,
                    "per_month": 73
                },
                "node_costs": node_costs,
                "total_cost": {
                    "per_hour": round(total_cost_per_hour, 4),
                    "per_day": round(total_cost_per_hour * 24, 2),
                    "per_month": round(total_cost_per_month, 2)
                },
                "currency": "USD",
                "region": aws_region
            }
            
        except ClientError as e:
            logging.error(f"Failed to get cost estimate: {str(e)}")
            # Return default estimate if API calls fail
            return {
                "cluster_name": cluster_name,
                "control_plane_cost": {
                    "per_hour": 0.10,
                    "per_month": 73
                },
                "node_costs": [
                    {
                        "nodegroup": "default",
                        "instance_type": "t3.medium",
                        "node_count": 2,
                        "cost_per_hour": 0.0832,
                        "cost_per_month": 60.74
                    }
                ],
                "total_cost": {
                    "per_hour": 0.1832,
                    "per_day": 4.40,
                    "per_month": 133.74
                },
                "currency": "USD",
                "region": aws_region,
                "note": "Estimated costs based on default configuration"
            }
            
    except Exception as e:
        logging.error(f"Failed to calculate cost estimate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate costs: {str(e)}")

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "multi_tenancy": "enabled"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # or put your frontend URL
    allow_credentials=True,
    allow_methods=["*"],       # GET, POST, DELETE, etc.
    allow_headers=[
        "*",
        "x-user-hash",
        "Content-Type",
        "Authorization"
    ],
    expose_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    """Initialize database collections and default data"""
    # Create default templates
    api_template = {
        "name": "FastAPI Service Template",
        "service_type": "api",
        "description": "Standard FastAPI service template",
        "template_files": {
            "main.py": '''from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
''',
            "requirements.txt": '''fastapi==0.110.1
uvicorn==0.25.0
''',
            "Dockerfile": '''FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
''',
            "Jenkinsfile": '''pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t $SERVICE_NAME .'
            }
        }
        stage('Deploy') {
            steps {
                sh 'docker push $SERVICE_NAME'
            }
        }
    }
}
'''
        },
        "created_at": datetime.utcnow()
    }
    
    # Check if template already exists
    existing_template = await db.templates.find_one({"service_type": "api"})
    if not existing_template:
        template_obj = ServiceTemplate(**api_template)
        await db.templates.insert_one(template_obj.dict())
        logger.info("Default API template created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()