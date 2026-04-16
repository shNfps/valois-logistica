import { useState } from 'react'
import { ManutencaoAgendaTab } from './manutencao-agenda.jsx'
import { ManutencaoEquipamentosTab } from './manutencao-equipamentos.jsx'
import { ManutencaoHistoricoTab } from './manutencao-historico.jsx'

const tabBtn = (active) => ({ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, background: active ? '#0A1628' : 'transparent', color: active ? '#fff' : '#64748B' })

export function ManutencaoView({ user }) {
  const [tab, setTab] = useState('agenda')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E2E8F0', paddingBottom: 0 }}>
        <button onClick={() => setTab('agenda')} style={tabBtn(tab === 'agenda')}>📅 Agenda</button>
        <button onClick={() => setTab('equipamentos')} style={tabBtn(tab === 'equipamentos')}>📦 Equipamentos</button>
        <button onClick={() => setTab('historico')} style={tabBtn(tab === 'historico')}>📋 Histórico</button>
      </div>
      {tab === 'agenda' && <ManutencaoAgendaTab user={user} />}
      {tab === 'equipamentos' && <ManutencaoEquipamentosTab />}
      {tab === 'historico' && <ManutencaoHistoricoTab />}
    </div>
  )
}
