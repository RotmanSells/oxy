# VPS Deployment

This setup runs the static site and API on one Ubuntu server:

- Nginx serves the website from `/opt/oxy/site`
- Nginx proxies `/api/*` to Node.js on `127.0.0.1:3000`
- systemd keeps the API running as `oxy-api`
- SQLite data is stored at `/var/lib/oxy/leads.db`
- SSL can be issued by Certbot / Let's Encrypt

## Server requirements

Recommended minimum:

- Ubuntu 22.04 or 24.04
- 1 vCPU
- 2 GB RAM
- 20 GB SSD
- root SSH access
- domain A-record pointed to the server IP

## First deploy

SSH into the server as root and run:

```bash
apt-get update && apt-get install -y git
cd /tmp
git clone https://github.com/RotmanSells/oxy.git
cd oxy
bash deploy/bootstrap-ubuntu.sh example.com
```

Replace `example.com` with the real domain.

## Fill secrets

Edit the production env file:

```bash
nano /opt/oxy/api/.env
```

Required values:

```env
BOT_TOKEN=...
CHAT_ID=...
OPENAI_API_KEY=...
OPENAI_MODEL=minimax-m2
OPENAI_BASE_URL=https://api.hydraai.ru/v1
ADMIN_SECRET=long-random-string
```

Then restart the API:

```bash
systemctl restart oxy-api
systemctl status oxy-api --no-pager
```

## Enable SSL

After the domain points to the server:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

## Update deploy

For future updates:

```bash
cd /opt/oxy/repo
git pull origin main
bash deploy/deploy.sh example.com
```

## Checks

```bash
curl http://127.0.0.1:3000/
curl https://example.com/health
curl 'https://example.com/api/stats?period=today'
systemctl status oxy-api --no-pager
journalctl -u oxy-api -n 80 --no-pager
```

Telegram commands after launch:

- `/start`
- `/leads`
- `/stats`
- `/stats week`
- `/ai`
- `/reports`
