import {
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion'
import { ChevronRight, Search, Sparkle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { festival } from '../data/festival'
import { categories, shops } from '../data/shops'
import { Snow } from './Snow'

const popular = ['Gold', 'Wedding', 'Mobile', 'Dental', 'Perfume', 'Supermarket']
const headline = ['27 shops.', 'One destination.']

function Counter({ to, label }: { to: number; label: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : 0)

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, to, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, reduce, to])

  return (
    <div>
      <span ref={ref} className="block font-display text-3xl font-semibold text-gold tabular-nums sm:text-4xl">
        {value}
      </span>
      <span className="text-sm text-ivory/70">{label}</span>
    </div>
  )
}

export function Hero({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const patternY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])

  const goToShops = (q: string) => {
    onQuery(q)
    document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section ref={ref} id="top" className="relative overflow-hidden bg-ink pt-16 text-ivory">
      <motion.div className="arch-pattern absolute inset-0 -top-[20%]" style={{ y: patternY }} aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(233_185_73/0.16),transparent_60%)]"
        aria-hidden="true"
      />
      <Snow density={45} className="opacity-70" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6"
      >
        <motion.a
          href="#festival"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-crimson py-1.5 pl-1.5 pr-3 text-sm font-semibold text-ivory shadow-lg shadow-crimson/30 transition-transform duration-200 hover:scale-[1.02]"
        >
          <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">New</span>
          {festival.name}
          <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </motion.a>
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-gold">Edakkara · Malappuram</p>

        <h1 className="max-w-3xl text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
          {headline.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-1">
              <motion.span
                className={`block ${i === 1 ? 'text-gold' : ''}`}
                initial={{ y: '105%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-xl text-lg text-ivory/80"
        >
          Jewellery, fashion, weddings, mobiles, groceries and everyday services — find the shop, then WhatsApp them
          directly.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={(e) => {
            e.preventDefault()
            goToShops(query)
          }}
          className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl bg-ivory p-2 shadow-2xl shadow-black/20"
          role="search"
        >
          <label htmlFor="hero-search" className="sr-only">
            Search shops
          </label>
          <Search className="ml-2 size-5 shrink-0 text-muted" aria-hidden="true" />
          <input
            id="hero-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Gold, saree, phone repair…"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-muted/70 focus:outline-none"
          />
          <button
            type="submit"
            className="h-12 shrink-0 cursor-pointer rounded-xl bg-ink px-5 font-bold text-ivory transition-transform duration-200 hover:bg-ink-soft active:scale-[0.97]"
          >
            Search
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-ivory/60">Popular:</span>
          {popular.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goToShops(p)}
              className="min-h-9 cursor-pointer rounded-full border border-ivory/20 px-3.5 text-sm text-ivory/85 transition-colors duration-200 hover:border-gold hover:text-gold"
            >
              {p}
            </button>
          ))}
        </motion.div>

        <div className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-ivory/15 pt-8">
          <Counter to={shops.length} label="Shops" />
          <Counter to={categories.length} label="Categories" />
          <Counter to={shops.filter((s) => s.wedding).length} label="For weddings" />
        </div>
      </motion.div>

      <Marquee />
    </section>
  )
}

const wrap = (min: number, max: number, v: number) => {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

/** Shop-name ticker that speeds up and reverses with the reader's scroll velocity. */
function Marquee() {
  const reduce = useReducedMotion()
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  const factor = useTransform(velocity, [0, 1000], [0, 4], { clamp: false })
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`)
  const direction = useRef(1)

  useAnimationFrame((_, delta) => {
    if (reduce) return
    let moveBy = direction.current * -1.2 * (delta / 1000)
    if (factor.get() < 0) direction.current = -1
    else if (factor.get() > 0) direction.current = 1
    moveBy += direction.current * Math.abs(moveBy) * Math.abs(factor.get()) * -1
    baseX.set(baseX.get() + moveBy)
  })

  const names = shops.map((s) => s.name)
  return (
    <div className="relative overflow-hidden border-t border-ivory/10 bg-ink-soft/60 py-4" aria-hidden="true">
      <motion.div className="flex w-max gap-10 whitespace-nowrap font-display text-lg text-ivory/55" style={{ x }}>
        {[...names, ...names].map((n, i) => (
          <span key={i} className="flex items-center gap-10">
            {n}
            <Sparkle className="size-3.5 text-gold/70" />
          </span>
        ))}
      </motion.div>
    </div>
  )
}
