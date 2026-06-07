#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: bash deploy/deploy.sh example.com"
  exit 1
fi

REPO_DIR="/opt/oxy/repo"
SITE_DIR="/opt/oxy/site"
API_DIR="/opt/oxy/api"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Repo not found at $REPO_DIR"
  exit 1
fi

mkdir -p "$SITE_DIR" "$API_DIR" /var/lib/oxy

rsync -a --delete \
  --exclude='.git' \
  --exclude='api' \
  --exclude='deploy' \
  --exclude='docs' \
  --exclude='security-review' \
  --exclude='node_modules' \
  --exclude='.DS_Store' \
  "$REPO_DIR/" "$SITE_DIR/"

rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data' \
  --exclude='.env' \
  "$REPO_DIR/api/" "$API_DIR/"

cd "$API_DIR"
npm ci
npm run build

if [[ ! -f "$API_DIR/.env" ]]; then
  cp "$REPO_DIR/deploy/env.production.example" "$API_DIR/.env"
  sed -i "s#https://YOUR_DOMAIN#https://$DOMAIN#g; s#YOUR_DOMAIN#$DOMAIN#g" "$API_DIR/.env"
  chmod 600 "$API_DIR/.env"
fi

cp "$REPO_DIR/deploy/oxy-api.service" /etc/systemd/system/oxy-api.service
sed "s#__DOMAIN__#$DOMAIN#g" "$REPO_DIR/deploy/nginx.conf.template" > /etc/nginx/sites-available/oxy.conf
ln -sf /etc/nginx/sites-available/oxy.conf /etc/nginx/sites-enabled/oxy.conf
rm -f /etc/nginx/sites-enabled/default

chown -R oxy:oxy /opt/oxy /var/lib/oxy
systemctl daemon-reload
systemctl enable oxy-api
systemctl restart oxy-api
nginx -t
systemctl reload nginx

echo "Deploy complete: http://$DOMAIN"
