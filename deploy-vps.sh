#!/bin/bash

# Deployment script to run on VPS
# This script is called by GitHub Actions

set -e  # Exit on error

echo "🚀 Starting deployment..."

cd /var/www/lms-backend

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create resources directory if it doesn't exist
mkdir -p resources
chmod 755 resources

# Set production environment
export NODE_ENV=production

# Restart backend with PM2
echo "🔄 Restarting backend..."
if pm2 list | grep -q "lms-backend"; then
    pm2 restart lms-backend
else
    pm2 start app.js --name lms-backend
fi

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
echo ""
echo "Backend Status:"
pm2 status
echo ""
echo "Recent logs:"
pm2 logs lms-backend --lines 20 --nostream
