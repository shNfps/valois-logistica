import { ManutencaoAceiteTab } from './manutencao-aceite.jsx'
import { ManutencaoAgendaTab } from './manutencao-agenda.jsx'
import { ManutencaoEquipamentosTab } from './manutencao-equipamentos.jsx'
import { ManutencaoHistoricoTab } from './manutencao-historico.jsx'
import { ReembolsosFuncionarioTab } from './reembolsos.jsx'

// Sub-abas controladas pelo side menu (Checkpoint 4): recebe `tab` por prop.
export function ManutencaoView({ user, tab = 'manutencoes' }) {
  return (
    <div>
      {tab === 'manutencoes' && <ManutencaoAceiteTab user={user} />}
      {tab === 'agenda' && <ManutencaoAgendaTab user={user} />}
      {tab === 'equipamentos' && <ManutencaoEquipamentosTab />}
      {tab === 'historico' && <ManutencaoHistoricoTab />}
      {tab === 'reembolsos' && <ReembolsosFuncionarioTab user={user} />}
    </div>
  )
}
