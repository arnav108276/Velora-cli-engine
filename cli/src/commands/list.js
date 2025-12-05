const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const api = require('../utils/api');

const listCommand = new Command('list')
  .description('List all services')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('--status <status>', 'Filter by status')
  .option('--type <type>', 'Filter by service type')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📋 Fetching services...'));
      
      const services = await api.getServices();
      
      if (services.length === 0) {
        console.log(chalk.yellow('📭 No services found'));
        console.log(chalk.dim('Create your first service with: velora create <service-name>'));
        return;
      }
      
      // Apply filters
      let filteredServices = services;
      
      if (options.status) {
        filteredServices = filteredServices.filter(s => s.status === options.status);
      }
      
      if (options.type) {
        filteredServices = filteredServices.filter(s => s.service_type === options.type);
      }
      
      if (filteredServices.length === 0) {
        console.log(chalk.yellow('📭 No services match the specified filters'));
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(filteredServices, null, 2));
        return;
      }
      
      // Table format
      const table = new Table({
        head: [
          chalk.bold('Name'),
          chalk.bold('Type'),
          chalk.bold('Status'),
          chalk.bold('URL'),
          chalk.bold('Created')
        ],
        colWidths: [20, 12, 12, 30, 12]
      });
      
      filteredServices.forEach(service => {
        const statusColor = getStatusColor(service.status);
        const status = chalk[statusColor](service.status.toUpperCase());
        
        const url = service.service_url 
          ? service.service_url.length > 25 
            ? service.service_url.substring(0, 22) + '...'
            : service.service_url
          : chalk.dim('(pending)');
        
        const created = new Date(service.created_at).toLocaleDateString();
        
        table.push([
          service.name,
          service.service_type,
          status,
          url,
          created
        ]);
      });
      
      console.log(table.toString());
      
      // Summary
      const statusCounts = {};
      filteredServices.forEach(service => {
        statusCounts[service.status] = (statusCounts[service.status] || 0) + 1;
      });
      
      console.log(chalk.blue('\n📊 Summary:'));
      console.log(`  Total: ${filteredServices.length} services`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        const color = getStatusColor(status);
        console.log(`  ${chalk[color](status.charAt(0).toUpperCase() + status.slice(1))}: ${count}`);
      });
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to list services: ${error.message}`));
      process.exit(1);
    }
  });

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

module.exports = listCommand;