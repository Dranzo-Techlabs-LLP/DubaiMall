import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { shops, weddingJourney, whatsappLink } from '../data/shops'
import { categoryColor, initials } from './categoryStyle'
import { Photo } from './Photo'
import { WhatsAppIcon } from './ShopCard'

const shopById = Object.fromEntries(shops.map((s) => [s.id, s]))

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function StepCard({ index, compact }: { index: number; compact?: boolean }) {
  const step = weddingJourney[index]
  return (
    <article
      className={`flex flex-col rounded-3xl border border-gold/25 bg-ink-soft/70 p-6 text-ivory backdrop-blur ${
        compact ? '' : 'h-[28rem] w-[22rem] shrink-0 lg:w-[24rem]'
      }`}
    >
      <span className="font-display text-6xl font-semibold leading-none text-gold/40 tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 className="mt-4 text-2xl font-semibold">{step.step}</h3>
      <p className="mt-1 text-ivory/70">{step.detail}</p>
      <ul className="mt-auto space-y-2 pt-6">
        {step.shopIds.map((id) => {
          const s = shopById[id]
          return (
            <li key={id} className="flex items-center gap-3 rounded-xl bg-ink/50 p-2 pr-2">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold text-white"
                style={{ backgroundColor: categoryColor[s.category] }}
              >
                {initials(s.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-ivory/60">{s.tagline}</span>
              </span>
              <a
                href={whatsappLink(s.phone, s.name)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp ${s.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-[#4ade80] transition-colors hover:bg-white/10"
              >
                <WhatsAppIcon className="size-5" />
              </a>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function BridePhoto({ className }: { className: string }) {
  return (
    <figure className={`relative overflow-hidden rounded-3xl border border-gold/30 ${className}`}>
      <Photo
        name="wedding-bride"
        alt="Bride in a red and gold silk saree wearing traditional gold jewellery"
        sizes="(min-width: 1024px) 336px, 100vw"
        className="size-full object-cover"
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-sm text-ivory/90">
        Saree, gold, makeover and photos — every piece from one mall.
      </figcaption>
    </figure>
  )
}

function Intro({ progress }: { progress?: MotionValue<number> }) {
  return (
    <div className="max-w-md">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold">Wedding one-stop</p>
      <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
        From invitation to return gift — <span className="text-gold">one mall.</span>
      </h2>
      <p className="mt-4 text-lg text-ivory/75">
        {shops.filter((s) => s.wedding).length} shops at Dubai Mall cover every step of a Kerala wedding. Plan the whole
        celebration in one visit.
      </p>
      {progress && (
        <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-ivory/15" aria-hidden="true">
          <motion.div className="h-full origin-left bg-gold" style={{ scaleX: progress }} />
        </div>
      )}
    </div>
  )
}

function HorizontalJourney() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current
      if (track) setDistance(Math.max(0, track.scrollWidth - window.innerWidth + 48))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
  const x = useTransform(smooth, [0, 1], [0, -distance])

  return (
    <section
      ref={sectionRef}
      id="wedding"
      className="relative scroll-mt-16 bg-ink"
      style={{ height: `calc(100vh + ${distance}px)` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="arch-pattern absolute inset-0 opacity-50" aria-hidden="true" />
        <motion.div ref={trackRef} style={{ x }} className="relative flex items-center gap-6 pl-6 pr-6 lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
          <div className="w-[26rem] shrink-0 pr-8 text-ivory">
            <Intro progress={smooth} />
          </div>
          <BridePhoto className="h-[28rem] w-[21rem] shrink-0" />
          {weddingJourney.map((_, i) => (
            <StepCard key={i} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function VerticalJourney() {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 70%', 'end 70%'] })
  const reduce = useReducedMotion()

  return (
    <section id="wedding" className="relative scroll-mt-16 overflow-hidden bg-ink py-20 text-ivory">
      <div className="arch-pattern absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Intro />
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10"
        >
          <BridePhoto className="aspect-[4/5] w-full max-w-md" />
        </motion.div>
        <ol ref={listRef} className="relative mt-12 space-y-6 pl-8">
          <span className="absolute bottom-0 left-[11px] top-0 w-0.5 bg-ivory/15" aria-hidden="true" />
          <motion.span
            className="absolute bottom-0 left-[11px] top-0 w-0.5 origin-top bg-gold"
            style={{ scaleY: reduce ? 1 : scrollYProgress }}
            aria-hidden="true"
          />
          {weddingJourney.map((step, i) => (
            <motion.li
              key={step.step}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <span className="absolute -left-8 top-7 grid size-6 place-items-center rounded-full border-2 border-gold bg-ink" aria-hidden="true">
                <span className="size-2 rounded-full bg-gold" />
              </span>
              <StepCard index={i} compact />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function WeddingJourney() {
  const wide = useMediaQuery('(min-width: 1024px)')
  const reduce = useReducedMotion()
  return wide && !reduce ? <HorizontalJourney /> : <VerticalJourney />
}
