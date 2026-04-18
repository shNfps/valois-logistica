import { useState, useEffect, lazy, Suspense } from 'react'
import { getRef, fetchClientes, fetchConfigRanking } from './db.js'

const EloJornadaPanel = lazy(() => import('./elo-jornada.jsx').then(m => ({ default: m.EloJornadaPanel })))

export const ELOS = [
  { id:'bronze',    label:'Bronze',    min:0,     max:499,   emoji:'🛡️',  gradFrom:'#92400E', gradTo:'#B45309', color:'#92400E', bg:'#FEF3C7' },
  { id:'prata',     label:'Prata',     min:500,   max:1499,  emoji:'🛡️',  gradFrom:'#64748B', gradTo:'#94A3B8', color:'#64748B', bg:'#F1F5F9' },
  { id:'ouro',      label:'Ouro',      min:1500,  max:3499,  emoji:'⭐',  gradFrom:'#B45309', gradTo:'#F59E0B', color:'#B45309', bg:'#FFFBEB' },
  { id:'platina',   label:'Platina',   min:3500,  max:5999,  emoji:'💠',  gradFrom:'#1E40AF', gradTo:'#3B82F6', color:'#1E40AF', bg:'#DBEAFE' },
  { id:'esmeralda', label:'Esmeralda', min:6000,  max:9999,  emoji:'💚',  gradFrom:'#065F46', gradTo:'#10B981', color:'#065F46', bg:'#D1FAE5' },
  { id:'diamante',  label:'Diamante',  min:10000, max:Infinity, emoji:'💎', gradFrom:'#7C3AED', gradTo:'#06B6D4', color:'#7C3AED', bg:'#EDE9FE' },
]

export const getElo = (pts) => [...ELOS].reverse().find(e => pts >= e.min) || ELOS[0]

// Retorna MAX(dataCorte, inicioMes) - para aplicar data de corte do ranking
export function getInicioComercial(dataCorte) {
  const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0,0,0,0)
  if (!dataCorte) return mesIni
  const corte = new Date(dataCorte)
  return corte > mesIni ? corte : mesIni
}

// rangeIni/rangeFim opcionais para calcular pontos de períodos anteriores
export function calcPontosComercial(pedidos, userName, rangeIni, rangeFim) {
  const ini = rangeIni || (() => { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })()
  const meus = pedidos.filter(p => { const d=new Date(p.criado_em); return p.criado_por===userName && d>=ini && (!rangeFim||d<=rangeFim) })
  let pts = 0; const logs = []
  meus.forEach(p => { pts += 5; logs.push({ ref: getRef(p), acao: 'Criou pedido', pts: 5 }) })
  meus.filter(p => !p.obs && !['INCOMPLETO','PENDENTE'].includes(p.status)).forEach(p => { pts += 8; logs.push({ ref: getRef(p), acao: 'Aprovado direto', pts: 8 }) })
  meus.filter(p => p.status === 'INCOMPLETO').forEach(p => { pts -= 10; logs.push({ ref: getRef(p), acao: 'Rejeitado pelo galpão', pts: -10 }) })
  meus.filter(p => p.status === 'ENTREGUE').forEach(p => { pts += 10; logs.push({ ref: getRef(p), acao: 'Pedido entregue', pts: 10 }) })
  const dias = {}; meus.forEach(p => { const k=p.criado_em?.slice(0,10); if(!dias[k]){ dias[k]=true; pts+=3; logs.push({ ref: k, acao: 'Primeiro pedido do dia', pts: 3 }) } })
  return { pontos: Math.max(0, pts), logs }
}

