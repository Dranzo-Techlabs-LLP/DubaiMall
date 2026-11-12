import { motion } from 'framer-motion'
import { Heart, MapPin, Phone, User, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { categories, whatsappLink, type Shop } from '../data/shops'
import { categoryColor, categoryIcon, initials } from './categoryStyle'
import { Photo } from './Photo'
import { WhatsAppIcon } from './ShopCard'

export function ShopModal({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const Icon = categoryIcon[shop.category]
  const color = categoryColor[shop.category]
  const catLabel = categories.find((c) => c.id === shop.category)?.label

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-${shop.id}`}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="relative h-48 overflow-hidden sm:h-56" style={{ backgroundColor: color }}>
          <motion.div
            className="size-full"
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Photo name={shop.id} alt={`${shop.tagline} at ${shop.name}`} sizes="448px" eager className="size-full object-cover" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 grid size-11 cursor-pointer place-items-center rounded-full bg-black/20 text-white transition-colors hover:bg-black/30"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <motion.div
            layoutId={`logo-${shop.id}`}
            className="relative z-10 -mt-10 grid size-20 place-items-center rounded-2xl border-4 border-white font-display text-2xl font-semibold text-white shadow-lg"
            style={{ backgroundColor: color }}
          >
            {initials(shop.name)}
          </motion.div>

          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color }}>
            <Icon className="size-3.5" aria-hidden="true" />
            {catLabel}
          </div>
          <motion.h3 layoutId={`name-${shop.id}`} id={`modal-${shop.id}`} className="mt-1 text-3xl font-semibold text-ink">
            {shop.name}
          </motion.h3>
          <p className="mt-1 text-lg text-muted">{shop.tagline}</p>

          <ul className="mt-5 space-y-3 text-[15px]">
            <li className="flex items-center gap-3">
              <User className="size-5 text-muted" aria-hidden="true" />
              <span>
                Run by <span className="font-semibold">{shop.owner}</span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-5 text-muted" aria-hidden="true" />
              <a href={`tel:+91${shop.phone}`} className="font-semibold tabular-nums underline-offset-4 hover:underline">
                +91 {shop.phone.slice(0, 5)} {shop.phone.slice(5)}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="size-5 text-muted" aria-hidden="true" />
              Dubai Mall, Edakkara
            </li>
            {shop.wedding && (
              <li className="flex items-center gap-3 text-gold-text">
                <Heart className="size-5" aria-hidden="true" />
                Part of the wedding one-stop
              </li>
            )}
          </ul>

          <div className="mt-6 flex gap-2">
            <a
              href={whatsappLink(shop.phone, shop.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp font-bold text-white transition-transform duration-200 hover:bg-whatsapp-hover active:scale-[0.97]"
            >
              <WhatsAppIcon className="size-5" />
              Chat on WhatsApp
            </a>
            <a
              href={`tel:+91${shop.phone}`}
              aria-label={`Call ${shop.name}`}
              className="grid min-h-12 w-14 place-items-center rounded-xl border border-line text-ink transition-colors hover:bg-sand"
            >
              <Phone className="size-5" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
