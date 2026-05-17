import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { fmt, groupByCidade, VEICULOS, btnPrimary, btnSmall, card, updatePedido, addHistorico, fetchRotasAtivas, fetchRotaPedidoIds, finalizarRota, fetchPedidosByIds, fetchRotasFinalizadasHoje, fetchRotaByPedido } from './db.js'
import { criarNotificacao } from './notificacoes.js'
import { Badge, RefBadge, PdfViewer, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'
import { MontarRotaScreen } from './views5-montar.jsx'
import { ReembolsosFuncionarioTab } from './reembolsos.jsx'
import { ObsComercialInline } from './obs-comercial.jsx'

const motTabBtn = (active) => ({ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, background: active ? '#0A1628' : 'transparent', color: active ? '#fff' : '#64748B' })

const vIcon = v => VEICULOS.find(x => x.key === v)?.icon || '🚐'

// ─── ROTA CARD (colapsável, pedidos dentro) ───
function RotaCard({ rota, pedidosRota, onAssinar, onVerPedido, onFechar }) {
  const [expanded, setExpanded] = useState(true)
  const fin = rota.status === 'finalizada'
  const emRota = pedidosRota.filter(p => p.status === 'EM_ROTA')
  const entregues = pedidosRota.filter(p => p.status === 'ENTREGUE')
  const total = pedidosRota.length; const ec = entregues.length
  return (
    <div style={{ borderRadius: 14, marginBottom: 16, overflow: 'hidden', border: `1px solid ${fin ? '#A7F3D0' : '#1E293B'}` }}>
      <style>{`@keyframes truck-move{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}@keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '14px 18px', background: fin ? '#D1FAE5' : '#0A1628', color: fin ? '#065F46' : '#fff', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, display: 'inline-block', animation: fin ? 'none' : 'truck-move 1.2s ease-in-out infinite' }}>{fin ? '✅' : vIcon(rota.veiculo)}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>{fin ? 'ROTA FINALIZADA' : 'ROTA ATIVA'}</div>
              <div style={{ fontSize: 12, color: fin ? '#059669' : '#94A3B8' }}>{rota.cidades?.length > 0 ? rota.cidades.join(', ') : rota.cidade} · {vIcon(rota.veiculo)} · {rota.motorista_nome}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!fin && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'blink-red 1s infinite' }} /><span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: 1 }}>AO VIVO</span></>}
            {fin && onFechar && <button onClick={e => { e.stopPropagation(); onFechar() }} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 11 }}>Fechar</button>}
            <span style={{ fontSize: 13, opacity: 0.6, color: fin ? '#065F46' : '#fff' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div style={{ background: fin ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: fin ? '#059669' : '#CBD5E1' }}>Entregas realizadas</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{ec} <span style={{ fontWeight: 400, fontSize: 12, color: fin ? '#059669' : '#94A3B8' }}>de {total}</span></span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emRota.length === 0 && entregues.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8', fontSize: 13 }}>Nenhum pedido nesta rota</div>}
          {emRota.length === 0 && entregues.length > 0 && <div style={{ textAlign: 'center', padding: 10, color: '#059669', fontWeight: 600, fontSize: 13 }}>Todos os pedidos foram entregues ✅</div>}
          {emRota.map(p => (
            <div key={p.id} style={{ borderLeft: '3px solid #3B82F6', borderRadius: 8, padding: '10px 12px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }} onClick={() => onVerPedido(p.id)}>
                <RefBadge pedido={p}/><span style={{ fontWeight: 700, color: '#0A1628', flex: 1 }}>{p.cliente}</span>
                {p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}
              </div>
              {p.obs_comercial && <div style={{ marginBottom: 8 }}><ObsComercialInline texto={p.obs_comercial}/></div>}
              <button onClick={() => onAssinar(p.id)} style={{ ...btnPrimary, background: '#059669', padding: '8px 14px', fontSize: 13, width: '100%' }}>✍ Coletar Assinatura</button>
            </div>
          ))}
          {entregues.map(p => (
            <div key={p.id} style={{ borderLeft: '3px solid #10B981', borderRadius: 8, padding: '10px 12px', background: '#F0FDF4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefBadge pedido={p}/><span style={{ fontWeight: 700, color: '#0A1628', flex: 1 }}>{p.cliente}</span>
                {p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}
                <span>✅</span>
              </div>
              {p.entrega_cpf && <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>CPF: {p.entrega_cpf} · {fmt(p.entrega_data)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MOTORISTA VIEW ───
export function MotoristaView({ pedidos, refresh, user }) {
  const [tab, setTab] = useState('rotas')
  const [viewing, setViewing] = useState(null); const [signing, setSigning] = useState(false); const [saving, setSaving] = useState(false)
  const [montarRota, setMontarRota] = useState(false)
  const [rotasAtivas, setRotasAtivas] = useState([]); const [rotasPedidos, setRotasPedidos] = useState({})
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
  }, [])

  useEffect(() => { loadRotas() }, [loadRotas])
  useEffect(() => {
    const sub = supabase.channel('rotas-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'rotas' }, loadRotas).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [loadRotas])

  const onRotaCriada = async () => { await loadRotas(); setMontarRota(false); refresh() }

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

  if (montarRota) return <MontarRotaScreen pedidos={pedidos.filter(p => p.status === 'NF_EMITIDA')} user={user} onRotaCriada={onRotaCriada} onCancel={() => setMontarRota(false)} />

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
        {p.status === 'NF_EMITIDA' && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', width: '100%', padding: 10 }}>Use "Montar Rota" para incluir este pedido em uma rota.</div>}
      </div>
      <PedidoDetail pedido={p} /><HistoricoView pedidoId={p.id} />
    </div>)
  }

  const minhaRotaAtiva = rotasAtivas.find(r => r.status === 'ativa' && r.motorista_nome === user.nome)
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
      <button onClick={() => setTab('reembolsos')} style={motTabBtn(tab === 'reembolsos')}>💸 Reembolsos</button>
    </div>
    {tab === 'reembolsos' && <ReembolsosFuncionarioTab user={user} />}
    {tab === 'rotas' && <>
    {secH('📋', 'Pedidos para roteirizar', nfEmitida.length)}
    {minhaRotaAtiva
      ? <div style={{ background: '#FEF3C7', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#92400E', fontWeight: 600 }}>⚠️ Você já tem uma rota ativa. Finalize a rota atual para criar uma nova.</div>
      : <button onClick={() => setMontarRota(true)} style={{ ...btnPrimary, width: '100%', marginBottom: 14, background: '#3B82F6' }}>🗺️ Montar Rota</button>}
    {nfEmitida.length === 0
      ? <div style={{ textAlign: 'center', padding: 28, color: '#94A3B8', background: '#F8FAFC', borderRadius: 12, marginBottom: 4 }}>Nenhum pedido aguardando roteirização ✓</div>
      : nfPorCidade.map(g => <CidadeGroup key={g.cidade} cidade={g.cidade} count={g.items.length}><div className="nf-grid">{g.items.map(renderCard)}</div></CidadeGroup>)}
    {divider}
    {secH('🚛', 'Rota Ativa')}
    {rotasAtivas.length === 0
      ? <div style={{ textAlign: 'center', padding: 28, color: '#94A3B8', background: '#F8FAFC', borderRadius: 12 }}>Nenhuma rota ativa — monte uma rota acima</div>
      : rotasAtivas.map(rota => {
          const ids = rotasPedidos[rota.id] || []
          const pedidosRota = pedidos.filter(p => ids.includes(p.id))
          return <RotaCard key={rota.id} rota={rota} pedidosRota={pedidosRota}
            onAssinar={id => { setViewing(id); setSigning(true) }}
            onVerPedido={setViewing}
            onFechar={rota.status === 'finalizada' ? () => setRotasAtivas(prev => prev.filter(r => r.id !== rota.id)) : null} />
        })}
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