export function calcPontosVendedor(pedidos, clientes, userName) {
  const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0,0,0,0)
  const meusC = clientes.filter(c => c.vendedor_nome === userName)
  const cIds = new Set(meusC.map(c => c.id)); const cNomes = new Set(meusC.map(c => c.nome?.toLowerCase()))
  const todos = pedidos.filter(p => cIds.has(p.cliente_id) || cNomes.has(p.cliente?.toLowerCase()))
  const doMes = todos.filter(p => new Date(p.criado_em) >= mesIni)
  let pts = 0; const logs = []
  doMes.forEach(p => { pts += 3; logs.push({ ref: getRef(p), acao: 'Orçamento gerado', pts: 3 }) })
  doMes.filter(p => p.status === 'ENTREGUE').forEach(p => { pts += 10; logs.push({ ref: getRef(p), acao: 'Pedido entregue', pts: 10 }) })
  const clientesMes = [...new Set(doMes.map(p => p.cliente?.toLowerCase()).filter(Boolean))]
  clientesMes.forEach(nc => {
    const hist = todos.filter(p => p.cliente?.toLowerCase()===nc).sort((a,b)=>new Date(a.criado_em)-new Date(b.criado_em))
    if (hist[0] && new Date(hist[0].criado_em) >= mesIni) { pts += 8; logs.push({ ref: nc, acao: 'Cliente novo', pts: 8 }) }
    else if (hist.length > 1) {
      const idx = hist.findIndex(p => new Date(p.criado_em) >= mesIni)
      if (idx > 0 && (new Date(hist[idx].criado_em)-new Date(hist[idx-1].criado_em))/86400000 >= 14) { pts += 15; logs.push({ ref: nc, acao: 'Cliente reativado', pts: 15 }) }
    }
  })
  return { pontos: Math.max(0, pts), logs }
}

export function EloCard({ pontos }) {
  const elo = getElo(pontos); const idx = ELOS.indexOf(elo); const next = ELOS[idx+1]
  const pct = next ? Math.min(((pontos - elo.min) / (next.min - elo.min)) * 100, 100) : 100
  return (
    <div style={{ background: `linear-gradient(135deg,${elo.gradFrom}18,${elo.gradTo}30)`, border: `2px solid ${elo.gradFrom}50`, borderRadius: 20, padding: '28px 20px', textAlign: 'center', marginBottom: 16 }}>
      <style>{`@keyframes ep{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}} @keyframes sbf{from{width:0}} @keyframes shim{0%{left:-100%}100%{left:200%}}`}</style>
      <div style={{ fontSize: 80, lineHeight: 1, animation: 'ep 3s ease-in-out infinite', filter: `drop-shadow(0 6px 18px ${elo.color}66)`, marginBottom: 12 }}>{elo.emoji}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: elo.color, letterSpacing: 3, marginBottom: 4 }}>{elo.label.toUpperCase()}</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>{pontos} pts{next ? ` · faltam ${next.min - pontos} para ${next.label}` : ' · Rank máximo! 🏆'}</div>
      <div style={{ height: 10, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden', marginBottom: 4, position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${elo.gradFrom},${elo.gradTo})`, borderRadius: 5, transition: 'width 1s ease', animation: 'sbf 1s ease', position: 'relative', overflow: 'hidden' }}>
          {elo.id === 'diamante' && <div style={{ position:'absolute', top:0, bottom:0, width:'50%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)', animation:'shim 2s linear infinite', left:0 }}/>}
        </div>
      </div>
      {next && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>{elo.label} → {next.label}</div>}
    </div>
  )
}

export function EloBadge({ pontos }) {
  const elo = getElo(pontos); const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <div onClick={() => setOpen(true)} style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg,${elo.gradFrom},${elo.gradTo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer', boxShadow: `0 2px 6px ${elo.color}55`, flexShrink: 0 }}>{elo.emoji}</div>
      {open && <Suspense fallback={null}><EloJornadaPanel pontos={pontos} onClose={() => setOpen(false)} /></Suspense>}
    </div>
  )
}

export function EloBadgeAuto({ user, pedidos }) {
  const [clientes, setClientes] = useState([])
  const [dataCorte, setDataCorte] = useState(null)
  const setor = (user?.setores || [user?.setor])[0]
  useEffect(() => {
    if (setor === 'vendedor') fetchClientes().then(setClientes)
    if (setor === 'comercial') fetchConfigRanking().then(c => setDataCorte(c?.data_corte_comercial || null))
  }, [setor])
  if (!['comercial','vendedor'].includes(setor)) return null
  const ini = setor === 'comercial' ? getInicioComercial(dataCorte) : undefined
  const pontos = setor === 'comercial' ? calcPontosComercial(pedidos, user?.nome, ini).pontos : calcPontosVendedor(pedidos, clientes, user?.nome).pontos
  return <EloBadge pontos={pontos} />
}
