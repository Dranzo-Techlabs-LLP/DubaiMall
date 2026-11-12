import { MotionConfig } from 'framer-motion'
import { useState } from 'react'
import { Directory } from './components/Directory'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { BackToTop } from './components/BackToTop'
import { Festival } from './components/Festival'
import { CategoryShowcase, Footer, Visit } from './components/Sections'
import { WeddingJourney } from './components/WeddingJourney'

export default function App() {
  const [query, setQuery] = useState('')
  const showShop = (name: string) => {
    setQuery(name)
    document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#shops"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
      >
        Skip to shops
      </a>
      <Navbar />
      <main>
        <Hero query={query} onQuery={setQuery} />
        <CategoryShowcase />
        <Festival onShop={showShop} />
        <Directory query={query} onQuery={setQuery} />
        <WeddingJourney />
        <Visit />
      </main>
      <Footer />
      <BackToTop />
    </MotionConfig>
  )
}
