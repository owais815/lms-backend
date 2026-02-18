# Continuous Deployment Setup Guide

This guide will help you set up automatic deployment to your Contabo VPS whenever you push code to the `main` branch.

## Prerequisites

- ✅ GitHub repository with your backend code
- ✅ Contabo VPS with SSH access
- ✅ Backend already deployed manually (first time)

---

## Step 1: Prepare VPS for Git Repository

### Option A: Clone Repository (Recommended)

```bash
# SSH into VPS
ssh root@your-vps-ip

# Navigate to deployment directory
cd /var/www

# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git lms-backend
cd lms-backend/backend

# Install dependencies
npm install --production

# Configure backend (update config/config.json, etc.)
nano config/config.json

# Start backend initially
export NODE_ENV=production
pm2 start app.js --name lms-backend
pm2 save
```

### Option B: Initialize Git in Existing Directory

```bash
cd /var/www/lms-backend
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git pull origin main
```

---

## Step 2: Generate SSH Key for GitHub Actions

```bash
# On your LOCAL machine (or VPS)
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy

# This creates two files:
# - ~/.ssh/github_actions_deploy (private key)
# - ~/.ssh/github_actions_deploy.pub (public key)
```

---

## Step 3: Add Public Key to VPS

```bash
# Copy public key to VPS
cat ~/.ssh/github_actions_deploy.pub | ssh root@your-vps-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Or manually add to VPS:
ssh root@your-vps-ip
nano ~/.ssh/authorized_keys
# Paste the public key content
```

---

## Step 4: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

   | Secret Name | Value | Example |
   |------------|-------|---------|
   | `VPS_HOST` | Your VPS IP or domain | `123.45.67.89` or `api.yourdomain.com` |
   | `VPS_USERNAME` | SSH username | `root` |
   | `VPS_SSH_KEY` | Private SSH key content | Content of `~/.ssh/github_actions_deploy` |
   | `VPS_PORT` | SSH port (optional) | `22` |

### How to get SSH key content:
```bash
# On your local machine
cat ~/.ssh/github_actions_deploy
# Copy the entire output (including -----BEGIN and -----END lines)
```

---

## Step 5: Verify Workflow File

The workflow file is already created at:
```
.github/workflows/deploy-backend.yml
```

Make sure it's committed to your repository:
```bash
git add .github/workflows/deploy-backend.yml
git commit -m "Add CD workflow"
git push origin main
```

---

## Step 6: Test Deployment

1. Make a small change to your backend code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test CD deployment"
   git push origin main
   ```
3. Go to GitHub → **Actions** tab
4. Watch the workflow run
5. Check VPS logs:
   ```bash
   ssh root@your-vps-ip
   pm2 logs lms-backend
   ```

---

## How It Works

1. **Push to main** → GitHub Actions triggers
2. **Checkout code** → Gets latest code
3. **SSH to VPS** → Connects using secrets
4. **Pull latest** → `git pull origin main`
5. **Install deps** → `npm install --production`
6. **Restart PM2** → `pm2 restart lms-backend`

---

## Troubleshooting

### Workflow fails: "Permission denied"
- **Fix**: Ensure SSH key is added to VPS `~/.ssh/authorized_keys`
- **Fix**: Check VPS_USERNAME is correct
- **Fix**: Verify SSH key secret is complete (includes BEGIN/END)

### Workflow fails: "git pull" error
- **Fix**: Ensure repository is cloned on VPS
- **Fix**: Check git remote is set: `git remote -v`
- **Fix**: Ensure VPS has access to repository (public repo or deploy key)

### PM2 restart fails
- **Fix**: Check if backend is running: `pm2 list`
- **Fix**: Manually start: `pm2 start app.js --name lms-backend`
- **Fix**: Check logs: `pm2 logs lms-backend`

### Deployment works but backend doesn't update
- **Fix**: Check PM2 is actually restarting: `pm2 logs lms-backend`
- **Fix**: Verify code is pulled: `cd /var/www/lms-backend && git log -1`
- **Fix**: Check for errors in PM2 logs

---

## Security Best Practices

1. **Use Deploy Keys** (instead of personal SSH key):
   - GitHub → Repo Settings → Deploy Keys → Add deploy key
   - Use read-only access

2. **Restrict SSH Access**:
   ```bash
   # On VPS, edit SSH config
   nano /etc/ssh/sshd_config
   # Disable password authentication
   # Use key-based auth only
   ```

3. **Use Non-Root User**:
   ```bash
   # Create deploy user
   adduser deploy
   # Add to sudo group if needed
   usermod -aG sudo deploy
   ```

4. **Limit PM2 Access**:
   - Use specific user for PM2 processes
   - Set proper file permissions

---

## Advanced: Database Migrations

If you need to run migrations automatically:

1. Add to `package.json`:
   ```json
   "scripts": {
     "migrate:prod": "NODE_ENV=production npx sequelize-cli db:migrate"
   }
   ```

2. Update workflow to run migrations:
   ```yaml
   script: |
     npm run migrate:prod || true
   ```

---

## Monitoring Deployments

- **GitHub Actions**: View deployment history in Actions tab
- **PM2**: `pm2 logs lms-backend` for real-time logs
- **PM2 Monitoring**: `pm2 monit` for resource usage

---

## Rollback (if needed)

If deployment fails:

```bash
# SSH into VPS
ssh root@your-vps-ip
cd /var/www/lms-backend

# Rollback to previous commit
git log --oneline  # Find previous commit hash
git checkout <previous-commit-hash>
npm install --production
pm2 restart lms-backend
```

---

## Summary

✅ **Setup once**: Configure GitHub secrets and VPS  
✅ **Push code**: Every push to `main` auto-deploys  
✅ **Monitor**: Check GitHub Actions and PM2 logs  
✅ **Secure**: Use SSH keys and deploy keys  

Your backend will now automatically deploy whenever you push to the main branch! 🚀
