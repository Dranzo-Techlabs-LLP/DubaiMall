#!/usr/bin/env bash
# Dubai Mall Edakkara: deploy the website, voucher desk and coupon server into a cPanel account.
#
# Run in WHM → Terminal (as root), from the unpacked package folder:
#   cd /home/dubaimalldranzo/dubai-mall-deploy
#   bash deploy.sh --user dubaimalldranzo --domain YOUR-DOMAIN.com
#
# Safe to run again for updates: the desk key, saved coupons and the desk login are kept.
set -euo pipefail

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$*"; }
warn() { printf '    \033[31m!!\033[0m  %s\n' "$*"; }
die()  { printf '\n\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: bash deploy.sh --user <cpanel-user> --domain <main-domain> [options]

  --user            cPanel account name, e.g. dubaimalldranzo
  --domain          main website domain, e.g. dubaimalledakkara.com
  --coupons-host    address for coupon links (default: coupons.<domain>)
  --reset-password  set a new voucher desk username and password
  --reset-key       make a new desk key (open desk tabs must be reloaded afterwards)
EOF
  exit 1
}

CP_USER="" DOMAIN="" COUPONS_HOST="" RESET_PASSWORD=0 RESET_KEY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user) CP_USER="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --coupons-host) COUPONS_HOST="${2:-}"; shift 2 ;;
    --reset-password) RESET_PASSWORD=1; shift ;;
    --reset-key) RESET_KEY=1; shift ;;
    -h | --help) usage ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done
[ -n "$CP_USER" ] && [ -n "$DOMAIN" ] || usage

