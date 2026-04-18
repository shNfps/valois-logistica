import { useState, useEffect, useRef } from 'react'
import { fmtMoney, fetchClientes, fetchMetas, fetchConfigRanking, updateConfigRanking, inputStyle, btnSmall, card } from './db.js'
import { AvatarByNome } from './avatar.jsx'
import { RankingDetalhe } from './ranking-detalhe.jsx'
import { PodioPodium } from './ranking-podio.jsx'
import { getInicioComercial } from './performance-rank.jsx'

const ANIM = `
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes pgold{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,0.05)}50%{box-shadow:0 0 22px rgba(245,158,11,0.28),0 2px 8px rgba(0,0,0,0.05)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #10B981}50%{box-shadow:0 0 12px #10B981,0 0 28px #10B98155}}
@keyframes rowshimmer{0%{background-position:-400% center}100%{background-position:400% center}}
@keyframes metapop{0%{transform:scale(0.85)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
`

function useCountUp(target, active) {
  const [val, setVal] = useState(0)
  const raf = useRef()
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!active) { setVal(0); return }
    const start = performance.now()
    const tick = now => {
      const p = Math.min((now - start) / 1500, 1)
      setVal(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, active])
  return val
}

function getPeriodo(p) {
  const now = new Date()
  if (p === 'semana') { const ini = new Date(now); ini.setDate(now.getDate()-now.getDay()); ini.setHours(0,0,0,0); const fim = new Date(ini); fim.setDate(ini.getDate()+6); fim.setHours(23,59,59); return [ini,fim] }
  if (p === 'mes-anterior') return [new Date(now.getFullYear(),now.getMonth()-1,1), new Date(now.getFullYear(),now.getMonth(),0,23,59,59)]
  if (p === '3meses') return [new Date(now.getFullYear(),now.getMonth()-2,1), new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59)]
  return [new Date(now.getFullYear(),now.getMonth(),1), new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59)]
}

