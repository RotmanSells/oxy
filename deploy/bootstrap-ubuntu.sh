#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
REPO_URL="${2:-https://github.com/RotmanSells/oxy.git}"
BRANCH="${3:-main}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash deploy/bootstrap-ubuntu.sh example.com [repo_url] [branch]"
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/bootstrap-ubuntu.sh ..."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx rsync ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! id oxy >/dev/null 2>&1; then
  useradd --system --home /opt/oxy --shell /usr/sbin/nologin oxy
fi

mkdir -p /opt/oxy /var/lib/oxy
chown -R oxy:oxy /opt/oxy /var/lib/oxy

if [[ ! -d /opt/oxy/repo/.git ]]; then
  runuser -u oxy -- git clone --branch "$BRANCH" "$REPO_URL" /opt/oxy/repo
else
  runuser -u oxy -- git -C /opt/oxy/repo fetch origin "$BRANCH"
  runuser -u oxy -- git -C /opt/oxy/repo reset --hard "origin/$BRANCH"
fi

bash /opt/oxy/repo/deploy/deploy.sh "$DOMAIN"

ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

cat <<NEXT

Bootstrap complete.

Next steps:
1. Edit secrets: nano /opt/oxy/api/.env
2. Restart API: systemctl restart oxy-api
3. Check API: curl http://127.0.0.1:3000/
4. Optional SSL: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN -d www.$DOMAIN

NEXT
