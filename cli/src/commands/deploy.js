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

// Helper function for executing commands
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

// Check if kubectl is installed
async function checkKubectl() {
  try {
    await execAsync('kubectl version --client');
    return true;
  } catch (error) {
    return false;
  }
}

// Check EKS cluster status
async function checkEKSConnection(clusterName, region) {
  try {
    const { stdout } = await execAsync(`aws eks describe-cluster --name ${clusterName} --region ${region}`);
    const cluster = JSON.parse(stdout);
    return cluster.cluster.status === 'ACTIVE';
  } catch (error) {
    return false;
  }
}

// ✅ FIX: Enhanced port detection from Dockerfile
async function detectPortFromDockerfile(dockerImage) {
  try {
    // Try to inspect the Docker image to find EXPOSE directive
    const { stdout } = await execAsync(`docker image inspect ${dockerImage} --format='{{json .Config.ExposedPorts}}'`);
    if (stdout && stdout.trim() !== 'null' && stdout.trim() !== '') {
      const exposedPorts = JSON.parse(stdout.trim());
      const ports = Object.keys(exposedPorts);
      if (ports.length > 0) {
        // Extract the port number (format: "8080/tcp")
        const port = parseInt(ports[0].split('/')[0]);
        console.log(chalk.blue(`📦 Detected exposed port from Docker image: ${port}`));
        return port;
      }
    }
  } catch (error) {
    // Image might not be available locally, continue with default logic
    console.log(chalk.dim('Could not inspect Docker image locally, using default port detection'));
  }
  return null;
}

// Generate Kubernetes Deployment manifest
function generateK8sDeployment(serviceName, dockerImage, serviceType, containerPort) {
  // ✅ FIX: Use detected port or fallback to defaults
  const port = containerPort || (
    serviceType === "frontend" ? 80 :
    serviceType === "database" ? 5432 :
    serviceType === "api" ? 8080 :
    8080  // ✅ FIX: Changed default from 8002 to 8080 for better compatibility
  );
  
  console.log(chalk.blue(`🔧 Using container port: ${port} for service type: ${serviceType}`));
  
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
              containerPort: port,
              name: 'http',
              protocol: 'TCP'
            }],
            // ✅ FIX: Added health checks for better pod readiness detection
            readinessProbe: {
              httpGet: {
                path: '/',
                port: port,
                scheme: 'HTTP'
              },
              initialDelaySeconds: 10,
              periodSeconds: 5,
              timeoutSeconds: 3,
              successThreshold: 1,
              failureThreshold: 3
            },
            livenessProbe: {
              httpGet: {
                path: '/',
                port: port,
                scheme: 'HTTP'
              },
              initialDelaySeconds: 30,
              periodSeconds: 10,
              timeoutSeconds: 3,
              successThreshold: 1,
              failureThreshold: 3
            },
            resources: {
              requests: {
                memory: '256Mi',
                cpu: '250m'
              },
              limits: {
                memory: '512Mi',
                cpu: '500m'
              }
            },
            env: [
              {
                name: 'PORT',
                value: port.toString()
              }
            ]
          }]
        }
      }
    }
  };
  
  return yaml.dump(deployment);
}

// Generate Kubernetes Service manifest
function generateK8sService(serviceName, serviceType, containerPort) {
  // ✅ FIX: Use detected port or fallback to defaults
  const port = containerPort || (
    serviceType === "frontend" ? 80 :
    serviceType === "database" ? 5432 :
    serviceType === "api" ? 8080 :
    8080  // ✅ FIX: Changed default from 8002 to 8080
  );
  
  console.log(chalk.blue(`🔧 Creating NodePort service on port: ${port}`));
  
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
        name: 'http'
      }],
      sessionAffinity: 'ClientIP',
      sessionAffinityConfig: {
        clientIP: {
          timeoutSeconds: 10800
        }
      }
    }
  };
  
  return yaml.dump(service);
}

// Get Node IP address
async function getNodeIP() {
  try {
    // Try ExternalIP first
    const { stdout } = await execAsync('kubectl get nodes -o jsonpath="{.items[0].status.addresses[?(@.type==\'ExternalIP\')].address}"');
    if (stdout && stdout.trim()) {
      console.log(chalk.green(`✅ Found External IP: ${stdout.trim()}`));
      return stdout.trim();
    }
    
    // Fallback to InternalIP
    const { stdout: internalIP } = await execAsync('kubectl get nodes -o jsonpath="{.items[0].status.addresses[?(@.type==\'InternalIP\')].address}"');
    console.log(chalk.yellow(`⚠️  Using Internal IP: ${internalIP.trim()} (External IP not available)`));
    console.log(chalk.dim('Note: You may need to configure security groups to access this IP externally'));
    return internalIP.trim();
  } catch (error) {
    throw new Error('Failed to get node IP address');
  }
}

