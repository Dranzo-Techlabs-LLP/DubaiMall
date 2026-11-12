import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { ArrowDown, CakeSlice, Camera, Gift, PartyPopper, Smartphone, Sparkles, Ticket, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { festival, seasonPicks, type PickIcon } from '../data/festival'
import { shops } from '../data/shops'
import { RevealHeading } from './RevealHeading'
import { Snow } from './Snow'

const ease = [0.22, 1, 0.36, 1] as const
const shopById = Object.fromEntries(shops.map((s) => [s.id, s]))
const pickIcon: Record<PickIcon, LucideIcon> = {
  gift: Gift,
  party: PartyPopper,
  cake: CakeSlice,
  phone: Smartphone,
  sparkles: Sparkles,
  camera: Camera,
}

const BULBS = 18
const bulbColors = ['var(--color-crimson)', 'var(--color-gold)', '#3fae7a', '#ffffff']

function Bulb({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const at = (i + 1) / (BULBS + 2)
  const opacity = useTransform(progress, [at - 0.04, at], [0.25, 1])
  const glow = useTransform(progress, [at - 0.04, at], [0, 1])
  const x = ((i + 0.5) / BULBS) * 100
  const y = 10 + Math.sin(((i + 0.5) / BULBS) * Math.PI) * 26
  const color = bulbColors[i % bulbColors.length]
  return (
    <g transform={`translate(${x * 12} ${y})`}>
      <rect x="-3" y="-4" width="6" height="6" rx="1" fill="#4b5578" />
      <motion.circle cy="10" r="16" fill={color} style={{ opacity: glow }} filter="url(#bulb-blur)" />
      <motion.ellipse cy="10" rx="5.5" ry="8" fill={color} style={{ opacity }} />
    </g>
  )
}

/** A string of festive bulbs that switch on one by one as the section scrolls into view. */
function StringLights() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 95%', 'start 25%'] })
  return (
    <div ref={ref} className="relative">
    <svg viewBox="0 0 1200 70" preserveAspectRatio="none" className="h-14 w-full sm:h-16" aria-hidden="true">
      <defs>
        <filter id="bulb-blur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <path
        d={`M0 8 ${Array.from({ length: 49 }, (_, k) => {
          const t = k / 48
          return `L${t * 1200} ${8 + Math.sin(t * Math.PI) * 26}`
        }).join(' ')}`}
        fill="none"
        stroke="#4b5578"
        strokeWidth="1.5"
      />
      {Array.from({ length: BULBS }, (_, i) => (
        <Bulb key={i} i={i} progress={scrollYProgress} />
      ))}
    </svg>
    </div>
  )
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const diff = Math.max(0, target.getTime() - now)
  return {
    done: diff === 0,
    parts: [
      { label: 'days', value: Math.floor(diff / 86_400_000) },
      { label: 'hrs', value: Math.floor(diff / 3_600_000) % 24 },
      { label: 'min', value: Math.floor(diff / 60_000) % 60 },
      { label: 'sec', value: Math.floor(diff / 1000) % 60 },
    ],
  }
}

function Countdown({ title, target, tone }: { title: string; target: Date; tone: 'crimson' | 'gold' }) {
  const { done, parts } = useCountdown(target)
  return (
    <div className="rounded-2xl border border-ivory/15 bg-ink-soft/70 p-4 backdrop-blur-sm sm:p-5">
      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${tone === 'crimson' ? 'text-[#ff8a9b]' : 'text-gold'}`}>
        {title}
      </p>
      {done ? (
        <p className="mt-2 font-display text-2xl font-semibold">It's here — celebrate with us</p>
      ) : (
        <div className="mt-2 grid grid-cols-4 gap-2" role="timer" aria-label={`${parts[0].value} days to ${title}`}>
          {parts.map((p) => (
            <div key={p.label} className="text-center">
              <span className="block font-display text-2xl font-semibold tabular-nums sm:text-3xl">
                {String(p.value).padStart(2, '0')}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-ivory/60">{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Coupon() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const rotate = useTransform(scrollYProgress, [0, 1], [-6, 5])
  const y = useTransform(scrollYProgress, [0, 1], [60, -60])
  return (
    <motion.div ref={ref} style={{ rotate, y }} className="relative mx-auto w-[calc(100%-1.5rem)] max-w-sm">
      <div className="relative overflow-hidden rounded-3xl bg-crimson p-8 text-ivory shadow-2xl shadow-black/40">
        <div className="arch-pattern absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <Ticket className="size-10 text-gold" aria-hidden="true" />
            <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-ink">2026 → 2027</span>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gold">Lucky draw coupon</p>
          <p className="mt-2 font-display text-4xl font-semibold leading-tight">Christmas &amp; New Year</p>
          <p className="font-display text-xl text-ivory/80">Dubai Mall Shopping Festival</p>
          <div className="my-6 border-t border-dashed border-ivory/40" />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-ivory/70">Valid at</p>
              <p className="font-semibold">All {shops.length} shops</p>
            </div>
            <p className="font-display text-3xl font-semibold tabular-nums text-gold">No. 1225</p>
          </div>
        </div>
      </div>
      <div className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-ink" aria-hidden="true" />
      <div className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-ink" aria-hidden="true" />
    </motion.div>
  )
}

function SeasonPicks({ onShop }: { onShop: (name: string) => void }) {
  return (
    <section id="season" className="scroll-mt-16 bg-ivory py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-crimson">Your season shopping list</p>
        <RevealHeading
          text="Everything for Christmas and"
          accent="the new year"
          accentClassName="text-crimson"
          className="mt-2 max-w-2xl text-4xl font-semibold text-ink sm:text-5xl"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seasonPicks.map((pick, i) => {
            const Icon = pickIcon[pick.icon]
            return (
              <motion.li
                key={pick.title}
                initial={{ opacity: 0, y: 40, rotate: i % 2 ? 2 : -2 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease }}
                className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-lift"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-crimson-soft text-crimson">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-xl font-semibold text-ink">{pick.title}</h3>
                <p className="mt-1 text-muted">{pick.detail}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {pick.shopIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onShop(shopById[id].name)}
                      className="min-h-9 cursor-pointer rounded-full border border-line px-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-gold hover:bg-gold-soft"
                    >
                      {shopById[id].name}
                    </button>
                  ))}
                </div>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

const sparks = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2)
const bursts = [
  { left: '18%', top: '28%', color: 'var(--color-gold)', delay: 0 },
  { left: '80%', top: '22%', color: 'var(--color-crimson)', delay: 0.5 },
  { left: '62%', top: '70%', color: '#ffffff', delay: 1 },
  { left: '30%', top: '76%', color: 'var(--color-gold)', delay: 1.4 },
]

function Fireworks({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {bursts.map((b, bi) => (
        <div key={bi} className="absolute" style={{ left: b.left, top: b.top }}>
          {sparks.map((angle, si) => (
            <motion.span
              key={si}
              className="absolute size-2 rounded-full"
              style={{ backgroundColor: b.color, boxShadow: `0 0 10px ${b.color}` }}
              initial={false}
              animate={
                active
                  ? { x: [0, Math.cos(angle) * 90], y: [0, Math.sin(angle) * 90 + 20], opacity: [1, 0], scale: [1, 0.4] }
                  : { x: 0, y: 0, opacity: 0, scale: 1 }
              }
              transition={
                active
                  ? { duration: 1.3, delay: b.delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.6 }
                  : { duration: 0.2 }
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Sticky scroll scene: the year rolls from 2026 to 2027, then fireworks go off. */
function YearRoll() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 })
  const digitY = useTransform(p, [0.25, 0.6], ['0%', '-50%'])
  const scale = useTransform(p, [0, 0.6, 1], [0.85, 1.05, 1])
  const glow = useTransform(p, [0.4, 0.8], [0.15, 0.55])
  const byeOpacity = useTransform(p, [0.15, 0.35], [1, 0])
  const helloOpacity = useTransform(p, [0.5, 0.7], [0, 1])
  const helloY = useTransform(p, [0.5, 0.7], [20, 0])
  const [active, setActive] = useState(false)
  useMotionValueEvent(p, 'change', (v) => setActive(v > 0.6))

  return (
    <section ref={ref} className="relative h-[260vh] bg-ink text-ivory" aria-label="Countdown to 2027">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-gold),transparent_55%)]"
          style={{ opacity: glow }}
          aria-hidden="true"
        />
        <Snow density={40} />
        <Fireworks active={active} />

        <div className="relative grid h-8 place-items-center">
          <motion.p style={{ opacity: byeOpacity }} className="col-start-1 row-start-1 text-sm font-bold uppercase tracking-[0.2em] text-ivory/70">
            Goodbye 2026
          </motion.p>
          <motion.p
            style={{ opacity: helloOpacity, y: helloY }}
            className="col-start-1 row-start-1 text-sm font-bold uppercase tracking-[0.2em] text-gold"
          >
            Hello 2027
          </motion.p>
        </div>

        <motion.p
          style={{ scale }}
          className="relative mt-2 flex font-display text-[28vw] font-semibold leading-none tabular-nums sm:text-[18rem]"
          aria-label="2027"
        >
          <span aria-hidden="true">202</span>
          <span className="relative inline-block h-[1em] overflow-hidden" aria-hidden="true">
            <motion.span className="flex flex-col" style={{ y: digitY }}>
              <span className="h-[1em]">6</span>
              <span className="h-[1em] text-gold">7</span>
            </motion.span>
          </span>
        </motion.p>

        <motion.div style={{ opacity: helloOpacity, y: helloY }} className="relative mt-6 max-w-md">
          <p className="font-display text-2xl font-semibold sm:text-3xl">{festival.drawLabel}</p>
          <p className="mt-2 text-ivory/75">
            Every purchase during the festival gets you a coupon. Shop at any of the {shops.length} shops — prizes
            announced soon.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

export function Festival({ onShop }: { onShop: (name: string) => void }) {
  return (
    <>
      <section id="festival" className="relative scroll-mt-16 overflow-hidden bg-ink pb-24 text-ivory sm:pb-32">
        <Snow />
        <StringLights />
        <div className="relative mx-auto mt-10 grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-gold"
            >
              {festival.dateLabel}
            </motion.p>
            <RevealHeading
              text="Christmas & New Year"
              accent="Shopping Festival"
              className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl"
            />
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className="mt-5 max-w-lg text-lg text-ivory/80"
            >
              Five weeks of festive shopping across all {shops.length} shops — gifts, party wear, cakes, new phones and
              makeovers. One lucky-draw coupon with every purchase.
            </motion.p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Countdown title="Christmas" target={festival.christmas} tone="crimson" />
              <Countdown title="New Year" target={festival.newYear} tone="gold" />
            </div>
            <a
              href="#season"
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 font-bold text-ink transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
            >
              See what to shop
              <ArrowDown className="size-5" aria-hidden="true" />
            </a>
          </div>
          <Coupon />
        </div>
      </section>
      <SeasonPicks onShop={onShop} />
      <YearRoll />
    </>
  )
}
