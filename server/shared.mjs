// Rules shared by the voucher desk (src/vouchers) and the coupon server, so both count vouchers
// and label coupons the same way. The desk imports this file; the server ships it next to index.mjs.

/** The festival printed on every coupon. */
export const FESTIVAL = {
  name: 'Christmas & New Year Shopping Festival',
  dateLabel: '1 Dec 2026 – 4 Jan 2027',
  drawLabel: "Mega lucky draw on New Year's Eve",
}

/** One lucky-draw voucher for every full ₹1,000 on the bill. */
export const RUPEES_PER_VOUCHER = 1000

/** Most vouchers one purchase can carry. */
export const MAX_VOUCHERS = 500

/** Vouchers a bill of this many rupees earns. */
export const eligibleVouchers = (amount) =>
  Number.isFinite(amount) && amount > 0 ? Math.floor(amount / RUPEES_PER_VOUCHER) : 0
