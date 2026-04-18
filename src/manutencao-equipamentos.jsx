import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { TIPOS_EQUIPAMENTO, CIDADES, inputStyle, btnPrimary, btnSmall, card, fetchClientes } from './db.js'
import { fetchEquipamentos, createEquipamento, deleteEquipamento } from './manutencao-db.js'
import { SearchBar } from './components.jsx'
import { atualizarCoordenadasLote } from './geocoding.js'

const MapaEquipamentos = lazy(() => import('./mapa-equipamentos.jsx').then(m => ({ default: m.MapaEquipamentos })))

function NovoEquipamentoModal({ clientes, onClose, onSaved }) {
  const [tipo, setTipo] = useState(TIPOS_EQUIPAMENTO[0])
  const [modelo, setModelo] = useState('')
  const [serie, setSerie] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [local, setLocal] = useState('')
  const [status, setStatus] = useState('instalado')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!tipo) { alert('Selecione o tipo'); return }
    setSaving(true)
    const cl = clientes.find(c => c.id === clienteId)
    const eq = {
      tipo, modelo: modelo.trim() || null, numero_serie: serie.trim() || null,
      cliente_id: clienteId || null, cliente_nome: cl?.nome || null,
      local_instalacao: local.trim() || null, status,
      data_instalacao: status === 'instalado' ? new Date().toISOString().slice(0, 10) : null,
      observacoes: obs.trim() || null
    }
    await createEquipamento(eq)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Cadastrar Equipamento</h3>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          {TIPOS_EQUIPAMENTO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Modelo (opcional)" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="Número de série (opcional)" style={{ ...inputStyle, marginBottom: 10 }} />
        <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ ...inputStyle, marginBottom: 10, color: clienteId ? '#0A1628' : '#94A3B8' }}>
          <option value="">Cliente (opcional - se instalado)</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` - ${c.cidade}` : ''}</option>)}
        </select>
        <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Local de instalação (ex: Banheiro 2° andar)" style={{ ...inputStyle, marginBottom: 10 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="instalado">Instalado</option>
          <option value="em_estoque">Em estoque</option>
          <option value="defeito">Com defeito</option>
          <option value="descartado">Descartado</option>
        </select>
        <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações..." rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '+ Cadastrar'}</button>
        </div>
      </div>
    </div>
  )
}

const STATUS_EQ = {
  instalado: { label: 'Instalado', bg: '#D1FAE5', color: '#065F46' },
  em_estoque: { label: 'Em estoque', bg: '#DBEAFE', color: '#1D4ED8' },
  defeito: { label: 'Defeito', bg: '#FEE2E2', color: '#B91C1C' },
  descartado: { label: 'Descartado', bg: '#F1F5F9', color: '#64748B' }
}

