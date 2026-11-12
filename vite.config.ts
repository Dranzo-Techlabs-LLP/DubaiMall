import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // The coupon server (npm run server) writes its database here on every coupon;
      // without this, each save would reload the voucher desk mid-send.
      ignored: ['**/server/**'],
    },
  },
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        vouchers: 'vouchers.html',
      },
    },
  },
})
