import { useState, useEffect, useCallback } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchReembolsos, createReembolso, updateReembolso, deleteReembolso, uploadComprovante, isoHoje } from './financeiro-db.js'
import { criarNotificacao } from './notificacoes.js'

const STATUS_BADGE = {
  PENDENTE:    { label: '🟡 Pendente',    bg: '#FEF3C7', color: '#B45309' },
  APROVADO:    { label: '🟢 Aprovado',    bg: '#D1FAE5', color: '#065F46' },
  REEMBOLSADO: { label: '💰 Reembolsado', bg: '#DBEAFE', color: '#1D4ED8' },
  RECUSADO:    { label: '🔴 Recusado',    bg: '#FEE2E2', color: '#B91C1C' },
}
const CATEGORIAS = ['Combustível', 'Alimentação', 'Material', 'Outros']

function fmtData(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('pt-BR') }

function SolicitarModal({ user, onClose, onSaved, editando }) {
  const [descricao, setDescricao] = useState(editando?.descricao || '')
  const [valor, setValor] = useState(editando?.valor || '')
  const [dataDespesa, setDataDespesa] = useState(editando?.data_despesa || isoHoje())
  const [categoria, setCategoria] = useState(editando?.categoria || 'Combustível')
  const [comprovante, setComprovante] = useState(null)
  const [saving, setSaving] = useState(false)

  const salvar = async () => {
    if (!descricao.trim() || !valor || !dataDespesa) { alert('Preencha descrição, valor e data'); return }
    if (!editando && !comprovante) { alert('Anexe o comprovante (foto ou PDF)'); return }
    setSaving(true)
    let url = editando?.comprovante_url || null
    if (comprovante) url = await uploadComprovante(comprovante)
    if (editando) {
      await updateReembolso(editando.id, { descricao, valor: Number(valor), data_despesa: dataDespesa, categoria, comprovante_url: url })
    } else {
      await createReembolso({ usuario_id: user.id, usuario_nome: user.nome, descricao, valor: Number(valor), data_despesa: dataDespesa, categoria, comprovante_url: url, status: 'PENDENTE' })
      await criarNotificacao('financeiro', '💸 Novo reembolso solicitado', `${user.nome}: ${descricao} — ${fmtMoney(valor)}`)
    }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{editando ? 'Editar reembolso' : 'Solicitar reembolso'}</h3>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Ex: Combustível Cabo Frio → Macaé" style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 10, resize: 'vertical' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor R$" style={inputStyle} />
          <input type="date" value={dataDespesa} onChange={e => setDataDespesa(e.target.value)} style={inputStyle} />
        </div>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer' }}>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6 }}>Comprovante {editando ? '(deixe vazio para manter)' : '*'}</label>
        <input type="file" accept="image/*,.pdf" onChange={e => setComprovante(e.target.files[0])} style={{ marginBottom: 16, width: '100%' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function ItemReembolso({ r, isOwner, onEdit, onDelete, onAprovar, onRecusar, onReembolsar }) {
  const s = STATUS_BADGE[r.status] || STATUS_BADGE.PENDENTE
  return (
    <div style={{ ...card, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0A1628' }}>{r.descricao}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            {!isOwner && <>👤 <b>{r.usuario_nome}</b> · </>}
            📅 {fmtData(r.data_despesa)} {r.categoria && <> · 🏷️ {r.categoria}</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#059669' }}>{fmtMoney(r.valor)}</div>
          <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, display: 'inline-block', marginTop: 4 }}>{s.label}</span>
        </div>
      </div>
      {r.status === 'REEMBOLSADO' && r.data_reembolso && <div style={{ fontSize: 11, color: '#1D4ED8', marginTop: 4 }}>💰 Pago em {fmtData(r.data_reembolso)}{r.forma_reembolso ? ` · ${r.forma_reembolso}` : ''}</div>}
      {r.status === 'RECUSADO' && r.observacao_aprovador && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>Motivo: {r.observacao_aprovador}</div>}
      {r.status === 'APROVADO' && r.observacao_aprovador && <div style={{ fontSize: 11, color: '#065F46', marginTop: 4 }}>Obs: {r.observacao_aprovador}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {r.comprovante_url && <a href={r.comprovante_url} target="_blank" rel="noreferrer" style={{ ...btnSmall, textDecoration: 'none', fontSize: 11 }}>📎 Comprovante</a>}
        {isOwner && r.status === 'PENDENTE' && <>
          <button onClick={() => onEdit(r)} style={{ ...btnSmall, fontSize: 11 }}>✏️ Editar</button>
          <button onClick={() => onDelete(r)} style={{ ...btnSmall, fontSize: 11, color: '#B91C1C' }}>🗑️ Excluir</button>
        </>}
        {!isOwner && r.status === 'PENDENTE' && <>
          <button onClick={() => onAprovar(r)} style={{ ...btnSmall, fontSize: 11, background: '#D1FAE5', color: '#065F46' }}>✅ Aprovar</button>
          <button onClick={() => onRecusar(r)} style={{ ...btnSmall, fontSize: 11, background: '#FEE2E2', color: '#B91C1C' }}>❌ Recusar</button>
        </>}
        {!isOwner && r.status === 'APROVADO' && <button onClick={() => onReembolsar(r)} style={{ ...btnSmall, fontSize: 11, background: '#DBEAFE', color: '#1D4ED8' }}>💰 Marcar como pago</button>}
      </div>
    </div>
  )
}

// Reembolsos para o funcionário (vê apenas os próprios).
export function ReembolsosFuncionarioTab({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)

  const load = useCallback(async () => {
    setItems(await fetchReembolsos({ usuario_nome: user.nome })); setLoading(false)
  }, [user.nome])
  useEffect(() => { load() }, [load])

  const excluir = async (r) => { if (confirm('Excluir essa solicitação?')) { await deleteReembolso(r.id); load() } }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: 1.5 }}>Meus reembolsos</h3>
        <button onClick={() => { setEditando(null); setShowModal(true) }} style={{ ...btnPrimary, height: 36, padding: '0 14px', fontSize: 13 }}>+ Solicitar</button>
      </div>
      {loading && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div>}
      {!loading && items.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Nenhum reembolso solicitado</div>}
      {items.map(r => <ItemReembolso key={r.id} r={r} isOwner={true} onEdit={r => { setEditando(r); setShowModal(true) }} onDelete={excluir} />)}
      {showModal && <SolicitarModal user={user} editando={editando} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  )
}

// Reembolsos para financeiro/admin (vê todos).
export function ReembolsosFinanceiroTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [acao, setAcao] = useState(null) // {tipo, reembolso}
  const [observacao, setObservacao] = useState('')
  const [dataReemb, setDataReemb] = useState(isoHoje())
  const [formaReemb, setFormaReemb] = useState('pix')

  const load = useCallback(async () => { setItems(await fetchReembolsos()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const filtrados = items.filter(r =>
    (!filtroStatus || r.status === filtroStatus) &&
    (!filtroUsuario || r.usuario_nome.toLowerCase().includes(filtroUsuario.toLowerCase()))
  )

  const confirmar = async () => {
    if (!acao) return
    const r = acao.reembolso
    if (acao.tipo === 'aprovar') {
      await updateReembolso(r.id, { status: 'APROVADO', data_aprovacao: new Date().toISOString(), observacao_aprovador: observacao || null })
      await criarNotificacao(r.usuario_nome, '✅ Reembolso aprovado', `${r.descricao} — ${fmtMoney(r.valor)}`)
    } else if (acao.tipo === 'recusar') {
      if (!observacao.trim()) { alert('Motivo é obrigatório'); return }
      await updateReembolso(r.id, { status: 'RECUSADO', data_aprovacao: new Date().toISOString(), observacao_aprovador: observacao })
      await criarNotificacao(r.usuario_nome, '🔴 Reembolso recusado', `${r.descricao}: ${observacao}`)
    } else if (acao.tipo === 'reembolsar') {
      await updateReembolso(r.id, { status: 'REEMBOLSADO', data_reembolso: dataReemb, forma_reembolso: formaReemb })
      await criarNotificacao(r.usuario_nome, '💰 Reembolso pago', `${r.descricao} — ${fmtMoney(r.valor)} via ${formaReemb}`)
    }
    setAcao(null); setObservacao(''); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="">Todos status</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="APROVADO">Aprovados</option>
          <option value="REEMBOLSADO">Reembolsados</option>
          <option value="RECUSADO">Recusados</option>
        </select>
        <input value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} placeholder="Filtrar funcionário..." style={{ ...inputStyle, width: 200, height: 36 }} />
      </div>
      {loading && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div>}
      {!loading && filtrados.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Nenhum reembolso encontrado</div>}
      {filtrados.map(r => <ItemReembolso key={r.id} r={r} isOwner={false}
        onAprovar={r => setAcao({ tipo: 'aprovar', reembolso: r })}
        onRecusar={r => setAcao({ tipo: 'recusar', reembolso: r })}
        onReembolsar={r => setAcao({ tipo: 'reembolsar', reembolso: r })} />)}

      {acao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>
              {acao.tipo === 'aprovar' && 'Aprovar reembolso'}
              {acao.tipo === 'recusar' && 'Recusar reembolso'}
              {acao.tipo === 'reembolsar' && 'Marcar como pago'}
            </h3>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>{acao.reembolso.usuario_nome} · {fmtMoney(acao.reembolso.valor)}<br/>{acao.reembolso.descricao}</div>
            {acao.tipo === 'reembolsar' ? (
              <>
                <label style={{ fontSize: 12, color: '#64748B' }}>Data do pagamento</label>
                <input type="date" value={dataReemb} onChange={e => setDataReemb(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
                <label style={{ fontSize: 12, color: '#64748B' }}>Forma</label>
                <select value={formaReemb} onChange={e => setFormaReemb(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer' }}>
                  <option value="pix">PIX</option><option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option><option value="cheque">Cheque</option>
                </select>
              </>
            ) : (
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} placeholder={acao.tipo === 'recusar' ? 'Motivo da recusa *' : 'Observação (opcional)'} style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 14, resize: 'vertical' }} />
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setAcao(null); setObservacao('') }} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={confirmar} style={{ ...btnPrimary, flex: 2 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
