#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');

// Import commands
const createCommand = require('../src/commands/create');
const listCommand = require('../src/commands/list');
const statusCommand = require('../src/commands/status');
const deployCommand = require('../src/commands/deploy');
const logsCommand = require('../src/commands/logs');
const deleteCommand = require('../src/commands/delete');
const configCommand = require('../src/commands/config');

const program = new Command();

// CLI Header
console.log(chalk.blue.bold(`
    ╔══════════════════════════════════════╗
   ║            🚀 VELORA CLI               ║
  ║       Cloud-Native Developer Platform     ║
 ╚══════════════════════════════════════════════╝
`));

program
  .name('velora')
  .description('Velora CLI - Cloud-Native Internal Developer Platform')
  .version(packageJson.version, '-v, --version', 'Display version number');
// Add commands
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(statusCommand);
program.addCommand(deployCommand);
program.addCommand(logsCommand);
program.addCommand(deleteCommand);
program.addCommand(configCommand);

// Add helpful examples
program.addHelpText('after', `
Examples:
  $ velora config setup                                    Setup CLI configuration
  $ velora create my-api --type api                        Create a new API service
  $ velora list                                            List all services
  $ velora status my-api --follow                          Monitor service status
  $ velora logs my-api --follow                            Follow service logs
  $ velora deploy my-api --rollback                        Rollback service
`);

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled Rejection:'), reason);
  console.error(chalk.dim('Promise:'), promise);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Uncaught Exception:'), error.message);
  console.error(chalk.dim('Stack:'), error.stack);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Goodbye!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n👋 Goodbye!'));
  process.exit(0);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
