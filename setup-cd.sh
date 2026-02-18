#!/bin/bash

# Setup script for Continuous Deployment
# Run this ONCE on your VPS to prepare for CD

echo "🔧 Setting up Continuous Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Install git if not installed
if ! command -v git &> /dev/null; then
    echo "📦 Installing Git..."
    apt update
    apt install -y git
fi

# Create deployment directory
DEPLOY_DIR="/var/www/lms-backend"
mkdir -p $DEPLOY_DIR

echo "📁 Deployment directory: $DEPLOY_DIR"
echo ""
echo "Next steps:"
echo "1. Clone your repository:"
echo "   cd $DEPLOY_DIR"
echo "   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ."
echo ""
echo "2. Install dependencies:"
echo "   npm install --production"
echo ""
echo "3. Configure your backend (config/config.json, etc.)"
echo ""
echo "4. Make deploy script executable:"
echo "   chmod +x deploy-vps.sh"
echo ""
echo "5. Initial start with PM2:"
echo "   export NODE_ENV=production"
echo "   pm2 start app.js --name lms-backend"
echo "   pm2 save"
echo ""
echo "6. Setup GitHub Secrets (in your repo settings):"
echo "   - VPS_HOST: Your VPS IP or domain"
echo "   - VPS_USERNAME: SSH username (usually 'root')"
echo "   - VPS_SSH_KEY: Your private SSH key"
echo "   - VPS_PORT: SSH port (default: 22)"
echo ""
echo "✅ CD setup script complete!"
