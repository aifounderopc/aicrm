import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'
import { stageName, formatDate, daysUntil, amountLabel } from '../utils'
import { Search, LayoutGrid, List, ChevronUp, ChevronDown, ChevronDown as ChevronDownIcon, SlidersHorizontal, Download } from 'lucide-react'
import type { Opportunity } from '../types'
import { useMobile } from '../hooks/useMobile'
import ExcelJS from 'exceljs'

// 导出商机为带样式的 Excel（.xlsx，使用 ExcelJS）
async function exportOpportunitiesToExcel(list: Opportunity[]) {
  const amount = (o: Opportunity) =>
    (o.stage === 'signed' || o.stage === 'delivery') && o.signedAmount
      ? `${(o.signedAmount / 10000).toFixed(o.signedAmount % 10000 === 0 ? 0 : 1)}万元`
      : amountLabel(o.amountRange)
  const protect = (o: Opportunity) => {
    if (o.stage === 'released') return '已释放'
    if (o.lockedPermanently) return '持续锁定中'
    const d = daysUntil(o.releaseAt)
    return d > 0 ? `保护中（剩 ${d} 天）` : '已到期'
  }

  const columns = [
    { header: '客户名称', key: 'customerName', width: 18 },
    { header: '公司全称', key: 'companyName', width: 28 },
    { header: '所属行业', key: 'industry', width: 16 },
    { header: '商机来源', key: 'source', width: 11 },
    { header: '渠道名称', key: 'channelName', width: 14 },
    { header: '报备人', key: 'owner', width: 11 },
    { header: '当前阶段', key: 'stage', width: 11 },
    { header: '预算/签约金额', key: 'amount', width: 15 },
    { header: '首次接触时间', key: 'firstContact', width: 14 },
    { header: '报备时间', key: 'reportedAt', width: 14 },
    { header: '保护到期时间', key: 'releaseAt', width: 14 },
    { header: '保护状态', key: 'protect', width: 16 },
    { header: '需求描述', key: 'requirement', width: 46 },
  ]

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('我的商机', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns

  // 表头样式
  const header = ws.getRow(1)
  header.height = 24
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E9DBF' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB8DCE8' } } }
  })

  list.forEach((o, i) => {
    const row = ws.addRow({
      customerName: o.customerName, companyName: o.companyName || '', industry: o.industry,
      source: o.source === 'channel' ? '渠道' : '直客销售', channelName: o.channelName || '',
      owner: o.salesOwnerName, stage: stageName(o.stage), amount: amount(o),
      firstContact: o.firstContactDate ? formatDate(o.firstContactDate) : '', reportedAt: formatDate(o.reportedAt),
      releaseAt: formatDate(o.releaseAt), protect: protect(o), requirement: o.requirementDescription || '',
    })
    row.eachCell(cell => {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      cell.font = { size: 10.5 }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFEAEAEA' } } }
    })
    if (i % 2 === 1) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4FAFC' } } })
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `我的商机_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const STAGE_CARD: Record<string, {
  bg: string; bgHover: string;
  accent: string; text: string; sub: string;
  badge: string; badgeText: string;
  line: string; lineFade: string;
  shadow: string;
}> = {
  reporting: {
    bg:        'linear-gradient(145deg, #ddf3fa 0%, #b8e8f7 100%)',
    bgHover:   'linear-gradient(145deg, #ceeef8 0%, #a8e0f4 100%)',
    accent:    '#0e7a9a', text: '#0a4a62', sub: '#2a9abf',
    badge: 'rgba(14,165,233,0.13)', badgeText: '#0369a1',
    line: '#14a0c8', lineFade: 'rgba(20,160,200,0.2)',
    shadow: 'rgba(14,120,160,0.18)',
  },
  signing: {
    bg:        'linear-gradient(145deg, #fef4c0 0%, #fce878 100%)',
    bgHover:   'linear-gradient(145deg, #fef0a8 0%, #fbe060 100%)',
    accent:    '#9a6e00', text: '#6b4a00', sub: '#b08020',
    badge: 'rgba(245,158,11,0.15)', badgeText: '#d97706',
    line: '#c89800', lineFade: 'rgba(200,152,0,0.2)',
    shadow: 'rgba(160,120,0,0.18)',
  },
  signed: {
    bg:        'linear-gradient(145deg, #c8f5e4 0%, #96eacb 100%)',
    bgHover:   'linear-gradient(145deg, #b8f0d8 0%, #82e4bc 100%)',
    accent:    '#0a7a52', text: '#055038', sub: '#2a9468',
    badge: 'rgba(10,122,82,0.13)', badgeText: '#0a7a52',
    line: '#10a06a', lineFade: 'rgba(16,160,106,0.2)',
    shadow: 'rgba(10,120,80,0.18)',
  },
  delivery: {
    bg:        'linear-gradient(145deg, #ddd8fc 0%, #c4bbf8 100%)',
    bgHover:   'linear-gradient(145deg, #d4cefb 0%, #b8aff6 100%)',
    accent:    '#4830b8', text: '#32208a', sub: '#6050c8',
    badge: 'rgba(14,157,191,0.13)', badgeText: '#0e7a9a',
    line: '#5840cc', lineFade: 'rgba(88,64,204,0.2)',
    shadow: 'rgba(70,48,180,0.18)',
  },
  released: {
    bg: 'linear-gradient(145deg, #f3f4f6 0%, #eaecef 100%)', bgHover: 'linear-gradient(145deg, #eeeff2 0%, #e4e6ea 100%)',
    accent: '#9ca3af', text: '#6b7280', sub: '#9ca3af',
    badge: 'rgba(100,116,139,0.12)', badgeText: '#64748b',
    line: '#d1d5db', lineFade: 'rgba(209,213,219,0.3)',
    shadow: 'rgba(0,0,0,0.06)',
  },
}

const PIPELINE = ['reporting', 'signing', 'signed', 'delivery'] as const
const PIPELINE_LABEL: Record<string, string> = {
  reporting: '初接触', signing: '签约中', signed: '已签约', delivery: '交付中',
}


// ─── Sort key type ────────────────────────────────────────────────────────────
type SortKey = 'reportedAt' | 'releaseAt' | 'customerName' | 'amountRange'

const amountOrder: Record<string, number> = { under50: 0, '50to200': 1, above200: 2 }

function sortOpps(list: Opportunity[], key: SortKey, asc: boolean) {
  return [...list].sort((a, b) => {
    let va: string | number, vb: string | number
    if (key === 'amountRange') { va = amountOrder[a.amountRange]; vb = amountOrder[b.amountRange] }
    else { va = a[key] as string; vb = b[key] as string }
    if (va < vb) return asc ? -1 : 1
    if (va > vb) return asc ? 1 : -1
    return 0
  })
}

// ─── Card view ────────────────────────────────────────────────────────────────
function CardView({ list, onSelect, isAdmin }: { list: Opportunity[]; onSelect: (o: Opportunity) => void; isAdmin: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {list.map(opp => {
        const days = daysUntil(opp.releaseAt)
        const sc = STAGE_CARD[opp.stage] ?? STAGE_CARD.reporting
        const currentIdx = PIPELINE.indexOf(opp.stage as typeof PIPELINE[number])
        const isReleased = opp.stage === 'released'
        return (
          <div key={opp.id}
            onClick={() => onSelect(opp)}
            style={{
              borderRadius: 20, padding: '16px 18px 18px',
              cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s',
              boxShadow: `0 2px 14px ${sc.shadow}`,
              background: sc.bg, minWidth: 0, position: 'relative',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.transform = 'translateY(-3px)'
              el.style.boxShadow = `0 10px 28px ${sc.shadow.replace('0.18', '0.28')}`
              el.style.background = sc.bgHover
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.transform = ''
              el.style.boxShadow = `0 2px 14px ${sc.shadow}`
              el.style.background = sc.bg
            }}
          >
            {/* Top row: stage badge + admin reporter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.badge, color: sc.badgeText, letterSpacing: '0.2px' }}>
                {isReleased ? '已释放' : (PIPELINE_LABEL[opp.stage] ?? opp.stage)}
              </span>
              {isAdmin && (
                <span style={{ fontSize: 10, fontWeight: 600, color: sc.sub, background: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: '2px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opp.salesOwnerName}
                </span>
              )}
            </div>

            {/* Customer name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: sc.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opp.customerName.length > 12 ? opp.customerName.slice(0, 12) + '…' : opp.customerName}
              </div>
              {isAdmin && opp.renewalRequests.some(r => r.status === 'pending') && (
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.7)', color: '#d97706', padding: '1px 6px', borderRadius: 6 }}>续期待审</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: sc.sub, marginBottom: 14 }}>
              {opp.industry} · {(opp.stage === 'signed' || opp.stage === 'delivery') && opp.signedAmount
                ? `${(opp.signedAmount / 10000).toFixed(opp.signedAmount % 10000 === 0 ? 0 : 1)}万元`
                : amountLabel(opp.amountRange)}
            </div>

            {/* Stage timeline (skip for released) */}
            {!isReleased ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {PIPELINE.map((stage, i) => (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                      <div style={{
                        width: i === currentIdx ? 10 : 7,
                        height: i === currentIdx ? 10 : 7,
                        borderRadius: '50%', flexShrink: 0,
                        background: i <= currentIdx ? sc.line : sc.lineFade,
                        border: i === currentIdx ? `2px solid ${sc.accent}` : 'none',
                        boxShadow: i === currentIdx ? `0 0 0 3px ${sc.lineFade}` : 'none',
                      }} />
                      {i < 3 && (
                        <div style={{ flex: 1, height: 2, borderRadius: 1, background: i < currentIdx ? sc.line : sc.lineFade }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  {PIPELINE.map((stage, i) => (
                    <span key={stage} style={{ fontSize: 9, fontWeight: i === currentIdx ? 700 : 400, color: i === currentIdx ? sc.accent : sc.lineFade.replace('0.2)', '0.6)'), lineHeight: 1 }}>
                      {PIPELINE_LABEL[stage]}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12, fontSize: 11, color: sc.sub, opacity: 0.7 }}>保护期已结束</div>
            )}

            {/* Protection days */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.line, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: sc.text, fontWeight: 600, opacity: 0.85 }}>
                {isReleased ? '已释放' : opp.lockedPermanently ? '持续锁定' : days > 0 ? `保护期剩 ${days} 天` : '保护期已到'}
              </span>
            </div>
          </div>
        )
      })}

      {list.length === 0 && (
        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>暂无商机记录</div>
        </div>
      )}
    </div>
  )
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────
function FilterDropdown({
  options, selected, onChange, onClose,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 300,
      background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      border: '1px solid rgba(0,0,0,0.08)', minWidth: 150, padding: '6px 0',
    }}>
      {selected.length > 0 && (
        <button onClick={() => onChange([])} style={{
          display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
          fontSize: 12, color: '#e05555', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>清除筛选</button>
      )}
      {options.map(opt => (
        <label key={opt} onClick={() => toggle(opt)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          cursor: 'pointer', fontSize: 13, color: '#111111',
          background: selected.includes(opt) ? 'rgba(0,0,0,0.04)' : 'transparent',
        }}>
          <div style={{
            width: 15, height: 15, borderRadius: 4, flexShrink: 0,
            border: `1.5px solid ${selected.includes(opt) ? '#111111' : '#d1d5db'}`,
            background: selected.includes(opt) ? '#111111' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected.includes(opt) && <svg width="9" height="9" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          {opt}
        </label>
      ))}
    </div>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────
type ColFilterKey = 'industry' | 'stage' | 'protection' | 'owner'

const PROTECTION_LABEL = (opp: Opportunity) => {
  if (opp.stage === 'released') return '已释放'
  if (opp.lockedPermanently) return '持续锁定'
  const d = daysUntil(opp.releaseAt)
  return d > 0 ? '保护中' : '已到期'
}

const COL_DEFS: { key: SortKey | null; label: string; width: string; filterKey?: ColFilterKey }[] = [
  { key: 'customerName', label: '客户名称',   width: '22%' },
  { key: null,           label: '行业',       width: '12%', filterKey: 'industry' },
  { key: null,           label: '阶段',       width: '10%', filterKey: 'stage' },
  { key: 'amountRange',  label: '预算/签约金额', width: '11%' },
  { key: 'reportedAt',   label: '报备时间',   width: '11%' },
  { key: 'releaseAt',    label: '商机保护状态', width: '14%', filterKey: 'protection' },
  { key: null,           label: '报备人',     width: '10%', filterKey: 'owner' },
  { key: null,           label: '操作',       width: '10%' },
]

function ListView({
  list, onSelect, sortKey, sortAsc, onSort, isAdmin,
}: {
  list: Opportunity[]
  onSelect: (o: Opportunity) => void
  sortKey: SortKey
  sortAsc: boolean
  onSort: (k: SortKey) => void
  isAdmin: boolean
}) {
  const [colFilters, setColFilters] = useState<Record<ColFilterKey, string[]>>({
    industry: [], stage: [], protection: [], owner: [],
  })
  const [openFilter, setOpenFilter] = useState<ColFilterKey | null>(null)

  // Build option lists from the full input list
  const filterOptions: Record<ColFilterKey, string[]> = useMemo(() => ({
    industry: [...new Set(list.map(o => o.industry))].sort(),
    stage: [...new Set(list.filter(o => o.stage !== 'released').map(o => stageName(o.stage)))].sort(),
    protection: [...new Set(list.map(PROTECTION_LABEL))],
    owner: [...new Set(list.map(o => o.salesOwnerName))].sort(),
  }), [list])

  const setFilter = (key: ColFilterKey, vals: string[]) =>
    setColFilters(prev => ({ ...prev, [key]: vals }))

  // Apply column filters on top of the passed-in list
  const displayed = list.filter(o => {
    if (colFilters.industry.length && !colFilters.industry.includes(o.industry)) return false
    if (colFilters.stage.length && o.stage !== 'released' && !colFilters.stage.includes(stageName(o.stage))) return false
    if (colFilters.protection.length && !colFilters.protection.includes(PROTECTION_LABEL(o))) return false
    if (colFilters.owner.length && !colFilters.owner.includes(o.salesOwnerName)) return false
    return true
  })

  const SortIcon = ({ col }: { col: typeof COL_DEFS[0] }) => {
    if (!col.key) return null
    const active = sortKey === col.key
    return (
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
        <ChevronUp size={10} style={{ color: active && sortAsc ? '#111111' : '#aaa', display: 'block', marginBottom: -2 }} />
        <ChevronDown size={10} style={{ color: active && !sortAsc ? '#111111' : '#aaa', display: 'block' }} />
      </span>
    )
  }

  const thStyle = (col: typeof COL_DEFS[0]) => ({
    padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280',
    textAlign: 'left' as const, cursor: col.key || col.filterKey ? 'pointer' : 'default',
    userSelect: 'none' as const, whiteSpace: 'nowrap' as const,
    width: col.width, letterSpacing: '0.3px',
    background: 'transparent', border: 'none',
    position: 'relative' as const,
  })

  return (
    <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 18, overflow: 'visible', boxShadow: '0 2px 16px rgba(80,140,160,0.08), 0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.9)' }}>
      <div style={{ borderRadius: 18, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(200,230,240,0.4)', background: 'rgba(236,248,252,0.6)' }}>
            {COL_DEFS.filter(c => isAdmin || c.label !== '报备人').map(col => {
              const hasFilter = !!col.filterKey
              const active = hasFilter && colFilters[col.filterKey!].length > 0
              const isOpen = hasFilter && openFilter === col.filterKey
              return (
                <th key={col.label} style={thStyle(col)}
                  onClick={() => {
                    if (col.key) onSort(col.key)
                    if (col.filterKey) setOpenFilter(isOpen ? null : col.filterKey)
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: active ? '#111111' : '#6b7280' }}>{col.label}</span>
                    {hasFilter && (
                      <SlidersHorizontal size={11} style={{
                        color: active ? '#111111' : '#bbb',
                        flexShrink: 0,
                      }} />
                    )}
                    {active && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#3b82f6', flexShrink: 0,
                      }} />
                    )}
                    <SortIcon col={col} />
                  </span>
                  {isOpen && (
                    <FilterDropdown
                      options={filterOptions[col.filterKey!]}
                      selected={colFilters[col.filterKey!]}
                      onChange={vals => setFilter(col.filterKey!, vals)}
                      onClose={() => setOpenFilter(null)}
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {displayed.map((opp, idx) => {
            const days = daysUntil(opp.releaseAt)
            const sc = STAGE_CARD[opp.stage] ?? STAGE_CARD.released
            const lockColor = opp.lockedPermanently ? '#2ec4b6' : days <= 3 ? '#ff6b6b' : days <= 7 ? '#f4a261' : '#111111'
            return (
              <tr key={opp.id}
                onClick={() => onSelect(opp)}
                style={{
                  borderBottom: idx < displayed.length - 1 ? '1px solid #f9f9f9' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Customer name */}
                <td style={{ padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: sc.badge, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: sc.badgeText,
                    }}>
                      {opp.customerName[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opp.customerName}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {opp.isFrozen && (
                          <span style={{ fontSize: 10, color: '#e05555', background: '#fff1f1', padding: '1px 6px', borderRadius: 6 }}>已冻结</span>
                        )}
                        {isAdmin && opp.renewalRequests.some(r => r.status === 'pending') && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 6 }}>续期待审</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {/* Industry */}
                <td style={{ padding: '13px 14px', fontSize: 12, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opp.industry}
                </td>
                {/* Stage */}
                <td style={{ padding: '13px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: sc.badge, color: sc.badgeText, whiteSpace: 'nowrap' }}>
                    {opp.stage === 'released' ? '—' : stageName(opp.stage)}
                  </span>
                </td>
                {/* Amount */}
                <td style={{ padding: '13px 14px', fontSize: 12, color: '#4b5563' }}>
                  {(opp.stage === 'signed' || opp.stage === 'delivery') && opp.signedAmount
                    ? <span style={{ fontWeight: 600, color: '#059669' }}>{(opp.signedAmount / 10000).toFixed(opp.signedAmount % 10000 === 0 ? 0 : 1)}万元</span>
                    : amountLabel(opp.amountRange)}
                </td>
                {/* Reported at */}
                <td style={{ padding: '13px 14px', fontSize: 12, color: '#6b7280' }}>
                  {formatDate(opp.reportedAt)}
                </td>
                {/* Lock status */}
                <td style={{ padding: '13px 14px' }}>
                  {opp.stage === 'released' ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>已释放</span>
                  ) : opp.lockedPermanently ? (
                    <span style={{ fontSize: 12, color: '#2ec4b6', fontWeight: 600 }}>持续锁定中</span>
                  ) : days > 0 ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: days <= 7 ? '#ef4444' : '#0e7a9a' }}>
                      保护中
                      <span style={{ fontWeight: days <= 7 ? 700 : 500, marginLeft: 4 }}>（剩 {days} 天）</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>已到期</span>
                  )}
                </td>
                {/* Owner (admin only) */}
                {isAdmin && (
                  <td style={{ padding: '13px 14px', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opp.salesOwnerName}
                  </td>
                )}
                {/* Action */}
                <td style={{ padding: '13px 14px' }}>
                  <button
                    onClick={e => { e.stopPropagation(); onSelect(opp) }}
                    style={{
                      fontSize: 12, padding: '5px 12px', borderRadius: 8,
                      border: '1.5px solid #e5e5e5', background: 'white',
                      color: '#111111', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    详情
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>暂无符合条件的商机</div>
        </div>
      )}
      </div>
    </div>
  )
}

const selectStyle = {
  padding: '8px 32px 8px 12px', fontSize: 13, border: '1.5px solid #e5e5e5',
  borderRadius: 12, background: 'rgba(255,255,255,0.9)', color: '#111111',
  outline: 'none', cursor: 'pointer', appearance: 'none' as const,
  fontFamily: 'inherit', fontWeight: 500,
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyOpportunities() {
  const { currentUser, opportunities, users, channels } = useStore()
  const isMobile = useMobile()
  const navigate = useNavigate()
  const isAdmin = currentUser.role === 'admin'
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list')
  const [sortKey, setSortKey] = useState<SortKey>('reportedAt')
  const [sortAsc, setSortAsc] = useState(false)

  const myOpps = opportunities.filter(o =>
    isAdmin || o.salesOwnerId === currentUser.id
  )

  void users; void channels

  const filtered = sortOpps(
    myOpps
      .filter(o => filter === 'all' || o.stage === filter)
      .filter(o => !search || o.customerName.toLowerCase().includes(search.toLowerCase())),
    sortKey,
    sortAsc,
  )

  const filterCounts = ['all', 'reporting', 'signing', 'delivery', 'signed', 'released'].map(f => ({
    value: f, label: f === 'all' ? '全部' : stageName(f),
    count: f === 'all' ? myOpps.length : myOpps.filter(o => o.stage === f).length,
  }))

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(v => !v)
    else { setSortKey(k); setSortAsc(true) }
  }

  const effectiveViewMode = isMobile ? 'card' : viewMode

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111111', margin: '0 0 2px' }}>我的商机</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>共 {myOpps.length} 个，筛选后 {filtered.length} 个</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search — desktop */}
          {!isMobile && (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索客户名称…"
                style={{
                  paddingLeft: 34, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
                  border: '1.5px solid #e5e5e5', borderRadius: 12, fontSize: 13,
                  background: 'rgba(255,255,255,0.9)', color: '#111111', outline: 'none', width: 190,
                }}
                onFocus={e => (e.target.style.borderColor = '#111111')}
                onBlur={e => (e.target.style.borderColor = '#e5e5e5')}
              />
            </div>
          )}
          {/* Export — icon only */}
          <button onClick={() => exportOpportunitiesToExcel(filtered)} disabled={filtered.length === 0}
            title="导出当前筛选结果为 Excel"
            style={{
              width: 38, height: 38, borderRadius: 11, border: '1.5px solid #e5e5e5',
              background: 'rgba(255,255,255,0.9)', color: filtered.length === 0 ? '#d1d5db' : '#6b7280',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (filtered.length) { (e.currentTarget as HTMLElement).style.color = '#0e7a9a'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.3)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = filtered.length === 0 ? '#d1d5db' : '#6b7280'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
          >
            <Download size={16} />
          </button>
          {/* View toggle — desktop only */}
          {!isMobile && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.9)', borderRadius: 12, border: '1.5px solid #e5e5e5', overflow: 'hidden', padding: 3, gap: 2 }}>
              {([
                { mode: 'card' as const, Icon: LayoutGrid, title: '卡片视图' },
                { mode: 'list' as const, Icon: List,        title: '列表视图' },
              ]).map(({ mode, Icon, title }) => (
                <button key={mode} title={title} onClick={() => setViewMode(mode)} style={{
                  width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: viewMode === mode ? 'linear-gradient(135deg, #111111, #444444)' : 'transparent',
                  color: viewMode === mode ? 'white' : '#6b7280', transition: 'all 0.18s',
                  boxShadow: viewMode === mode ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                }}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile search */}
      {isMobile && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索客户名称…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 11, paddingBottom: 11,
              border: '1.5px solid #e5e5e5', borderRadius: 12, fontSize: 14,
              background: 'rgba(255,255,255,0.9)', color: '#111111', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Stage filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: isMobile ? 4 : 0 }}>
        {filterCounts.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: isMobile ? 12 : 13, fontWeight: 600, flexShrink: 0,
            background: filter === f.value ? 'linear-gradient(135deg, #111111, #444444)' : 'rgba(255,255,255,0.85)',
            color: filter === f.value ? 'white' : '#4b5563',
            boxShadow: filter === f.value ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.07)',
          }}>
            {f.label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* View */}
      {effectiveViewMode === 'card'
        ? <CardView list={filtered} onSelect={o => navigate(`/opportunity/${o.id}`)} isAdmin={currentUser.role === 'admin'} />
        : <ListView list={filtered} onSelect={o => navigate(`/opportunity/${o.id}`)} sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} isAdmin={currentUser.role === 'admin'} />
      }
    </div>
  )
}
