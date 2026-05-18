import { useState } from 'react'
import { statusAtraso, fmtMoney, btnSmall, card } from './db.js'
import { criarNotificacao } from './notificacoes.js'

// Cores e ícones por nível de atraso.
const NIVEL = {
  atrasado: { cor: '#DC2626', bg: '#FEE2E2', borda: '#FECACA', icone: '🔴', label: 'ATRASADO' },
  hoje:     { cor: '#EA580C', bg: '#FFEDD5', borda: '#FED7AA', icone: '🟠', label: 'HOJE' },
  amanha:   { cor: '#CA8A04', bg: '#FEF9C3', borda: '#FDE68A', icone: '🟡', label: 'AMANHÃ' }
}

export const atrasoKeyframes = `@keyframes atraso-pulse{0%,100%{box-shadow:inset 4px 0 0 0 #DC2626}50%{box-shadow:inset 4px 0 0 0 rgba(220,38,38,0.35)}}`

// Badge compacto pra colocar ao lado do Badge de status.
export function AtrasoBadge({ pedido, compact }) {
  const s = statusAtraso(pedido); if (!s) return null
  const c = NIVEL[s.nivel]
  return (
    <span title={s.texto} style={{ background: c.bg, color: c.cor, border: `1px solid ${c.borda}`, fontWeight: 700, fontSize: compact ? 10 : 11, padding: compact ? '2px 6px' : '3px 8px', borderRadius: 8, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {c.icone} {compact ? c.label : s.texto}
    </span>
  )
}

// Estilo de borda esquerda + pulse pra row de pedido atrasado/hoje/amanhã.
export function atrasoRowStyle(pedido) {
  const s = statusAtraso(pedido); if (!s) return {}
  const c = NIVEL[s.nivel]
  const base = { borderLeft: `4px solid ${c.cor}` }
  if (s.nivel === 'atrasado') base.animation = 'atraso-pulse 1.6s ease-in-out infinite'
  return base
}

// Card destacado pro dashboard do Admin.
export function AlertasDashboardCard({ pedidos }) {
  const [open, setOpen] = useState(false)
  const comAlerta = pedidos.map(p => ({ p, s: statusAtraso(p) })).filter(x => x.s)
  if (comAlerta.length === 0) return null
  const atrasados = comAlerta.filter(x => x.s.nivel === 'atrasado')
  const hoje = comAlerta.filter(x => x.s.nivel === 'hoje')
  const amanha = comAlerta.filter(x => x.s.nivel === 'amanha')
  const totalAtrasado = atrasados.reduce((s, x) => s + (Number(x.p.valor_total) || 0), 0)
  const lista = [...atrasados, ...hoje, ...amanha]
  return (
    <div style={{ ...card, padding: 0, marginBottom: 16, overflow: 'hidden', borderLeft: '4px solid #DC2626' }}>
      <div style={{ padding: '14px 18px', background: 'linear-gradient(90deg,#FEE2E2,#fff)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B', letterSpacing: 0.5, textTransform: 'uppercase' }}>⚠️ Pedidos com Atraso na Entrega</div>
          <div style={{ fontSize: 11, color: '#7F1D1D', marginTop: 2 }}>{comAlerta.length} pedido(s) em alerta · {fmtMoney(totalAtrasado)} atrasado</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pastilha cor="#DC2626" bg="#FEE2E2" label="Atrasados" n={atrasados.length} />
          <Pastilha cor="#EA580C" bg="#FFEDD5" label="Hoje" n={hoje.length} />
          <Pastilha cor="#CA8A04" bg="#FEF9C3" label="Amanhã" n={amanha.length} />
          <button onClick={() => setOpen(o => !o)} style={{ ...btnSmall, fontSize: 11, padding: '6px 12px', background: '#991B1B', color: '#fff', border: 'none' }}>{open ? 'Ocultar' : 'Ver todos'}</button>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #FECACA', maxHeight: 360, overflowY: 'auto' }}>
          {lista.map(({ p, s }) => {
            const c = NIVEL[s.nivel]
            return (
              <div key={p.id} style={{ padding: '10px 18px', borderBottom: '1px solid #F1F5F9', borderLeft: `4px solid ${c.cor}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: c.cor, fontSize: 11, fontWeight: 700, minWidth: 110 }}>{c.icone} {s.texto}</span>
                <span style={{ fontWeight: 700, color: '#0A1628', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
                {p.cidade && <span style={{ fontSize: 11, color: '#64748B' }}>📍 {p.cidade}</span>}
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: 6 }}>{p.status}</span>
                {p.valor_total > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>{fmtMoney(p.valor_total)}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Pastilha({ cor, bg, label, n }) {
  if (!n) return null
  return <span style={{ background: bg, color: cor, fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{n} {label}</span>
}

// Card-resumo pro Comercial: "X pedidos para entregar hoje" + atrasados em vermelho.
export function ResumoComercialAtrasos({ pedidos }) {
  const comAlerta = pedidos.map(p => ({ p, s: statusAtraso(p) })).filter(x => x.s)
  if (comAlerta.length === 0) return null
  const atrasados = comAlerta.filter(x => x.s.nivel === 'atrasado').length
  const hoje = comAlerta.filter(x => x.s.nivel === 'hoje').length
  const amanha = comAlerta.filter(x => x.s.nivel === 'amanha').length
  return (
    <div style={{ ...card, padding: '12px 16px', marginBottom: 12, borderLeft: `4px solid ${atrasados ? '#DC2626' : '#EA580C'}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: atrasados ? '#FEF2F2' : '#FFF7ED' }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: atrasados ? '#991B1B' : '#9A3412' }}>
          {atrasados > 0 ? `${atrasados} pedido(s) atrasado(s)` : `${hoje} pedido(s) para entregar hoje`}
        </div>
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
          {hoje > 0 && `${hoje} para hoje · `}{amanha > 0 && `${amanha} para amanhã`}
        </div>
      </div>
      <Pastilha cor="#DC2626" bg="#FEE2E2" label="Atrasados" n={atrasados} />
      <Pastilha cor="#EA580C" bg="#FFEDD5" label="Hoje" n={hoje} />
      <Pastilha cor="#CA8A04" bg="#FEF9C3" label="Amanhã" n={amanha} />
    </div>
  )
}

// Filtra pedidos cujo status de atraso está em níveis informados (default: atrasado+hoje).
export function filtrarAtrasos(pedidos, niveis = ['atrasado', 'hoje']) {
  return pedidos.filter(p => { const s = statusAtraso(p); return s && niveis.includes(s.nivel) })
}

// Dispara notificações para pedidos atrasados/de hoje. Dedup por pedido+nivel+dia via localStorage.
// Chamar uma vez por sessão (App.jsx no load).
export async function notificarAtrasos(pedidos) {
  if (!pedidos?.length || typeof window === 'undefined') return
  const hoje = new Date().toISOString().slice(0, 10)
  for (const p of pedidos) {
    const s = statusAtraso(p); if (!s) continue
    if (s.nivel !== 'atrasado' && s.nivel !== 'hoje') continue
    const key = `valois-notif-atraso-${p.id}-${s.nivel}-${hoje}`
    try { if (window.localStorage.getItem(key)) continue } catch { continue }
    if (s.nivel === 'atrasado') {
      await criarNotificacao('admin', `🔴 Pedido ATRASADO ${p.numero_ref || ''}`, `${p.cliente} - ${p.cidade} · ${s.texto}`, p.id)
      await criarNotificacao('comercial', `🔴 Pedido ATRASADO ${p.numero_ref || ''}`, `${p.cliente} - ${p.cidade} · ${s.texto}`, p.id)
    } else {
      await criarNotificacao('comercial', `🟠 Entregar hoje: ${p.cliente}`, `${p.cidade} · NF ${p.numero_nf || 'pendente'}`, p.id)
      await criarNotificacao('motorista', `🟠 Entregar hoje: ${p.cliente}`, `${p.cidade} · NF ${p.numero_nf || 'pendente'}`, p.id)
    }
    try { window.localStorage.setItem(key, '1') } catch {}
  }
}
