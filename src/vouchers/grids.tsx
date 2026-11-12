import { themeQuartz, type ColDef, type GridApi, type ICellRendererParams } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { Send } from 'lucide-react'
import { useMemo } from 'react'
import { WhatsAppIcon } from '../components/ShopCard'
import { shopById, shopRows, type Issue, type IssueStatus, type ShopRow } from './data'

export const gridTheme = themeQuartz.withParams({
  fontFamily: '"Nunito Sans", system-ui, sans-serif',
  fontSize: 14,
  foregroundColor: '#141a2e',
  backgroundColor: '#ffffff',
  accentColor: '#b7862c',
  headerBackgroundColor: '#f0ebe3',
  headerFontWeight: 700,
  headerTextColor: '#0e1838',
  borderColor: '#e3ddd2',
  rowHoverColor: '#faf7f2',
  oddRowBackgroundColor: '#fdfcfa',
  wrapperBorderRadius: 16,
  spacing: 7,
})

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const dateCol: ColDef = {
  headerName: 'Issued',
  field: 'createdAt',
  sort: 'desc',
  width: 150,
  valueFormatter: (p) => (p.value ? dateFmt.format(new Date(p.value)) : ''),
  filter: 'agDateColumnFilter',
  filterParams: {
    comparator: (filterDate: Date, value: string) => {
      const d = new Date(value)
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return day === filterDate.getTime() ? 0 : day < filterDate.getTime() ? -1 : 1
    },
  },
}

const countCol = (headerName: string, field: string): ColDef => ({
  headerName,
  field,
  type: 'rightAligned',
  width: 120,
  filter: 'agNumberColumnFilter',
})

const phoneFmt = (p: { value?: string }) => (p.value ? `+91 ${p.value.slice(0, 5)} ${p.value.slice(5)}` : '')

