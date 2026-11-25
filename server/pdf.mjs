// A printable PDF of lucky-draw coupons: one ticket per voucher code, three to an A4 page.
// No libraries: PDF's built-in fonts (Helvetica, Courier) and plain shapes draw the same
// navy-and-gold ticket as the desk's coupon image.

const PAGE_W = 595.28 // A4 in points
const PAGE_H = 841.89
const MARGIN = 40
const TICKET_W = PAGE_W - 2 * MARGIN
const TICKET_H = 222
const GAP = 24
const STUB_W = 78
const PER_PAGE = 3

const NAVY = [14, 24, 56]
const NAVY_SOFT = [30, 42, 82]
const GOLD = [233, 185, 73]
const WHITE = [255, 255, 255]
const MUTED = [176, 184, 206]
const INK_GREY = [86, 93, 115]

// The built-in fonts only cover Western European letters (WinAnsi). Others, such as Malayalam,
// are left out of the PDF; the coupon page on screen still shows them.
const WIN_ANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 }
function pdfString(s) {
  let out = ''
  for (const ch of String(s).replace(/₹\s?/g, 'Rs. ')) {
    const c = ch.codePointAt(0)
    const b = WIN_ANSI[ch] ?? ((c >= 32 && c < 127) || (c >= 160 && c < 256) ? c : null)
    if (b === null) continue
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`
    else out += b < 128 ? String.fromCharCode(b) : `\\${b.toString(8).padStart(3, '0')}`
  }
  return out.replace(/\s+/g, ' ').trim()
}
const printable = (s) => pdfString(s).replace(/\\(\d{3}|.)/g, 'x') // one char per glyph, for measuring

// Helvetica advance widths (per 1000 em) for ASCII 32–126; bold is ~7% wider.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
const widthOf = (s, size, font) => {
  if (font === 'F3') return printable(s).length * 0.6 * size // Courier is monospaced
  let w = 0
  for (const ch of printable(s)) w += HELV[ch.charCodeAt(0) - 32] ?? 556
  return (w / 1000) * size * (font === 'F2' ? 1.07 : 1)
}
/** Shortens text with "..." so it fits the width. */
function fit(s, size, font, max) {
  let t = String(s)
  if (widthOf(t, size, font) <= max) return t
  while (t.length > 1 && widthOf(`${t}...`, size, font) > max) t = t.slice(0, -1)
  return `${t.trimEnd()}...`
}

const rgb = (c) => c.map((v) => (v / 255).toFixed(3)).join(' ')
const n = (v) => Number(v.toFixed(2))

class Canvas {
  ops = []
  fill(color, x, y, w, h) {
    this.ops.push(`${rgb(color)} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`)
  }
  stroke(color, x, y, w, h, width = 1, dash = '') {
    this.ops.push(`${rgb(color)} RG ${width} w ${dash ? `[${dash}] 0 d` : '[] 0 d'} ${n(x)} ${n(y)} ${n(w)} ${n(h)} re S`)
  }
  line(color, x1, y1, x2, y2, width = 1, dash = '') {
    this.ops.push(`${rgb(color)} RG ${width} w ${dash ? `[${dash}] 0 d` : '[] 0 d'} ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`)
  }
  circle(color, cx, cy, r) {
    const k = r * 0.5523 // Bézier approximation of a circle
    this.ops.push(
      `${rgb(color)} rg ${n(cx + r)} ${n(cy)} m ${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c ` +
        `${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c ${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c ` +
        `${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c f`,
    )
  }
  /** Text at (x, y) baseline. align: left | right | center. spacing = extra points between letters. */
  text(s, x, y, { font = 'F1', size = 10, color = WHITE, align = 'left', spacing = 0 } = {}) {
    const str = pdfString(s)
    if (!str) return
    const w = widthOf(s, size, font) + spacing * Math.max(0, printable(s).length - 1)
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
    this.ops.push(`BT /${font} ${size} Tf ${spacing} Tc ${rgb(color)} rg ${n(left)} ${n(y)} Td (${str}) Tj ET`)
  }
  /** Text turned to read bottom-to-top, centred on (cx, cy). */
  textUp(s, cx, cy, { font = 'F2', size = 12, color = NAVY, spacing = 0 } = {}) {
    const w = widthOf(s, size, font) + spacing * Math.max(0, printable(s).length - 1)
    this.ops.push(`BT /${font} ${size} Tf ${spacing} Tc ${rgb(color)} rg 0 1 -1 0 ${n(cx + size * 0.35)} ${n(cy - w / 2)} Tm (${pdfString(s)}) Tj ET`)
  }
}

/** One ticket with its top-left corner at (x, top). */
function drawTicket(cv, x, top, t) {
  const y = top - TICKET_H
  const bodyW = TICKET_W - STUB_W
  const pad = 22
  const L = x + pad
  cv.fill(NAVY, x, y, bodyW, TICKET_H)
  cv.fill(GOLD, x + bodyW, y, STUB_W, TICKET_H)
  // Perforated tear line with punched notches.
  cv.line(WHITE, x + bodyW, y + 8, x + bodyW, top - 8, 1.2, '4 4')
  cv.circle(WHITE, x + bodyW, top, 8)
  cv.circle(WHITE, x + bodyW, y, 8)

  cv.text('DUBAI MALL EDAKKARA', L, top - 30, { font: 'F2', size: 9, color: GOLD, spacing: 1.6 })
  cv.text(`Voucher ${t.index} of ${t.total}`, x + bodyW - pad, top - 30, { font: 'F2', size: 9, color: MUTED, align: 'right' })
  cv.text(fit(t.festival, 15, 'F2', bodyW - 2 * pad), L, top - 50, { font: 'F2', size: 15 })

  // The voucher code in a gold-edged box.
  const codeSize = 26
  const boxW = widthOf(t.code, codeSize, 'F3') + 28
  cv.fill(NAVY_SOFT, L, top - 112, boxW, 44)
  cv.stroke(GOLD, L, top - 112, boxW, 44, 1.2)
  cv.text(t.code, L + 14, top - 99, { font: 'F3', size: codeSize, color: GOLD })

  const col2 = L + (bodyW - 2 * pad) / 2 + 8
  const colW = (bodyW - 2 * pad) / 2 - 12
  cv.text('ISSUED TO', L, top - 136, { font: 'F2', size: 7.5, color: MUTED, spacing: 1 })
  cv.text(fit(t.customer || '-', 12, 'F2', colW), L, top - 151, { font: 'F2', size: 12 })
  cv.text('SHOP', col2, top - 136, { font: 'F2', size: 7.5, color: MUTED, spacing: 1 })
  cv.text(fit(t.shop || '-', 12, 'F2', colW), col2, top - 151, { font: 'F2', size: 12 })

  cv.text('VALID', L, top - 172, { font: 'F2', size: 7.5, color: MUTED, spacing: 1 })
  cv.text(fit(`${t.dateLabel} · ${t.drawLabel}`, 10.5, 'F2', colW * 2), L, top - 186, { font: 'F2', size: 10.5 })
  const foot = [t.billAmount ? `Bill Rs. ${t.billAmount.toLocaleString('en-IN')}` : '', t.billNo ? `Bill no. ${t.billNo}` : '', t.sponsors.length ? `Sponsored by ${t.sponsors.join(', ')}` : '']
    .filter(Boolean)
    .join('   ·   ')
  if (foot) cv.text(fit(foot, 8.5, 'F1', bodyW - 2 * pad), L, top - 206, { size: 8.5, color: MUTED })

  cv.textUp('LUCKY DRAW', x + bodyW + STUB_W / 2, y + TICKET_H / 2, { size: 14, spacing: 2.4 })
}

/**
 * A PDF with every voucher of a purchase as its own ticket.
 * coupon: { codes, customer, shop, billAmount?, billNo?, sponsors: string[], festival, dateLabel, drawLabel }
 */
export function couponsPdf(coupon) {
  const total = coupon.codes.length
  const pages = []
  for (let start = 0; start < total; start += PER_PAGE) {
    const cv = new Canvas()
    const pageNo = pages.length + 1
    const pageCount = Math.ceil(total / PER_PAGE)
    cv.text(`Your lucky-draw coupons · ${total} voucher${total === 1 ? '' : 's'}`, MARGIN, PAGE_H - 30, { font: 'F2', size: 10, color: INK_GREY })
    cv.text(`Page ${pageNo} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 30, { size: 9, color: INK_GREY, align: 'right' })
    coupon.codes.slice(start, start + PER_PAGE).forEach((code, i) => {
      const top = PAGE_H - 44 - i * (TICKET_H + GAP)
      drawTicket(cv, MARGIN, top, { ...coupon, code, index: start + i + 1, total })
      if (i < PER_PAGE - 1 && start + i + 1 < total) {
        // Cut guide between tickets.
        cv.line([200, 200, 200], MARGIN, top - TICKET_H - GAP / 2, PAGE_W - MARGIN, top - TICKET_H - GAP / 2, 0.6, '3 3')
      }
    })
    cv.text('Keep these coupons to claim your prize. Wishing you a joyful season! - Dubai Mall Edakkara', PAGE_W / 2, 22, { size: 8.5, color: INK_GREY, align: 'center' })
    pages.push(cv.ops.join('\n'))
  }

  // Objects: 1 catalog, 2 page tree, 3-5 fonts, then a page + its content for each page.
  const objects = []
  const kids = pages.map((_, i) => `${6 + i * 2} 0 R`).join(' ')
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  for (const base of ['Helvetica', 'Helvetica-Bold', 'Courier-Bold']) {
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`)
  }
  pages.forEach((content, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + i * 2} 0 R >>`,
    )
    objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
  })
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${pdfString('Lucky-draw coupons - Dubai Mall Edakkara')}) >> >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
