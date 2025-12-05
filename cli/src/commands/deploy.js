const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const api = require('../utils/api');
const config = require('../utils/config');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

async function execAsync(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function checkKubectl() {
  try {
    await execAsync('kubectl version --client');
    return true;
  } catch (error) {
    return false;
  }
}

async function checkEKSConnection(clusterName, region) {
  try {
    const { stdout } = await execAsync(`aws eks describe-cluster --name ${clusterName} --region ${region}`);
    const cluster = JSON.parse(stdout);
    return cluster.cluster.status === 'ACTIVE';
  } catch (error) {
    return false;
  }
}

function generateK8sDeployment(serviceName, dockerImage, serviceType) {
  const port =
  serviceType === "frontend" ? 80 :
  serviceType === "database" ? 5432 :
  serviceType === "api" ? 8080 :
  8002;
  
  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: serviceName,
      labels: {
        app: serviceName,
        'managed-by': 'velora'
      }
    },
    spec: {
      replicas: 2,
      selector: {
        matchLabels: {
          app: serviceName
        }
      },
      template: {
        metadata: {
          labels: {
            app: serviceName
          }
        },
        spec: {
          containers: [{
            name: serviceName,
            image: dockerImage,
            ports: [{
              containerPort: port
            }],
            resources: {
              requests: {
                memory: '256Mi',
                cpu: '250m'
              },
              limits: {
                memory: '512Mi',
                cpu: '500m'
              }
            }
          }]
        }
      }
    }
  };
  
  return yaml.dump(deployment);
}

function generateK8sService(serviceName, serviceType) {
  const port =
  serviceType === "frontend" ? 80 :
  serviceType === "database" ? 5432 :
  serviceType === "api" ? 8080 :
  8002;
  
  // Use NodePort for cost-effective access
  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: `${serviceName}-service`,
      labels: {
        app: serviceName,
        'managed-by': 'velora'
      }
    },
    spec: {
      type: 'NodePort',
      selector: {
        app: serviceName
      },
      ports: [{
        protocol: 'TCP',
        port: port,
        targetPort: port,
        nodePort: null  // Let Kubernetes assign
      }]
    }
  };
  
  return yaml.dump(service);
}

async function getNodeIP() {
  try {
    const { stdout } = await execAsync('kubectl get nodes -o jsonpath="{.items[0].status.addresses[?(@.type==\'ExternalIP\')].address}"');
    if (stdout && stdout.trim()) {
      return stdout.trim();
    }
    
    // Fallback to InternalIP if ExternalIP not available
    const { stdout: internalIP } = await execAsync('kubectl get nodes -o jsonpath="{.items[0].status.addresses[?(@.type==\'InternalIP\')].address}"');
    return internalIP.trim();
  } catch (error) {
    throw new Error('Failed to get node IP address');
  }
}

async function getServiceNodePort(serviceName) {
  try {
    const { stdout } = await execAsync(`kubectl get service ${serviceName}-service -o jsonpath='{.spec.ports[0].nodePort}'`);
    return stdout.trim();
  } catch (error) {
    throw new Error('Failed to get service NodePort');
  }
}

async function deployToEKS(serviceName, service, clusterName, region) {
  const spinner = ora('Deploying to AWS EKS...').start();
  
  try {
    // Ensure kubectl is configured for the EKS cluster
    spinner.text = 'Configuring kubectl for EKS cluster...';
    await execAsync(`aws eks update-kubeconfig --name ${clusterName} --region ${region}`);
    spinner.succeed(chalk.green('✅ kubectl configured for EKS cluster'));
    
    // Create temporary directory for manifests
    const tmpDir = path.join(os.tmpdir(), `velora-${serviceName}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    
    // Ensure Docker image is available
    if (!service.docker_image) {
      spinner.fail(chalk.red('❌ No Docker image found for this service'));
      throw new Error('Service must have a Docker image. Create service with --location flag first.');
    }
    dockerImage=`arnavgoel/${service.name}:latest`;    // Generate Kubernetes manifests
    spinner.start('Generating Kubernetes manifests...');
    const deploymentYaml = generateK8sDeployment(serviceName, dockerImage, service.service_type);
    const serviceYaml = generateK8sService(serviceName, service.service_type);
    
    const deploymentPath = path.join(tmpDir, 'deployment.yaml');
    const servicePath = path.join(tmpDir, 'service.yaml');
    
    fs.writeFileSync(deploymentPath, deploymentYaml);
    fs.writeFileSync(servicePath, serviceYaml);
    spinner.succeed(chalk.green('✅ Kubernetes manifests generated'));
    
    // Apply deployment
    spinner.start('Deploying to Kubernetes...');
    await execAsync(`kubectl apply -f ${deploymentPath}`);
    await execAsync(`kubectl apply -f ${servicePath}`);
    spinner.succeed(chalk.green('✅ Deployed to Kubernetes'));
    
    // Wait for deployment to be ready
    spinner.start('Waiting for pods to be ready...');
    await execAsync(`kubectl wait --for=condition=available --timeout=300s deployment/${serviceName}`, {
      timeout: 310000
    });
    spinner.succeed(chalk.green('✅ Pods are ready'));
    
    // Get Node IP and NodePort
    spinner.start('Getting service access information...');
    const nodeIP = await getNodeIP();
    const nodePort = await getServiceNodePort(serviceName);
    spinner.succeed(chalk.green('✅ Service deployed successfully'));
    
    // Clean up temporary files
    fs.rmSync(tmpDir, { recursive: true, force: true });
    
    return {
      nodeIP,
      nodePort,
      url: `http://${nodeIP}:${nodePort}`
    };
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Deployment failed'));
    throw error;
  }
}

