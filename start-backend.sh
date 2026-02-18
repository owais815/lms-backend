#!/bin/bash

# LMS Backend Startup Script
# This script starts MySQL (Docker) and the Backend server

echo "🚀 Starting LMS Backend Services..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Start MySQL Docker container
echo "📦 Starting MySQL container..."
docker-compose up -d mysql

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
sleep 5

# Check if MySQL is running
if docker-compose ps mysql | grep -q "Up"; then
    echo "✅ MySQL is running"
else
    echo "❌ MySQL failed to start"
    exit 1
fi

# Start Backend server
echo "🔧 Starting Backend server..."
npm run dev
