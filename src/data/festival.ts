// Festival dates confirmed 28 Oct 2026. Lucky-draw prizes still to be announced.
export const festival = {
  name: 'Christmas & New Year Shopping Festival',
  start: new Date('2026-12-01T10:00:00+05:30'),
  end: new Date('2027-01-04T22:00:00+05:30'),
  dateLabel: '1 Dec 2026 – 4 Jan 2027',
  christmas: new Date('2026-12-25T00:00:00+05:30'),
  newYear: new Date('2027-01-01T00:00:00+05:30'),
  drawLabel: "Mega lucky draw on New Year's Eve",
}

export type PickIcon = 'gift' | 'party' | 'cake' | 'phone' | 'sparkles' | 'camera'

/** Seasonal shopping ideas — each links to shops that already sell these things. */
export const seasonPicks: { title: string; detail: string; icon: PickIcon; shopIds: string[] }[] = [
  { title: 'Christmas gifts', detail: 'Gift hampers, mementos and personalised prints', icon: 'gift', shopIds: ['uniqgift', 'aura', 'oswa'] },
  { title: 'Party wear', detail: 'Outfits and footwear for carols, parties and New Year night', icon: 'party', shopIds: ['plazi', 'kunuk', 'man-street', 'error-44', 'shoe-planet'] },
  { title: 'Cakes and festive groceries', detail: 'Everything for the Christmas table', icon: 'cake', shopIds: ['carrefresh'] },
  { title: 'New phone for the new year', detail: 'Upgrade, exchange or repair before 2027', icon: 'phone', shopIds: ['classic-shopee', 'ideal-mobiles'] },
  { title: 'Party makeover', detail: 'Hair, makeup and a little sparkle', icon: 'sparkles', shopIds: ['highness', 'kajal', 'doniya-silver'] },
  { title: 'Family photos', detail: 'Christmas and New Year portraits', icon: 'camera', shopIds: ['meow'] },
]
