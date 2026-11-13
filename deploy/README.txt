DUBAI MALL EDAKKARA: DEPLOY PACKAGE FOR cPANEL (WHM terminal)
==============================================================

What's inside
  site/            the mall website + voucher desk (vouchers.html), built and ready
  coupon-server/   the voucher desk server: logins, vouchers, sponsors, coupon links
                   (Node.js, no dependencies)
  deploy.sh        does the whole deploy from the WHM terminal

Where things end up (account dubaimalldranzo)
  ~/public_html/        website + voucher desk
  ~/coupon-server/      the server; ALL desk data (vouchers, logins, sponsors, coupons)
                        is in coupon-server/data/ → include it in backups
  ~/backups/            a backup of the website folder, taken before each deploy


STEP 1: GET THE PACKAGE ONTO THE SERVER
  Either cPanel → File Manager → /home/dubaimalldranzo → Upload dubai-mall-deploy.tar.gz,
  or copy it with scp/SFTP to /home/dubaimalldranzo/

  Then in WHM → Terminal:
    cd /home/dubaimalldranzo
    tar -xzf dubai-mall-deploy.tar.gz


STEP 2: (ONLY IF NEEDED) INSTALL NODE.JS
  deploy.sh tells you if Node.js is missing. To install it from the terminal:
    CloudLinux servers:   WHM → LVE Manager → Node.js Selector → install Node.js 22
    Other cPanel servers: dnf install -y ea-nodejs22 ea-ruby27-mod_passenger ea-apache24-mod_env
                          (yum instead of dnf on CentOS 7), and in WHM → Feature Manager
                          allow "Application Manager" for the account's package.


STEP 3: DEPLOY
    cd /home/dubaimalldranzo/dubai-mall-deploy
    bash deploy.sh --user dubaimalldranzo --domain dubaimall.dranzo.com

  The first time it asks for the MALL ADMIN username + password, then:
    1  checks the domain belongs to the account and finds its website folder   (uapi DomainInfo)
    2  backs up the website folder to ~/backups
    3  copies the website and voucher desk
    4  installs the server and points the desk at it
    5  creates the mall admin login
    6  creates coupons.YOUR-DOMAIN                                               (uapi SubDomain)
    7  registers + starts the Node.js app        (cloudlinux-selector, or uapi PassengerApps)
    8  checks DNS and runs AutoSSL                          (/usr/local/cpanel/bin/autossl_check)
    9  checks the server answers

  Anything it couldn't do is listed at the end with what to do.
  If the domain's DNS is NOT managed by this server, add an A record for
  coupons.YOUR-DOMAIN (same IP as the main domain), wait a few minutes, run it again.


STEP 4: CREATE THE SHOP LOGINS
  Open https://YOUR-DOMAIN/vouchers.html → log in as the mall admin →
  "Shop logins" tab → "Create login" for each shop → Save password →
  "Copy login" and send it to that shop.
  Each shop logs in with its own username, issues vouchers only for itself,
  sees only its own vouchers, and manages its own sponsors.


STEP 5: CHECK
  https://coupons.YOUR-DOMAIN/healthz    → {"ok":true}
  https://YOUR-DOMAIN/                   → mall website
  Log in as one shop, issue one voucher to your own WhatsApp number and open the link.


UPDATING LATER
  Upload + extract the new package and run the same deploy.sh command again.
  Vouchers, coupons and all logins are kept; finished steps are skipped.

OPTIONS
  --reset-password     new password for the mall admin (if it's forgotten)
  --node-version 22    pick the Node.js version (default: newest installed)
  --files-only         only copy files (skip subdomain, Node.js app, SSL)
  --coupons-host X     use another address for coupon links

TROUBLESHOOTING
  Server log:      ~/coupon-server/stderr.log  (or cPanel → Setup Node.js App)
  Restart server:  touch /home/dubaimalldranzo/coupon-server/tmp/restart.txt
  A shop forgot its password: admin → Shop logins → Reset password.
