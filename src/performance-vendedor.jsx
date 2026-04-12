import { useState, useEffect } from 'react'
import { fmtMoney, fmt, getRef, card, fetchClientes, fetchMetas, STATUS_MAP } from './db.js'
import { BarraProgresso } from './comissoes-metas.jsx'
import { EloCard, calcPontosVendedor } from './performance-rank.jsx'

export function PerformanceVendedorTab({ user, pedidos }) {
  const [clientes, setClientes] = useState([])
  const [metas, setMetas] = useState([])
  useEffect(() => { fetchClientes().then(setClientes) }, []) // eslint-disable-line
  useEffect(() => { fetchMetas().then(setMetas) }, []) // eslint-disable-line

  const now = new Date()
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)
  const semIni = new Date(now); semIni.setDate(now.getDate()-now.getDay()); semIni.setHours(0,0,0,0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate()+6); semFim.setHours(23,59,59)

  const meusC = clientes.filter(c => c.vendedor_nome === user.nome)
  const cIds = new Set(meusC.map(c => c.id)); const cNomes = new Set(meusC.map(c => c.nome?.toLowerCase()))
  const todos = pedidos.filter(p => cIds.has(p.cliente_id) || cNomes.has(p.cliente?.toLowerCase()))
  const doMes = todos.filter(p => new Date(p.criado_em) >= mesIni)
  const entregues = doMes.filter(p => p.status === 'ENTREGUE')
  const valorMes = entregues.reduce((s,p) => s+(Number(p.valor_total)||0), 0)
  const clientesAtivos = new Set(doMes.map(p => p.cliente?.toLowerCase()).filter(Boolean)).size

  const validos = todos.filter(p => ['NF_EMITIDA','EM_ROTA','ENTREGUE'].includes(p.status))
  const tSem = validos.filter(p => { const d=new Date(p.criado_em); return d>=semIni&&d<=semFim }).reduce((s,p)=>s+(Number(p.valor_total)||0),0)
  const tMes = validos.filter(p => new Date(p.criado_em)>=mesIni).reduce((s,p)=>s+(Number(p.valor_total)||0),0)
  const mSemana = metas.find(m => m.tipo==='semanal'&&(!m.vendedor_nome||m.vendedor_nome===user.nome))
  const mMes = metas.find(m => m.tipo==='mensal'&&(!m.vendedor_nome||m.vendedor_nome===user.nome))

  const cMap = {}; doMes.forEach(p => { const k=p.cliente?.toLowerCase(); if(!k)return; if(!cMap[k])cMap[k]={nome:p.cliente,valor:0,qtd:0}; cMap[k].valor+=Number(p.valor_total)||0; cMap[k].qtd++ })
  const top5 = Object.values(cMap).sort((a,b)=>b.valor-a.valor).slice(0,5)
  const { pontos } = calcPontosVendedor(pedidos, clientes, user.nome)
  const ultimos = [...doMes].sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em)).slice(0,15)

  return (
    <div>
      <EloCard pontos={pontos}/>
      <div style={{...card,padding:'16px 20px',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>📊 Meu Mês</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'#F0FDF4',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#166534',fontWeight:600,marginBottom:4}}>💰 Comissão</div>
            <div style={{fontSize:22,fontWeight:800,color:'#059669'}}>{fmtMoney(valorMes*0.05)}</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>5% de {fmtMoney(valorMes)}</div>
          </div>
          <div style={{background:'#EFF6FF',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#1E40AF',fontWeight:600,marginBottom:4}}>📦 Pedidos</div>
            <div style={{fontSize:22,fontWeight:800,color:'#2563EB'}}>{doMes.length}</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>{entregues.length} entregues</div>
          </div>
          <div style={{background:'#FFF7ED',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#92400E',fontWeight:600,marginBottom:4}}>🎫 Ticket Médio</div>
            <div style={{fontSize:18,fontWeight:800,color:'#B45309'}}>{fmtMoney(entregues.length?valorMes/entregues.length:0)}</div>
          </div>
          <div style={{background:'#F5F3FF',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#5B21B6',fontWeight:600,marginBottom:4}}>👥 Clientes Ativos</div>
            <div style={{fontSize:22,fontWeight:800,color:'#7C3AED'}}>{clientesAtivos}</div>
          </div>
        </div>
      </div>
      {(mSemana||mMes)&&(
        <div style={{...card,padding:16,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>🎯 Metas</div>
          {mSemana&&<BarraProgresso atual={tSem} meta={Number(mSemana.valor_meta)} label="Meta Semanal"/>}
          {mMes&&<BarraProgresso atual={tMes} meta={Number(mMes.valor_meta)} label="Meta Mensal"/>}
        </div>
      )}
      {top5.length>0&&(
        <div style={{...card,padding:'14px 16px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>🏆 Top 5 Clientes do Mês</div>
          {top5.map((c,i)=>(
            <div key={c.nome} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i<top5.length-1?'1px solid #F1F5F9':'none'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#94A3B8',width:16}}>{i+1}</span>
              <span style={{flex:1,fontSize:13,fontWeight:600,color:'#0A1628'}}>{c.nome}</span>
              <span style={{fontSize:12,fontWeight:700,color:'#059669'}}>{fmtMoney(c.valor)}</span>
              <span style={{fontSize:11,color:'#94A3B8'}}>{c.qtd}x</span>
            </div>
          ))}
        </div>
      )}
      {ultimos.length>0&&(
        <>
          <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8}}>📋 Últimos Pedidos do Mês</div>
          {ultimos.map(p=>{const s=STATUS_MAP[p.status]||{label:p.status,color:'#64748B',bg:'#F1F5F9'};return(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:'#fff',borderRadius:10,marginBottom:6,border:'1px solid #F1F5F9'}}>
              <span style={{fontFamily:'monospace',fontSize:10,background:'#F1F5F9',color:'#64748B',padding:'2px 5px',borderRadius:4,flexShrink:0}}>{getRef(p)}</span>
              <span style={{flex:1,fontSize:12,fontWeight:600,color:'#0A1628',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.cliente}</span>
              <span style={{fontSize:12,fontWeight:700,color:'#059669',whiteSpace:'nowrap'}}>{fmtMoney(p.valor_total||0)}</span>
              <span style={{fontSize:10,fontWeight:700,color:s.color,background:s.bg,padding:'2px 6px',borderRadius:6,whiteSpace:'nowrap'}}>{s.label}</span>
              <span style={{fontSize:10,color:'#94A3B8',whiteSpace:'nowrap'}}>{fmt(p.criado_em)}</span>
            </div>
          )})}
        </>
      )}
    </div>
  )
}
