const { Command } = require('commander');
const chalk = require('chalk');
const config = require('../utils/config');

const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .addCommand(
    new Command('setup')
      .description('Interactive configuration setup')
      .action(async () => {
        try {
          await config.setupInteractive();
        } catch (error) {
          console.error(chalk.red(`❌ Setup failed: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List current configuration')
      .action(() => {
        try {
          config.listConfig();
        } catch (error) {
          console.error(chalk.red(`❌ Failed to list config: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key')
      .argument('<value>', 'Configuration value')
      .action((key, value) => {
        try {
          config.setConfig(key, value);
          console.log(chalk.green(`✅ Set ${key} = ${value}`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to set config: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('Get configuration value')
      .argument('<key>', 'Configuration key')
      .action((key) => {
        try {
          const currentConfig = config.getConfig();
          const value = currentConfig[key];
          
          if (value !== undefined) {
            const displayValue = (key.toLowerCase().includes('token') || key.toLowerCase().includes('password'))
              ? '●'.repeat(8) + (value?.slice(-4) || '')
              : value;
            console.log(displayValue || chalk.dim('(not set)'));
          } else {
            console.log(chalk.red(`❌ Configuration key "${key}" not found`));
            process.exit(1);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Failed to get config: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('reset')
      .description('Reset configuration to defaults')
      .action(() => {
        try {
          config.resetConfig();
          console.log(chalk.green('✅ Configuration reset to defaults'));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to reset config: ${error.message}`));
          process.exit(1);
        }
      })
  );

module.exports = configCommand;