const deployCommand = new Command('deploy')
  .description('Deploy a service to AWS EKS')
  .argument('<service-name-or-id>', 'Service name or ID')
  .option('-c, --cluster <name>', 'EKS cluster name', 'arnav-velora1')
  .option('-r, --region <region>', 'AWS region', 'ap-south-1')
  .option('-f, --follow', 'Follow deployment progress')
  .option('--rollback', 'Rollback to previous version')
  .action(async (serviceIdentifier, options) => {
    try {
      // Check prerequisites
      console.log(chalk.blue('🔍 Checking prerequisites...'));
      
      const kubectlInstalled = await checkKubectl();
      if (!kubectlInstalled) {
        console.error(chalk.red('❌ kubectl is not installed'));
        console.log(chalk.yellow('\\nPlease install kubectl:'));
        console.log(chalk.dim('  macOS: brew install kubectl'));
        console.log(chalk.dim('  Linux: curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"'));
        process.exit(1);
      }
      
      const currentConfig = config.getConfig();
      if (!currentConfig.userHash) {
        console.error(chalk.red('❌ User not configured. Run "velora config setup" first.'));
        process.exit(1);
      }
      
      // Find service
      console.log(chalk.blue(`🔍 Looking up service: ${serviceIdentifier}...`));
      const services = await api.getServices();
      const service = services.find(s => s.name === serviceIdentifier || s.id === serviceIdentifier);
      
      if (!service) {
        console.error(chalk.red(`❌ Service "${serviceIdentifier}" not found`));
        console.log(chalk.yellow('\\nRun "velora list" to see available services'));
        process.exit(1);
      }
      
      console.log(chalk.green(`✅ Found service: ${service.name} (${service.id})`));
      
      if (options.rollback) {
        console.log(chalk.yellow(`🔄 Initiating rollback for: ${service.name}`));
        
        try {
          await api.rollbackService(service.id);
          console.log(chalk.green('✅ Rollback initiated successfully'));
          
          if (options.follow) {
            console.log(chalk.blue('\\n👀 Following rollback progress...'));
            await followDeployment(service.id);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Rollback failed: ${error.message}`));
          process.exit(1);
        }
      } else {
        // Check EKS cluster connection
        console.log(chalk.blue(`\\n🔍 Checking EKS cluster: ${options.cluster}...`));
        const clusterActive = await checkEKSConnection(options.cluster, options.region);
        
        if (!clusterActive) {
          console.error(chalk.red(`❌ EKS cluster "${options.cluster}" not found or not active in region ${options.region}`));
          console.log(chalk.yellow('\\n📋 Setup Instructions:'));
          console.log(chalk.dim('\\n1. Install eksctl:'));
          console.log(chalk.dim('   macOS: brew tap weaveworks/tap && brew install weaveworks/tap/eksctl'));
          console.log(chalk.dim('   Linux: curl --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp && sudo mv /tmp/eksctl /usr/local/bin'));
          console.log(chalk.dim('\\n2. Create EKS cluster:'));
          console.log(chalk.dim(`   eksctl create cluster --name ${options.cluster} --region ${options.region} --nodes 2 --node-type t3.medium`));
          console.log(chalk.dim('\\n3. This will take ~15-20 minutes'));
          console.log(chalk.dim('\\n4. Once complete, run this deploy command again'));
          process.exit(1);
        }
        
        console.log(chalk.green(`✅ EKS cluster is active`));
        
        // Deploy to EKS
        console.log(chalk.blue(`\\n🚀 Deploying ${service.name} to EKS...\\n`));
        const deploymentInfo = await deployToEKS(service.name, service, options.cluster, options.region);
        
        console.log(chalk.green('\\n🎉 Deployment completed successfully!\\n'));
        console.log(chalk.bold('📋 Access Information:'));
        console.log(`  ${chalk.cyan('Service URL')}: ${chalk.bold(deploymentInfo.url)}`);
        console.log(`  ${chalk.dim('Node IP')}: ${deploymentInfo.nodeIP}`);
        console.log(`  ${chalk.dim('NodePort')}: ${deploymentInfo.nodePort}`);
        
        console.log(chalk.dim('\\n💡 Tips:'));
        console.log(chalk.dim(`  • Check pods: kubectl get pods -l app=${service.name}`));
        console.log(chalk.dim(`  • View logs: kubectl logs -l app=${service.name} --tail=50`));
        console.log(chalk.dim(`  • Scale deployment: kubectl scale deployment/${service.name} --replicas=3`));
        console.log(chalk.dim(`  • Delete deployment: kubectl delete deployment/${service.name} && kubectl delete service/${service.name}-service`));
      }
      
    } catch (error) {
      console.error(chalk.red(`\\n❌ Error: ${error.message}`));
      if (error.stdout) console.error(chalk.dim(error.stdout));
      if (error.stderr) console.error(chalk.dim(error.stderr));
      process.exit(1);
    }
  });

async function followDeployment(serviceId) {
  const maxAttempts = 60;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const pipeline = await api.getPipeline(serviceId);
      
      const statusIcon = pipeline.status === 'success' ? '✅' : 
                        pipeline.status === 'failed' ? '❌' : 
                        pipeline.status === 'running' ? '🔄' : '⏳';
      
      console.log(`${statusIcon} ${pipeline.stage.replace('_', ' ')} (${pipeline.progress}%)`);
      
      if (pipeline.status === 'success' || pipeline.status === 'failed') {
        break;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Deployment monitoring error: ${error.message}`));
      break;
    }
  }
}

module.exports = deployCommand;
