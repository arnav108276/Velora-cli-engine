const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const api = require('../utils/api');
const axios = require('axios');
const config = require('../utils/config');

async function parseRepo(url) {
  try {
    const m = url.match(/https:\/\/github.com\/([^/]+)\/([^/]+)(\.git)?$/);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
  } catch (_) { return null; }
}

async function deleteGithubRepo(token, owner, repo) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    await axios.delete(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    console.log(chalk.green(`✓ Deleted GitHub repo ${owner}/${repo}`));
  } catch (e) {
    if (e.response?.status === 404) {
      console.log(chalk.yellow('! GitHub repo not found; skipping'));
    } else {
      throw new Error(`GitHub delete failed: ${e.response?.status} ${e.response?.statusText}`);
    }
  }
}

function parseImage(image) {
  if (!image) return null;
  const [pathPart, tagPart] = image.split(':');
  const [namespace, repo] = pathPart.split('/');
  const tag = tagPart || 'latest';
  if (!namespace || !repo) return null;
  return { namespace, repo, tag };
}

async function dockerHubLogin(username, password) {
  const { data } = await axios.post('https://hub.docker.com/v2/users/login', { username, password });
  return data.token;
}

async function dockerHubDeleteTag(authToken, namespace, repo, tag) {
  try {
    await axios.delete(`https://hub.docker.com/v2/repositories/${namespace}/${repo}/tags/${encodeURIComponent(tag)}/`, { headers: { Authorization: `JWT ${authToken}` } });
    console.log(chalk.green(`✓ Deleted Docker tag ${namespace}/${repo}:${tag}`));
  } catch (e) {
    if (e.response?.status === 404) console.log(chalk.yellow('! Docker tag not found; skipping'));
    else throw new Error(`Docker tag delete failed: ${e.response?.status} ${e.response?.statusText}`);
  }
}

async function dockerHubDeleteRepo(authToken, namespace, repo) {
  try {
    await axios.delete(`https://hub.docker.com/v2/repositories/${namespace}/${repo}/`, { headers: { Authorization: `JWT ${authToken}` } });
    console.log(chalk.green(`✓ Deleted Docker repository ${namespace}/${repo}`));
  } catch (e) {
    if (e.response?.status === 404) console.log(chalk.yellow('! Docker repository not found; skipping'));
    else throw new Error(`Docker repo delete failed: ${e.response?.status} ${e.response?.statusText}`);
  }
}

const deleteCommand = new Command('delete')
  .description('Delete a service')
  .argument('<service-name-or-id>', 'Service name or ID')
  .option('-f, --force', 'Force delete without confirmation')
  .action(async (serviceIdentifier, options) => {
    try {
      // Find service
      const services = await api.getServices();
      const service = services.find(s => s.name === serviceIdentifier || s.id === serviceIdentifier);
      
      if (!service) {
        console.error(chalk.red(`❌ Service "${serviceIdentifier}" not found`));
        process.exit(1);
      }
      
      // Confirmation
      if (!options.force) {
        console.log(chalk.yellow('⚠️  You are about to delete the following service:'));
        console.log(`  Name: ${service.name}`);
        console.log(`  Type: ${service.service_type}`);
        console.log(`  Status: ${service.status}`);
        if (service.service_url) {
          console.log(`  URL: ${service.service_url}`);
        }
        console.log();
        
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to delete this service? This action cannot be undone.',
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.blue('Operation cancelled'));
          return;
        }
      }
      
      console.log(chalk.blue(`🗑️  Deleting service: ${service.name}`));

      // Delete GitHub repo if available
      if (service.github_repo_url) {
        const parsed = await parseRepo(service.github_repo_url);
        const ghToken = config.getConfig().githubToken || process.env.GITHUB_TOKEN;
        if (parsed && ghToken) {
          try {
            await deleteGithubRepo(ghToken, parsed.owner, parsed.repo);
          } catch (e) {
            console.log(chalk.yellow(`! GitHub deletion warning: ${e.message}`));
          }
        } else {
          console.log(chalk.yellow('! Missing GitHub info or token; skipping GitHub deletion'));
        }
      }

      // Delete Docker Hub tag and repo if available
      if (service.docker_image) {
        const di = parseImage(service.docker_image);
        const dockerUsername = config.getConfig().dockerRegistry || process.env.DOCKER_USERNAME;
        const dockerToken = config.getConfig().dockerToken || process.env.DOCKER_TOKEN;
        if (di && dockerUsername && dockerToken) {
          try {
            const token = await dockerHubLogin(dockerUsername, dockerToken);
            await dockerHubDeleteTag(token, di.namespace, di.repo, di.tag);
            await dockerHubDeleteRepo(token, di.namespace, di.repo);
          } catch (e) {
            console.log(chalk.yellow(`! Docker Hub deletion warning: ${e.message}`));
          }
        } else {
          console.log(chalk.yellow('! Missing Docker credentials or invalid image; skipping Docker deletion'));
        }
      }
      
      // Delete service from Velora backend (MongoDB)
      try {
        await api.deleteService(service.id);
        console.log(chalk.green('✅ Service deleted successfully'));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to delete service from backend: ${error.message}`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

module.exports = deleteCommand;