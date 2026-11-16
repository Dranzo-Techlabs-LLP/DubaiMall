#!/usr/bin/env bash
# Dubai Mall Edakkara: deploy the website, voucher desk and coupon server into a cPanel account,
# entirely from the WHM terminal (as root).
#
#   cd /home/dubaimalldranzo/dubai-mall-deploy
#   bash deploy.sh --user dubaimalldranzo --domain YOUR-DOMAIN.com
#
# It copies the files, then uses cPanel's own command-line tools to create the coupons subdomain,
# register + start the Node.js app, and run AutoSSL. Every step checks first, so running it again
# (for updates) is safe: vouchers, coupons and all logins are kept.
set -euo pipefail

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$*"; }
warn() { printf '    \033[31m!!\033[0m  %s\n' "$*"; TODO+=("$*"); }
info() { printf '        %s\n' "$*"; }
die()  { printf '\n\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }
TODO=()

usage() {
  cat <<'EOF'
Usage: bash deploy.sh --user <cpanel-user> --domain <main-domain> [options]

  --user            cPanel account name, e.g. dubaimalldranzo
  --domain          the account's website domain, e.g. dubaimalledakkara.com
  --coupons-host    address for coupon links (default: coupons.<domain>)
  --node-version    Node.js major version for the coupon server (default: newest installed)
  --files-only      only copy files; skip subdomain, Node.js app and SSL setup
  --reset-password  set a new password for the mall admin login
EOF
  exit 1
}

CP_USER="" DOMAIN="" COUPONS_HOST="" NODE_MAJOR="" FILES_ONLY=0 RESET_PASSWORD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user) CP_USER="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --coupons-host) COUPONS_HOST="${2:-}"; shift 2 ;;
    --node-version) NODE_MAJOR="${2:-}"; shift 2 ;;
    --files-only) FILES_ONLY=1; shift ;;
    --reset-password) RESET_PASSWORD=1; shift ;;
    -h | --help) usage ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done
[ -n "$CP_USER" ] && [ -n "$DOMAIN" ] || usage

