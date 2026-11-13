/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Voucher desk server address for local development, e.g. http://localhost:8787. */
  readonly VITE_COUPON_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
