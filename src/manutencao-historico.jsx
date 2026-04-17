import { useState, useEffect, useCallback } from 'react'
import { inputStyle, btnSmall, card, fetchClientes } from './db.js'
import { fetchOrdensServico } from './manutencao-db.js'
import { SearchBar } from './components.jsx'

const OS_TIPO_LABEL = { instalacao: 'Instalação', manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação' }

export function ManutencaoHistoricoTab() {
  const [ordens, setOrdens] = useState([])
  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos')
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [os, cl] = await Promise.all([fetchOrdensServico(), fetchClientes()])
    setOrdens(os); setClientes(cl); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const concluidas = ordens.filter(o => o.status === 'CONCLUIDA')

  const now = new Date()
  const filtradas = concluidas.filter(o => {
    if (search) {
      const s = search.toLowerCase()
      if (!(o.cliente_nome || '').toLowerCase().includes(s) && !(o.numero_os || '').toLowerCase().includes(s) && !(o.tecnico_nome || '').toLowerCase().includes(s)) return false
    }
    if (filtroCliente && o.cliente_nome !== filtroCliente) return false
    if (filtroPeriodo !== 'todos') {
      const d = new Date(o.concluido_em || o.criado_em)
      if (filtroPeriodo === '7dias' && (now - d) > 7 * 86400000) return false
      if (filtroPeriodo === '30dias' && (now - d) > 30 * 86400000) return false
      if (filtroPeriodo === '90dias' && (now - d) > 90 * 86400000) return false
    }
    return true
  }).sort((a, b) => new Date(b.concluido_em || b.criado_em) - new Date(a.concluido_em || a.criado_em))

  const clienteNomes = [...new Set(concluidas.map(o => o.cliente_nome).filter(Boolean))].sort()

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando histórico...</div>

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar OS, cliente, técnico..." />

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: 12, height: 34 }}>
          <option value="">Todos os clientes</option>
          {clienteNomes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: 12, height: 34 }}>
          <option value="todos">Todo o período</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="30dias">Últimos 30 dias</option>
          <option value="90dias">Últimos 90 dias</option>
        </select>
      </div>

      <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, display: 'block', marginBottom: 12 }}>Concluídas ({filtradas.length})</span>

      {filtradas.map(os => {
        const exp = expandedId === os.id
        return (
          <div key={os.id} style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            <div onClick={() => setExpandedId(v => v === os.id ? null : os.id)} style={{ padding: '12px 16px', cursor: 'pointer', background: exp ? '#F8FAFC' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{os.numero_os}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', flex: 1 }}>{os.cliente_nome}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#D1FAE5', color: '#065F46' }}>CONCLUÍDA</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {OS_TIPO_LABEL[os.tipo]} · {os.tecnico_nome || 'Sem técnico'} · {new Date(os.concluido_em || os.criado_em).toLocaleDateString('pt-BR')}{os.solicitante_nome ? ` · Solicitado por: ${os.solicitante_nome}` : ''}
              </div>
            </div>
            {exp && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                {os.solicitante_nome && <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}><b>Solicitado por:</b> {os.solicitante_nome}</div>}
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}><b>Descrição:</b> {os.descricao}</div>
                {os.observacao_conclusao && <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}><b>Obs. conclusão:</b> {os.observacao_conclusao}</div>}
                {os.equipamento_tipo && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>📦 Equipamento: {os.equipamento_tipo}</div>}
                {(os.endereco || os.cidade) && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>📍 {[os.endereco, os.cidade].filter(Boolean).join(' - ')}</div>}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {os.foto_antes && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>ANTES</div>
                      <img src={os.foto_antes} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />
                    </div>
                  )}
                  {os.foto_depois && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>DEPOIS</div>
                      <img src={os.foto_depois} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {filtradas.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhuma OS concluída encontrada</div>}
    </div>
  )
}