clean_host() { local h="${1#http://}"; h="${h#https://}"; printf '%s' "${h%%/*}"; }
DOMAIN="$(clean_host "$DOMAIN")"; DOMAIN="${DOMAIN#www.}"
COUPONS_HOST="$(clean_host "${COUPONS_HOST:-coupons.$DOMAIN}")"
HOST_RE='^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
[[ "$DOMAIN" =~ $HOST_RE ]] || die "'$DOMAIN' doesn't look like a domain."
[[ "$COUPONS_HOST" =~ $HOST_RE ]] || die "'$COUPONS_HOST' doesn't look like a domain."
[ -z "$NODE_MAJOR" ] || [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || die "--node-version takes a major version, e.g. 22"

if [ -n "${DME_HOME_OVERRIDE:-}" ]; then
  HOME_DIR="$DME_HOME_OVERRIDE" # for testing the script away from cPanel
else
  HOME_DIR="$(getent passwd "$CP_USER" | cut -d: -f6 || true)"
fi
[ -n "$HOME_DIR" ] && [ -d "$HOME_DIR" ] || die "cPanel user '$CP_USER' not found."

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$PKG/site/index.html" ] && [ -f "$PKG/coupon-server/index.mjs" ] ||
  die "Run this from the unpacked package folder (site/ and coupon-server/ are missing)."

CPANEL_BIN="${DME_CPANEL_BIN:-/usr/local/cpanel/bin}"
APP_DIR_NAME="coupon-server"
APP="$HOME_DIR/$APP_DIR_NAME"
STAMP="$(date +%Y%m%d-%H%M%S)"
IS_ROOT=0
[ "$(id -u)" -eq 0 ] && IS_ROOT=1

# Files must belong to the cPanel user, not root, or Apache/Passenger can't serve them.
own() { if [ "$IS_ROOT" -eq 1 ]; then chown -R "$CP_USER:$CP_USER" "$@"; fi; }

# --- cPanel API helpers (UAPI, run for the account as root) ---
HAVE_UAPI=0
command -v uapi >/dev/null && HAVE_UAPI=1
api() { uapi --output=json --user="$CP_USER" "$@" 2>&1 || true; }
api_ok() { local in; in="$(cat)"; grep -Eq '"status": *1' <<<"$in"; }
json_str() { sed -n "s/.*\"$1\": *\"\\([^\"]*\\)\".*/\\1/p" | head -n 1 | sed 's#\\/#/#g'; }
api_errors() { grep -o '"errors": *\[[^]]*\]' | head -n 1 | sed 's/"errors": *//'; }
domain_info() { api DomainInfo single_domain_data domain="$1"; }

printf '\nDeploying Dubai Mall Edakkara\n'
printf '  cPanel user:   %s (%s)\n' "$CP_USER" "$HOME_DIR"
printf '  website:       https://%s\n' "$DOMAIN"
printf '  voucher desk:  https://%s/vouchers.html\n' "$DOMAIN"
printf '  coupon links:  https://%s\n' "$COUPONS_HOST"

# ---------------------------------------------------------------------------
say "1/9  Checking the cPanel account"
WEB="$HOME_DIR/public_html"
if [ "$FILES_ONLY" -eq 1 ]; then
  ok "--files-only: using $WEB"
elif [ "$HAVE_UAPI" -eq 0 ]; then
  warn "cPanel's uapi command isn't available here; only the files will be set up (using $WEB)."
  FILES_ONLY=1
else
  INFO="$(domain_info "$DOMAIN")"
  if ! printf '%s' "$INFO" | api_ok; then
    printf '%s\n' "$(api DomainInfo list_domains)" | grep -o '"main_domain": *"[^"]*"' | sed 's/^/        /' || true
    die "$DOMAIN is not a domain of the cPanel account '$CP_USER'. Use the account's domain shown above."
  fi
  DOCROOT="$(printf '%s' "$INFO" | json_str documentroot)"
  [ -n "$DOCROOT" ] && WEB="$DOCROOT"
  ok "$DOMAIN belongs to $CP_USER; website folder: $WEB"
fi

# ---------------------------------------------------------------------------
say "2/9  Backing up the current website"
mkdir -p "$HOME_DIR/backups"
if [ -d "$WEB" ] && [ -n "$(ls -A "$WEB" 2>/dev/null | grep -v -x -e cgi-bin -e .well-known || true)" ]; then
  tar -czf "$HOME_DIR/backups/$(basename "$WEB")-$STAMP.tar.gz" -C "$(dirname "$WEB")" "$(basename "$WEB")"
  ok "Saved ~/backups/$(basename "$WEB")-$STAMP.tar.gz"
else
  ok "The website folder is empty, nothing to back up"
fi
own "$HOME_DIR/backups"

# ---------------------------------------------------------------------------
say "3/9  Copying the website and voucher desk"
mkdir -p "$WEB"
rm -rf "$WEB/assets" # build files have new names each release; drop the old ones
cp -R "$PKG/site/." "$WEB/"
# Fix ownership/permissions of what we copied only; the folder itself keeps cPanel's settings.
for item in "$PKG"/site/* "$PKG"/site/.[!.]*; do
  [ -e "$item" ] || continue
  target="$WEB/$(basename "$item")"
  own "$target"
  find "$target" -type d -exec chmod 755 {} +
  find "$target" -type f -exec chmod 644 {} +
done
ok "Website files copied to $WEB"

# ---------------------------------------------------------------------------
say "4/9  Installing the coupon server in ~/$APP_DIR_NAME"
mkdir -p "$APP/data" "$APP/tmp"
cp "$PKG/coupon-server/index.mjs" "$PKG/coupon-server/app.js" "$PKG/coupon-server/package.json" \
  "$PKG/coupon-server/.env.example" "$APP/"
ENV_FILE="$APP/.env"
cat >"$ENV_FILE" <<EOF
# Written by deploy.sh ($STAMP).
PUBLIC_URL=https://$COUPONS_HOST
DESK_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
EOF
chmod 600 "$ENV_FILE"
chmod 700 "$APP/data"
own "$APP"
ok "Coupon server files in $APP (vouchers, coupons and logins in $APP/data are kept)"

# Tell the desk where its server is (not secret: every action needs a shop or admin login).
cat >"$WEB/desk-config.js" <<EOF
// Written by deploy.sh: where the voucher desk finds its server.
window.DME_DESK_CONFIG = { couponApiUrl: 'https://$COUPONS_HOST' }
EOF
chmod 644 "$WEB/desk-config.js"
own "$WEB/desk-config.js"
ok "Voucher desk connected (desk-config.js)"

# ---------------------------------------------------------------------------
say "5/9  Mall admin login for the voucher desk"
# Newest Node.js on the server (CloudLinux or EasyApache), or the one given with --node-version.
find_node() {
  local cands=() n
  if [ -n "$NODE_MAJOR" ]; then
    cands+=("/opt/alt/alt-nodejs$NODE_MAJOR/root/usr/bin/node" "/opt/cpanel/ea-nodejs$NODE_MAJOR/bin/node")
  fi
  for n in $(ls -d /opt/alt/alt-nodejs*/root/usr/bin/node /opt/cpanel/ea-nodejs*/bin/node 2>/dev/null | sort -V -r); do cands+=("$n"); done
  if command -v node >/dev/null; then cands+=("$(command -v node)"); fi
  for n in ${cands[@]+"${cands[@]}"}; do
    if [ -x "$n" ]; then printf '%s' "$n"; return 0; fi
  done
  return 1
}
NODE_BIN="$(find_node || true)"
server_cmd() { (cd "$APP" && "$NODE_BIN" --no-warnings index.mjs "$@"); }
if [ -z "$NODE_BIN" ]; then
  warn "Node.js isn't installed yet, so the mall admin login can't be created. Install Node.js (see step 7) and run this again."