function StatusPill({ value }: { value: IssueStatus }) {
  const sent = value === 'sent'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        sent ? 'bg-[#e3f4ea] text-whatsapp' : 'bg-gold-soft text-gold-text'
      }`}
    >
      <span className={`size-1.5 rounded-full ${sent ? 'bg-whatsapp' : 'bg-gold'}`} />
      {sent ? 'Sent' : 'Not sent'}
    </span>
  )
}

const statusCol: ColDef = {
  headerName: 'WhatsApp',
  field: 'status',
  width: 130,
  cellRenderer: StatusPill,
  filterValueGetter: (p) => (p.data?.status === 'sent' ? 'Sent' : 'Not sent'),
}

// ---------- Vouchers: one row per code ----------

interface VoucherRow {
  code: string
  createdAt: string
  customerName: string
  phone: string
  place: string
  shopNo: string
  shopName: string
  category: string
  location: string
  billNo: string
  status: IssueStatus
}

export function VoucherGrid({ issues, search, onReady }: GridProps) {
  const rows = useMemo<VoucherRow[]>(
    () =>
      issues.flatMap((i) => {
        const shop = shopById[i.shopId]
        return i.codes.map((code) => ({
          code,
          createdAt: i.createdAt,
          customerName: i.customerName,
          phone: i.phone,
          place: i.place,
          shopNo: shop.shopNo,
          shopName: shop.name,
          category: shop.categoryLabel,
          location: shop.location,
          billNo: i.billNo,
          status: i.status,
        }))
      }),
    [issues],
  )
  const cols = useMemo<ColDef<VoucherRow>[]>(
    () => [
      { headerName: 'Voucher code', field: 'code', pinned: 'left', width: 150, cellClass: 'font-mono font-bold text-ink' },
      dateCol,
      { headerName: 'Customer', field: 'customerName', width: 170 },
      { headerName: 'WhatsApp no.', field: 'phone', width: 150, valueFormatter: phoneFmt },
      { headerName: 'Customer place', field: 'place', width: 150 },
      { headerName: 'Shop no.', field: 'shopNo', width: 110 },
      { headerName: 'Shop', field: 'shopName', width: 190 },
      { headerName: 'Category', field: 'category', width: 150 },
      { headerName: 'Shop location', field: 'location', width: 230 },
      { headerName: 'Bill no.', field: 'billNo', width: 120 },
      statusCol,
    ],
    [],
  )
  return <Grid rows={rows} cols={cols} search={search} onReady={onReady} rowId={(r) => r.code} />
}

// ---------- Purchases: one row per bill ----------

export function PurchaseGrid({ issues, search, onReady, onSend }: GridProps & { onSend: (issue: Issue) => void }) {
  const cols = useMemo<ColDef<Issue>[]>(
    () => [
      dateCol,
      { headerName: 'Customer', field: 'customerName', width: 170, pinned: 'left' },
      { headerName: 'WhatsApp no.', field: 'phone', width: 150, valueFormatter: phoneFmt },
      { headerName: 'Customer place', field: 'place', width: 150 },
      { headerName: 'Shop no.', valueGetter: (p) => shopById[p.data!.shopId].shopNo, width: 110 },
      { headerName: 'Shop', valueGetter: (p) => shopById[p.data!.shopId].name, width: 190 },
      { headerName: 'Shop location', valueGetter: (p) => shopById[p.data!.shopId].location, width: 230 },
      { headerName: 'Bill no.', field: 'billNo', width: 120 },
      {
        headerName: 'Vouchers',
        valueGetter: (p) => p.data!.codes.length,
        type: 'rightAligned',
        width: 115,
        filter: 'agNumberColumnFilter',
      },
      {
        headerName: 'Codes',
        valueGetter: (p) => p.data!.codes.join(', '),
        width: 260,
        cellClass: 'font-mono text-xs',
        tooltipValueGetter: (p) => p.value,
      },
      statusCol,
      {
        headerName: '',
        colId: 'send',
        width: 120,
        pinned: 'right',
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (p: ICellRendererParams<Issue>) => (
          <button
            type="button"
            onClick={() => onSend(p.data!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-whatsapp px-2.5 py-1 text-xs font-bold text-white hover:bg-whatsapp-hover"
          >
            {p.data!.status === 'sent' ? <Send className="size-3.5" /> : <WhatsAppIcon className="size-3.5" />}
            {p.data!.status === 'sent' ? 'Resend' : 'Send'}
          </button>
        ),
      },
    ],
    [onSend],
  )
  return <Grid rows={issues} cols={cols} search={search} onReady={onReady} rowId={(r) => r.id} />
}

// ---------- Shops: per-shop totals ----------

interface ShopStatsRow extends ShopRow {
  vouchers: number
  customers: number
  purchases: number
  notSent: number
  lastIssued?: string
}

export function ShopGrid({ issues, search, onReady }: GridProps) {
  const rows = useMemo<ShopStatsRow[]>(() => {
    const stats = new Map<string, { vouchers: number; phones: Set<string>; purchases: number; notSent: number; lastIssued?: string }>()
    for (const i of issues) {
      const s = stats.get(i.shopId) ?? { vouchers: 0, phones: new Set<string>(), purchases: 0, notSent: 0 }
      s.vouchers += i.codes.length
      s.phones.add(i.phone)
      s.purchases += 1
      if (i.status === 'pending') s.notSent += i.codes.length
      if (!s.lastIssued || i.createdAt > s.lastIssued) s.lastIssued = i.createdAt
      stats.set(i.shopId, s)
    }
    return shopRows.map((shop) => {
      const s = stats.get(shop.id)
      return {
        ...shop,
        vouchers: s?.vouchers ?? 0,
        customers: s?.phones.size ?? 0,
        purchases: s?.purchases ?? 0,
        notSent: s?.notSent ?? 0,
        lastIssued: s?.lastIssued,
      }
    })
  }, [issues])
  const cols = useMemo<ColDef<ShopStatsRow>[]>(
    () => [
      { headerName: 'Shop no.', field: 'shopNo', width: 110, pinned: 'left' },
      { headerName: 'Shop', field: 'name', width: 200, cellClass: 'font-bold text-ink' },
      { ...countCol('Vouchers sold', 'vouchers'), width: 160, sort: 'desc', cellClass: 'font-bold text-ink' },
      countCol('Customers', 'customers'),
      countCol('Bills', 'purchases'),
      countCol('Not sent', 'notSent'),
      { headerName: 'Category', field: 'categoryLabel', width: 160 },
      { headerName: 'Location', field: 'location', width: 230 },
      { headerName: 'Owner', field: 'owner', width: 160 },
      { headerName: 'Phone', field: 'phone', width: 150, valueFormatter: phoneFmt },
      { ...dateCol, headerName: 'Last voucher', field: 'lastIssued', sort: undefined },
    ],
    [],
  )
  return <Grid rows={rows} cols={cols} search={search} onReady={onReady} rowId={(r) => r.id} />
}

// ---------- shared ----------

interface GridProps {
  issues: Issue[]
  search: string
  onReady: (api: GridApi) => void
}

function Grid<T>({
  rows,
  cols,
  search,
  onReady,
  rowId,
}: {
  rows: T[]
  cols: ColDef<T>[]
  search: string
  onReady: (api: GridApi) => void
  rowId: (row: T) => string
}) {
  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: true, resizable: true }), [])
  return (
    <div className="h-[600px]">
      <AgGridReact<T>
        theme={gridTheme}
        rowData={rows}
        columnDefs={cols}
        defaultColDef={defaultColDef}
        quickFilterText={search}
        getRowId={(p) => rowId(p.data)}
        pagination
        paginationPageSize={20}
        paginationPageSizeSelector={[20, 50, 100]}
        tooltipShowDelay={300}
        onGridReady={(e) => onReady(e.api as GridApi)}
      />
    </div>
  )
}
