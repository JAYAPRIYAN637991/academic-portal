# Institutional Academic Portal — Comprehensive Hosting & Deployment Guide

This guide explains step-by-step how to host the **VSB Engineering College Academic Performance & Parent Notification Platform** in a production environment.

---

## 1. Architecture Overview for Hosting

The platform is designed as an **all-in-one unified production bundle**:
1. **Frontend (Client)**: Vite / React SPA compiles into static HTML/CSS/JS in `client/dist`.
2. **Backend (Server)**: Express API compiles into `server/dist` and automatically serves both the `/api` endpoints and the frontend SPA on a single port (default: `5000`).
3. **Database**: PostgreSQL 16 managed via Prisma ORM.
4. **Queue / Cache**: Redis 7 (optional; automatically falls back to resilient in-process memory queue if Redis is not installed).

---

## 2. Production Environment Variables Checklist

Create a `.env` file in the `server/` directory (or pass into Docker/Cloud environment):

```ini
# --- Core Server Settings ---
NODE_ENV=production
PORT=5000
CORS_ORIGIN=*

# --- Database (PostgreSQL Connection String) ---
DATABASE_URL=postgresql://postgres:StrongPassword2026!@localhost:5432/academic_portal?schema=public

# --- Authentication ---
JWT_SECRET=your-super-strong-jwt-secret-key-min-32-characters-random-generated-2026

# --- Redis (Optional, fallback is automatic) ---
ENABLE_REDIS=false
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# --- SMS Gateway (Optional: Set true to use real SMS credentials) ---
MOCK_NOTIFICATIONS=true
SMS_API_KEY=
SMS_SENDER_ID=VSBENG
SMS_API_URL=https://api.sms-gateway.com/v1/send

# --- WhatsApp Business Cloud API (Optional) ---
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

---

## 3. Hosting Method A: 1-Command Docker Compose (Recommended)

This is the fastest, standard industry method. It automatically provisions PostgreSQL 16, Redis 7, compiles the React frontend, compiles the Node backend, and starts everything with persistent volumes.

### Prerequisites:
- A Linux VPS (Ubuntu 22.04 / 24.04, Debian, AWS EC2, DigitalOcean Droplet, Linode)
- Docker & Docker Compose installed:
  ```bash
  sudo apt update && sudo apt install -y docker.io docker-compose
  ```

### Step-by-Step Instructions:

1. **Clone or Copy the Project to Your Server**:
   ```bash
   git clone <your-repo-url> /var/www/academic-portal
   cd /var/www/academic-portal
   ```

2. **Configure Environment File**:
   Copy `.env.example` or create `.env`:
   ```bash
   cp server/.env.example .env
   ```

3. **Build and Launch All Containers**:
   ```bash
   docker-compose up -d --build
   ```

4. **Run Database Migrations & Seeds Inside the Container**:
   ```bash
   docker exec -it academic_portal_app npx prisma migrate deploy
   docker exec -it academic_portal_app npx prisma db seed
   ```

5. **Verify Running Containers**:
   ```bash
   docker ps
   ```
   Your app is now live at `http://your-server-ip:5000/`!

---

## 4. Hosting Method B: Traditional Linux Server (Ubuntu VPS + PM2 + Nginx)

If you prefer deploying directly on an Ubuntu server without Docker:

### Step 1: Install Node.js, PostgreSQL, and PM2
```bash
# 1. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx

# 2. Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Configure PostgreSQL Database
```bash
sudo -u postgres psql

# Run inside Postgres shell:
CREATE DATABASE academic_portal;
CREATE USER portal_admin WITH ENCRYPTED PASSWORD 'StrongPassword2026!';
GRANT ALL PRIVILEGES ON DATABASE academic_portal TO portal_admin;
ALTER DATABASE academic_portal OWNER TO portal_admin;
\q
```

### Step 3: Clone Code and Install Dependencies
```bash
cd /var/www
git clone <your-repo-url> academic-portal
cd academic-portal

# Install server dependencies
cd server
npm ci
cp .env.example .env
# Edit .env with your DATABASE_URL:
# DATABASE_URL=postgresql://portal_admin:StrongPassword2026!@localhost:5432/academic_portal?schema=public

# Apply Prisma migrations & seed database
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed

# Compile TypeScript backend
npm run build

# Install and build frontend
cd ../client
npm ci
npm run build
```

### Step 4: Start Backend Process with PM2 (Auto-Restart on Reboot)
```bash
cd /var/www/academic-portal/server

# Start server using compiled production bundle
pm2 start dist/src/server.js --name "academic-portal"

# Enable auto-start on system boot
pm2 save
pm2 startup
```

### Step 5: Configure Nginx as Reverse Proxy (Port 80 -> Port 5000)
Create `/etc/nginx/sites-available/academic-portal`:
```nginx
server {
    listen 80;
    server_name portal.yourcollege.edu your-server-ip;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/academic-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 5. Setting Up Free SSL Certificate (HTTPS via Let's Encrypt)

Secure your portal with HTTPS:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portal.yourcollege.edu
```
Certbot will automatically configure HTTPS encryption and set up automatic renewal every 90 days.

---

## 6. Cloud Platform Deployment (Render / Railway / Supabase)

If you prefer managed cloud platforms:

### Option A: Railway.app or Render.com
1. **Push your repository to GitHub** (public or private).
2. **Create a Managed PostgreSQL Database** on Render or Railway (copy the connection string).
3. **Create a Web Service**:
   - Build Command: `cd client && npm install && npm run build && cd ../server && npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - Start Command: `cd server && npm run start:prod`
   - Environment Variables:
     - `DATABASE_URL` = `<your-database-connection-string>`
     - `JWT_SECRET` = `<your-jwt-secret>`
     - `NODE_ENV` = `production`
     - `PORT` = `5000` (or leave default for cloud provider)

4. Your application will be live at `https://your-app-name.onrender.com` or `https://your-app-name.up.railway.app`.

---

## 7. Verification Checklist After Hosting

Once deployed, run these 4 quick health checks:
1. **Health Check Endpoint**:  
   Visit `https://portal.yourcollege.edu/health`  
   Expected JSON response: `{"status": "HEALTHY", "database": "PostgreSQL (Connected via Prisma)", ...}`
2. **Admin Login**:  
   Sign in with administrator credentials -> verify redirected to `/admin/dashboard`.
3. **Staff Login**:  
   Sign in with faculty credentials -> verify redirected to `/staff/dashboard`.
4. **Report Export**:  
   Go to Reports Generator -> generate a PowerPoint (`.pptx`) or PDF to ensure document generators work in the container.