elif server_cmd has-admin && [ "$RESET_PASSWORD" -eq 0 ]; then
  ok "Kept the existing mall admin login (add --reset-password to change its password)"
else
  read -r -p "    Mall admin username [admin]: " ADMIN_USER
  ADMIN_USER="$(printf '%s' "${ADMIN_USER:-admin}" | tr '[:upper:]' '[:lower:]')"
  [[ "$ADMIN_USER" =~ ^[a-z0-9][a-z0-9._-]{1,39}$ ]] || die "Use only letters, numbers, dot, dash or underscore in the username."
  while :; do
    read -r -s -p "    Mall admin password (at least 8 characters): " P1
    echo
    read -r -s -p "    Repeat the password: " P2
    echo
    if [ "$P1" = "$P2" ] && [ "${#P1}" -ge 8 ]; then break; fi
    printf '    \033[31m!!\033[0m  The passwords did not match or were too short. Try again.\n'
  done
  printf '%s\n' "$P1" | server_cmd set-password "$ADMIN_USER" --admin >/dev/null
  unset P1 P2
  ok "Saved the mall admin login '$ADMIN_USER'. Log in with it to create each shop's login."
fi
own "$APP"

HT="$WEB/.htaccess"
touch "$HT"
# Replace our block between the markers and keep anything else already in .htaccess.
# (Earlier versions password-protected the desk here; logins in the desk replace that.)
awk '/^# BEGIN Dubai Mall voucher desk/{skip=1} !skip{print} /^# END Dubai Mall voucher desk/{skip=0}' "$HT" >"$HT.tmp"
cat >>"$HT.tmp" <<EOF
# BEGIN Dubai Mall voucher desk
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
ok "Website settings (.htaccess) updated"

# ---------------------------------------------------------------------------
say "6/9  Coupon subdomain $COUPONS_HOST"
if [ "$FILES_ONLY" -eq 1 ]; then
  info "skipped (--files-only)"
elif domain_info "$COUPONS_HOST" | api_ok; then
  ok "$COUPONS_HOST already exists"
