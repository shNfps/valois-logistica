import { useState, useEffect } from 'react'
import { fmtMoney, fetchClientes } from './db.js'
import { AvatarByNome } from './avatar.jsx'

function getSemIni() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d
}
function getSemFim() {
  const d = getSemIni(); d.setDate(d.getDate() + 6); d.setHours(23, 59, 59); return d
}
function getMesIni() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) }

function MiniCard({ label, icon, nome, avatar, valor, sub, accent, visible, delay = 0 }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 12px',
      display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid rgba(255,255,255,0.1)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(18px)',
      transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.1 }}>
        {icon} {label}
      </div>
      {nome ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AvatarByNome nome={nome} avatar={avatar} size={34} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: accent, lineHeight: 1 }}>{valor}</div>
          {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{sub}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', paddingTop: 8 }}>Sem dados</div>
      )}
    </div>
  )
}

export function PerformanceFlashcard({ pedidos, usuarios = [] }) {
  const [clientes, setClientes] = useState([])
  const [visible, setVisible] = useState(false)
  useEffect(() => { fetchClientes().then(setClientes) }, [])
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t) }, [])

  const avatarMap = {}; usuarios.forEach(u => { avatarMap[u.nome] = u.avatar })

  const semIni = getSemIni(); const semFim = getSemFim(); const mesIni = getMesIni()
  const pedSem = pedidos.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim })
  const pedMes = pedidos.filter(p => new Date(p.criado_em) >= mesIni)

  // 1. Melhor Vendedor da semana (ENTREGUE, por valor)
  const vSem = {}
  pedSem.filter(p => p.status === 'ENTREGUE').forEach(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    const v = c?.vendedor_nome || 'Valois'
    if (!vSem[v]) vSem[v] = { nome: v, valor: 0 }
    vSem[v].valor += Number(p.valor_total) || 0
  })
  const topVendSem = Object.values(vSem).sort((a, b) => b.valor - a.valor)[0]

  // 2. Mais Pedidos criados na semana
  const cSem = {}
  pedSem.forEach(p => {
    const n = p.criado_por; if (!n) return
    if (!cSem[n]) cSem[n] = { nome: n, total: 0 }
    cSem[n].total++
  })
  const topCriador = Object.values(cSem).sort((a, b) => b.total - a.total)[0]

  // 3. Melhor Taxa de aprovação na semana (mínimo 2 pedidos)
  const tSem = {}
  pedSem.forEach(p => {
    const n = p.criado_por; if (!n) return
    if (!tSem[n]) tSem[n] = { nome: n, total: 0, ok: 0 }
    tSem[n].total++; if (p.status === 'ENTREGUE') tSem[n].ok++
  })
  const topTaxa = Object.values(tSem).filter(v => v.total >= 2).sort((a, b) => (b.ok / b.total) - (a.ok / a.total))[0]

  // 4. Destaque do Mês acumulado (ENTREGUE, por valor)
  const vMes = {}
  pedMes.filter(p => p.status === 'ENTREGUE').forEach(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    const v = c?.vendedor_nome || 'Valois'
    if (!vMes[v]) vMes[v] = { nome: v, valor: 0 }
    vMes[v].valor += Number(p.valor_total) || 0
  })
  const topVendMes = Object.values(vMes).sort((a, b) => b.valor - a.valor)[0]

  if (!pedidos.length) return null

  const cards = [
    { label: 'Melhor Vendedor', icon: '🏆', nome: topVendSem?.nome, avatar: topVendSem ? avatarMap[topVendSem.nome] : null, valor: topVendSem ? fmtMoney(topVendSem.valor) : null, sub: 'vendido esta semana', accent: '#FBBF24' },
    { label: 'Mais Pedidos', icon: '📋', nome: topCriador?.nome, avatar: topCriador ? avatarMap[topCriador.nome] : null, valor: topCriador ? `${topCriador.total} pedido${topCriador.total !== 1 ? 's' : ''}` : null, sub: 'criados esta semana', accent: '#60A5FA' },
    { label: 'Melhor Taxa', icon: '✅', nome: topTaxa?.nome, avatar: topTaxa ? avatarMap[topTaxa.nome] : null, valor: topTaxa ? `${Math.round((topTaxa.ok / topTaxa.total) * 100)}%` : null, sub: topTaxa ? `${topTaxa.ok}/${topTaxa.total} entregues` : null, accent: '#34D399' },
    { label: 'Destaque do Mês', icon: '🌟', nome: topVendMes?.nome, avatar: topVendMes ? avatarMap[topVendMes.nome] : null, valor: topVendMes ? fmtMoney(topVendMes.valor) : null, sub: 'mês acumulado', accent: '#C084FC' },
  ]

  return (
    <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 55%,#0F172A 100%)', borderRadius: 20, padding: '18px 20px', marginBottom: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>⚡ Performance da Semana</span>
        <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {cards.map((c, i) => <MiniCard key={c.label} {...c} visible={visible} delay={i * 90} />)}
      </div>
    </div>
  )
}
