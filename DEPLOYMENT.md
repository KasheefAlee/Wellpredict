# Deployment Guide

This guide covers deploying the Employee Wellbeing & Burnout Monitoring Platform to production.

## Free Deployment (Render + Railway)

### Railway (PostgreSQL)
1. Create a Railway project → add **PostgreSQL**
2. Copy the connection string (`DATABASE_URL`)
3. Run migrations using the backend migration script:

```bash
cd backend
# set DATABASE_URL in your environment, then:
npm run migrate
```

Notes:
- Railway also provides a SQL editor—alternatively run `backend/migrations/schema.sql` there.
- For production, ensure your database user has permissions to create tables and triggers.

### Render (Backend Web Service)
1. Push your repo to GitHub
2. Create Render → **New Web Service**
3. Select your repo
4. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:
   - `DATABASE_URL` (recommended)
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://<your-frontend-domain>`
   - Render auto-provides `PORT` (backend uses `process.env.PORT`)

Verify after deploy:
- `GET /health` → `{ "status": "ok" }`

PDF Export note:
- PDF export uses Puppeteer/Chromium. Render often requires `--no-sandbox` flags (already set in code).


## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ database
- Server with SSH access (AWS EC2, DigitalOcean Droplet, etc.)
- Domain name (optional but recommended)

## Backend Deployment

### 1. Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE wellbeing_db;
CREATE USER wellbeing_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE wellbeing_db TO wellbeing_user;
\q
```

### 3. Application Setup

```bash
# Clone repository
git clone <your-repo-url>
cd employee-wellbeing-platform

# Install dependencies
cd backend
npm install --production

# Create .env file
nano .env
```

Add the following to `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wellbeing_db
DB_USER=wellbeing_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start with PM2

```bash
# Start application
pm2 start server.js --name wellbeing-backend

# Save PM2 configuration
pm2 save
pm2 startup
```

### 6. Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install nginx -y

# Create configuration
sudo nano /etc/nginx/sites-available/wellbeing-api
```

Add:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
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
sudo ln -s /etc/nginx/sites-available/wellbeing-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d api.yourdomain.com
```

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variable: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`
4. Deploy

### Option 2: Self-Hosted

```bash
# Install dependencies
cd frontend
npm install

# Build
npm run build

# Start
npm start
```

Or use PM2:
```bash
pm2 start npm --name wellbeing-frontend -- start
```

### Nginx Configuration for Frontend

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Backups

### Automated Backup Script

Create `/usr/local/bin/backup-wellbeing.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/wellbeing"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U wellbeing_user wellbeing_db | gzip > $BACKUP_DIR/wellbeing_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "wellbeing_*.sql.gz" -mtime +30 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-wellbeing.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-wellbeing.sh
```

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT_SECRET (min 32 characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (only allow 80, 443, 22)
- [ ] Regular database backups
- [ ] Keep Node.js and dependencies updated
- [ ] Use environment variables (never commit .env)
- [ ] Enable PostgreSQL SSL connections
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting (optional)

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs wellbeing-backend

# Monitor
pm2 monit

# Restart on crash
pm2 startup
```

### Health Check Endpoint

The API includes a health check at `/api/health`. Set up monitoring to check this endpoint.

## Troubleshooting

### Backend won't start
- Check logs: `pm2 logs wellbeing-backend`
- Verify database connection
- Check environment variables

### Database connection errors
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check credentials in .env
- Verify database exists

### Frontend can't connect to API
- Check CORS settings in backend
- Verify FRONTEND_URL in backend .env
- Check API URL in frontend environment

## Scaling Considerations

For high traffic:
- Use a load balancer (AWS ALB, Nginx)
- Scale backend horizontally with PM2 cluster mode
- Use connection pooling for PostgreSQL
- Consider Redis for session management
- Use CDN for frontend assets

## Environment Variables Summary

### Backend (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wellbeing_db
DB_USER=wellbeing_user
DB_PASSWORD=secure_password
JWT_SECRET=very_long_random_string
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

## Support

For deployment issues, refer to:
- Node.js documentation
- PostgreSQL documentation
- PM2 documentation
- Nginx documentation

---

**Remember**: Always test in a staging environment before deploying to production!

