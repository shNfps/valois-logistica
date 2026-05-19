import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { fmt, groupByCidade, btnPrimary, btnSmall, card, updatePedido, addHistorico, fetchRotasAtivas, fetchRotasFinalizadasHoje } from './db.js'
import { fetchRotasPendentesMotorista } from './roteiro-db.js'
import { criarNotificacao } from './notificacoes.js'
import { Badge, RefBadge, PdfViewer, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'
import { RoteirosTab } from './roteiros-tab.jsx'
import { ReembolsosFuncionarioTab } from './reembolsos.jsx'
import { ObsComercialInline } from './obs-comercial.jsx'
import { PendenteCard, ResumoRapidoMotorista, RotaCard, pendenteKeyframes } from './motorista-extras.jsx'

const motTabBtn = (active) => ({ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, background: active ? '#0A1628' : 'transparent', color: active ? '#fff' : '#64748B' })

// RotaCard, PendenteCard e ResumoRapidoMotorista vivem em motorista-extras.jsx.

// ─── MOTORISTA VIEW ───
export function MotoristaView({ pedidos, refresh, user }) {
  const [tab, setTab] = useState('rotas')
  const [viewing, setViewing] = useState(null); const [signing, setSigning] = useState(false); const [saving, setSaving] = useState(false)
  const [rotasAtivas, setRotasAtivas] = useState([]); const [rotasPedidos, setRotasPedidos] = useState({})
  const [rotasPendentes, setRotasPendentes] = useState([])
  const [rotasFinalizadas, setRotasFinalizadas] = useState([]); const [finColapsado, setFinColapsado] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const loadRotas = useCallback(async () => {
    const rs = await fetchRotasAtivas()
    const map = {}; const ativas = []
    for (const r of rs || []) {
      // Busca pedidos da rota diretamente via supabase para evitar cache
      const { data: rpRows } = await supabase.from('rota_pedidos').select('pedido_id').eq('rota_id', r.id)
      const ids = (rpRows || []).map(x => x.pedido_id)
      map[r.id] = ids
      if (ids.length > 0) {
        const { data: pedidosDB } = await supabase.from('pedidos').select('id, status').in('id', ids)
        const allEntregue = pedidosDB && pedidosDB.length > 0 && pedidosDB.every(p => p.status === 'ENTREGUE')
        console.log(`[loadRotas] Rota ${r.id.slice(0,8)}: ${pedidosDB?.length} pedidos, ${pedidosDB?.filter(p=>p.status==='ENTREGUE').length} entregues, finalizar=${allEntregue}`)
        if (allEntregue) {
          await supabase.from('rotas').update({ status: 'finalizada' }).eq('id', r.id)
          console.log('[loadRotas] ROTA FINALIZADA:', r.id)
          continue
        }
      }
      ativas.push(r)
    }
    setRotasAtivas(ativas); setRotasPedidos(map)
    setRotasFinalizadas(await fetchRotasFinalizadasHoje() || [])
    setRotasPendentes(await fetchRotasPendentesMotorista(user.nome) || [])
  }, [user.nome])

  useEffect(() => { loadRotas() }, [loadRotas])
  useEffect(() => {
    const sub = supabase.channel('rotas-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'rotas' }, loadRotas).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [loadRotas])

  const confirmarEntrega = async (id, { assinatura, cpf }) => {
    setSaving(true)
    await updatePedido(id, { status: 'ENTREGUE', entrega_assinatura: assinatura, entrega_cpf: cpf, entrega_data: new Date().toISOString(), entregue_por: user.nome })

    // Verificar se a rota pode ser finalizada (usando supabase direto, sem funções intermediárias)
    const { data: rotaPedido } = await supabase.from('rota_pedidos').select('rota_id').eq('pedido_id', id).maybeSingle()
    if (rotaPedido && rotaPedido.rota_id) {
      const { data: todosRp } = await supabase.from('rota_pedidos').select('pedido_id').eq('rota_id', rotaPedido.rota_id)
      if (todosRp && todosRp.length > 0) {
        const pedidoIds = todosRp.map(rp => rp.pedido_id)
        const { data: pedidosRota } = await supabase.from('pedidos').select('id, status').in('id', pedidoIds)
        const todosEntregues = pedidosRota && pedidosRota.every(p => p.status === 'ENTREGUE')
        console.log(`Verificando rota: ${pedidosRota?.length} pedidos total, ${pedidosRota?.filter(p => p.status === 'ENTREGUE').length} entregues`)
        if (todosEntregues) {
          await supabase.from('rotas').update({ status: 'finalizada' }).eq('id', rotaPedido.rota_id)
          console.log('ROTA FINALIZADA:', rotaPedido.rota_id)
          showToast('🎉 Rota finalizada! Todas as entregas concluídas.')
        } else {
          console.log('Rota ainda tem pedidos pendentes:', pedidosRota?.filter(p => p.status !== 'ENTREGUE').length)
        }
      }
    }

    await addHistorico(id, user.nome, 'Entregou — CPF: ' + cpf)
    const _pe = pedidos.find(x => x.id === id)
    await criarNotificacao('comercial', `✅ Pedido ${_pe?.numero_ref||id.slice(0,8).toUpperCase()} entregue para ${_pe?.cliente||''}`, `CPF: ${cpf} · Motorista: ${user.nome}`, id)
    await loadRotas(); refresh(); setSigning(false); setViewing(null); setSaving(false)
  }

  if (viewing) {
    const p = pedidos.find(x => x.id === viewing); if (!p) { setViewing(null); return null }
    if (signing) return <SignaturePad onSave={data => confirmarEntrega(p.id, data)} onCancel={() => setSigning(false)} />
    return (<div>
      <button onClick={() => { setViewing(null); setSigning(false) }} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 17, color: '#0A1628' }}>{p.cliente}</h3><Badge status={p.status} /></div>
        {p.cidade && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>📍 {p.cidade}</div>}
        <ObsComercialInline texto={p.obs_comercial}/>
        {p.nf_url && <PdfViewer url={p.nf_url} title="Nota Fiscal" />}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {p.status === 'EM_ROTA' && <button onClick={() => setSigning(true)} style={{ ...btnPrimary, flex: 1, background: '#059669' }}>✍ Coletar Assinatura</button>}
        {p.status === 'NF_EMITIDA' && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', width: '100%', padding: 10 }}>Aguarde o comercial atribuir este pedido a uma rota.</div>}
      </div>
      <PedidoDetail pedido={p} /><HistoricoView pedidoId={p.id} />
    </div>)
  }

  // Pendentes (criadas pelo comercial, motorista ainda não aceitou).
  const minhaRotaAtiva = rotasAtivas.find(r => r.status === 'ativa' && r.aceita_em && r.motorista_nome === user.nome)
  const rotasAtivasAceitas = rotasAtivas.filter(r => r.aceita_em)
  const pedidosRotaAtivaUser = minhaRotaAtiva ? pedidos.filter(p => (rotasPedidos[minhaRotaAtiva.id] || []).includes(p.id)) : []
  const nfEmitida = pedidos.filter(p => p.status === 'NF_EMITIDA')
  const nfPorCidade = groupByCidade(nfEmitida)
  const secH = (icon, title, count) => <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1.5 }}>{icon} {title}{count !== undefined ? ` (${count})` : ''}</h3>
  const divider = <div style={{ borderTop: '2px solid #E2E8F0', margin: '24px 0 18px' }} />

  const renderCard = p => (
    <div key={p.id} onClick={() => setViewing(p.id)} style={{ ...card, padding: 16, cursor: 'pointer', marginBottom: 0, border: '2px solid transparent' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RefBadge pedido={p}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
          {p.valor_total && <div style={{ fontSize: 11, color: '#64748B' }}>R$ {Number(p.valor_total).toFixed(2)}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{fmt(p.atualizado_em)}</div>
          <Badge status={p.status} />
        </div>
      </div>
    </div>
  )

  return (<div>
    <style>{`.nf-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(max-width:640px){.nf-grid{grid-template-columns:1fr}}`}</style>
    {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.3)', whiteSpace: 'nowrap' }}>{toast}</div>}
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E2E8F0', paddingBottom: 0 }}>
      <button onClick={() => setTab('rotas')} style={motTabBtn(tab === 'rotas')}>🚛 Rotas</button>
      <button onClick={() => setTab('roteiros')} style={motTabBtn(tab === 'roteiros')}>🗺️ Meus Roteiros</button>
      <button onClick={() => setTab('reembolsos')} style={motTabBtn(tab === 'reembolsos')}>💸 Reembolsos</button>
    </div>
    {tab === 'reembolsos' && <ReembolsosFuncionarioTab user={user} />}
    {tab === 'roteiros' && <RoteirosTab pedidos={pedidos} user={user} somenteMotorista={user.nome} />}
    {tab === 'rotas' && <>
    <style>{pendenteKeyframes}</style>
    <ResumoRapidoMotorista pedidos={pedidos} user={user} rotaAtiva={minhaRotaAtiva} pedidosRotaAtiva={pedidosRotaAtivaUser} />

    {rotasPendentes.length > 0 && (<>
      {secH('📋', 'Rotas Pendentes (aguardando seu aceite)', rotasPendentes.length)}
      {rotasPendentes.map(rota => {
        const ids = rotasPedidos[rota.id] || []
        const pedidosRota = pedidos.filter(p => ids.includes(p.id))
        return <PendenteCard key={rota.id} rota={rota} pedidosRota={pedidosRota} user={user} onAceito={loadRotas} onRecusado={() => { loadRotas(); refresh() }} />
      })}
      {divider}
    </>)}

    {secH('🚛', 'Rota Ativa')}
    {rotasAtivasAceitas.length === 0
      ? <div style={{ textAlign: 'center', padding: 28, color: '#94A3B8', background: '#F8FAFC', borderRadius: 12 }}>Nenhuma rota ativa no momento.</div>
      : rotasAtivasAceitas.map(rota => {
          const ids = rotasPedidos[rota.id] || []
          const pedidosRota = pedidos.filter(p => ids.includes(p.id))
          return <RotaCard key={rota.id} rota={rota} pedidosRota={pedidosRota}
            onAssinar={id => { setViewing(id); setSigning(true) }}
            onVerPedido={setViewing}
            onFechar={rota.status === 'finalizada' ? () => setRotasAtivas(prev => prev.filter(r => r.id !== rota.id)) : null} />
        })}

    {divider}
    {secH('📦', 'Pedidos para roteirizar', nfEmitida.length)}
    {nfEmitida.length === 0
      ? <div style={{ textAlign: 'center', padding: 28, color: '#94A3B8', background: '#F8FAFC', borderRadius: 12, marginBottom: 4 }}>Nenhum pedido aguardando roteirização ✓</div>
      : nfPorCidade.map(g => <CidadeGroup key={g.cidade} cidade={g.cidade} count={g.items.length} defaultOpen={false} persistKey={`mot-cidade-${user.nome}-${g.cidade}`}><div className="nf-grid">{g.items.map(renderCard)}</div></CidadeGroup>)}
    {rotasFinalizadas.length > 0 && (<>
      {divider}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        {secH('✅', 'Rotas finalizadas hoje', rotasFinalizadas.length)}
        <button onClick={() => setFinColapsado(f => !f)} style={{ ...btnSmall, fontSize: 11, marginBottom: 12 }}>{finColapsado ? '▼ Ver' : '▲ Fechar'}</button>
      </div>
      {!finColapsado && rotasFinalizadas.map(r => (
        <div key={r.id} style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: '#065F46', fontSize: 13 }}>✅ Rota finalizada</div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{r.motorista_nome} · {(r.cidades?.length ? r.cidades : [r.cidade]).join(', ')}</div>
          <div style={{ fontSize: 11, color: '#6EE7B7', marginTop: 2 }}>{fmt(r.criado_em)}</div>
        </div>
      ))}
    </>)}
    </>}
  </div>)
}
