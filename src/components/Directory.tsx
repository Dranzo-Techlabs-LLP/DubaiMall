import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Search, SearchX, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { categories, shops, type CategoryId, type Shop } from '../data/shops'
import { categoryColor, categoryIcon } from './categoryStyle'
import { ShopCard } from './ShopCard'
import { RevealHeading } from './RevealHeading'
import { ShopModal } from './ShopModal'

const categoryKeywords: Record<CategoryId, string> = {
  jewellery: 'gold diamond silver ornaments necklace bangles ring jewelry',
  fashion: 'clothes dress saree churidar kurti shirt jeans boutique stitching footwear shoes chappal',
  beauty: 'makeup bridal salon hair facial attar scent',
  mobiles: 'phone smartphone repair service accessories charger',
  daily: 'grocery vegetables stationery xerox pipes tap bathroom washing ironing',
  gifts: 'present memento printing flex invitation card video album',
  services: 'tax gst audit accounts software website app teeth doctor loan chitty course',
}

const haystack = (s: Shop) =>
  [
    s.name,
    s.owner,
    s.tagline,
    categories.find((c) => c.id === s.category)?.label,
    categoryKeywords[s.category],
    s.wedding ? 'wedding bridal marriage kalyanam' : '',
  ]
    .join(' ')
    .toLowerCase()

export function Directory({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const [active, setActive] = useState<CategoryId | 'all'>('all')
  const [selected, setSelected] = useState<Shop | null>(null)

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return shops.filter(
      (s) => (active === 'all' || s.category === active) && tokens.every((t) => haystack(s).includes(t)),
    )
  }, [query, active])

  const counts = useMemo(() => {
    const map: Partial<Record<CategoryId, number>> = {}
    shops.forEach((s) => (map[s.category] = (map[s.category] ?? 0) + 1))
    return map
  }, [])

  return (
    <section id="shops" className="scroll-mt-16 bg-ivory py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-text">Shop directory</p>
            <RevealHeading text="Everything under" accent="one roof" accentClassName="text-crimson" className="mt-2 text-4xl font-semibold text-ink sm:text-5xl" />
          </div>
          <div className="relative w-full md:w-80">
            <label htmlFor="dir-search" className="sr-only">
              Filter shops
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="dir-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search shops or products"
              className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-10 text-base shadow-sm transition-shadow duration-200 placeholder:text-muted/70 focus:border-gold focus:shadow-focus-gold focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted hover:bg-sand"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </motion.div>

        <div
          className="sticky top-16 z-30 -mx-4 mt-8 overflow-x-auto bg-ivory/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
          role="tablist"
          aria-label="Categories"
        >
          <LayoutGroup id="chips">
            <div className="flex w-max gap-2">
              {[{ id: 'all' as const, label: 'All shops' }, ...categories].map((c) => {
                const isActive = active === c.id
                const Icon = c.id === 'all' ? null : categoryIcon[c.id]
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(c.id)}
                    className={`relative flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-200 ${
                      isActive ? 'text-ivory' : 'text-text hover:bg-sand'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="chip-bg"
                        className="absolute inset-0 rounded-full bg-ink"
                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                      />
                    )}
                    {Icon && (
                      <Icon className="relative size-4" style={{ color: isActive ? 'var(--color-gold)' : categoryColor[c.id as CategoryId] }} aria-hidden="true" />
                    )}
                    <span className="relative">{c.label}</span>
                    <span className={`relative text-xs tabular-nums ${isActive ? 'text-ivory/70' : 'text-muted'}`}>
                      {c.id === 'all' ? shops.length : counts[c.id]}
                    </span>
                  </button>
                )
              })}
            </div>
          </LayoutGroup>
        </div>

        <p className="mt-6 text-sm text-muted" aria-live="polite">
          Showing {results.length} of {shops.length} shops
          {query && (
            <>
              {' '}for “<span className="font-semibold text-text">{query}</span>”
            </>
          )}
        </p>

        <motion.ul layout className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {results.map((shop, i) => (
              <ShopCard key={shop.id} shop={shop} index={i} onOpen={() => setSelected(shop)} />
            ))}
          </AnimatePresence>
        </motion.ul>

        <AnimatePresence>
          {results.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center"
            >
              <SearchX className="size-10 text-muted" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold text-ink">No shop matches that yet</h3>
              <p className="mt-1 max-w-sm text-muted">Try a simpler word like “gold” or “mobile”, or browse every shop.</p>
              <button
                type="button"
                onClick={() => {
                  onQuery('')
                  setActive('all')
                }}
                className="mt-5 min-h-11 cursor-pointer rounded-full bg-ink px-5 font-bold text-ivory transition-transform duration-200 active:scale-[0.97]"
              >
                Show all shops
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{selected && <ShopModal shop={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </section>
  )
}
