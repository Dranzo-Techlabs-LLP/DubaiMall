// Startup file for cPanel's "Setup Node.js App" (Phusion Passenger).
// Passenger needs app.js (CommonJS here: server/package.json has no "type"), so this hands over to the ES-module server.
import('./index.mjs').catch((err) => {
  console.error(err)
  process.exit(1)
})
