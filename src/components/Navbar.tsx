import { motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion'
import { useState } from 'react'

const links = [
  { href: '#shops', label: 'Shops' },
  { href: '#wedding', label: 'Weddings' },
  { href: '#festival', label: 'Christmas' },
  { href: '#visit', label: 'Visit' },
]

export function Navbar() {
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 30, restDelta: 0.001 })
  const [solid, setSolid] = useState(() => window.scrollY > 40)

  useMotionValueEvent(scrollY, 'change', (y) => setSolid(y > 40))

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        solid ? 'bg-ink/95 shadow-lg shadow-ink/10 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 text-ivory">
          <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="var(--color-ink-soft)" />
            <path d="M14 46V26l18-12 18 12v20" fill="none" stroke="var(--color-gold)" strokeWidth="4" strokeLinejoin="round" />
            <path d="M26 46V34h12v12" fill="none" stroke="var(--color-gold)" strokeWidth="4" />
          </svg>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold">Dubai Mall</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-gold">Edakkara</span>
          </span>
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-ivory/85 transition-colors duration-200 hover:bg-white/10 hover:text-ivory"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#shops"
          className="rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-ink transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
        >
          Find a shop
        </a>
      </nav>
      <motion.div
        className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-gold"
        style={{ scaleX: progress }}
        aria-hidden="true"
      />
    </header>
  )
}
