import { useState, useEffect, useCallback } from 'react'
import { fmt, getRef, groupByCidade, CIDADES, VEICULOS, inputStyle, btnPrimary, btnSmall, card, updatePedido, addHistorico, createRota, addRotaPedidos, fetchRotaAtiva, fetchRotaPedidoIds, finalizarRota } from './db.js'
import { Badge, PdfViewer, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'

const vIcon = v => VEICULOS.find(x => x.key === v)?.icon || '🚐'

// ─── ROTA ATIVA BANNER ───
export function RotaAtivaBanner({ rota, total, entregues, onFechar }) {
  const fin = rota.status === 'finalizada'
  return (
    <div style={{ borderRadius: 14, padding: '16px 18px', marginBottom: 16, background: fin ? '#D1FAE5' : '#0A1628', color: fin ? '#065F46' : '#fff' }}>
      <style>{`@keyframes truck-move{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}@keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
      {fin ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>✅</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>ROTA FINALIZADA</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{rota.cidade} · {vIcon(rota.veiculo)} · {total} entrega{total !== 1 ? 's' : ''}</div>
            </div>
          </div>
          {onFechar && <button onClick={onFechar} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 12 }}>Fechar</button>}
        </div>
      ) : (<>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28, display: 'inline-block', animation: 'truck-move 1.2s ease-in-out infinite' }}>{vIcon(rota.veiculo)}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>ROTA ATIVA</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{rota.cidade} · {rota.veiculo}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'blink-red 1s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: 1 }}>AO VIVO</span>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#CBD5E1' }}>Entregas realizadas</span>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{entregues} <span style={{ fontWeight: 400, fontSize: 13, color: '#94A3B8' }}>de {total}</span></span>
        </div>
      </>)}
    </div>
  )
}

// ─── MONTAR ROTA SCREEN ───
function MontarRotaScreen({ pedidos, user, onRotaCriada, onCancel }) {
  const [cidade, setCidade] = useState(''); const [veiculo, setVeiculo] = useState('')
  const [selecionados, setSelecionados] = useState(new Set()); const [saving, setSaving] = useState(false)
  const disponiveis = pedidos.filter(p => p.cidade === cidade && p.status === 'NF_EMITIDA')
  const toggle = id => setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const iniciar = async () => {
    if (!cidade) { alert('Selecione a cidade'); return }
    if (!veiculo) { alert('Selecione o veículo'); return }
    if (selecionados.size === 0) { alert('Selecione ao menos 1 pedido'); return }
    setSaving(true)
    const rota = await createRota(user.nome, cidade, veiculo); if (!rota) { setSaving(false); return }
    await addRotaPedidos(rota.id, [...selecionados])
    for (const id of selecionados) {
      await updatePedido(id, { status: 'EM_ROTA', entregue_por: user.nome })
      await addHistorico(id, user.nome, 'Iniciou rota — ' + cidade)
    }
    setSaving(false); onRotaCriada(rota, [...selecionados])
  }
  return (
    <div>
      <button onClick={onCancel} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>
      <div style={{ ...card, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>🗺️ Montar Rota</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Cidade</label>
        <select value={cidade} onChange={e => { setCidade(e.target.value); setSelecionados(new Set()) }} style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer', color: cidade ? '#0A1628' : '#94A3B8' }}>
          <option value="">Selecione a cidade...</option>{CIDADES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>Veículo</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {VEICULOS.map(v => (
            <button key={v.key} onClick={() => setVeiculo(v.key)} style={{ padding: '10px 16px', borderRadius: 10, border: `2px solid ${veiculo === v.key ? '#3B82F6' : '#E2E8F0'}`, background: veiculo === v.key ? '#EFF6FF' : '#fff', color: veiculo === v.key ? '#1D4ED8' : '#64748B', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        {cidade && (<>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>
            Pedidos com NF em {cidade} ({disponiveis.length})
          </label>
          {disponiveis.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Nenhum pedido com NF emitida nessa cidade</div>}
          {disponiveis.map(p => (
            <div key={p.id} onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
              <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => toggle(p.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: 4 }}>{getRef(p)}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', fontSize: 14 }}>{p.cliente}</span>
            </div>
          ))}
        </>)}
        <button onClick={iniciar} disabled={saving || selecionados.size === 0} style={{ ...btnPrimary, width: '100%', marginTop: 18, opacity: saving || selecionados.size === 0 ? 0.5 : 1 }}>
          {saving ? 'Iniciando...' : `🚀 Iniciar Rota (${selecionados.size} pedido${selecionados.size !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}

// ─── MOTORISTA VIEW ───
export function MotoristaView({ pedidos, refresh, user }) {
  const [viewing, setViewing] = useState(null); const [signing, setSigning] = useState(false); const [saving, setSaving] = useState(false)
  const [montarRota, setMontarRota] = useState(false)
  const [rotaAtiva, setRotaAtiva] = useState(null); const [rotaPedidoIds, setRotaPedidoIds] = useState([])

  const loadRota = useCallback(async () => {
    const r = await fetchRotaAtiva(user.nome); setRotaAtiva(r)
    if (r) setRotaPedidoIds(await fetchRotaPedidoIds(r.id)); else setRotaPedidoIds([])
  }, [user.nome])
  useEffect(() => { loadRota() }, [loadRota])

  const onRotaCriada = (rota, ids) => { setRotaAtiva(rota); setRotaPedidoIds(ids); setMontarRota(false); refresh() }

  const confirmarEntrega = async (id, { assinatura, cpf }) => {
    setSaving(true)
    await updatePedido(id, { status: 'ENTREGUE', entrega_assinatura: assinatura, entrega_cpf: cpf, entrega_data: new Date().toISOString(), entregue_por: user.nome })
    await addHistorico(id, user.nome, 'Entregou — CPF: ' + cpf)
    if (rotaAtiva) {
      const outros = rotaPedidoIds.filter(pid => pid !== id)
      const todosEntregues = outros.every(pid => pedidos.find(x => x.id === pid)?.status === 'ENTREGUE')
      if (todosEntregues) { await finalizarRota(rotaAtiva.id); setRotaAtiva(prev => prev ? { ...prev, status: 'finalizada' } : null) }
    }
    refresh(); setSigning(false); setViewing(null); setSaving(false)
  }

  if (montarRota) return <MontarRotaScreen pedidos={pedidos} user={user} onRotaCriada={onRotaCriada} onCancel={() => setMontarRota(false)} />

  if (viewing) {
    const p = pedidos.find(x => x.id === viewing); if (!p) { setViewing(null); return null }
    if (signing) return <SignaturePad onSave={data => confirmarEntrega(p.id, data)} onCancel={() => setSigning(false)} />
    return (<div>
      <button onClick={() => setViewing(null)} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 17, color: '#0A1628' }}>{p.cliente}</h3><Badge status={p.status} /></div>
        {p.cidade && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>📍 {p.cidade}</div>}
        {p.nf_url && <PdfViewer url={p.nf_url} title="Nota Fiscal" />}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {p.status === 'EM_ROTA' && <button onClick={() => setSigning(true)} style={{ ...btnPrimary, flex: 1, background: '#059669' }}>✍ Coletar Assinatura</button>}
        {p.status === 'NF_EMITIDA' && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', width: '100%', padding: 10 }}>Use "Montar Rota" para incluir este pedido em uma rota.</div>}
      </div>
      <PedidoDetail pedido={p} /><HistoricoView pedidoId={p.id} />
    </div>)
  }

  const hasRota = rotaAtiva && rotaAtiva.status === 'ativa'
  const pendentes = hasRota
    ? pedidos.filter(p => rotaPedidoIds.includes(p.id) && ['NF_EMITIDA', 'EM_ROTA'].includes(p.status))
    : pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA'].includes(p.status))
  const entregues = hasRota
    ? pedidos.filter(p => rotaPedidoIds.includes(p.id) && p.status === 'ENTREGUE')
    : pedidos.filter(p => p.status === 'ENTREGUE')
  const entreguesCount = rotaAtiva ? pedidos.filter(p => rotaPedidoIds.includes(p.id) && p.status === 'ENTREGUE').length : 0
  const porCidade = groupByCidade(pendentes)

  const renderCard = p => (<div key={p.id} onClick={() => setViewing(p.id)} style={{ ...card, cursor: 'pointer', border: '2px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{getRef(p)}</span><span style={{ fontWeight: 700, color: '#0A1628' }}>{p.cliente}</span>{p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}</div><Badge status={p.status} />
    </div>
    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{fmt(p.atualizado_em)}</div>
  </div>)

  return (<div>
    {rotaAtiva
      ? <RotaAtivaBanner rota={rotaAtiva} total={rotaPedidoIds.length} entregues={entreguesCount} onFechar={rotaAtiva.status === 'finalizada' ? () => { setRotaAtiva(null); setRotaPedidoIds([]) } : null} />
      : <button onClick={() => setMontarRota(true)} style={{ ...btnPrimary, width: '100%', marginBottom: 16, background: '#3B82F6' }}>🗺️ Montar Rota</button>}
    {!hasRota && <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1.5 }}>Entregas ({pendentes.length})</h3>}
    {pendentes.length === 0 && !hasRota && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhuma entrega pendente</div>}
    {hasRota ? pendentes.map(renderCard) : porCidade.map(g => (<CidadeGroup key={g.cidade} cidade={g.cidade} count={g.items.length}>{g.items.map(renderCard)}</CidadeGroup>))}
    {entregues.length > 0 && (<>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '28px 0 14px', textTransform: 'uppercase', letterSpacing: 1.5 }}>Entregues ({entregues.length})</h3>
      {entregues.slice(0, 20).map(p => (<div key={p.id} style={{ ...card, background: '#F0FDF4', opacity: 0.85 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ background: '#D1FAE5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{getRef(p)}</span><span style={{ fontWeight: 700, color: '#0A1628' }}>{p.cliente}</span>{p.cidade && <span style={{ fontSize: 10, color: '#94A3B8' }}>📍{p.cidade}</span>}</div><Badge status={p.status} />
        </div>
        {p.entrega_cpf && <div style={{ fontSize: 12, color: '#059669', marginTop: 6 }}>CPF: {p.entrega_cpf} · {fmt(p.entrega_data)}</div>}
      </div>))}
    </>)}
  </div>)
}
