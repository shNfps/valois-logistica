import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import { inputStyle, btnPrimary, btnSmall, card, fetchClientes } from './db.js'
import { fetchEquipamentosByCliente, fetchOSBySolicitante, createOrdemServico, uploadFotoManutencao } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'
import { OS_TIPO_LABEL, statusColor, statusLabel, formatData } from './manutencao-shared.js'

const TIPOS_SOLICIT = ['instalacao', 'manutencao', 'troca', 'desinstalacao']
const COM_EQUIPAMENTO = ['manutencao', 'troca', 'desinstalacao']

function SolicitarModal({ clientes, user, onClose, onCreated }) {
  const [tipo, setTipo] = useState('manutencao')
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [equipamentos, setEquipamentos] = useState([])
  const [equipamentoId, setEquipamentoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fotoRef = useRef(null)

  const clienteSel = clientes.find(c => c.id === clienteId)

  useEffect(() => {
    if (clienteId) fetchEquipamentosByCliente(clienteId).then(setEquipamentos)
    else { setEquipamentos([]); setEquipamentoId('') }
  }, [clienteId])

  const filteredClientes = clientes.filter(c => !clienteSearch || c.nome.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 15)

  const handleSave = async () => {
    if (!clienteId) { alert('Selecione o cliente'); return }
    if (!descricao.trim()) { alert('Descreva o serviço'); return }
    setSaving(true)
    let fotoUrl = null
    if (foto) fotoUrl = await uploadFotoManutencao(foto)
    const cl = clientes.find(c => c.id === clienteId)
    const eq = equipamentos.find(e => e.id === equipamentoId)
    const prazo = new Date(); prazo.setHours(prazo.getHours() + 24)
    const os = {
      tipo, cliente_id: clienteId, cliente_nome: cl?.nome || '',
      cidade: cl?.cidade || null, endereco: cl?.endereco || null,
      equipamento_id: equipamentoId || null, equipamento_tipo: eq?.tipo || null,
      descricao: descricao.trim(), data_agendada: null, periodo: null,
      solicitante_nome: user.nome, tecnico_nome: null, status: 'ABERTA',
      prazo_aceite: prazo.toISOString(), foto_antes: fotoUrl
    }
    const result = await createOrdemServico(os)
    if (result) {
      await criarNotificacao('manutencao', `🔧 Nova OS aberta: ${cl?.nome || ''} - ${OS_TIPO_LABEL[tipo]}`, `${descricao.trim().slice(0, 80)} · Por: ${user.nome}`)
    }
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Solicitar Serviço</h3>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Tipo de serviço</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {TIPOS_SOLICIT.map(k => (
            <button key={k} onClick={() => setTipo(k)} style={{ flex: '1 0 40%', padding: '8px 4px', borderRadius: 8, border: `2px solid ${tipo === k ? '#F97316' : '#E2E8F0'}`, background: tipo === k ? '#FFF7ED' : '#fff', color: tipo === k ? '#EA580C' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{OS_TIPO_LABEL[k]}</button>
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Cliente *</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={clienteSel ? clienteSel.nome : clienteSearch} onChange={e => { setClienteSearch(e.target.value); setClienteId(''); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)} placeholder="Buscar cliente..." style={inputStyle} />
          {showDropdown && filteredClientes.length > 0 && !clienteId && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
              {filteredClientes.map(c => (
                <div key={c.id} onClick={() => { setClienteId(c.id); setClienteSearch(c.nome); setShowDropdown(false) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  {c.nome}{c.cidade ? <span style={{ color: '#94A3B8', marginLeft: 6 }}>· {c.cidade}</span> : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        {clienteId && COM_EQUIPAMENTO.includes(tipo) && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Equipamento</label>
            <select value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)} style={{ ...inputStyle, marginBottom: 12, color: equipamentoId ? '#0A1628' : '#94A3B8' }}>
              <option value="">Selecionar equipamento...</option>
              {equipamentos.filter(e => e.status === 'instalado').map(e => (
                <option key={e.id} value={e.id}>{e.tipo}{e.modelo ? ` - ${e.modelo}` : ''}{e.local_instalacao ? ` (${e.local_instalacao})` : ''}</option>
              ))}
            </select>
          </>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Descrição do serviço *</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o problema ou o serviço necessário..." rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Foto do problema (opcional)</label>
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" ref={fotoRef} onChange={e => { const f = e.target.files[0]; if (f) { setFoto(f); setFotoPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button type="button" onClick={() => fotoRef.current.click()} style={{ ...btnSmall, flex: 1, justifyContent: 'center', color: foto ? '#10B981' : '#64748B', borderColor: foto ? '#A7F3D0' : '#E2E8F0' }}>
            {foto ? `✓ ${foto.name.slice(0, 25)}` : '📷 Anexar foto do problema'}
          </button>
          {fotoPreview && <img src={fotoPreview} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />}
        </div>

        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>
          ℹ️ A data e o técnico são definidos pela equipe de manutenção ao <b>aceitar</b> a ordem. Você será notificado com a data agendada.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Gerando...' : 'Gerar Ordem de Serviço'}</button>
        </div>
      </div>
    </div>
  )
}

export function SolicitarManutencaoTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [clientes, setClientes] = useState([])
  const [showSolicitar, setShowSolicitar] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [os, cl] = await Promise.all([fetchOSBySolicitante(user.nome), fetchClientes()])
    setOrdens(os); setClientes(cl); setLoading(false)
  }, [user.nome])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('os-solicit-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando...</div>

  return (
    <div>
      <button onClick={() => setShowSolicitar(true)} style={{ ...btnPrimary, width: '100%', marginBottom: 16 }}>Gerar Ordem de Serviço</button>

      <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, display: 'block', marginBottom: 12 }}>Minhas Solicitações ({ordens.length})</span>

      {ordens.map(os => {
        const sc = statusColor(os)
        return (
          <div key={os.id} style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{os.numero_os}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', flex: 1 }}>{os.cliente_nome}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>{statusLabel(os)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {OS_TIPO_LABEL[os.tipo] || os.tipo}{os.data_agendada ? ` · 📅 Agendada: ${formatData(os.data_agendada)}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{os.descricao}</div>
            {os.tecnico_nome && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Técnico: {os.tecnico_nome}</div>}
            {os.observacao_conclusao && <div style={{ fontSize: 11, color: '#065F46', marginTop: 4, background: '#D1FAE5', padding: '4px 8px', borderRadius: 6 }}>✅ {os.observacao_conclusao}</div>}
          </div>
        )
      })}

      {ordens.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhuma solicitação feita ainda</div>}
      {showSolicitar && <SolicitarModal clientes={clientes} user={user} onClose={() => setShowSolicitar(false)} onCreated={load} />}
    </div>
  )
}
