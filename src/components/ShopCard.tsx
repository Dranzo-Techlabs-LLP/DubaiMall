import { motion } from 'framer-motion'
import { Heart, Phone } from 'lucide-react'
import { forwardRef } from 'react'
import { categories, whatsappLink, type Shop } from '../data/shops'
import { categoryColor, categoryIcon, initials } from './categoryStyle'
import { Photo } from './Photo'

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.81-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.45 9.45 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.23-4.25 9.45-9.48 9.45zm8.06-17.52A11.32 11.32 0 0 0 12.04.65C5.76.65.65 5.75.65 12.03c0 2 .52 3.96 1.52 5.69L.55 23.6l6.02-1.58a11.36 11.36 0 0 0 5.46 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.05z" />
    </svg>
  )
}

interface Props {
  shop: Shop
  index: number
  onOpen: () => void
}

export const ShopCard = forwardRef<HTMLLIElement, Props>(function ShopCard({ shop, index, onOpen }, ref) {
  const Icon = categoryIcon[shop.category]
  const color = categoryColor[shop.category]
  const catLabel = categories.find((c) => c.id === shop.category)?.label

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow duration-300 hover:shadow-lift"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col text-left"
        aria-label={`View ${shop.name} details`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-sand">
          <Photo
            name={shop.id}
            alt={`${shop.tagline} at ${shop.name}`}
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" aria-hidden="true" />
        </div>
        <div className="flex items-start gap-4 p-5">
        <motion.div
          layoutId={`logo-${shop.id}`}
          className="relative z-10 -mt-12 grid size-14 shrink-0 place-items-center rounded-xl border-[3px] border-white font-display text-lg font-semibold text-white shadow-md"
          style={{ backgroundColor: color }}
        >
          {initials(shop.name)}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color }}>
            <Icon className="size-3.5" aria-hidden="true" />
            {catLabel}
            {shop.wedding && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] normal-case tracking-normal text-gold-text">
                <Heart className="size-3" aria-hidden="true" />
                Wedding
              </span>
            )}
          </div>
          <motion.h3 layoutId={`name-${shop.id}`} className="mt-1.5 text-xl font-semibold leading-snug text-ink">
            {shop.name}
          </motion.h3>
          <p className="mt-0.5 text-[15px] text-muted">{shop.tagline}</p>
        </div>
        </div>
      </button>

      <div className="flex gap-2 border-t border-line px-5 py-3">
        <a
          href={whatsappLink(shop.phone, shop.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-3 text-sm font-bold text-white transition-transform duration-200 hover:bg-whatsapp-hover active:scale-[0.97]"
        >
          <WhatsAppIcon className="size-[18px]" />
          WhatsApp
        </a>
        <a
          href={`tel:+91${shop.phone}`}
          aria-label={`Call ${shop.name}`}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink transition-colors duration-200 hover:bg-sand active:scale-[0.97]"
        >
          <Phone className="size-4" aria-hidden="true" />
          Call
        </a>
      </div>
    </motion.li>
  )
})
