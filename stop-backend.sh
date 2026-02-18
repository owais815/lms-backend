#!/bin/bash

# LMS Backend Stop Script
# This script stops the Backend server and MySQL (Docker)

echo "🛑 Stopping LMS Backend Services..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Stop Backend server (nodemon/node processes)
echo "🔧 Stopping Backend server..."
pkill -f "nodemon app.js" 2>/dev/null
pkill -f "node app.js" 2>/dev/null
echo "✅ Backend server stopped"

# Stop MySQL Docker container (optional - uncomment if you want to stop MySQL too)
# echo "📦 Stopping MySQL container..."
# docker-compose stop mysql
# echo "✅ MySQL stopped"

echo ""
echo "✨ All services stopped"
