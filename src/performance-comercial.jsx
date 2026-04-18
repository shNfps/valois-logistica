import { useState, useEffect } from 'react'
import { card, fetchConfigRanking } from './db.js'
import { EloCard, calcPontosComercial, getInicioComercial } from './performance-rank.jsx'

function Seta({ atual, ant }) {
  if (atual === ant) return <span style={{color:'#94A3B8',fontSize:12}}>—</span>
  return atual > ant
    ? <span style={{color:'#059669',fontSize:13,fontWeight:700}}>↑ {Math.abs(atual-ant)}</span>
    : <span style={{color:'#EF4444',fontSize:13,fontWeight:700}}>↓ {Math.abs(atual-ant)}</span>
}

export function PerformanceComercialTab({ user, pedidos }) {
  const [dataCorte, setDataCorte] = useState(null)
  useEffect(() => { fetchConfigRanking().then(c => setDataCorte(c?.data_corte_comercial || null)) }, [])
  const now = new Date()
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)
  const iniEfetivo = getInicioComercial(dataCorte)
  const mesAntIni = new Date(now.getFullYear(), now.getMonth()-1, 1)
  const mesAntFim = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const semIni = new Date(now); semIni.setDate(now.getDate()-now.getDay()); semIni.setHours(0,0,0,0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate()+6); semFim.setHours(23,59,59)

  const doMes = pedidos.filter(p => p.criado_por===user.nome && new Date(p.criado_em)>=iniEfetivo)
  const daSemana = pedidos.filter(p => p.criado_por===user.nome && new Date(p.criado_em)>=semIni && new Date(p.criado_em)<=semFim)
  const doMesAnt = pedidos.filter(p => p.criado_por===user.nome && new Date(p.criado_em)>=mesAntIni && new Date(p.criado_em)<=mesAntFim)

  const aprovados = doMes.filter(p => !p.obs && !['INCOMPLETO','PENDENTE'].includes(p.status))
  const incompletos = doMes.filter(p => p.status==='INCOMPLETO')
  const taxa = doMes.length > 0 ? Math.round((aprovados.length/doMes.length)*100) : 0

  // Streak: dias consecutivos com pedido
  const diasPed = new Set(pedidos.filter(p=>p.criado_por===user.nome).map(p=>p.criado_em?.slice(0,10)).filter(Boolean))
  let streak = 0; const dc = new Date(now)
  while (diasPed.has(dc.toISOString().slice(0,10))) { streak++; dc.setDate(dc.getDate()-1) }

  // Comparativo mês anterior
  const aprovAnt = doMesAnt.filter(p => !p.obs && !['INCOMPLETO','PENDENTE'].includes(p.status))
  const taxaAnt = doMesAnt.length > 0 ? Math.round((aprovAnt.length/doMesAnt.length)*100) : 0

  const { pontos, logs } = calcPontosComercial(pedidos, user.nome, iniEfetivo)
  const { pontos: pontosAnt } = calcPontosComercial(pedidos, user.nome, mesAntIni, mesAntFim)

  const comp = [
    ['Pedidos criados', doMes.length, doMesAnt.length, ''],
    ['Aprovados direto', aprovados.length, aprovAnt.length, ''],
    ['Taxa aprovação', taxa, taxaAnt, '%'],
    ['Pontos', pontos, pontosAnt, ''],
  ]

  return (
    <div>
      <EloCard pontos={pontos}/>
      {dataCorte && iniEfetivo > mesIni && <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:12,marginBottom:12,fontSize:13,color:'#1D4ED8',fontWeight:600}}>ℹ️ Ranking atualizado em {new Date(dataCorte).toLocaleDateString('pt-BR')}. Pontos contados a partir desta data.</div>}
      <div style={{...card,padding:'16px 20px',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>📊 Meu Mês</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'#EFF6FF',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#1E40AF',fontWeight:600,marginBottom:4}}>📦 Criados no Mês</div>
            <div style={{fontSize:22,fontWeight:800,color:'#2563EB'}}>{doMes.length}</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>{daSemana.length} esta semana</div>
          </div>
          <div style={{background:'#F0FDF4',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#166534',fontWeight:600,marginBottom:4}}>✅ Taxa Aprovação</div>
            <div style={{fontSize:22,fontWeight:800,color:'#059669'}}>{taxa}%</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>{aprovados.length} aprovados direto</div>
          </div>
          <div style={{background:'#FEF2F2',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#B91C1C',fontWeight:600,marginBottom:4}}>⚠️ Incompletos</div>
            <div style={{fontSize:22,fontWeight:800,color:'#EF4444'}}>{incompletos.length}</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>devolvidos pelo galpão</div>
          </div>
          <div style={{background:'#FFF7ED',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#92400E',fontWeight:600,marginBottom:4}}>🔥 Streak</div>
            <div style={{fontSize:22,fontWeight:800,color:'#B45309'}}>{streak}d</div>
            <div style={{fontSize:10,color:'#94A3B8'}}>dias consecutivos</div>
          </div>
        </div>
      </div>
      <div style={{...card,padding:'14px 16px',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>📈 Este Mês vs Mês Anterior</div>
        {comp.map(([label,atual,ant,suf])=>(
          <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid #F1F5F9',fontSize:13}}>
            <span style={{color:'#334155',fontWeight:600}}>{label}</span>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:11,color:'#94A3B8'}}>{ant}{suf}</span>
              <Seta atual={atual} ant={ant}/>
              <span style={{fontWeight:700,color:'#0A1628',minWidth:32,textAlign:'right'}}>{atual}{suf}</span>
            </div>
          </div>
        ))}
      </div>
      {logs.length>0&&(
        <div style={{...card,padding:'14px 16px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>⚡ Últimas Ações</div>
          {logs.slice(0,18).map((l,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<Math.min(logs.length,18)-1?'1px solid #F1F5F9':'none',fontSize:12}}>
              <span style={{color:'#334155'}}><span style={{fontFamily:'monospace',fontSize:10,color:'#94A3B8',marginRight:6}}>{l.ref}</span>{l.acao}</span>
              <span style={{fontWeight:700,color:l.pts>0?'#059669':'#EF4444',whiteSpace:'nowrap',marginLeft:8}}>{l.pts>0?'+':''}{l.pts} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