clean_host() { local h="${1#http://}"; h="${h#https://}"; printf '%s' "${h%%/*}"; }
DOMAIN="$(clean_host "$DOMAIN")"; DOMAIN="${DOMAIN#www.}"
COUPONS_HOST="$(clean_host "${COUPONS_HOST:-coupons.$DOMAIN}")"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "'$DOMAIN' doesn't look like a domain."
[[ "$COUPONS_HOST" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "'$COUPONS_HOST' doesn't look like a domain."

if [ -n "${DME_HOME_OVERRIDE:-}" ]; then
  HOME_DIR="$DME_HOME_OVERRIDE" # for testing the script away from cPanel
else
  HOME_DIR="$(getent passwd "$CP_USER" | cut -d: -f6 || true)"
fi
[ -n "$HOME_DIR" ] && [ -d "$HOME_DIR" ] || die "cPanel user '$CP_USER' not found."

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$PKG/site/index.html" ] && [ -f "$PKG/coupon-server/index.mjs" ] ||
  die "Run this from the unpacked package folder (site/ and coupon-server/ are missing)."
command -v openssl >/dev/null || die "openssl is needed (to make the desk key and password)."

WEB="$HOME_DIR/public_html"
APP="$HOME_DIR/coupon-server"
PASS_DIR="$HOME_DIR/.htpasswds"
PASS_FILE="$PASS_DIR/voucher-desk"
STAMP="$(date +%Y%m%d-%H%M%S)"
IS_ROOT=0
[ "$(id -u)" -eq 0 ] && IS_ROOT=1

# Files must belong to the cPanel user, not root, or Apache/Passenger can't serve them.
own() { if [ "$IS_ROOT" -eq 1 ]; then chown -R "$CP_USER:$CP_USER" "$@"; fi; }

printf '\nDeploying Dubai Mall Edakkara\n'
printf '  cPanel user:   %s (%s)\n' "$CP_USER" "$HOME_DIR"
printf '  website:       https://%s\n' "$DOMAIN"
printf '  voucher desk:  https://%s/vouchers.html\n' "$DOMAIN"
printf '  coupon links:  https://%s\n' "$COUPONS_HOST"

# ---------------------------------------------------------------------------
say "1/6  Backing up the current website"
mkdir -p "$HOME_DIR/backups"
if [ -d "$WEB" ] && [ -n "$(ls -A "$WEB" 2>/dev/null | grep -v -x -e cgi-bin -e .well-known || true)" ]; then
  tar -czf "$HOME_DIR/backups/public_html-$STAMP.tar.gz" -C "$HOME_DIR" public_html
  ok "Saved ~/backups/public_html-$STAMP.tar.gz"
else
  ok "public_html is empty, nothing to back up"
fi
own "$HOME_DIR/backups"

# ---------------------------------------------------------------------------
say "2/6  Copying the website and voucher desk into public_html"
mkdir -p "$WEB"
rm -rf "$WEB/assets" # build files have new names each release; drop the old ones
cp -R "$PKG/site/." "$WEB/"
# Fix ownership/permissions of what we copied only; public_html itself keeps cPanel's settings.
for item in "$PKG"/site/* "$PKG"/site/.[!.]*; do
  [ -e "$item" ] || continue
  target="$WEB/$(basename "$item")"
  own "$target"
  find "$target" -type d -exec chmod 755 {} +
  find "$target" -type f -exec chmod 644 {} +
done
ok "Website files copied"

# ---------------------------------------------------------------------------
say "3/6  Installing the coupon server in ~/coupon-server"
mkdir -p "$APP/data" "$APP/tmp"
cp "$PKG/coupon-server/index.mjs" "$PKG/coupon-server/app.js" "$PKG/coupon-server/package.json" \
  "$PKG/coupon-server/.env.example" "$APP/"
ENV_FILE="$APP/.env"
KEY=""
[ -f "$ENV_FILE" ] && KEY="$(sed -n 's/^DESK_KEY=//p' "$ENV_FILE" | head -n 1)"
if [ -z "$KEY" ] || [ "$RESET_KEY" -eq 1 ]; then
  KEY="$(openssl rand -base64 36 | tr '+/' '-_' | tr -d '=\n')"
  ok "Made a new desk key"
else
  ok "Kept the existing desk key"
fi
cat >"$ENV_FILE" <<EOF
# Written by deploy.sh ($STAMP). Running deploy.sh again keeps DESK_KEY.
DESK_KEY=$KEY
PUBLIC_URL=https://$COUPONS_HOST
DESK_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
EOF
chmod 600 "$ENV_FILE"
chmod 700 "$APP/data"
own "$APP"
ok "Coupon server files in $APP (saved coupons in $APP/data are kept)"

# ---------------------------------------------------------------------------
say "4/6  Connecting the voucher desk to the coupon server"
cat >"$WEB/desk-config.js" <<EOF
// Written by deploy.sh. Password-protected: only the desk login can read this file.
window.DME_DESK_CONFIG = { couponApiUrl: 'https://$COUPONS_HOST', couponApiKey: '$KEY' }
EOF
chmod 644 "$WEB/desk-config.js"
own "$WEB/desk-config.js"
ok "desk-config.js written"

# ---------------------------------------------------------------------------
say "5/6  Password-protecting the voucher desk"
mkdir -p "$PASS_DIR"
if [ ! -s "$PASS_FILE" ] || [ "$RESET_PASSWORD" -eq 1 ]; then
  read -r -p "    Desk username for staff: " DESK_USER
  [[ "$DESK_USER" =~ ^[A-Za-z0-9._-]+$ ]] || die "Use only letters, numbers, dot, dash or underscore in the username."
  while :; do
    read -r -s -p "    Desk password (at least 8 characters): " P1
    echo
    read -r -s -p "    Repeat the password: " P2
    echo
    if [ "$P1" = "$P2" ] && [ "${#P1}" -ge 8 ]; then break; fi
    warn "The passwords didn't match or were too short. Try again."
  done
  HASH="$(printf '%s' "$P1" | openssl passwd -apr1 -stdin)"
  unset P1 P2
  printf '%s:%s\n' "$DESK_USER" "$HASH" >"$PASS_FILE"
  ok "Saved the login for '$DESK_USER'"
else
  ok "Kept the existing desk login (add --reset-password to change it)"
fi
# Apache (user "nobody" on cPanel) must be able to read the password file.
if [ "$IS_ROOT" -eq 1 ] && getent group nobody >/dev/null; then
  chown "$CP_USER:nobody" "$PASS_DIR" "$PASS_FILE"
  chmod 750 "$PASS_DIR"
  chmod 640 "$PASS_FILE"
else
  chmod 755 "$PASS_DIR"
  chmod 644 "$PASS_FILE"
fi

HT="$WEB/.htaccess"
touch "$HT"
# Replace our block between the markers and keep anything else already in .htaccess.
awk '/^# BEGIN Dubai Mall voucher desk/{skip=1} !skip{print} /^# END Dubai Mall voucher desk/{skip=0}' "$HT" >"$HT.tmp"
cat >>"$HT.tmp" <<EOF
# BEGIN Dubai Mall voucher desk
# Staff only: the voucher desk page and its settings need the desk login.
<FilesMatch "^(vouchers\.html|desk-config\.js)$">
  AuthType Basic
  AuthName "Dubai Mall Edakkara voucher desk"
  AuthUserFile "$PASS_FILE"
  Require valid-user
</FilesMatch>
# Always load the newest pages and desk settings after a deploy.
<IfModule mod_headers.c>
  <FilesMatch "^(index\.html|vouchers\.html|desk-config\.js)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
# END Dubai Mall voucher desk
EOF
mv "$HT.tmp" "$HT"
chmod 644 "$HT"
own "$HT"
ok "vouchers.html now asks for the desk login"

# ---------------------------------------------------------------------------
say "6/6  Checking Node.js for the coupon server"
FOUND=0
for n in /opt/cpanel/ea-nodejs*/bin/node /opt/alt/alt-nodejs*/root/usr/bin/node; do
  [ -x "$n" ] || continue
  FOUND=1
  printf '    %-48s %s\n' "$n" "$("$n" -v 2>/dev/null || echo '?')"
done
if [ "$FOUND" -eq 0 ]; then
  warn "No cPanel Node.js found. Install one in WHM: EasyApache 4 (ea-nodejs22) or CloudLinux Node.js Selector."
fi
touch "$APP/tmp/restart.txt" # restarts the app if it is already set up
own "$APP/tmp"

cat <<EOF

$(printf '\033[1;32m')Files are in place.$(printf '\033[0m') The first time only, finish these in cPanel (log in as $CP_USER):

 A) Coupon subdomain:  Domains → Create A New Domain
      Domain:  $COUPONS_HOST
      Untick "Share document root" and keep the suggested folder.

 B) Node.js app:  "Setup Node.js App" (or "Application Manager") → Create
      Node.js version:           newest offered (22.13+ keeps coupons in SQLite;
                                 older versions save them as files; both work)
      Application mode:          Production
      Application root / path:   coupon-server
      Application URL / domain:  $COUPONS_HOST
      Startup file:              app.js
    Create, then Start. No "Run NPM Install" needed: it has no dependencies.

 C) HTTPS:  SSL/TLS Status → Run AutoSSL (covers $DOMAIN and $COUPONS_HOST).

Then check:
  https://$COUPONS_HOST/healthz       shows {"ok":true}
  https://$DOMAIN/                     the mall website
  https://$DOMAIN/vouchers.html        asks for the desk login, then opens the desk

Updates later: upload the new package, unpack it, and run this same command again.
Restart the coupon server:  touch $APP/tmp/restart.txt
EOF
