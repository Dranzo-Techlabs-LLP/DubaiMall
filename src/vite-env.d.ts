/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Coupon server address, e.g. http://localhost:8787 — enables coupon download links. */
  readonly VITE_COUPON_API_URL?: string
  /** Must match DESK_KEY in server/.env; lets this desk upload coupons. */
  readonly VITE_COUPON_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
