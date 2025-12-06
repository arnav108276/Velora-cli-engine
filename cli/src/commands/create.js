const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const api = require('../utils/api');
const config = require('../utils/config');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const { exec } = require('child_process');

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

async function checkSemgrepInstalled() {
  try {
    await execAsync('semgrep --version');
    return true;
  } catch (error) {
    return false;
  }
}

async function runSemgrepScan(folderPath) {
  const spinner = ora('Running Semgrep security scan...').start();
  
  try {
    // Run Semgrep with JSON output
    const { stdout } = await execAsync(
      `semgrep --config=auto --json --quiet`,
      { cwd: folderPath }
    );
    
    spinner.succeed(chalk.green('✅ Semgrep scan completed'));
    
    const results = JSON.parse(stdout);
    displaySemgrepResults(results);
    
    return results;
  } catch (error) {
    spinner.fail(chalk.yellow('⚠️  Semgrep scan encountered issues'));
    
    // Try to parse partial results
    try {
      if (error.stdout) {
        const results = JSON.parse(error.stdout);
        displaySemgrepResults(results);
        return results;
      }
    } catch (parseError) {
      console.log(chalk.yellow('Could not parse Semgrep output'));
    }
    
    return { results: [] };
  }
}

function displaySemgrepResults(scanResults) {
  const results = scanResults.results || [];
  
  if (results.length === 0) {
    console.log(chalk.green('\\n✅ No vulnerabilities found!\\n'));
    return;
  }
  
  // Group by severity
  const bySeverity = {
    ERROR: [],
    WARNING: [],
    INFO: []
  };
  
  results.forEach(result => {
    const severity = result.extra?.severity?.toUpperCase() || 'INFO';
    if (bySeverity[severity]) {
      bySeverity[severity].push(result);
    }
  });
  
  console.log(chalk.bold('\\n🔍 Semgrep Vulnerability Report:\\n'));
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.red('Critical/High')}: ${bySeverity.ERROR.length}`);
  console.log(`  ${chalk.yellow('Medium')}: ${bySeverity.WARNING.length}`);
  console.log(`  ${chalk.blue('Low/Info')}: ${bySeverity.INFO.length}`);
  console.log();
  
  // Display detailed findings
  Object.entries(bySeverity).forEach(([severity, findings]) => {
    if (findings.length > 0) {
      const color = severity === 'ERROR' ? 'red' : severity === 'WARNING' ? 'yellow' : 'blue';
      const icon = severity === 'ERROR' ? '🔴' : severity === 'WARNING' ? '🟡' : '🔵';
      
      console.log(chalk[color].bold(`\\n${icon} ${severity} (${findings.length}):`));
      
      findings.forEach((finding, idx) => {
        console.log(chalk[color](`\\n  ${idx + 1}. ${finding.check_id || finding.extra?.message || 'Unknown rule'}`));
        console.log(chalk.dim(`     File: ${finding.path}:${finding.start?.line || '?'}`));
        console.log(chalk.dim(`     Message: ${finding.extra?.message || finding.message || 'No description'}`));
        
        if (finding.extra?.lines) {
          console.log(chalk.dim(`     Code: ${finding.extra.lines.trim()}`));
        }
      });
    }
  });
  
  console.log();
}

async function getGithubOwner(token) {
  const { data } = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });
  return data.login;
}

async function ensureGithubRepo({ token, owner, name, description }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Check exists
  try {
    await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers });
    return;
  } catch (_) {}

  // create under user
  await axios.post('https://api.github.com/user/repos', { name, description, private: false }, { headers });
}

async function pushFolderToRepo({ token, owner, name, folderPath }) {
  const abs = path.isAbsolute(folderPath) ? folderPath : path.resolve(process.cwd(), folderPath);
  if (!fs.existsSync(abs)) throw new Error(`Path not found: ${abs}`);
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) throw new Error('Provided path must be a directory');

  // FIX: Check if the folder itself has a .git directory (parent git repo)
  const gitDirInFolder = path.join(abs, '.git');
  const hasGitInFolder = fs.existsSync(gitDirInFolder);
  
  // FIX: Initialize git with explicit working directory to avoid parent git repo interference
  const git = simpleGit({ 
    baseDir: abs,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
  
  // FIX: If there's already a .git in this folder, check if it's linked to a parent repo
  // We need to ensure we're working in an isolated git environment
  if (hasGitInFolder) {
    // Check if this is a submodule or part of parent repo
    try {
      const topLevel = await git.raw(['rev-parse', '--show-toplevel']);
      const topLevelPath = topLevel.trim();
      
      // If the top level is not our target folder, we have a parent git repo issue
      if (path.resolve(topLevelPath) !== path.resolve(abs)) {
        console.log(chalk.yellow(`⚠️  Detected parent git repository. Reinitializing in target folder only...`));
        // Remove the git reference and reinitialize
        fs.rmSync(gitDirInFolder, { recursive: true, force: true });
        await git.init();
      }
    } catch (err) {
      // If error checking, just reinitialize to be safe
      await git.init();
    }
  } else {
    // FIX: No .git exists, initialize fresh repo
    await git.init();
  }

  // FIX: Ensure we're on main branch from the start
  try { 
    await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); 
  } catch (_) {
    // If branch doesn't exist yet, it will be created on first commit
  }

  // Create .gitignore if not exists
  const giPath = path.join(abs, '.gitignore');
  if (!fs.existsSync(giPath)) {
    fs.writeFileSync(giPath, 'node_modules\\n.DS_Store\\n.env\\n');
  }

  // FIX: Add all files from THIS directory only
  await git.add('.');
  
  // FIX: Check status before committing
  const status = await git.status();
  if (status.staged.length > 0 || status.not_added.length > 0 || status.modified.length > 0) {
    await git.commit('Initial commit: import via Velora CLI');
  }

  const remoteWithToken = `https://${token}@github.com/${owner}/${name}.git`;
  const remoteNoToken = `https://github.com/${owner}/${name}.git`;

  // FIX: Clean up any existing remotes
  const remotes = await git.getRemotes(true);
  for (const remote of remotes) {
    if (remote.name === 'origin') {
      await git.removeRemote('origin');
    }
  }
  
  // Add new remote
  await git.addRemote('origin', remoteWithToken);

  // FIX: Ensure we're on main branch before pushing
  try { 
    await git.raw(['branch', '-M', 'main']); 
  } catch (_) {}

  // FIX: Push only the current folder's content
  try {
    await git.push(['-u', 'origin', 'main', '--force']);
  } catch (err) {
    console.error(chalk.red(`Git push failed: ${err.message}`));
    throw err;
  }

  // Clean up: replace token with public URL
  await git.removeRemote('origin');
  await git.addRemote('origin', remoteNoToken);

  return remoteNoToken.replace('.git', '');
}

