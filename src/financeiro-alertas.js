import { fmtMoney } from './db.js'
import { fetchDespesas, fetchContasReceber, fetchConfigFinanceiro, statusEfetivo, diasAte, alertaJaDisparado, marcarAlertaDisparado, clientesInadimplentes, isoHoje } from './financeiro-db.js'
import { criarNotificacao } from './notificacoes.js'

// Varre o estado financeiro e dispara notificações que ainda não foram enviadas hoje.
// Usa a tabela alertas_financeiro_disparados como deduplicador (chave: tipo:id:data).
export async function rodarAlertasFinanceiros() {
  try {
    const [despesas, receber, cfg] = await Promise.all([fetchDespesas(), fetchContasReceber(), fetchConfigFinanceiro()])
    const hoje = isoHoje()
    const diasAlerta = cfg?.dias_alerta_vencimento ?? 3

    for (const d of despesas) {
      if (d.status !== 'PENDENTE') continue
      const dias = diasAte(d.data_vencimento)
      if (dias >= 0 && dias <= diasAlerta) {
        const chave = `desp_venc:${d.id}:${hoje}`
        if (!await alertaJaDisparado(chave)) {
          const titulo = dias === 0 ? `🔴 Boleto vence HOJE: ${d.descricao}` : `⚠️ Boleto vence em ${dias} dia${dias > 1 ? 's' : ''}: ${d.descricao}`
          await criarNotificacao('financeiro', titulo, `${d.fornecedor || ''} · ${fmtMoney(d.valor)}`)
          await marcarAlertaDisparado(chave)
        }
      }
      if (statusEfetivo(d) === 'ATRASADO') {
        const chave = `desp_atraso:${d.id}:${hoje}`
        if (!await alertaJaDisparado(chave)) {
          await criarNotificacao('financeiro', `🚨 Boleto atrasado: ${d.descricao}`, `${d.fornecedor || ''} · ${fmtMoney(d.valor)} · venc. ${d.data_vencimento}`)
          await marcarAlertaDisparado(chave)
        }
      }
    }

    if (cfg?.alertar_inadimplencia) {
      const inad = clientesInadimplentes(receber)
      for (const i of inad) {
        const chave = `inadimp:${i.cliente_id || i.cliente_nome}:${hoje}`
        if (!await alertaJaDisparado(chave)) {
          await criarNotificacao('comercial', `🚨 Cliente inadimplente: ${i.cliente_nome}`, `${i.count} contas atrasadas · ${fmtMoney(i.total)}`)
          await criarNotificacao('financeiro', `🚨 Cliente inadimplente: ${i.cliente_nome}`, `${i.count} contas atrasadas · ${fmtMoney(i.total)}`)
          await marcarAlertaDisparado(chave)
        }
      }
    }
  } catch (e) {
    console.error('Erro ao rodar alertas financeiros:', e)
  }
}
