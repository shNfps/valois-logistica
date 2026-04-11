import { useState, useEffect } from 'react'
import { fmtMoney, fetchClientes, fetchMetas } from './db.js'
import { AvatarByNome } from './avatar.jsx'
import { RankingDetalhe } from './ranking-detalhe.jsx'

const ANIM = `
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes pgold{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,0.05)}50%{box-shadow:0 0 22px rgba(245,158,11,0.28),0 2px 8px rgba(0,0,0,0.05)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
`

function getPeriodo(p) {
  const now = new Date()
  if (p === 'semana') { const ini = new Date(now); ini.setDate(now.getDate()-now.getDay()); ini.setHours(0,0,0,0); const fim = new Date(ini); fim.setDate(ini.getDate()+6); fim.setHours(23,59,59); return [ini,fim] }
  if (p === 'mes-anterior') return [new Date(now.getFullYear(),now.getMonth()-1,1), new Date(now.getFullYear(),now.getMonth(),0,23,59,59)]
  if (p === '3meses') return [new Date(now.getFullYear(),now.getMonth()-2,1), new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59)]
  return [new Date(now.getFullYear(),now.getMonth(),1), new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59)]
}

function posColor(i) { return i===0?'#F59E0B':i===1?'#94A3B8':i===2?'#D97706':'#CBD5E1' }
function posTextColor(i) { return i<3?'#fff':'#64748B' }

function PosCircle({ pos }) {
  return <div style={{ width:28,height:28,borderRadius:'50%',background:posColor(pos),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:posTextColor(pos),flexShrink:0 }}>{pos+1}</div>
}

function MetaBadge() {
  return <span style={{ fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:6,color:'#fff',letterSpacing:0.5,background:'linear-gradient(90deg,#10B981 25%,#34D399 50%,#10B981 75%)',backgroundSize:'200% auto',animation:'shimmer 3s linear infinite' }}>META ✓</span>
}

function MetaBar({ pct, animado }) {
  const [w, setW] = useState(0)
  useEffect(() => { if (animado) { const t = setTimeout(() => setW(Math.min(pct,100)), 200); return () => clearTimeout(t) } else setW(Math.min(pct,100)) }, [pct, animado])
  const cor = pct >= 100 ? '#10B981' : '#1E293B'
  return (
    <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:3 }}>
      <div style={{ flex:1,height:4,background:'#F1F5F9',borderRadius:2,overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${w}%`,background:cor,borderRadius:2,transition:'width 1s ease' }} />
      </div>
      <span style={{ fontSize:10,fontWeight:700,color:cor,width:34,textAlign:'right' }}>{Math.round(pct)}%</span>
    </div>
  )
}

function RankingRow({ item, pos, avatarMap, metaValor, animado, delay, expandido, onToggle, pedidos, clientes, tipo, readonly, isLogado }) {
  const [hov, setHov] = useState(false)
  const ticket = item.count > 0 ? item.valor / item.count : 0
  const pct = metaValor > 0 ? (item.valor / metaValor) * 100 : 0
  const isFirst = pos === 0
  return (
    <div style={{ opacity: animado?1:0, transform: animado?'translateY(0)':'translateY(16px)', transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms` }}>
      <div onClick={() => !readonly && onToggle(item.nome)}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,marginBottom:6,cursor:readonly?'default':'pointer',
          background: isLogado?'#EFF6FF': isFirst?'#FFFDF5':'#fff',
          border: isLogado?'2px solid #BFDBFE': isFirst?'1px solid #FDE68A':'1px solid #F1F5F9',
          animation: isFirst?'pgold 2.8s ease-in-out infinite':'none',
          transform: hov&&!readonly?'translateX(4px)':'translateX(0)',
          boxShadow: hov&&!readonly?'0 4px 16px rgba(0,0,0,0.1)':'0 1px 3px rgba(0,0,0,0.04)',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }}>
        <PosCircle pos={pos} />
        <AvatarByNome nome={item.nome} avatar={avatarMap[item.nome]} size={36} rank={pos < 3 ? pos : undefined} />
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:1 }}>
            <span style={{ fontSize:14,fontWeight:700,color:'#0A1628',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.nome}</span>
            {pct >= 100 && <MetaBadge />}
            {isLogado && <span style={{ fontSize:10,fontWeight:700,color:'#3B82F6',background:'#DBEAFE',padding:'1px 6px',borderRadius:5 }}>você</span>}
          </div>
          {metaValor > 0 && <MetaBar pct={pct} animado={animado} />}
          <div style={{ fontSize:10,color:'#94A3B8',marginTop:3 }}>{item.count} pedido{item.count!==1?'s':''} · TM {fmtMoney(ticket)}</div>
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <div style={{ fontSize:15,fontWeight:800,color:'#059669' }}>{fmtMoney(item.valor)}</div>
          {!readonly && <span style={{ fontSize:11,color:'#CBD5E1' }}>{expandido?'▲':'▼'}</span>}
        </div>
      </div>
      {expandido && <RankingDetalhe nome={item.nome} tipo={tipo} pedidos={pedidos} clientes={clientes} />}
    </div>
  )
}