elif [[ "$COUPONS_HOST" != *".$DOMAIN" ]]; then
  warn "$COUPONS_HOST is not under $DOMAIN, so it can't be added as a subdomain here. Add it in cPanel → Domains."
else
  SUB="${COUPONS_HOST%".$DOMAIN"}"
  OUT="$(api SubDomain addsubdomain domain="$SUB" rootdomain="$DOMAIN" dir="$COUPONS_HOST")"
  if printf '%s' "$OUT" | api_ok; then
    ok "Created $COUPONS_HOST (folder ~/$COUPONS_HOST)"
  else
    warn "Could not create $COUPONS_HOST: $(printf '%s' "$OUT" | api_errors)"
  fi
fi

# ---------------------------------------------------------------------------
say "7/9  Coupon server as a Node.js app"
touch "$APP/tmp/restart.txt" # Passenger restarts the app on its next request
own "$APP/tmp"
newest_major() { ls -d "$@" 2>/dev/null | sed -n 's/.*nodejs\([0-9][0-9]*\).*/\1/p' | sort -n | tail -n 1; }
if [ "$FILES_ONLY" -eq 1 ]; then
  info "skipped (--files-only)"
elif command -v cloudlinux-selector >/dev/null; then
  # CloudLinux "Setup Node.js App"
  MAJOR="${NODE_MAJOR:-$(newest_major /opt/alt/alt-nodejs*)}"
  APPS="$(cloudlinux-selector get --json --interpreter nodejs --user "$CP_USER" 2>&1 || true)"
  if grep -q "\"$APP_DIR_NAME\"" <<<"$APPS"; then
    cloudlinux-selector restart --json --interpreter nodejs --user "$CP_USER" --app-root "$APP_DIR_NAME" >/dev/null 2>&1 &&
      ok "Node.js app already set up; restarted it" || warn "Could not restart the Node.js app; restart it in cPanel → Setup Node.js App."
  elif [ -z "$MAJOR" ]; then
    warn "No Node.js versions are installed. In WHM → LVE Manager → Node.js Selector, install Node.js 22, then run this again."
  else
    OUT="$(cloudlinux-selector create --json --interpreter nodejs --user "$CP_USER" --app-root "$APP_DIR_NAME" \
      --domain "$COUPONS_HOST" --app-uri / --version "$MAJOR" --app-mode production --startup-file app.js 2>&1 || true)"
    if grep -Eq '"result": *"success"' <<<"$OUT"; then
      cloudlinux-selector start --json --interpreter nodejs --user "$CP_USER" --app-root "$APP_DIR_NAME" >/dev/null 2>&1 || true
      ok "Created and started the Node.js app (Node $MAJOR, CloudLinux)"
    else
      warn "CloudLinux couldn't create the Node.js app: $OUT"
    fi
  fi