const posColor = i => i===0?'#F59E0B':i===1?'#94A3B8':i===2?'#D97706':'#CBD5E1'
function PosCircle({ pos }) {
  return <div style={{ width:28,height:28,borderRadius:'50%',background:posColor(pos),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:pos<3?'#fff':'#64748B',flexShrink:0 }}>{pos+1}</div>
}
function MetaBadge() {
  return <span style={{ fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:6,color:'#fff',letterSpacing:0.5,background:'linear-gradient(90deg,#10B981 25%,#34D399 50%,#10B981 75%)',backgroundSize:'200% auto',animation:'shimmer 3s linear infinite,metapop 0.35s ease' }}>META ✓</span>
}
function MetaBar({ pct, animado }) {
  const [w, setW] = useState(0)
  useEffect(() => { if (animado) { const t = setTimeout(() => setW(Math.min(pct,100)), 200); return () => clearTimeout(t) } else setW(Math.min(pct,100)) }, [pct, animado])
  const cor = pct >= 100 ? '#10B981' : '#3B82F6'
  return (
    <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:3 }}>
      <div style={{ flex:1,height:4,background:'#F1F5F9',borderRadius:2,overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${w}%`,background:cor,borderRadius:2,transition:'width 1s ease' }} />
      </div>
      <span style={{ fontSize:10,fontWeight:700,color:cor,width:34,textAlign:'right' }}>{Math.round(pct)}%</span>
    </div>
  )
}
function CompBadge() {
  return <div style={{ textAlign:'center',padding:'2px 0 6px',fontSize:11,fontWeight:700,color:'#F59E0B',letterSpacing:0.5 }}>⚡ Disputa acirrada!</div>
}
function CountMoney({ value, active }) {
  const v = useCountUp(value, active)
  return <>{fmtMoney(v)}</>
}

function RankingRow({ item, pos, avatarMap, metaValor, animado, delay, expandido, onToggle, pedidos, clientes, tipo, readonly, isLogado }) {
  const [hov, setHov] = useState(false)
  const pct = metaValor > 0 ? (item.valor / metaValor) * 100 : 0
  const isFirst = pos === 0
  const ticket = item.count > 0 ? item.valor / item.count : 0
  const taxaAprov = item.count > 0 ? Math.round((item.entregues / item.count) * 100) : 0
  const comissao = item.valor * 0.05
  const bg = isFirst ? 'linear-gradient(90deg,#FFFDF5 0%,#FEF3C7 40%,#FFFDF5 60%,#FEF3C7 100%)' : isLogado ? '#EFF6FF' : '#fff'
  return (
    <div style={{ opacity:animado?1:0,transform:animado?'translateY(0)':'translateY(16px)',transition:`opacity 0.4s ease ${delay}ms,transform 0.4s ease ${delay}ms` }}>
      <div onClick={() => !readonly && onToggle(item.nome)}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,marginBottom:6,cursor:readonly?'default':'pointer',
          background:bg, backgroundSize:isFirst?'400% auto':'auto',
          animation:isFirst?`pgold 2.8s ease-in-out infinite,rowshimmer 5s linear infinite`:'none',
          border:isLogado?'2px solid #BFDBFE':isFirst?'1px solid #FDE68A':'1px solid #F1F5F9',
          transform:hov&&!readonly?'translateX(4px)':'translateX(0)',
          boxShadow:hov&&!readonly?'0 4px 16px rgba(0,0,0,0.1)':'0 1px 3px rgba(0,0,0,0.04)',
          transition:'transform 0.18s ease,box-shadow 0.18s ease',
        }}>
        <PosCircle pos={pos} />
        <AvatarByNome nome={item.nome} avatar={avatarMap[item.nome]} size={36} rank={pos < 3 ? pos : undefined} />
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:1 }}>
            <span style={{ fontSize:13,fontWeight:700,color:'#0A1628',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.nome.split(' ')[0]}</span>
            {pct >= 100 && <MetaBadge />}
            {isLogado && <span style={{ fontSize:10,fontWeight:700,color:'#3B82F6',background:'#DBEAFE',padding:'1px 6px',borderRadius:5 }}>você</span>}
          </div>
          {metaValor > 0 && <MetaBar pct={pct} animado={animado} />}
          {tipo === 'vendedor'
            ? <div style={{ fontSize:10,color:'#94A3B8',marginTop:2 }}>{item.clientesAtivos} clientes · {item.count} pedidos · comissão {fmtMoney(comissao)}</div>
            : <div style={{ fontSize:10,color:'#94A3B8',marginTop:2 }}>{item.count} pedidos · TM {fmtMoney(ticket)} · aprovação {taxaAprov}%</div>}
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <div style={{ fontSize:15,fontWeight:800,color:'#059669' }}><CountMoney value={item.valor} active={animado} /></div>
          {!readonly && <span style={{ fontSize:11,color:'#CBD5E1' }}>{expandido?'▲':'▼'}</span>}
        </div>
      </div>
      {expandido && <RankingDetalhe nome={item.nome} tipo={tipo} pedidos={pedidos} clientes={clientes} />}
    </div>
  )
}

const FATURADOS = ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE']

function computeRanking(tipo, pedidos, clientes, ini, fim) {
  const map = {}
  pedidos.filter(p => { const d = new Date(p.criado_em); return d >= ini && d <= fim }).forEach(p => {
    const n = tipo === 'comercial' ? p.criado_por : (() => { const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase()); return c?.vendedor_nome || null })()
    if (!n) return
    if (!map[n]) map[n] = { nome: n, count: 0, valor: 0, entregues: 0, clientesSet: new Set() }
    map[n].count++
    if (FATURADOS.includes(p.status)) { map[n].valor += Number(p.valor_total) || 0; map[n].entregues++ }
    if (tipo === 'vendedor' && p.cliente) map[n].clientesSet.add(p.cliente)
  })
  return Object.values(map).map(r => ({ nome:r.nome,count:r.count,valor:r.valor,entregues:r.entregues,clientesAtivos:r.clientesSet.size })).sort((a, b) => b.valor - a.valor)
}

const PERIODOS = [['semana','Esta semana'],['mes','Este mês'],['mes-anterior','Mês anterior'],['3meses','Últ. 3 meses']]
const FULL_TITLE = 'Ranking de Vendas'

function ResetRankingModal({ onClose, onSaved }) {
  const [dataCorte, setDataCorte] = useState(new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)
  const agora = new Date().toISOString().slice(0, 16)
  const hojeIni = new Date(); hojeIni.setHours(0,0,0,0)
  const semIni = new Date(); semIni.setDate(semIni.getDate()-semIni.getDay()); semIni.setHours(0,0,0,0)
  const salvar = async () => {
    if (!confirm('Confirma o reset do ranking comercial?')) return
    setSaving(true)
    await updateConfigRanking({ data_corte_comercial: new Date(dataCorte).toISOString() })
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:380,padding:24 }}>
        <h3 style={{ margin:'0 0 16px',fontSize:16,fontWeight:700 }}>🔄 Resetar Ranking Comercial</h3>
        <p style={{ fontSize:13,color:'#64748B',margin:'0 0 14px' }}>Pedidos antes da data escolhida não contarão para pontos e elo.</p>
        <div style={{ display:'flex',gap:6,marginBottom:12,flexWrap:'wrap' }}>
          <button onClick={() => setDataCorte(agora)} style={{ ...btnSmall,fontSize:11,padding:'4px 10px',color:'#3B82F6' }}>Agora</button>
          <button onClick={() => setDataCorte(hojeIni.toISOString().slice(0,16))} style={{ ...btnSmall,fontSize:11,padding:'4px 10px',color:'#3B82F6' }}>Início de hoje</button>
          <button onClick={() => setDataCorte(semIni.toISOString().slice(0,16))} style={{ ...btnSmall,fontSize:11,padding:'4px 10px',color:'#3B82F6' }}>Início da semana</button>
        </div>
        <input type="datetime-local" value={dataCorte} onChange={e => setDataCorte(e.target.value)} style={{ ...inputStyle,marginBottom:16 }} />
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ ...btnSmall,flex:1,justifyContent:'center' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ flex:2,height:42,borderRadius:10,border:'none',background:'#EF4444',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif",opacity:saving?0.6:1 }}>{saving ? 'Salvando...' : 'Confirmar Reset'}</button>
        </div>
      </div>
    </div>
  )
}

export function RankingPage({ pedidos, usuarios=[], userLogado, readonly=false, tipoInicial, isAdmin=false }) {
  const [tipo, setTipo] = useState(tipoInicial || 'vendedor')
  const [periodo, setPeriodo] = useState('mes')
  const [clientes, setClientes] = useState([])
  const [metas, setMetas] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [fade, setFade] = useState(1)
  const [animado, setAnimado] = useState(false)
  const [title, setTitle] = useState('')
  const [configRanking, setConfigRanking] = useState(null)
  const [showReset, setShowReset] = useState(false)

  const loadConfig = () => fetchConfigRanking().then(setConfigRanking)
  useEffect(() => { fetchClientes().then(setClientes); fetchMetas().then(setMetas); loadConfig() }, [])
  useEffect(() => {
    setFade(0)
    const t = setTimeout(() => { setAnimado(false); setFade(1); setTimeout(() => setAnimado(true), 80) }, 250)
    return () => clearTimeout(t)
  }, [tipo, periodo])
  useEffect(() => {
    setTitle(''); let i = 0
    const iv = setInterval(() => { i++; setTitle(FULL_TITLE.slice(0, i)); if (i >= FULL_TITLE.length) clearInterval(iv) }, 50)
    return () => clearInterval(iv)
  }, [])

  const avatarMap = {}; usuarios.forEach(u => { avatarMap[u.nome] = u.avatar })
  const [ini, fim] = getPeriodo(periodo)
  const dataCorteComercial = configRanking?.data_corte_comercial || null
  const iniEfetivo = tipo === 'comercial' && (periodo === 'mes' || periodo === 'semana')
    ? (() => { const corte = getInicioComercial(dataCorteComercial); return corte > ini ? corte : ini })()
    : ini
  const ranking = computeRanking(tipo, pedidos, clientes, iniEfetivo, fim)
  const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0,0,0,0)
  const showBanner = tipo === 'comercial' && dataCorteComercial && getInicioComercial(dataCorteComercial) > mesIni
  const metaTipo = periodo === 'semana' ? 'semanal' : 'mensal'
  const metaValor = Number(metas.find(m => m.tipo === metaTipo && !m.vendedor_nome)?.valor_meta || 0)
  const posLogado = ranking.findIndex(r => r.nome === userLogado)
  const maxVal = ranking[0]?.valor || 1

  return (
    <div style={{ opacity:fade, transition:'opacity 0.25s ease' }}>
      <style>{ANIM}</style>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10 }}>
        <div>
          <h2 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,color:'#0A1628',display:'flex',alignItems:'center',gap:6 }}>
            {title}<span style={{ opacity:title.length < FULL_TITLE.length ? 1 : 0, animation:'pulse 0.7s step-start infinite' }}>|</span>
            <span title="Valor calculado sobre pedidos faturados (NF emitida, em rota ou entregue)" style={{ fontSize:14,cursor:'help',color:'#94A3B8' }}>ℹ️</span>
          </h2>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:'#10B981',display:'inline-block',animation:'pulse 1.2s ease-in-out infinite,glow 1.2s ease-in-out infinite' }} />
            <span style={{ fontSize:11,fontWeight:700,color:'#64748B',letterSpacing:1 }}>AO VIVO</span>
          </div>
        </div>
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
          {PERIODOS.map(([k,l]) => <button key={k} onClick={() => setPeriodo(k)} style={{ padding:'5px 10px',borderRadius:20,border:'none',cursor:'pointer',background:periodo===k?'#0A1628':'#E2E8F0',color:periodo===k?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit' }}>{l}</button>)}
        </div>
      </div>
      {!readonly && ranking.length > 0 && <PodioPodium top3={ranking.slice(0,3)} avatarMap={avatarMap} />}
      {userLogado && posLogado >= 0 && <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'8px 14px',marginBottom:12,fontSize:13,color:'#1D4ED8',fontWeight:600 }}>Você está em {posLogado+1}º lugar 🏆</div>}
      <div style={{ display:'flex',gap:0,marginBottom:16,background:'#F1F5F9',borderRadius:10,padding:3 }}>
        {[['vendedor','💰 Vendedores'],['comercial','📋 Time Comercial']].map(([k,l]) => <button key={k} onClick={() => setTipo(k)} style={{ flex:1,padding:'8px 0',border:'none',cursor:'pointer',borderRadius:8,background:tipo===k?'#0A1628':'transparent',color:tipo===k?'#fff':'#64748B',fontSize:12,fontWeight:700,fontFamily:'inherit',transition:'all 0.18s' }}>{l}</button>)}
      </div>
      {showBanner && <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:12,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8 }}>
        <span style={{ fontSize:13,color:'#1D4ED8',fontWeight:600 }}>ℹ️ Ranking atualizado em {new Date(dataCorteComercial).toLocaleDateString('pt-BR')}. Pontos contados a partir desta data.</span>
        {isAdmin && <button onClick={() => setShowReset(true)} style={{ ...btnSmall,fontSize:11,padding:'4px 10px',color:'#EF4444',borderColor:'#FECACA' }}>🔄 Resetar Ranking</button>}
      </div>}
      {isAdmin && tipo === 'comercial' && !showBanner && <div style={{ textAlign:'right',marginBottom:10 }}><button onClick={() => setShowReset(true)} style={{ ...btnSmall,fontSize:11,padding:'4px 10px',color:'#EF4444',borderColor:'#FECACA' }}>🔄 Resetar Ranking</button></div>}
      {ranking.length === 0 && <div style={{ textAlign:'center',padding:40,color:'#94A3B8' }}>Sem dados no período</div>}
      {showReset && <ResetRankingModal onClose={() => setShowReset(false)} onSaved={loadConfig} />}
      {ranking.map((item, i) => {
        const nextVal = ranking[i+1]?.valor || 0
        const showComp = i < ranking.length - 1 && Math.abs(item.valor - nextVal) / maxVal < 0.05
        return (
          <div key={item.nome}>
            <RankingRow item={item} pos={i} avatarMap={avatarMap} metaValor={metaValor}
              animado={animado} delay={i * 90} expandido={expandido === item.nome}
              onToggle={n => setExpandido(v => v===n?null:n)}
              pedidos={pedidos} clientes={clientes} tipo={tipo}
              readonly={readonly} isLogado={userLogado === item.nome}
            />
            {showComp && <CompBadge />}
          </div>
        )
      })}
    </div>
  )
}
