import { useState } from 'react'
import { DashboardTab } from './financeiro-dashboard.jsx'
import { ConfiguracoesTab } from './financeiro-config.jsx'
import { ContasPagarTab } from './financeiro-contas-pagar.jsx'
import { ContasReceberTab } from './financeiro-contas-receber.jsx'
import { ReembolsosFinanceiroTab } from './reembolsos.jsx'
import { DRETab } from './dre.jsx'

const tabBtn = (active) => ({ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, background: active ? '#059669' : 'transparent', color: active ? '#fff' : '#64748B' })

export function FinanceiroView({ user }) {
  const [tab, setTab] = useState('dashboard')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E2E8F0', paddingBottom: 0, overflowX: 'auto' }}>
        <button onClick={() => setTab('dashboard')} style={tabBtn(tab === 'dashboard')}>📊 Dashboard</button>
        <button onClick={() => setTab('pagar')} style={tabBtn(tab === 'pagar')}>📅 Contas a Pagar</button>
        <button onClick={() => setTab('receber')} style={tabBtn(tab === 'receber')}>📈 Contas a Receber</button>
        <button onClick={() => setTab('reembolsos')} style={tabBtn(tab === 'reembolsos')}>💸 Reembolsos</button>
        <button onClick={() => setTab('dre')} style={tabBtn(tab === 'dre')}>📊 DRE</button>
        <button onClick={() => setTab('config')} style={tabBtn(tab === 'config')}>⚙️ Configurações</button>
      </div>
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'pagar' && <ContasPagarTab user={user} />}
      {tab === 'receber' && <ContasReceberTab />}
      {tab === 'reembolsos' && <ReembolsosFinanceiroTab />}
      {tab === 'dre' && <DRETab />}
      {tab === 'config' && <ConfiguracoesTab />}
    </div>
  )
}
