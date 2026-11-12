import { motion } from 'framer-motion'
import { Clock, MapPin, Store } from 'lucide-react'
import { categories, shops } from '../data/shops'
import { categoryColor, categoryIcon } from './categoryStyle'
import { Photo } from './Photo'
import { RevealHeading } from './RevealHeading'

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

export function CategoryShowcase() {
  return (
    <section className="bg-sand py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-text">What you'll find</p>
          <RevealHeading text="Seven reasons to" accent="visit" accentClassName="text-crimson" className="mt-2 text-4xl font-semibold text-ink sm:text-5xl" />
        </motion.div>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c, i) => {
            const Icon = categoryIcon[c.id]
            const count = shops.filter((s) => s.category === c.id).length
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={i === 0 ? 'col-span-2 lg:col-span-1 lg:row-span-2' : ''}
              >
                <a
                  href="#shops"
                  className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-ink p-5 text-white transition-shadow duration-300 hover:shadow-lift ${
                    i === 0 ? 'min-h-64 lg:min-h-full' : 'min-h-56'
                  }`}
                >
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 1.18 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Photo
                      name={`cat-${c.id}`}
                      alt=""
                      sizes={i === 0 ? '(min-width: 1024px) 280px, 100vw' : '(min-width: 1024px) 280px, 50vw'}
                      className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  </motion.div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" aria-hidden="true" />
                  <span
                    className="absolute left-4 top-4 grid size-10 place-items-center rounded-xl text-white shadow-md"
                    style={{ backgroundColor: categoryColor[c.id] }}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="relative">
                    <h3 className="text-xl font-semibold sm:text-2xl">{c.label}</h3>
                    <p className="mt-0.5 text-sm text-white/80">{c.blurb}</p>
                    <span className="mt-3 inline-block rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-ink">
                      {count} {count === 1 ? 'shop' : 'shops'}
                    </span>
                  </div>
                </a>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function Visit() {
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Dubai+Mall+Edakkara'
  const items = [
    { Icon: MapPin, title: 'Where', text: 'Dubai Mall, Edakkara, Malappuram, Kerala' },
    { Icon: Clock, title: 'Timings', text: 'Timings vary by shop — WhatsApp them before you visit' },
    { Icon: Store, title: 'Own a shop here?', text: 'Talk to the Dubai Mall merchants association to get listed' },
  ]
  return (
    <section id="visit" className="scroll-mt-16 bg-sand py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...reveal} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-text">Plan your visit</p>
            <RevealHeading text="See you at" accent="the mall" accentClassName="text-crimson" className="mt-2 text-4xl font-semibold text-ink sm:text-5xl" />
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-gold px-6 font-bold text-ink transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
          >
            <MapPin className="size-5" aria-hidden="true" />
            Open in Google Maps
          </a>
        </motion.div>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map(({ Icon, title, text }, i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-white p-6"
            >
              <Icon className="size-6 text-gold-text" aria-hidden="true" />
              <h3 className="mt-3 text-xl font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-muted">{text}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-ink py-10 text-ivory/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display text-base text-ivory">Dubai Mall</span> · Edakkara
        </p>
        <p>Built by Dranzo for the Dubai Mall merchants · Placeholder photos from Unsplash</p>
      </div>
    </footer>
  )
}
