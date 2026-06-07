# VPS Deployment

This setup runs the static site and API on one Ubuntu server:

- Nginx serves the website from `/opt/oxy/site`
- Nginx proxies `/api/*` to Node.js on `127.0.0.1:3000`
- systemd keeps the API running as `oxy-api`
- SQLite data is stored at `/var/lib/oxy/leads.db`
- Uploaded site photos are stored at `/var/lib/oxy/uploads`
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
UPLOAD_DIR=/var/lib/oxy/uploads
ADMIN_SECRET=long-random-string
```

`CHAT_ID` is the only Telegram account allowed to become admin with `/start`. Keep `ADMIN_SECRET` private; it protects write endpoints such as `POST /api/content/:key` and `POST /api/media/:key`.

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
curl 'https://example.com/api/content'
curl -I 'https://example.com/uploads/non-existing.webp'
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
- `/set hero_title Новый текст`
- `/get hero_title`
- `/photo hero_bg`

Telegram content editing after launch:

- Press `📝 Тексты`, choose a key, send the new text, wait for `✅ Текст обновлён`.
- Press `🖼 Фото`, choose `hero_bg`, `about_photo`, or `contacts_bg`, send JPG/PNG/WebP up to 8 MB, wait for `✅ Фото обновлено`.
- Public site reads updated data from `GET /api/content`; if the API is down, the static fallback content remains visible.

Available text keys: `hero_title`, `hero_subtitle`, `hero_cta`, `about_title`, `about_text`, `contacts_title`, `contacts_phone`, `contacts_telegram`, `contacts_whatsapp`.

After every deploy, verify `/var/lib/oxy/uploads` exists and is owned by `oxy:oxy`:

```bash
ls -ld /var/lib/oxy /var/lib/oxy/uploads
systemctl restart oxy-api
```
