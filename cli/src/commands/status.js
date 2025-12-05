const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const api = require('../utils/api');

const statusCommand = new Command('status')
  .description('Check service status and pipeline progress')
  .argument('<service-name-or-id>', 'Service name or ID')
  .option('-f, --follow', 'Follow pipeline progress in real-time')
  .option('--json', 'Output in JSON format')
  .action(async (serviceIdentifier, options) => {
    try {
      let service;
      let pipeline;
      
      // Try to find service by name first, then by ID
      try {
        const services = await api.getServices();
        service = services.find(s => s.name === serviceIdentifier || s.id === serviceIdentifier);
        
        if (!service) {
          console.error(chalk.red(`❌ Service "${serviceIdentifier}" not found`));
          process.exit(1);
        }
        
        // Get pipeline status
        try {
          pipeline = await api.getPipeline(service.id);
        } catch (error) {
          // Pipeline may not exist yet
          pipeline = null;
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch service: ${error.message}`));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify({ service, pipeline }, null, 2));
        return;
      }
      
      // Display service status
      displayServiceStatus(service, pipeline);
      
      // Follow mode
      if (options.follow && pipeline && ['pending', 'running'].includes(pipeline.status)) {
        console.log(chalk.blue('\n👀 Following pipeline progress... (Press Ctrl+C to stop)'));
        await followPipeline(service.id);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

function displayServiceStatus(service, pipeline) {
  console.log(chalk.blue(`\n🔍 Service Status: ${service.name}\n`));
  
  // Service information
  const statusIcon = getStatusIcon(service.status);
  const statusColor = getStatusColor(service.status);
  
  console.log(`${statusIcon} Status: ${chalk[statusColor](service.status.toUpperCase())}`);
  console.log(`📦 Type: ${service.service_type}`);
  console.log(`📝 Description: ${service.description}`);
  console.log(`🆔 ID: ${chalk.dim(service.id)}`);
  console.log(`📅 Created: ${new Date(service.created_at).toLocaleString()}`);
  console.log(`🔄 Updated: ${new Date(service.updated_at).toLocaleString()}`);
  
  if (service.service_url) {
    console.log(`🌐 URL: ${chalk.blue.underline(service.service_url)}`);
  }
  
  if (service.github_repo_url) {
    console.log(`📂 Repository: ${chalk.blue.underline(service.github_repo_url)}`);
  }
  
  // Pipeline information
  if (pipeline) {
    console.log(chalk.blue('\n📊 Pipeline Status:\n'));
    
    const pipelineStatusIcon = getPipelineStatusIcon(pipeline.status);
    const pipelineStatusColor = getPipelineStatusColor(pipeline.status);
    
    console.log(`${pipelineStatusIcon} Status: ${chalk[pipelineStatusColor](pipeline.status.toUpperCase())}`);
    console.log(`🎯 Stage: ${pipeline.stage.replace('_', ' ')}`);
    console.log(`📈 Progress: ${pipeline.progress}%`);
    
    // Progress bar
    const progressBarLength = 20;
    const filledLength = Math.round((pipeline.progress / 100) * progressBarLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
    console.log(`${chalk.blue(progressBar)} ${pipeline.progress}%`);
    
    console.log(`🕐 Updated: ${new Date(pipeline.updated_at).toLocaleString()}`);
    
    // Recent logs
    if (pipeline.logs && pipeline.logs.length > 0) {
      console.log(chalk.blue('\n📋 Recent Logs:\n'));
      pipeline.logs.slice(-5).forEach(log => {
        console.log(chalk.dim(`  ${log}`));
      });
    }
  }
}

async function followPipeline(serviceId) {
  const maxAttempts = 120; // 10 minutes with 5-second intervals
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const pipeline = await api.getPipeline(serviceId);
      
      const statusIcon = getPipelineStatusIcon(pipeline.status);
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`[${timestamp}] ${statusIcon} ${pipeline.stage.replace('_', ' ')} (${pipeline.progress}%)`);
      
      if (pipeline.status === 'success') {
        console.log(chalk.green('\n✅ Pipeline completed successfully!'));
        
        // Show final service URL
        try {
          const service = await api.getService(serviceId);
          if (service.service_url) {
            console.log(chalk.blue(`🌐 Service URL: ${service.service_url}`));
          }
        } catch (error) {
          // Ignore URL fetch errors
        }
        
        break;
      } else if (pipeline.status === 'failed') {
        console.log(chalk.red('\n❌ Pipeline failed!'));
        if (pipeline.logs && pipeline.logs.length > 0) {
          console.log(chalk.red('\nError logs:'));
          pipeline.logs.slice(-3).forEach(log => {
            console.log(chalk.dim(`  ${log}`));
          });
        }
        break;
      }
      
      attempts++;
      if (attempts < maxAttempts && ['pending', 'running'].includes(pipeline.status)) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        break;
      }
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Pipeline monitoring error: ${error.message}`));
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log(chalk.yellow('\n⏰ Pipeline monitoring timed out.'));
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'running':
      return '✅';
    case 'failed':
      return '❌';
    case 'building':
      return '🔄';
    case 'creating':
      return '⏳';
    default:
      return '❓';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'running':
      return 'green';
    case 'failed':
      return 'red';
    case 'building':
      return 'yellow';
    case 'creating':
      return 'blue';
    default:
      return 'gray';
  }
}

function getPipelineStatusIcon(status) {
  switch (status) {
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'running':
      return '🔄';
    case 'pending':
      return '⏳';
    default:
      return '❓';
  }
}

function getPipelineStatusColor(status) {
  switch (status) {
    case 'success':
      return 'green';
    case 'failed':
      return 'red';
    case 'running':
      return 'blue';
    case 'pending':
      return 'yellow';
    default:
      return 'gray';
  }
}

module.exports = statusCommand;