async function ensureDockerfile(folderPath, serviceType) {
  const dockerfilePath = path.join(folderPath, 'Dockerfile');
  
  if (fs.existsSync(dockerfilePath)) {
    console.log(chalk.green('✅ Dockerfile already exists'));
    return true;
  }
  
  console.log(chalk.yellow('⚠️  No Dockerfile found, generating...'));
  
  const dockerfileTemplates = {
    api: `FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
`,
    frontend: `FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`,
    worker: `FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "worker.py"]
`,
    database: `FROM postgres:15-alpine

ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=user
ENV POSTGRES_PASSWORD=password

EXPOSE 5432
`
  };
  
  const dockerfileContent = dockerfileTemplates[serviceType] || dockerfileTemplates.api;
  fs.writeFileSync(dockerfilePath, dockerfileContent);
  
  console.log(chalk.green('✅ Dockerfile generated'));
  return true;
}

async function dockerBuildAndPush({ folderAbs, imageName, dockerUsername, dockerToken }) {
  // Login
  await execAsync(`docker login -u ${dockerUsername} -p ${dockerToken}`);
  // Build
  await execAsync(`docker build -t ${imageName} .`, { cwd: folderAbs });
  // Push
  await execAsync(`docker push ${imageName}`);
}

const createCommand = new Command('create')
  .description('Create a new service with CI/CD pipeline and security scanning')
  .argument('<service-name>', 'Service name (lowercase, alphanumeric, hyphens only)')
  .option('-t, --type <type>', 'Service type (api, frontend, worker, database)', 'api')
  .option('-d, --description <desc>', 'Service description')
  .option('--skip-github', 'Skip GitHub repository creation')
  .option('--skip-deploy', 'Skip initial deployment')
  .option('--skip-semgrep', 'Skip Semgrep security scan')
  .option('-l, --location <path>', 'Local folder path to push (contents only)')
  .action(async (serviceName, options) => {
    try {
      console.log(chalk.blue(`🚀 Creating service: ${serviceName}`));
      
      // Validate service name
      if (!/^[a-z0-9-]+$/.test(serviceName)) {
        console.error(chalk.red('❌ Service name must contain only lowercase letters, numbers, and hyphens'));
        process.exit(1);
      }
      
      // Get configuration
      const currentConfig = config.getConfig();
      if (!currentConfig.apiUrl) {
        console.error(chalk.red('❌ API URL not configured. Run "velora config setup" first.'));
        process.exit(1);
      }
      
      if (!currentConfig.userHash) {
        console.error(chalk.red('❌ User not configured. Run "velora config setup" to set username and GitHub token.'));
        process.exit(1);
      }
      
      // Get description if not provided
      let description = options.description;
      if (!description) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Service description:',
            validate: (input) => input.trim().length > 0 || 'Description is required'
          }
        ]);
        description = answers.description;
      }
      
      // Get developer ID
      let developerId = currentConfig.username || 'default-developer';
      
      const spinner = ora('Creating service...').start();
      
      try {
        let githubRepoUrl = null;
        let dockerImage = null;
        let semgrepResults = null;
        
        // Process location if provided
        if (options.location && !options.skipGithub) {
          spinner.stop();
          
          const ghToken = currentConfig.githubToken || process.env.GITHUB_TOKEN;
          if (!ghToken) {
            console.error(chalk.red('❌ GitHub token missing. Set in config or env GITHUB_TOKEN.'));
            process.exit(1);
          }
          
          const abs = path.isAbsolute(options.location) ? options.location : path.resolve(process.cwd(), options.location);
          
          // FIX: Verify the path exists and is a directory
          if (!fs.existsSync(abs)) {
            console.error(chalk.red(`❌ Path not found: ${abs}`));
            process.exit(1);
          }
          
          const stat = fs.statSync(abs);
          if (!stat.isDirectory()) {
            console.error(chalk.red(`❌ Path must be a directory: ${abs}`));
            process.exit(1);
          }
          
          console.log(chalk.blue(`📁 Using folder: ${abs}`));
          
          // Ensure Dockerfile exists
          await ensureDockerfile(abs, options.type);
          
          // Run Semgrep scan if not skipped
          if (!options.skipSemgrep) {
            const semgrepInstalled = await checkSemgrepInstalled();
            if (semgrepInstalled) {
              semgrepResults = await runSemgrepScan(abs);
              
              // Ask user to continue if critical issues found
              const criticalIssues = semgrepResults.results?.filter(r => 
                r.extra?.severity?.toUpperCase() === 'ERROR'
              ) || [];
              
              if (criticalIssues.length > 0) {
                const { continueAnyway } = await inquirer.prompt([{
                  type: 'confirm',
                  name: 'continueAnyway',
                  message: `Found ${criticalIssues.length} critical security issue(s). Continue anyway?`,
                  default: false
                }]);
                
                if (!continueAnyway) {
                  console.log(chalk.yellow('\\n⚠️  Service creation cancelled. Please fix security issues and try again.'));
                  process.exit(0);
                }
              }
            } else {
              console.log(chalk.yellow('\\n⚠️  Semgrep not installed. Skipping security scan.'));
              console.log(chalk.dim('To install: pip install semgrep or brew install semgrep'));
            }
          }
          
          spinner.start('Pushing to GitHub...');
          
          const owner = await getGithubOwner(ghToken);
          await ensureGithubRepo({ token: ghToken, owner, name: serviceName, description });
          const repoUrl = await pushFolderToRepo({ token: ghToken, owner, name: serviceName, folderPath: abs });
          githubRepoUrl = repoUrl;
          
          spinner.text = 'Building and pushing Docker image...';
          
          // Docker build/push
          const dockerfilePath = path.join(abs, 'Dockerfile');
          if (fs.existsSync(dockerfilePath)) {
            const dockerUsername = currentConfig.dockerRegistry || process.env.DOCKER_USERNAME;
            const dockerToken = currentConfig.dockerToken || process.env.DOCKER_TOKEN;
            if (!dockerUsername || !dockerToken) {
              spinner.stop();
              console.error(chalk.red('❌ Docker credentials missing. Set dockerRegistry and dockerToken via "velora config setup".'));
              process.exit(1);
            }
            const imageName = `${dockerUsername}/${serviceName}:latest`;
            await dockerBuildAndPush({ folderAbs: abs, imageName, dockerUsername, dockerToken });
            dockerImage = imageName;
          }
        }

        spinner.text = 'Registering service...';
        
        // Create service via API
       const serviceData = {
  name: serviceName,
  description: description,
  service_type: options.type,
  developer_id: developerId,
  ...(githubRepoUrl ? { github_repo_url: githubRepoUrl } : {}),
  
  // ALWAYS send docker_image (fallback if CLI didn't build one)
  docker_image: dockerImage || `${currentConfig.dockerRegistry}/${serviceName}:latest`,
};
        
        const service = await api.createService(serviceData);
        
        spinner.succeed(chalk.green(`✅ Service "${serviceName}" created successfully!`));
        
        console.log(chalk.blue('\\n📋 Service Details:'));
        console.log(`  ID: ${service.id}`);
        console.log(`  Name: ${service.name}`);
        console.log(`  Type: ${service.service_type}`);
        console.log(`  Status: ${service.status}`);
        if (githubRepoUrl) console.log(`  GitHub: ${githubRepoUrl}`);
        if (dockerImage) console.log(`  Image: ${dockerImage}`);
        
        // Monitor pipeline if not skipping deployment
        if (!options.skipDeploy) {
          console.log(chalk.blue('\\n📊 Monitoring deployment pipeline...'));
          await monitorPipeline(service.id);
        }
        
        console.log(chalk.green('\\n🎉 Service creation completed!'));
        console.log(chalk.dim(`\\nNext steps:`));
        console.log(chalk.dim(`  • Deploy to EKS: velora deploy ${serviceName}`));
        console.log(chalk.dim(`  • Check status: velora status ${serviceName}`));
        console.log(chalk.dim(`  • View logs: velora logs ${serviceName} --follow`));
        console.log(chalk.dim(`  • List services: velora list`));
        
      } catch (error) {
        spinner.fail(chalk.red('❌ Failed to create service'));
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

async function monitorPipeline(serviceId) {
  const maxAttempts = 60;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const pipeline = await api.getPipeline(serviceId);
      
      const statusIcon = pipeline.status === 'success' ? '✅' : 
                        pipeline.status === 'failed' ? '❌' : 
                        pipeline.status === 'running' ? '🔄' : '⏳';
      
      console.log(`${statusIcon} Pipeline: ${pipeline.stage} (${pipeline.progress}%)`);
      
      if (pipeline.status === 'success') {
        console.log(chalk.green('✅ Deployment completed successfully!'));
        
        try {
          const service = await api.getService(serviceId);
          if (service.service_url) {
            console.log(chalk.blue(`🌐 Service URL: ${service.service_url}`));
          }
        } catch (error) {
          // Ignore
        }
        
        break;
      } else if (pipeline.status === 'failed') {
        console.log(chalk.red('❌ Deployment failed!'));
        if (pipeline.logs && pipeline.logs.length > 0) {
          console.log(chalk.red('Error logs:'));
          pipeline.logs.forEach(log => console.log(chalk.dim(`  ${log}`)));
        }
        break;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Pipeline monitoring error: ${error.message}`));
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log(chalk.yellow('⏰ Pipeline monitoring timed out. Use "velora status" to check progress.'));
  }
}

module.exports = createCommand;
