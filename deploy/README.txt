DUBAI MALL EDAKKARA: DEPLOY PACKAGE FOR cPANEL
==============================================

What's inside
  site/            the mall website + voucher desk (vouchers.html), built and ready
  coupon-server/   the coupon link server (Node.js, no dependencies)
  deploy.sh        puts everything in place in the cPanel account

Where things end up (account dubaimalldranzo)
  /home/dubaimalldranzo/public_html/      website + voucher desk (desk is password-protected)
  /home/dubaimalldranzo/coupon-server/    coupon server; saved coupons in coupon-server/data/
  /home/dubaimalldranzo/.htpasswds/       the desk login
  /home/dubaimalldranzo/backups/          a backup of public_html, taken before each deploy

1. UPLOAD
   cPanel → File Manager → open /home/dubaimalldranzo
   Upload dubai-mall-deploy.tar.gz, then right-click it → Extract (into /home/dubaimalldranzo).
   You now have the folder /home/dubaimalldranzo/dubai-mall-deploy

2. RUN THE SCRIPT  (WHM → Terminal)
   cd /home/dubaimalldranzo/dubai-mall-deploy
   bash deploy.sh --user dubaimalldranzo --domain YOUR-DOMAIN.com

   It asks for a username and password for the voucher desk (for the staff).

3. FIRST TIME ONLY, in cPanel (the script prints these with your domain filled in)
   a) Domains → Create A New Domain → coupons.YOUR-DOMAIN.com
      (untick "Share document root")
   b) Setup Node.js App → Create Application
        Node.js version:   newest offered
        Application mode:  Production
        Application root:  coupon-server
        Application URL:   coupons.YOUR-DOMAIN.com
        Startup file:      app.js
      → Create → Start
   c) SSL/TLS Status → Run AutoSSL

4. CHECK
   https://coupons.YOUR-DOMAIN.com/healthz    → {"ok":true}
   https://YOUR-DOMAIN.com/                   → mall website
   https://YOUR-DOMAIN.com/vouchers.html      → asks for the desk login, then the desk
   Issue one voucher to your own WhatsApp number and open the link on your phone.

UPDATING LATER
   Upload + extract the new package and run the same deploy.sh command again.
   The desk key, saved coupons and desk login are kept.
   Options:  --reset-password  (new desk login)   --reset-key  (new desk key)
