import { useState } from 'react'
import { fmtMoney, card } from './db.js'

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Gráfico de barras receitas x despesas (6 meses).
export function BarrasReceitaDespesa({ dados }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...dados.flatMap(d => [d.receita, d.despesa]))
  const W = 480, H = 220, M = { l: 50, r: 12, t: 14, b: 30 }
  const cw = (W - M.l - M.r) / dados.length, bw = cw * 0.35

  return (
    <div style={{ ...card, padding: 16, margin: 0 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Receitas × Despesas (6 meses)</h4>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240 }}>
        {[0, 0.5, 1].map((p, i) => (
          <g key={i}>
            <line x1={M.l} y1={M.t + (H - M.t - M.b) * (1 - p)} x2={W - M.r} y2={M.t + (H - M.t - M.b) * (1 - p)} stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x={M.l - 6} y={M.t + (H - M.t - M.b) * (1 - p) + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{fmtMoney(max * p).replace('R$ ', '')}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = M.l + i * cw + cw / 2
          const hR = (H - M.t - M.b) * (d.receita / max), hD = (H - M.t - M.b) * (d.despesa / max)
          return (
            <g key={i}>
              <rect x={x - bw - 1} y={H - M.b - hR} width={bw} height={hR} fill="#059669" onMouseEnter={() => setHover({ x, tipo: 'Receita', valor: d.receita, label: d.label })} onMouseLeave={() => setHover(null)} />
              <rect x={x + 1} y={H - M.b - hD} width={bw} height={hD} fill="#DC2626" onMouseEnter={() => setHover({ x, tipo: 'Despesa', valor: d.despesa, label: d.label })} onMouseLeave={() => setHover(null)} />
              <text x={x} y={H - M.b + 14} textAnchor="middle" fontSize="10" fill="#64748B">{d.label}</text>
            </g>
          )
        })}
        {hover && (
          <g>
            <rect x={hover.x - 50} y={M.t} width={100} height={32} rx={4} fill="#0F172A" />
            <text x={hover.x} y={M.t + 13} textAnchor="middle" fontSize="10" fill="#fff">{hover.label} · {hover.tipo}</text>
            <text x={hover.x} y={M.t + 25} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{fmtMoney(hover.valor)}</text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748B', justifyContent: 'center', marginTop: 6 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#059669', marginRight: 4 }}/>Receitas</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#DC2626', marginRight: 4 }}/>Despesas</span>
      </div>
    </div>
  )
}

// Donut: despesas por categoria.
export function DonutCategorias({ dados }) {
  const total = dados.reduce((s, d) => s + d.valor, 0)
  if (!total) return <div style={{ ...card, padding: 16, margin: 0 }}><h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Despesas por categoria</h4><div style={{ color: '#94A3B8', textAlign: 'center', padding: 30, fontSize: 12 }}>Sem dados no período</div></div>

  const R = 60, r = 38, cx = 80, cy = 80
  let acumulado = 0
  const arcos = dados.map(d => {
    const frac = d.valor / total; const inicio = acumulado * 2 * Math.PI; const fim = (acumulado + frac) * 2 * Math.PI
    acumulado += frac
    const grande = frac > 0.5 ? 1 : 0
    const path = `M ${cx + R * Math.sin(inicio)} ${cy - R * Math.cos(inicio)} A ${R} ${R} 0 ${grande} 1 ${cx + R * Math.sin(fim)} ${cy - R * Math.cos(fim)} L ${cx + r * Math.sin(fim)} ${cy - r * Math.cos(fim)} A ${r} ${r} 0 ${grande} 0 ${cx + r * Math.sin(inicio)} ${cy - r * Math.cos(inicio)} Z`
    return { ...d, path, pct: (frac * 100).toFixed(1) }
  })

  return (
    <div style={{ ...card, padding: 16, margin: 0 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Despesas por categoria</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, flexShrink: 0 }}>
          {arcos.map((a, i) => <path key={i} d={a.path} fill={a.cor} />)}
          <text x={80} y={78} textAnchor="middle" fontSize="10" fill="#94A3B8">Total</text>
          <text x={80} y={94} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0A1628">{fmtMoney(total).replace('R$ ', 'R$')}</text>
        </svg>
        <div style={{ flex: 1, fontSize: 11 }}>
          {arcos.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, background: a.cor, borderRadius: 2 }}/>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0A1628' }}>{a.label}</span>
              <span style={{ color: '#64748B' }}>{a.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Linha de fluxo projetado (30 dias).
export function FluxoProjetado({ dados }) {
  const [hover, setHover] = useState(null)
  const W = 480, H = 200, M = { l: 50, r: 12, t: 14, b: 26 }
  const min = Math.min(0, ...dados.map(d => d.saldo))
  const max = Math.max(0, ...dados.map(d => d.saldo)); const range = max - min || 1
  const px = i => M.l + (i / Math.max(1, dados.length - 1)) * (W - M.l - M.r)
  const py = v => M.t + (1 - (v - min) / range) * (H - M.t - M.b)
  const path = dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.saldo)}`).join(' ')
  const zeroY = py(0)
  const algumNegativo = dados.some(d => d.saldo < 0)

  return (
    <div style={{ ...card, padding: 16, margin: 0 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Fluxo de caixa projetado (30 dias)</h4>
      {algumNegativo && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '6px 10px', borderRadius: 6, fontSize: 11, marginBottom: 8, fontWeight: 600 }}>⚠️ Saldo projetado fica negativo em algum dia</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
        <line x1={M.l} y1={zeroY} x2={W - M.r} y2={zeroY} stroke="#94A3B8" strokeDasharray="3 3" />
        <text x={M.l - 6} y={zeroY + 3} textAnchor="end" fontSize="9" fill="#94A3B8">0</text>
        <text x={M.l - 6} y={M.t + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{fmtMoney(max).replace('R$ ', '')}</text>
        {min < 0 && <text x={M.l - 6} y={H - M.b + 4} textAnchor="end" fontSize="9" fill="#DC2626">{fmtMoney(min).replace('R$ ', '')}</text>}
        <path d={path} stroke="#2563EB" strokeWidth="2" fill="none" />
        {dados.map((d, i) => (
          <circle key={i} cx={px(i)} cy={py(d.saldo)} r={hover === i ? 4 : 2.5} fill={d.saldo < 0 ? '#DC2626' : '#2563EB'} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
        ))}
        {hover !== null && (
          <g>
            <rect x={px(hover) - 60} y={M.t} width={120} height={32} rx={4} fill="#0F172A" />
            <text x={px(hover)} y={M.t + 13} textAnchor="middle" fontSize="10" fill="#fff">{dados[hover].label}</text>
            <text x={px(hover)} y={M.t + 25} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{fmtMoney(dados[hover].saldo)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

export { MESES_CURTO }
