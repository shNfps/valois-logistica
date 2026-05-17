import { useState } from 'react'
import { fmtMoney, card } from './db.js'

// Constrói as barras do waterfall a partir do DRE.
// Cada barra representa uma transição: positiva (verde, receita)
// ou negativa (vermelha, dedução); barras de "total" reiniciam a base.
export function buildWaterfallSteps(dre) {
  return [
    { label: 'Receita Bruta', valor: dre.receitaBruta, tipo: 'inicio' },
    { label: 'Deduções', valor: -dre.deducoes, tipo: 'neg' },
    { label: 'CMV', valor: -dre.cmv, tipo: 'neg' },
    { label: 'Lucro Bruto', valor: dre.lucroBruto, tipo: 'subtotal' },
    { label: 'Operacional', valor: -dre.totalOperacional, tipo: 'neg' },
    { label: 'EBITDA', valor: dre.ebitda, tipo: 'subtotal' },
    { label: 'Imposto lucro', valor: -dre.impostoLucro, tipo: 'neg' },
    { label: 'Lucro Líquido', valor: dre.lucroLiquido, tipo: 'final' },
  ]
}

export function Waterfall({ dre }) {
  const [hover, setHover] = useState(null)
  const steps = buildWaterfallSteps(dre)

  // Calcula posição acumulada de cada barra
  let acc = 0
  const barras = steps.map((s, i) => {
    let topo, base
    if (s.tipo === 'inicio' || s.tipo === 'subtotal' || s.tipo === 'final') {
      base = 0; topo = s.valor; acc = s.valor
    } else if (s.valor >= 0) {
      base = acc; topo = acc + s.valor; acc = topo
    } else {
      topo = acc; base = acc + s.valor; acc = base
    }
    return { ...s, base, topo, idx: i }
  })

  const maxAbs = Math.max(...barras.flatMap(b => [b.base, b.topo]), 1)
  const minAbs = Math.min(...barras.flatMap(b => [b.base, b.topo]), 0)
  const range = maxAbs - minAbs || 1

  const W = 720, H = 280, M = { l: 60, r: 12, t: 20, b: 60 }
  const cw = (W - M.l - M.r) / barras.length, bw = cw * 0.6
  const py = v => M.t + (1 - (v - minAbs) / range) * (H - M.t - M.b)
  const zeroY = py(0)

  const corBarra = (s) => {
    if (s.tipo === 'inicio') return '#059669'
    if (s.tipo === 'subtotal') return '#0EA5E9'
    if (s.tipo === 'final') return s.valor >= 0 ? '#D97706' : '#B91C1C'
    return s.valor >= 0 ? '#10B981' : '#DC2626'
  }

  return (
    <div style={{ ...card, padding: 16, margin: 0 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Cascata Receita → Lucro Líquido</h4>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 300 }}>
        <line x1={M.l} y1={zeroY} x2={W - M.r} y2={zeroY} stroke="#94A3B8" strokeDasharray="3 3" />
        <text x={M.l - 6} y={zeroY + 3} textAnchor="end" fontSize="9" fill="#94A3B8">0</text>
        <text x={M.l - 6} y={M.t + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{fmtMoney(maxAbs).replace('R$ ', '')}</text>
        {minAbs < 0 && <text x={M.l - 6} y={H - M.b + 4} textAnchor="end" fontSize="9" fill="#DC2626">{fmtMoney(minAbs).replace('R$ ', '')}</text>}

        {barras.map((b, i) => {
          const x = M.l + i * cw + (cw - bw) / 2
          const yTop = py(Math.max(b.topo, b.base))
          const yBot = py(Math.min(b.topo, b.base))
          const h = Math.max(2, yBot - yTop)
          const cor = corBarra(b)
          // Linha conectora entre barras (acumulado)
          const conectorY = py(b.tipo === 'inicio' || b.tipo === 'subtotal' || b.tipo === 'final' ? b.topo : (b.valor >= 0 ? b.topo : b.base))
          const prox = barras[i + 1]
          return (
            <g key={i}>
              {prox && <line x1={x + bw} y1={conectorY} x2={M.l + (i + 1) * cw + (cw - bw) / 2} y2={conectorY} stroke="#CBD5E1" strokeDasharray="2 3" />}
              <rect x={x} y={yTop} width={bw} height={h} fill={cor} rx={2} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
              <text x={x + bw / 2} y={yTop - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="#0A1628">{fmtMoney(b.valor).replace('R$ ', '')}</text>
              <text x={x + bw / 2} y={H - M.b + 14} textAnchor="middle" fontSize="9" fill="#64748B">{b.label}</text>
            </g>
          )
        })}
        {hover !== null && (
          <g>
            <rect x={M.l + hover * cw + cw / 2 - 70} y={M.t} width={140} height={32} rx={4} fill="#0F172A" />
            <text x={M.l + hover * cw + cw / 2} y={M.t + 13} textAnchor="middle" fontSize="10" fill="#fff">{barras[hover].label}</text>
            <text x={M.l + hover * cw + cw / 2} y={M.t + 25} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{fmtMoney(barras[hover].valor)}</text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#64748B', justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#059669', marginRight: 4 }} />Receita</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#DC2626', marginRight: 4 }} />Dedução</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#0EA5E9', marginRight: 4 }} />Subtotal</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#D97706', marginRight: 4 }} />Lucro Líquido</span>
      </div>
    </div>
  )
}
