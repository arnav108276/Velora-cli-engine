const { Command } = require('commander');
const chalk = require('chalk');
const api = require('../utils/api');

const logsCommand = new Command('logs')
  .description('View service logs')
  .argument('<service-name-or-id>', 'Service name or ID')
  .option('-f, --follow', 'Follow logs in real-time')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (serviceIdentifier, options) => {
    try {
      // Find service
      const services = await api.getServices();
      const service = services.find(s => s.name === serviceIdentifier || s.id === serviceIdentifier);
      
      if (!service) {
        console.error(chalk.red(`❌ Service "${serviceIdentifier}" not found`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`📋 Logs for: ${service.name}`));
      console.log(chalk.dim(`Service ID: ${service.id}\n`));
      
      // Get pipeline logs (in a real implementation, this would fetch actual service logs)
      try {
        const pipeline = await api.getPipeline(service.id);
        
        if (pipeline.logs && pipeline.logs.length > 0) {
          const linesToShow = parseInt(options.lines);
          const logs = pipeline.logs.slice(-linesToShow);
          
          logs.forEach((log, index) => {
            const timestamp = new Date().toISOString();
            console.log(chalk.dim(`[${timestamp}]`) + ` ${log}`);
          });
          
          if (options.follow) {
            console.log(chalk.blue('\n👀 Following logs... (Press Ctrl+C to stop)'));
            await followLogs(service.id);
          }
        } else {
          console.log(chalk.yellow('📭 No logs available yet'));
          
          if (options.follow) {
            console.log(chalk.blue('\n👀 Waiting for logs... (Press Ctrl+C to stop)'));
            await followLogs(service.id);
          }
        }
      } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch logs: ${error.message}`));
        
        // Show helpful message
        console.log(chalk.yellow('\n💡 Note: Direct service logs are not yet implemented.'));
        console.log(chalk.dim('Currently showing pipeline logs. Full service logs will be available soon.'));
        
        if (service.service_url) {
          console.log(chalk.blue(`\n🌐 You can check the service directly at: ${service.service_url}`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

async function followLogs(serviceId) {
  let lastLogCount = 0;
  
  const interval = setInterval(async () => {
    try {
      const pipeline = await api.getPipeline(serviceId);
      
      if (pipeline.logs && pipeline.logs.length > lastLogCount) {
        const newLogs = pipeline.logs.slice(lastLogCount);
        newLogs.forEach(log => {
          const timestamp = new Date().toISOString();
          console.log(chalk.dim(`[${timestamp}]`) + ` ${log}`);
        });
        lastLogCount = pipeline.logs.length;
      }
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Log monitoring error: ${error.message}`));
    }
  }, 2000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.yellow('\n👋 Stopped following logs'));
    process.exit(0);
  });
}

module.exports = logsCommand;