// Get assigned NodePort
async function getServiceNodePort(serviceName) {
  try {
    const { stdout } = await execAsync(`kubectl get service ${serviceName}-service -o jsonpath='{.spec.ports[0].nodePort}'`);
    const nodePort = stdout.trim();
    console.log(chalk.green(`✅ NodePort assigned: ${nodePort}`));
    return nodePort;
  } catch (error) {
    throw new Error('Failed to get service NodePort');
  }
}

// ✅ FIX: Verify service endpoints
async function verifyServiceEndpoints(serviceName) {
  try {
    const { stdout } = await execAsync(`kubectl get endpoints ${serviceName}-service -o jsonpath='{.subsets[*].addresses[*].ip}'`);
    if (stdout && stdout.trim()) {
      const endpoints = stdout.trim().split(' ');
      console.log(chalk.green(`✅ Service endpoints ready: ${endpoints.length} pod(s)`));
      endpoints.forEach((ip, idx) => {
        console.log(chalk.dim(`   Pod ${idx + 1}: ${ip}`));
      });
      return true;
    } else {
      console.log(chalk.yellow('⚠️  No endpoints found. Pods might not be ready yet.'));
      return false;
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not verify service endpoints'));
    return false;
  }
}

// ✅ FIX: Check detailed pod status
async function checkPodStatus(serviceName) {
  try {
    const { stdout } = await execAsync(`kubectl get pods -l app=${serviceName} -o json`);
    const podsData = JSON.parse(stdout);
    
    if (podsData.items && podsData.items.length > 0) {
      console.log(chalk.blue(`\n📊 Pod Status for ${serviceName}:`));
      
      podsData.items.forEach((pod, idx) => {
        const podName = pod.metadata.name;
        const podStatus = pod.status.phase;
        const containerStatuses = pod.status.containerStatuses || [];
        
        console.log(chalk.dim(`\n  Pod ${idx + 1}: ${podName}`));
        console.log(chalk.dim(`    Status: ${podStatus}`));
        
        containerStatuses.forEach(container => {
          console.log(chalk.dim(`    Container: ${container.name}`));
          console.log(chalk.dim(`      Ready: ${container.ready}`));
          console.log(chalk.dim(`      Restart Count: ${container.restartCount}`));
          
          if (container.state.running) {
            console.log(chalk.dim(`      State: Running (started ${container.state.running.startedAt})`));
          } else if (container.state.waiting) {
            console.log(chalk.yellow(`      State: Waiting (${container.state.waiting.reason})`));
          } else if (container.state.terminated) {
            console.log(chalk.red(`      State: Terminated (${container.state.terminated.reason})`));
          }
        });
      });
      
      return true;
    } else {
      console.log(chalk.yellow('⚠️  No pods found for this service'));
      return false;
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not check pod status: ${error.message}`));
    return false;
  }
}

// Main deployment function
async function deployToEKS(serviceName, service, clusterName, region) {
  const spinner = ora('Deploying to AWS EKS...').start();
  try {
    // Configure kubectl
    spinner.text = 'Configuring kubectl for EKS cluster...';
    await execAsync(`aws eks update-kubeconfig --name ${clusterName} --region ${region}`);
    spinner.succeed(chalk.green('✅ kubectl configured for EKS cluster'));
    // Create temp directory
    const tmpDir = path.join(os.tmpdir(), `velora-${serviceName}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    // Validate Docker image
    if (!service.docker_image) {
      spinner.fail(chalk.red('❌ No Docker image found for this service'));
      throw new Error('Service must have a Docker image. Create service with --location flag first.');
    }
    const dockerImage = `arnavgoel/${service.name}:latest`;
    // Detect port
    spinner.text = 'Detecting container port...';
    const detectedPort = await detectPortFromDockerfile(dockerImage);
    // Generate manifests
    spinner.start('Generating Kubernetes manifests...');
    const deploymentYaml = generateK8sDeployment(serviceName, dockerImage, service.service_type, detectedPort);
    const serviceYaml = generateK8sService(serviceName, service.service_type, detectedPort);
    const deploymentPath = path.join(tmpDir, 'deployment.yaml');
    const servicePath = path.join(tmpDir, 'service.yaml');
    fs.writeFileSync(deploymentPath, deploymentYaml);
    fs.writeFileSync(servicePath, serviceYaml);
    spinner.succeed(chalk.green('✅ Kubernetes manifests generated'));
    
    console.log(chalk.dim(`\nDeployment manifest saved to: ${deploymentPath}`));
    console.log(chalk.dim(`Service manifest saved to: ${servicePath}`));
    
    // Apply deployment
    spinner.start('Deploying to Kubernetes...');
    await execAsync(`kubectl apply -f ${deploymentPath}`);
    await execAsync(`kubectl apply -f ${servicePath}`);
    spinner.succeed(chalk.green('✅ Deployed to Kubernetes'));
    
    // Wait for pods
    spinner.start('Waiting for pods to be ready (this may take a few minutes)...');
    try {
      await execAsync(`kubectl wait --for=condition=available --timeout=300s deployment/${serviceName}`, {
        timeout: 310000
      });
      spinner.succeed(chalk.green('✅ Pods are ready'));
    } catch (waitError) {
      spinner.warn(chalk.yellow('⚠️  Timeout waiting for pods, checking status...'));
      await checkPodStatus(serviceName);
      console.log(chalk.dim('\nContinuing with service information retrieval...'));
    }
    
    // Verify endpoints
    spinner.start('Verifying service endpoints...');
    const endpointsReady = await verifyServiceEndpoints(serviceName);
    if (endpointsReady) {
      spinner.succeed(chalk.green('✅ Service endpoints verified'));
    } else {
      spinner.warn(chalk.yellow('⚠️  Service endpoints not ready yet'));
    }
    
    // Get access info
    spinner.start('Getting service access information...');
    const nodeIP = await getNodeIP();
    const nodePort = await getServiceNodePort(serviceName);
    spinner.succeed(chalk.green('✅ Service deployed successfully'));
    
    // Check pod status
    await checkPodStatus(serviceName);
    
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
    
    
    return {
      nodeIP,
      nodePort,
      url: `http://${nodeIP}:${nodePort}`,
      containerPort: detectedPort || (service.service_type === "api" ? 8080 : 8080)
    };
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Deployment failed'));
    throw error;
  }
}

// Follow deployment progress
async function followDeployment(serviceId) {
  const maxAttempts = 30;
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

// Create the deploy command
const deployCommand = new Command('deploy')
  .description('Deploy a service to AWS EKS')
  .argument('<service-name-or-id>', 'Service name or ID')
  .option('-c, --cluster <name>', 'EKS cluster name', 'arnav-velora2')
  .option('-r, --region <region>', 'AWS region', 'ap-south-1')
  .option('-f, --follow', 'Follow deployment progress')
  .option('--rollback', 'Rollback to previous version')
  .option('-p, --port <port>', 'Override container port (if auto-detection fails)', parseInt)
  .action(async (serviceIdentifier, options) => {
    try {
      // Check prerequisites
      console.log(chalk.blue('🔍 Checking prerequisites...'));
      
      const kubectlInstalled = await checkKubectl();
      if (!kubectlInstalled) {
        console.error(chalk.red('❌ kubectl is not installed'));
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
        console.log(chalk.yellow('\nRun "velora list" to see available services'));
        process.exit(1);
      }
      
      console.log(chalk.green(`✅ Found service: ${service.name} (${service.id})`));
      console.log(chalk.dim(`   Type: ${service.service_type}`));
      console.log(chalk.dim(`   Docker Image: ${service.docker_image || 'Not set'}`));
      
      if (options.rollback) {
        console.log(chalk.yellow(`🔄 Initiating rollback for: ${service.name}`));
        
        try {
          await api.rollbackService(service.id);
          console.log(chalk.green('✅ Rollback initiated successfully'));
          
          if (options.follow) {
            console.log(chalk.blue('\n👀 Following rollback progress...'));
            await followDeployment(service.id);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Rollback failed: ${error.message}`));
          process.exit(1);
        }
      } else {
        // Check EKS cluster
        console.log(chalk.blue(`\n🔍 Checking EKS cluster: ${options.cluster}...`));
        const clusterActive = await checkEKSConnection(options.cluster, options.region);
        
        if (!clusterActive) {
          console.error(chalk.red(`❌ EKS cluster "${options.cluster}" not found or not active in region ${options.region}`));

          process.exit(1);
        }
        
        console.log(chalk.green(`✅ EKS cluster is active`));
        // Deploy
        console.log(chalk.blue(`\n🚀 Deploying ${service.name} to EKS...\n`));
        const deploymentInfo = await deployToEKS(service.name, service, options.cluster, options.region);
        console.log(chalk.green('\n🎉 Deployment completed successfully!\n'));
        console.log(chalk.bold('📋 Access Information:'));
        console.log(`  ${chalk.cyan('Service URL')}: ${chalk.bold(deploymentInfo.url)}`);
        console.log(`  ${chalk.dim('Node IP')}: ${deploymentInfo.nodeIP}`);
        console.log(`  ${chalk.dim('NodePort')}: ${deploymentInfo.nodePort}`);
        console.log(`  ${chalk.dim('Container Port')}: ${deploymentInfo.containerPort}`);
        console.log(chalk.dim(`Or visit in browser: ${deploymentInfo.url}`));
        
        }
      
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (error.stdout) console.error(chalk.dim(error.stdout));
      if (error.stderr) console.error(chalk.dim(error.stderr));
      process.exit(1);
    }
  });
module.exports = deployCommand;