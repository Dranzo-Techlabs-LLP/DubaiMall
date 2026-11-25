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
    Other cPanel servers, as root:
      AlmaLinux/Rocky: dnf install -y ea-nodejs22 ea-apache24-mod-passenger ea-apache24-mod_env
      Ubuntu:          apt-get install -y ea-nodejs22 ea-apache24-mod-passenger ea-apache24-mod-env
      (older cPanel: ea-ruby27-mod_passenger instead of ea-apache24-mod-passenger)
    Then in WHM → Feature Manager, allow "Application Manager" (passengerapps)
    for the account's feature list.


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
  "Shop logins" tab → "Create N missing logins" (each shop gets a codename
  password, e.g. tanmay-falcon27) → "Copy all" or "CSV" and send each shop its login.
  Passwords are shown once; "Set password" makes a new one for a single shop.
  Each shop logs in with its own username, issues vouchers only for itself,
  sees only its own vouchers, and manages its own sponsors.
  Access rights per shop (same tab): Issue, QR form, Sponsors, and the power
  button switches a login off completely.

STEP 4b: SHOP QR CODES
  Each shop: "My QR & code" tab → "Download poster" → print it for the counter.
  The QR opens https://coupons.YOUR-DOMAIN/s/<shop>. The customer types their
  name, WhatsApp number and bill amount; staff check the bill and type the
  6-digit shop code shown in that tab. The vouchers are made at once
  (1 per full ₹1,000, the same rule as the desk) and the customer's phone shows
  every coupon with a "Download coupons (PDF)" button. Refreshing or tapping
  twice never makes extra vouchers. The vouchers appear in the desk's Customers
  tab as "QR form (automatic)", where the shop can still Send them on WhatsApp.
  Each shop picks what its form asks in "My QR & code" → Customer form:
    Bill number             Required / Optional / Don't ask
    Vouchers by bill amount on: the form asks the amount, 1 voucher per ₹1,000
                            off (default): no amount field, 1 voucher per customer
  A shop whose "Issue" right is off gets the old way instead: the customer waits
  under "Customers from QR" and the shop releases the vouchers.
  The mall admin sees every shop's QR in the "QR codes" tab.


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
