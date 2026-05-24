import { useEffect, useState } from 'react'
import { fmtMoney, card, btnPrimary, btnSmall, inputStyle } from './db.js'
import { Loader } from './components.jsx'
import { fetchVisitasRetencao, atualizarVisitaRetencao } from './relatorios-db.js'

const STATUS_VISITA = {
  AGENDADA:  { label: 'Agendada',  bg: '#FEF3C7', color: '#92400E', icon: '📅' },
  REALIZADA: { label: 'Realizada', bg: '#D1FAE5', color: '#065F46', icon: '✅' },
  CANCELADA: { label: 'Cancelada', bg: '#FEE2E2', color: '#991B1B', icon: '❌' }
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const diasAte = d => {
  if (!d) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(d); alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo - hoje) / 86400000)
}

function ModalRealizar({ visita, onClose, onSaved }) {
  const [obs, setObs] = useState(visita.observacao || '')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    const { error } = await atualizarVisitaRetencao(visita.id, {
      status: 'REALIZADA',
      data_realizada: new Date().toISOString(),
      observacao: obs || null
    })
    setSalvando(false)
    if (error) { alert('Erro: ' + (error.message || 'desconhecido')); return }
    onSaved?.(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✅ Marcar como realizada</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{visita.clientes?.nome}</div>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>O que foi tratado</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={5}
          style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 16, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnSmall, height: 36, padding: '0 16px' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RelatorioVisitasPendentes() {
  const [loading, setLoading] = useState(true)
  const [visitas, setVisitas] = useState([])
  const [modalRealizar, setModalRealizar] = useState(null)

  const carregar = async () => {
    setLoading(true)
    const v = await fetchVisitasRetencao({ status: 'AGENDADA' })
    setVisitas(v); setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const cancelar = async (visita) => {
    if (!confirm(`Cancelar a visita agendada para ${visita.clientes?.nome}?`)) return
    await atualizarVisitaRetencao(visita.id, { status: 'CANCELADA' })
    carregar()
  }

  if (loading) return <Loader />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📅 Visitas de Retenção Pendentes</h2>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{visitas.length} agendada(s)</div>
        </div>
        <button onClick={carregar} style={btnSmall}>🔄 Recarregar</button>
      </div>

      {visitas.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#64748B' }}>
          Nenhuma visita agendada. Use a tela de Diagnóstico Top 20 para agendar.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                <th style={th()}>Cliente</th>
                <th style={th()}>Cidade</th>
                <th style={th()}>Vendedor</th>
                <th style={th()}>Data</th>
                <th style={th()}>Em</th>
                <th style={th()}>Observação</th>
                <th style={th()}>Criado por</th>
                <th style={th()}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map(v => {
                const dias = diasAte(v.data_agendada)
                const atrasada = dias != null && dias < 0
                const cor = atrasada ? '#991B1B' : dias === 0 ? '#92400E' : '#0F172A'
                const labelDias = dias == null ? '—'
                  : dias < 0 ? `${Math.abs(dias)}d atrasada`
                  : dias === 0 ? 'Hoje'
                  : `em ${dias}d`
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid #E2E8F0', background: atrasada ? '#FEF2F2' : '#fff' }}>
                    <td style={{ ...td(), fontWeight: 600 }}>{v.clientes?.nome || '—'}</td>
                    <td style={td()}>{v.clientes?.cidade || '—'}</td>
                    <td style={td()}>{v.vendedor_responsavel || '—'}</td>
                    <td style={td()}>{fmtDate(v.data_agendada)}</td>
                    <td style={{ ...td(), color: cor, fontWeight: atrasada ? 700 : 500 }}>{labelDias}</td>
                    <td style={{ ...td(), color: '#475569', maxWidth: 280 }}>{v.observacao || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    <td style={{ ...td(), color: '#64748B', fontSize: 11 }}>{v.criado_por}</td>
                    <td style={{ ...td(), whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModalRealizar(v)} style={{ ...btnSmall, height: 28, fontSize: 11, background: '#D1FAE5', color: '#065F46' }}>✅ Realizada</button>
                      <button onClick={() => cancelar(v)} style={{ ...btnSmall, height: 28, fontSize: 11, marginLeft: 4, background: '#FEE2E2', color: '#991B1B' }}>❌ Cancelar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalRealizar && <ModalRealizar visita={modalRealizar} onClose={() => setModalRealizar(null)} onSaved={carregar} />}
    </div>
  )
}

const th = () => ({ padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', textAlign: 'left', borderBottom: '2px solid #E2E8F0' })
const td = () => ({ padding: '10px 12px', fontSize: 12, color: '#0F172A' })
