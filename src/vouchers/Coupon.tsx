import { Ticket } from 'lucide-react'
import { festival } from '../data/festival'
import type { Sponsor } from './data'

/** How many placeholder codes the live preview draws before collapsing the rest into "+N more". */
const PREVIEW_CODES = 6

/**
 * The lucky-draw coupon as a ticket: dark body with the voucher codes, a perforated edge,
 * and a gold stub. Sponsors sit directly on the coupon's navy background.
 * One coupon covers a whole purchase, so the customer gets a single image with all their codes.
 */
export function Coupon({
  codes,
  count = 1,
  customerName,
  shopLabel,
  sponsors,
}: {
  /** The real codes. Omit for the live preview, which shows `count` placeholder codes. */
  codes?: string[]
  count?: number
  customerName?: string
  shopLabel?: string
  sponsors: Sponsor[]
}) {
  const total = codes?.length ?? Math.max(1, count)
  const shown = codes ?? Array.from({ length: Math.min(total, PREVIEW_CODES) }, () => '')
  const hidden = total - shown.length

  return (
    <article className="relative flex overflow-hidden rounded-2xl bg-ink text-white shadow-lift">
      <div className="arch-pattern min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Dubai Mall Edakkara</p>
            <p className="mt-0.5 font-display text-[15px] font-semibold leading-snug">{festival.name}</p>
          </div>
          {total > 1 && (
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-white/85">
              {total} vouchers
            </span>
          )}
        </div>

        {total === 1 ? (
          <div className="mt-3.5 inline-flex rounded-lg border border-gold/45 bg-gold/10 px-3 py-1.5">
            <span className={`font-mono text-xl font-bold tracking-[0.14em] ${shown[0] ? 'text-gold' : 'text-gold/50'}`}>
              {shown[0] || 'DME-XXXXXX'}
            </span>
          </div>
        ) : (
          <ul className="mt-3.5 flex flex-wrap gap-2" aria-label="Voucher codes">
            {shown.map((c, i) => (
              <li
                key={c || i}
                className={`rounded-md border border-gold/45 bg-gold/10 px-2 py-1 font-mono text-sm font-bold tracking-[0.1em] ${
                  c ? 'text-gold' : 'text-gold/50'
                }`}
              >
                {c || 'DME-XXXXXX'}
              </li>
            ))}
            {hidden > 0 && (
              <li className="rounded-md border border-dashed border-gold/40 px-2 py-1 text-sm font-bold text-gold/70">
                +{hidden} more
              </li>
            )}
          </ul>
        )}

        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="min-w-0">
            <dt className="text-white/60">Issued to</dt>
            <dd className="truncate font-semibold">{customerName || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-white/60">Shop</dt>
            <dd className="truncate font-semibold">{shopLabel || '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-white/60">Valid</dt>
            <dd className="font-semibold">
              {festival.dateLabel} · {festival.drawLabel}
            </dd>
          </div>
        </dl>

        {sponsors.length > 0 && (
          <div className="mt-4 border-t border-white/15 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Sponsored by</p>
            <ul className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-3">
              {sponsors.map((s) => (
                <li key={s.id} className="flex w-28 flex-col items-center gap-1 text-center">
                  {/* Each logo keeps its own shape: wide, square or tall. */}
                  <img src={s.image} alt="" className="h-14 w-auto max-w-28 rounded-md object-contain" />
                  <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white/90" title={s.name}>
                    {s.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Perforated tear line with punched notches (notch colour = the card behind the coupon). */}
      <div aria-hidden className="relative border-l-2 border-dashed border-white/30">
        <span className="absolute -left-[9px] -top-2 size-4 rounded-full bg-white" />
        <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full bg-white" />
      </div>

      <div className="flex w-14 shrink-0 flex-col items-center justify-between gap-3 bg-gradient-to-b from-gold to-[#cf9a2e] py-4 text-ink sm:w-16">
        <Ticket className="size-5" aria-hidden />
        <span className="rotate-180 text-xs font-extrabold uppercase tracking-[0.22em] [writing-mode:vertical-rl]">
          Lucky draw
        </span>
        <span className="size-5" aria-hidden />
      </div>
    </article>
  )
}
