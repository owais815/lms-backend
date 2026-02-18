#!/bin/bash

# Quick Deployment Script for Contabo VPS
# Run this script on your VPS after uploading the code

echo "🚀 Starting LMS Backend Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create resources directory if it doesn't exist
mkdir -p resources
chmod 755 resources

# Set production environment
export NODE_ENV=production

# Start with PM2
echo "🚀 Starting backend with PM2..."
pm2 start app.js --name lms-backend

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check status"
echo "  pm2 logs lms-backend - View logs"
echo "  pm2 restart lms-backend - Restart"
echo "  pm2 monit           - Monitor"
