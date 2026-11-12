import {
  Briefcase,
  Gem,
  Gift,
  ShoppingBasket,
  Shirt,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from '../data/shops'

export const categoryIcon: Record<CategoryId, LucideIcon> = {
  jewellery: Gem,
  fashion: Shirt,
  beauty: Sparkles,
  mobiles: Smartphone,
  daily: ShoppingBasket,
  gifts: Gift,
  services: Briefcase,
}

export const categoryColor: Record<CategoryId, string> = {
  jewellery: 'var(--color-cat-jewellery)',
  fashion: 'var(--color-cat-fashion)',
  beauty: 'var(--color-cat-beauty)',
  mobiles: 'var(--color-cat-mobiles)',
  daily: 'var(--color-cat-daily)',
  gifts: 'var(--color-cat-gifts)',
  services: 'var(--color-cat-services)',
}

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