export function ManutencaoEquipamentosTab() {
  const [equipamentos, setEquipamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [showNovo, setShowNovo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('lista')
  const [geoProgress, setGeoProgress] = useState(null)

  const load = useCallback(async () => {
    const [eq, cl] = await Promise.all([fetchEquipamentos(), fetchClientes()])
    setEquipamentos(eq); setClientes(cl); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (eq) => {
    if (!confirm(`Remover ${eq.tipo}${eq.cliente_nome ? ' de ' + eq.cliente_nome : ''}?`)) return
    await deleteEquipamento(eq.id); load()
  }

  const handleGeocode = async () => {
    if (!confirm('Atualizar coordenadas de todos os clientes sem localização? Isso pode demorar.')) return
    setGeoProgress({ total: 0, done: 0, ok: 0, fail: 0, nome: '' })
    await atualizarCoordenadasLote(setGeoProgress)
    await load()
    setTimeout(() => setGeoProgress(null), 3000)
  }

  const hoje = new Date()
  const dias90 = 90 * 24 * 60 * 60 * 1000

  const filtrados = equipamentos.filter(eq => {
    if (filtroTipo && eq.tipo !== filtroTipo) return false
    if (filtroStatus && eq.status !== filtroStatus) return false
    if (filtroCidade) {
      const cl = clientes.find(c => c.id === eq.cliente_id)
      if (!cl || cl.cidade !== filtroCidade) return false
    }
    if (search) {
      const s = search.toLowerCase()
      if (!eq.tipo.toLowerCase().includes(s) && !(eq.cliente_nome || '').toLowerCase().includes(s) && !(eq.modelo || '').toLowerCase().includes(s) && !(eq.numero_serie || '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const tipos = [...new Set(equipamentos.map(e => e.tipo))].sort()
  const cidades = [...new Set(clientes.filter(c => c.cidade).map(c => c.cidade))].sort()

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando equipamentos...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2 }}>Equipamentos ({filtrados.length})</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <button onClick={() => setViewMode('lista')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: viewMode === 'lista' ? '#0A1628' : '#fff', color: viewMode === 'lista' ? '#fff' : '#64748B' }}>📋 Lista</button>
            <button onClick={() => setViewMode('mapa')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: viewMode === 'mapa' ? '#0A1628' : '#fff', color: viewMode === 'mapa' ? '#fff' : '#64748B', borderLeft: '1px solid #E2E8F0' }}>🗺️ Mapa</button>
          </div>
          <button onClick={() => setShowNovo(true)} style={{ ...btnPrimary, padding: '0 14px', height: 36, fontSize: 13 }}>+ Cadastrar</button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente, endereço, tipo..." />

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: 12, height: 34 }}>
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: 12, height: 34 }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_EQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: 12, height: 34 }}>
          <option value="">Todas as cidades</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {viewMode === 'mapa' && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleGeocode} disabled={!!geoProgress} style={{ ...btnSmall, fontSize: 11, padding: '5px 12px', color: '#B45309', borderColor: '#FDE68A', background: '#FFFBEB' }}>
            📍 Atualizar coordenadas
          </button>
          {geoProgress && (
            <span style={{ fontSize: 11, color: '#64748B' }}>
              {geoProgress.done < geoProgress.total
                ? `Processando ${geoProgress.done}/${geoProgress.total}... (${geoProgress.nome})`
                : `Concluído: ${geoProgress.ok} OK, ${geoProgress.fail} falha(s)`}
            </span>
          )}
        </div>
      )}

      {viewMode === 'mapa' ? (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Carregando mapa...</div>}>
          <MapaEquipamentos equipamentos={equipamentos} clientes={clientes} filtroTipo={filtroTipo} filtroStatus={filtroStatus} filtroCidade={filtroCidade} search={search} />
        </Suspense>
      ) : (
        <>
          {filtrados.map(eq => {
            const st = STATUS_EQ[eq.status] || STATUS_EQ.instalado
            const needsMaint = eq.status === 'instalado' && eq.ultima_manutencao && (hoje - new Date(eq.ultima_manutencao)) > dias90
            const neverMaint = eq.status === 'instalado' && !eq.ultima_manutencao && eq.data_instalacao && (hoje - new Date(eq.data_instalacao)) > dias90
            return (
              <div key={eq.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0A1628' }}>{eq.tipo}</div>
                    {eq.modelo && <div style={{ fontSize: 11, color: '#64748B' }}>{eq.modelo}{eq.numero_serie ? ` · S/N: ${eq.numero_serie}` : ''}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                {eq.cliente_nome && <div style={{ fontSize: 12, color: '#334155', marginBottom: 2 }}>👤 {eq.cliente_nome}</div>}
                {eq.local_instalacao && <div style={{ fontSize: 11, color: '#94A3B8' }}>📍 {eq.local_instalacao}</div>}
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 12 }}>
                  {eq.data_instalacao && <span>Instalado: {new Date(eq.data_instalacao).toLocaleDateString('pt-BR')}</span>}
                  {eq.ultima_manutencao && <span>Última manutenção: {new Date(eq.ultima_manutencao).toLocaleDateString('pt-BR')}</span>}
                </div>
                {(needsMaint || neverMaint) && (
                  <div style={{ marginTop: 6, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: '#B45309' }}>⚠️ Manutenção pendente (90+ dias)</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => handleDelete(eq)} style={{ ...btnSmall, fontSize: 10, padding: '3px 8px', color: '#EF4444' }}>🗑 Remover</button>
                </div>
              </div>
            )
          })}
          {filtrados.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhum equipamento encontrado</div>}
        </>
      )}

      {showNovo && <NovoEquipamentoModal clientes={clientes} onClose={() => setShowNovo(false)} onSaved={load} />}
    </div>
  )
}
