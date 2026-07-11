import { DashboardTab } from './financeiro-dashboard.jsx'
import { ConfiguracoesTab } from './financeiro-config.jsx'
import { ContasPagarTab } from './financeiro-contas-pagar.jsx'
import { ContasReceberTab } from './financeiro-contas-receber.jsx'
import { ReembolsosFinanceiroTab } from './reembolsos.jsx'
import { DRETab } from './dre.jsx'

// Sub-abas controladas pelo side menu (Checkpoint 4): recebe `tab` por prop.
export function FinanceiroView({ user, tab = 'dashboard' }) {
  return (
    <div>
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'pagar' && <ContasPagarTab user={user} />}
      {tab === 'receber' && <ContasReceberTab />}
      {tab === 'reembolsos' && <ReembolsosFinanceiroTab />}
      {tab === 'dre' && <DRETab />}
      {tab === 'config' && <ConfiguracoesTab />}
    </div>
  )
}