function computeRanking(tipo, pedidos, clientes, ini, fim) {
  const map = {}
  pedidos.filter(p => { const d = new Date(p.criado_em); return d >= ini && d <= fim }).forEach(p => {
    const n = tipo === 'comercial' ? p.criado_por : (() => { const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase()); return c?.vendedor_nome || 'Valois' })()
    if (!n) return
    if (!map[n]) map[n] = { nome: n, count: 0, valor: 0 }
    map[n].count++
    if (p.status === 'ENTREGUE') map[n].valor += Number(p.valor_total) || 0
  })
  return Object.values(map).sort((a, b) => b.valor - a.valor)
}

const PERIODOS = [['semana','Esta semana'],['mes','Este mês'],['mes-anterior','Mês anterior'],['3meses','Últ. 3 meses']]

export function RankingPage({ pedidos, usuarios=[], userLogado, readonly=false, tipoInicial, onIrPara }) {
  const [tipo, setTipo] = useState(tipoInicial || 'vendedor')
  const [periodo, setPeriodo] = useState('mes')
  const [clientes, setClientes] = useState([])
  const [metas, setMetas] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [animado, setAnimado] = useState(false)

  useEffect(() => { fetchClientes().then(setClientes); fetchMetas().then(setMetas) }, [])
  useEffect(() => { setAnimado(false); const t = setTimeout(() => setAnimado(true), 80); return () => clearTimeout(t) }, [tipo, periodo])

  const avatarMap = {}; usuarios.forEach(u => { avatarMap[u.nome] = u.avatar })
  const [ini, fim] = getPeriodo(periodo)
  const ranking = computeRanking(tipo, pedidos, clientes, ini, fim)
  const metaTipo = periodo === 'semana' ? 'semanal' : 'mensal'
  const metaValor = Number(metas.find(m => m.tipo === metaTipo && !m.vendedor_nome)?.valor_meta || 0)

  const posLogado = ranking.findIndex(r => r.nome === userLogado)

  return (
    <div>
      <style>{ANIM}</style>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10 }}>
        <div>
          <h2 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,color:'#0A1628' }}>Ranking de Vendas</h2>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:'#10B981',display:'inline-block',animation:'pulse 1.2s ease-in-out infinite' }} />
            <span style={{ fontSize:11,fontWeight:700,color:'#64748B',letterSpacing:1 }}>AO VIVO</span>
          </div>
        </div>
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
          {PERIODOS.map(([k,l]) => <button key={k} onClick={() => setPeriodo(k)} style={{ padding:'5px 10px',borderRadius:20,border:'none',cursor:'pointer',background:periodo===k?'#0A1628':'#E2E8F0',color:periodo===k?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit' }}>{l}</button>)}
        </div>
      </div>
      {userLogado && posLogado >= 0 && <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#1D4ED8',fontWeight:600 }}>Você está em {posLogado+1}º lugar 🏆</div>}
      <div style={{ display:'flex',gap:0,marginBottom:16,background:'#F1F5F9',borderRadius:10,padding:3 }}>
        {[['vendedor','💰 Vendedores'],['comercial','📋 Time Comercial']].map(([k,l]) => <button key={k} onClick={() => setTipo(k)} style={{ flex:1,padding:'8px 0',border:'none',cursor:'pointer',borderRadius:8,background:tipo===k?'#0A1628':'transparent',color:tipo===k?'#fff':'#64748B',fontSize:12,fontWeight:700,fontFamily:'inherit',transition:'all 0.18s' }}>{l}</button>)}
      </div>
      {ranking.length===0 && <div style={{ textAlign:'center',padding:40,color:'#94A3B8' }}>Sem dados no período</div>}
      {ranking.map((item, i) => (
        <RankingRow key={item.nome} item={item} pos={i} avatarMap={avatarMap} metaValor={metaValor}
          animado={animado} delay={i * 90} expandido={expandido===item.nome}
          onToggle={n => setExpandido(v => v===n?null:n)}
          pedidos={pedidos} clientes={clientes} tipo={tipo}
          readonly={readonly} isLogado={userLogado===item.nome}
        />
      ))}
    </div>
  )
}
