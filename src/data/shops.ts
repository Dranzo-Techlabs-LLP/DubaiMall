export type CategoryId =
  | 'jewellery'
  | 'fashion'
  | 'beauty'
  | 'mobiles'
  | 'daily'
  | 'gifts'
  | 'services'

export interface Category {
  id: CategoryId
  label: string
  blurb: string
}

export interface Shop {
  id: string
  name: string
  owner: string
  category: CategoryId
  tagline: string
  phone: string
  /** Name or number was hard to read on the handwritten sheet — confirm before going live. */
  verify?: boolean
  /** Part of the "Wedding under one roof" journey. */
  wedding?: boolean
}

export const categories: Category[] = [
  { id: 'jewellery', label: 'Jewellery', blurb: 'Gold, diamond, silver and fancy' },
  { id: 'fashion', label: 'Fashion', blurb: 'Men, women, footwear and tailoring' },
  { id: 'beauty', label: 'Beauty & fragrance', blurb: 'Salon and perfumes' },
  { id: 'mobiles', label: 'Mobiles', blurb: 'Sales, service and wholesale' },
  { id: 'daily', label: 'Daily needs', blurb: 'Groceries, books, hardware, laundry' },
  { id: 'gifts', label: 'Gifts & events', blurb: 'Gifts, printing and photography' },
  { id: 'services', label: 'Services', blurb: 'Finance, health, IT and training' },
]

export const shops: Shop[] = [
  { id: 'tanmay', name: 'Tanmay', owner: 'Noushad M', category: 'jewellery', tagline: 'Gold and diamond jewellery', phone: '7994943535', wedding: true },
  { id: 'kajal', name: 'Kajal', owner: 'Shadil', category: 'jewellery', tagline: 'Fancy jewellery', phone: '8089377105', verify: true, wedding: true },
  { id: 'doniya-silver', name: 'Doniya Silver', owner: 'Vinod E', category: 'jewellery', tagline: 'Silver jewellery', phone: '8589299971', verify: true, wedding: true },

  { id: 'man-street', name: 'Man Street', owner: 'Fayis K', category: 'fashion', tagline: "Men's clothing", phone: '9745704563', wedding: true },
  { id: 'error-44', name: 'Error 44', owner: 'Raji', category: 'fashion', tagline: "Men's wear", phone: '9539866044' },
  { id: 'plazi', name: 'Plazi Boutique', owner: 'Abdu Ssalih P', category: 'fashion', tagline: "Women's boutique", phone: '9745660980', wedding: true },
  { id: 'kunuk', name: 'Kunuk', owner: 'Sibi P. George', category: 'fashion', tagline: "Women's wear", phone: '9447591111', verify: true },
  { id: 'shoe-planet', name: 'Shoe Planet', owner: 'Saleem', category: 'fashion', tagline: 'Footwear for the whole family', phone: '7736627876', wedding: true },
  { id: 'tailor', name: 'Sunil Tailor', owner: 'Sunil', category: 'fashion', tagline: 'Stitching and alterations', phone: '9447882322', wedding: true },
  { id: 'zool', name: 'Zool Wedding', owner: 'Rahma', category: 'fashion', tagline: 'Wedding ornaments and dresses on rent', phone: '7306221213', wedding: true },

  { id: 'highness', name: 'Highness Beauty Parlour', owner: 'Jibi Mathew', category: 'beauty', tagline: 'Unisex beauty parlour', phone: '9447681115', wedding: true },
  { id: 'oswa', name: 'OSWA Perfume', owner: 'Moideenkutty', category: 'beauty', tagline: 'Perfumes and attars', phone: '9207569322', wedding: true },

  { id: 'classic-shopee', name: 'Classic Shopee', owner: 'Fathoos', category: 'mobiles', tagline: 'Mobile wholesale and retail', phone: '9443999280', verify: true },
  { id: 'ideal-mobiles', name: 'Ideal Mobiles', owner: 'Althaf MK', category: 'mobiles', tagline: 'Mobile sales and service', phone: '8606829733' },

  { id: 'carrefresh', name: 'Carrefresh', owner: 'Abdulsamad', category: 'daily', tagline: 'Supermarket', phone: '7902980607' },
  { id: 'praise', name: 'Praise Book Stall', owner: 'George Thomas', category: 'daily', tagline: 'Books, stationery and photocopy', phone: '8547133928' },
  { id: 'plumber-world', name: 'Plumber World', owner: 'Firos E', category: 'daily', tagline: 'Plumbing hardware and sanitary', phone: '9645039208' },
  { id: 'shinex', name: 'Shinex Laundry', owner: 'Leela Bijan', category: 'daily', tagline: 'Laundry and dry cleaning', phone: '7561098990', verify: true },

  { id: 'uniqgift', name: 'UNIQGIFT', owner: 'Sathar', category: 'gifts', tagline: 'Gift shop', phone: '9846638870', wedding: true },
  { id: 'aura', name: 'Aura Design & Print', owner: 'Anjalos P.S', category: 'gifts', tagline: 'Digital printing, mementos and gifts', phone: '8281236836', wedding: true },
  { id: 'meow', name: 'Meow Photography', owner: 'Risal', category: 'gifts', tagline: 'Photography and videography', phone: '9446536843', verify: true, wedding: true },

  { id: 'ca', name: 'CA Sirajudheen P', owner: 'Sirajudheen P', category: 'services', tagline: 'Chartered accountants', phone: '8547738979' },
  { id: 'dranzo', name: 'Dranzo', owner: 'Shimil', category: 'services', tagline: 'IT software and solutions', phone: '8903459123' },
  { id: 'dr-jobs', name: "Dr. Job's Dental Care", owner: 'Dr. Job Abraham', category: 'services', tagline: 'Dental clinic', phone: '9847891307' },
  { id: 'gcc', name: 'GCC Gold Loan', owner: 'Nithya', category: 'services', tagline: 'Gold loan and chits', phone: '9747927498' },
  { id: 'abc', name: 'ABC Training Academy', owner: 'Shifana', category: 'services', tagline: 'Montessori, fashion and other courses', phone: '9539229500' },
  { id: 'cfh', name: 'C.F.H', owner: 'Hamza', category: 'services', tagline: 'Category to be confirmed', phone: '8547338203', verify: true },
]

/** Ordered steps for the wedding journey section. */
export const weddingJourney: { step: string; detail: string; shopIds: string[] }[] = [
  { step: 'Invitations', detail: 'Cards, save-the-dates and mementos', shopIds: ['aura'] },
  { step: 'Gold and jewellery', detail: 'Bridal gold, silver and fancy sets', shopIds: ['tanmay', 'doniya-silver', 'kajal'] },
  { step: 'Bridal and groom wear', detail: 'Boutique, menswear, rentals and stitching', shopIds: ['plazi', 'man-street', 'zool', 'tailor'] },
  { step: 'Footwear and fragrance', detail: 'The finishing touches', shopIds: ['shoe-planet', 'oswa'] },
  { step: 'Bridal makeover', detail: 'Makeup and grooming for the family', shopIds: ['highness'] },
  { step: 'Photography', detail: 'Save the date to the reception', shopIds: ['meow'] },
  { step: 'Return gifts', detail: 'Gifts for every guest', shopIds: ['uniqgift'] },
]

export const whatsappLink = (phone: string, shopName: string) =>
  `https://wa.me/91${phone}?text=${encodeURIComponent(`Hi, I found ${shopName} on the Dubai Mall Edakkara website.`)}`
