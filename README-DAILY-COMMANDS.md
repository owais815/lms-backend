# Daily Commands for Running LMS Backend

This guide provides the essential commands you'll use daily to start and stop the backend services.

## Quick Start (Recommended)

### Option 1: Using the Startup Script
```bash
cd /Users/mrowais/Desktop/LMS/backend
chmod +x start-backend.sh
./start-backend.sh
```

### Option 2: Manual Commands

#### Start Services:
```bash
# 1. Navigate to backend directory
cd /Users/mrowais/Desktop/LMS/backend

# 2. Start MySQL Docker container
docker-compose up -d mysql

# 3. Wait a few seconds for MySQL to initialize
sleep 5

# 4. Start Backend server (development mode with auto-reload)
npm run dev
```

#### Stop Services:
```bash
# Stop Backend server (press Ctrl+C in the terminal, or):
pkill -f "nodemon app.js"

# Stop MySQL (optional - usually keep it running):
docker-compose stop mysql
```

## Detailed Daily Workflow

### Morning - Starting Your Work Session

1. **Start MySQL** (if not already running):
   ```bash
   cd /Users/mrowais/Desktop/LMS/backend
   docker-compose up -d mysql
   ```

2. **Verify MySQL is running**:
   ```bash
   docker-compose ps
   ```
   You should see `lms-mysql` with status "Up"

3. **Start Backend Server**:
   ```bash
   npm run dev
   ```
   This will start the server on `http://localhost:8080` with auto-reload enabled.

### During Development

- The backend will automatically restart when you save changes (thanks to nodemon)
- Check logs in the terminal where you ran `npm run dev`
- Backend API is available at: `http://localhost:8080`

### End of Day - Stopping Services

1. **Stop Backend Server**:
   - Press `Ctrl+C` in the terminal where backend is running
   - Or run: `pkill -f "nodemon app.js"`

2. **Stop MySQL** (optional - you can leave it running):
   ```bash
   docker-compose stop mysql
   ```

## Useful Commands

### Check Service Status
```bash
# Check MySQL container status
docker-compose ps

# Check if backend is running
curl http://localhost:8080
# or
lsof -i :8080
```

### View MySQL Logs
```bash
docker-compose logs mysql
# or follow logs in real-time:
docker-compose logs -f mysql
```

### Restart MySQL (if needed)
```bash
docker-compose restart mysql
```

### Access MySQL Database Directly
```bash
docker exec -it lms-mysql mysql -uroot -palisher.1 LMSystem
```

### View Backend Logs
If running in background, check the log file:
```bash
tail -f /tmp/backend.log
```

## Troubleshooting

### MySQL won't start
```bash
# Check if port 3306 is already in use
lsof -i :3306

# Restart MySQL container
docker-compose restart mysql

# View MySQL logs for errors
docker-compose logs mysql
```

### Backend won't connect to MySQL
```bash
# Verify MySQL is running
docker-compose ps

# Test MySQL connection
docker exec lms-mysql mysql -uroot -palisher.1 -e "SELECT 1;"
```

### Port 8080 already in use
```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process or change port in config/development.js
```

## Environment Variables

The backend uses:
- **NODE_ENV**: `development` (set automatically by `npm run dev`)
- **Database**: Configured in `config/config.json`
- **Port**: `8080` (configured in `config/development.js`)

## Notes

- MySQL container can stay running in the background (it uses minimal resources)
- Backend server should be stopped when not in use to free up port 8080
- All database data persists in Docker volume `mysql_data`
- Backend auto-reloads on code changes (nodemon watches for file changes)
