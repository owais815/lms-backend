# Backend Deployment Guide - Contabo VPS

## Prerequisites
- Contabo VPS with Ubuntu/Debian
- Domain name (or use IP)
- SSH access to VPS

---

## Step-by-Step Deployment

### 1. **Initial VPS Setup**
```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install MySQL
apt install -y mysql-server

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot (SSL certificates)
apt install -y certbot python3-certbot-nginx
```

### 2. **Configure MySQL**
```bash
# Secure MySQL installation
mysql_secure_installation

# Create database and user
mysql -u root -p
```
```sql
CREATE DATABASE LMSystem;
CREATE USER 'lmsuser'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON LMSystem.* TO 'lmsuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. **Upload Backend Code**
```bash
# On your local machine, create deployment package
cd /Users/mrowais/Desktop/LMS/backend
tar -czf backend.tar.gz --exclude='node_modules' --exclude='.git' .

# Upload to VPS (from local machine)
scp backend.tar.gz root@your-vps-ip:/root/

# On VPS, extract and setup
cd /root
mkdir -p /var/www/lms-backend
tar -xzf backend.tar.gz -C /var/www/lms-backend
cd /var/www/lms-backend
```

### 4. **Configure Backend**
```bash
# Install dependencies
npm install --production

# Update config/config.json with production database credentials
nano config/config.json
# Update production section with MySQL user/password

# Update production.js SSL paths (if using domain)
nano config/production.js
# Update SSL certificate paths to match your domain
```

### 5. **Setup SSL Certificate (if using domain)**
```bash
# Get SSL certificate
certbot certonly --standalone -d yourdomain.com

# Update config/production.js with correct paths
# Paths will be: /etc/letsencrypt/live/yourdomain.com/
```

### 6. **Configure Firewall**
```bash
# Allow ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8080/tcp # Backend HTTP
ufw allow 8443/tcp # Backend HTTPS
ufw enable
```

### 7. **Configure Nginx (Reverse Proxy)**
```bash
# Create Nginx config
nano /etc/nginx/sites-available/lms-backend
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/lms-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 8. **Start Backend with PM2**
```bash
cd /var/www/lms-backend

# Set production environment
export NODE_ENV=production

# Start with PM2
pm2 start app.js --name lms-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

### 9. **Verify Deployment**
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs lms-backend

# Test API
curl http://localhost:8080
```

### 10. **Setup Auto-restart & Monitoring**
```bash
# PM2 auto-restart on crash
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## Daily Management Commands

### Start/Stop/Restart
```bash
pm2 start lms-backend
pm2 stop lms-backend
pm2 restart lms-backend
```

### View Logs
```bash
pm2 logs lms-backend
pm2 logs lms-backend --lines 100
```

### Monitor
```bash
pm2 status
pm2 monit
```

---

## Important Notes

- **Database**: Update `config/config.json` production section with VPS MySQL credentials
- **SSL**: Update `config/production.js` with your SSL certificate paths
- **Ports**: Backend runs on 8080 (HTTP) and 8443 (HTTPS)
- **Resources**: Ensure `resources/` folder exists and has write permissions
- **Environment**: Set `NODE_ENV=production` before starting

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs lms-backend
# Check for database connection errors
```

### Database connection issues
```bash
mysql -u lmsuser -p LMSystem
# Verify credentials in config/config.json
```

### Port already in use
```bash
lsof -i :8080
# Kill process or change port
```

### SSL certificate issues
```bash
certbot certificates
# Verify certificate paths in production.js
```