else
  # cPanel "Application Manager" (Phusion Passenger, EasyApache 4)
  MAJOR="${NODE_MAJOR:-$(newest_major /opt/cpanel/ea-nodejs*)}"
  HAVE_PASSENGER=0
  # Read the package lists into a variable first: with pipefail, `dpkg -l | grep -q` fails when
  # grep stops early and dpkg gets SIGPIPE. (rpm on AlmaLinux/Rocky, dpkg on Ubuntu.)
  PKGS="$( { rpm -qa 2>/dev/null || true; dpkg -l 2>/dev/null || true; } )"
  if ls -d /opt/cpanel/ea-ruby*/root/usr/share/passenger >/dev/null 2>&1 || grep -Eq 'mod[_-]passenger' <<<"$PKGS"; then
    HAVE_PASSENGER=1
  fi
  if [ -z "$MAJOR" ] || [ "$HAVE_PASSENGER" -eq 0 ]; then
    warn "Node.js / Passenger isn't installed. Install it, then run this again:"
    info "  AlmaLinux/Rocky: dnf install -y ea-nodejs22 ea-apache24-mod-passenger ea-apache24-mod_env"
    info "  Ubuntu:          apt-get install -y ea-nodejs22 ea-apache24-mod-passenger ea-apache24-mod-env"
    info "  and in WHM → Feature Manager, allow \"Application Manager\" for the account's package."
  else
    APPS="$(api PassengerApps list_applications)"
    if grep -q "\"$APP_DIR_NAME\"" <<<"$APPS"; then
      ok "Node.js app already registered; it restarts on the next visit"
    else
      OUT="$(api PassengerApps register_application name="$APP_DIR_NAME" path="$APP_DIR_NAME" domain="$COUPONS_HOST" \
        base_uri=/ deployment_mode=production enabled=1)"
      if ! printf '%s' "$OUT" | api_ok; then # some cPanel versions want the full path
        OUT="$(api PassengerApps register_application name="$APP_DIR_NAME" path="$APP" domain="$COUPONS_HOST" \
          base_uri=/ deployment_mode=production enabled=1)"
      fi
      if printf '%s' "$OUT" | api_ok; then
        ok "Registered the Node.js app (Application Manager, Node $MAJOR)"
      else
        warn "Could not register the Node.js app: $(printf '%s' "$OUT" | api_errors)"
        info "  If it says the feature is disabled: WHM → Feature Manager → allow \"Application Manager\"."
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
say "8/9  DNS and HTTPS"
if [ "$FILES_ONLY" -eq 1 ]; then
  info "skipped (--files-only)"
else
  MAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || true)"
  COUPON_IP="$(getent hosts "$COUPONS_HOST" | awk '{print $1; exit}' || true)"
  TARGET_IP="${MAIN_IP:-the server IP}"
  if [ -z "$COUPON_IP" ]; then
    warn "$COUPONS_HOST doesn't resolve yet. If the domain's DNS is managed elsewhere, add an A record for it pointing to $TARGET_IP."
  else
    ok "$COUPONS_HOST resolves to $COUPON_IP"
  fi
  if [ -x "$CPANEL_BIN/autossl_check" ]; then
    info "Running AutoSSL for $CP_USER (can take a minute)..."
    if "$CPANEL_BIN/autossl_check" --user="$CP_USER" >/dev/null 2>&1; then
      ok "AutoSSL ran; certificates may take a few minutes to appear"
    else
      warn "AutoSSL didn't finish; run it in cPanel → SSL/TLS Status → Run AutoSSL."
    fi
  else
    warn "AutoSSL tool not found; run it in cPanel → SSL/TLS Status → Run AutoSSL."
  fi
fi

# ---------------------------------------------------------------------------
say "9/9  Checking the coupon server"
if [ "$FILES_ONLY" -eq 1 ]; then
  info "skipped (--files-only)"
elif command -v curl >/dev/null; then
  HEALTH=""
  for _ in 1 2 3 4 5; do
    HEALTH="$(curl -s -m 15 -H "Host: $COUPONS_HOST" http://127.0.0.1/healthz || true)"
    grep -q '"ok":true' <<<"$HEALTH" && break
    sleep 3
  done
  if grep -q '"ok":true' <<<"$HEALTH"; then
    ok "Coupon server is answering at $COUPONS_HOST"
  else
    warn "Coupon server didn't answer yet. Check the log: $APP/stderr.log or cPanel → Setup Node.js App."
  fi
fi

# ---------------------------------------------------------------------------
printf '\n'
if [ "${#TODO[@]}" -eq 0 ]; then
  printf '\033[1;32mAll done.\033[0m\n'
else
  printf '\033[1;33mDone, with %s item(s) to finish:\033[0m\n' "${#TODO[@]}"
  for t in "${TODO[@]}"; do printf '  - %s\n' "$t"; done
fi
cat <<EOF

Check in a browser:
  https://$COUPONS_HOST/healthz       shows {"ok":true}
  https://$DOMAIN/                     the mall website
  https://$DOMAIN/vouchers.html        log in as the mall admin → Shop logins → create each shop's login

Updates later: upload the new package, unpack it, and run this same command again.
Restart the coupon server:  touch $APP/tmp/restart.txt
EOF
