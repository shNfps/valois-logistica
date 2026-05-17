import { supabase } from './supabase.js'

// ─── Períodos ───
export function periodoIntervalo(tipo, ref = new Date(), custom = {}) {
  const hoje = new Date(ref); hoje.setHours(0, 0, 0, 0)
  if (tipo === 'mes') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return { de: iso(ini), ate: iso(fim) }
  }
  if (tipo === 'mes_anterior') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    return { de: iso(ini), ate: iso(fim) }
  }
  if (tipo === 'trimestre') {
    const m = hoje.getMonth(); const q = Math.floor(m / 3)
    return { de: iso(new Date(hoje.getFullYear(), q * 3, 1)), ate: iso(new Date(hoje.getFullYear(), q * 3 + 3, 0)) }
  }
  if (tipo === 'ano') {
    return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(new Date(hoje.getFullYear(), 11, 31)) }
  }
  return { de: custom.de || iso(hoje), ate: custom.ate || iso(hoje) }
}
export function periodoAnterior({ de, ate }) {
  const d1 = new Date(de + 'T00:00:00'); const d2 = new Date(ate + 'T00:00:00')
  const dias = Math.round((d2 - d1) / 86400000) + 1
  const ate2 = new Date(d1); ate2.setDate(ate2.getDate() - 1)
  const de2 = new Date(ate2); de2.setDate(de2.getDate() - dias + 1)
  return { de: iso(de2), ate: iso(ate2) }
}
function iso(d) { return d.toISOString().slice(0, 10) }

// ─── Buscas brutas ───
export async function fetchDadosDRE({ de, ate }) {
  const [pedidos, despesas, reembolsos, contas] = await Promise.all([
    supabase.from('pedidos').select('id,cliente,cliente_id,valor_total,status,entrega_data,atualizado_em').eq('status', 'ENTREGUE').gte('atualizado_em', de + 'T00:00:00').lte('atualizado_em', ate + 'T23:59:59'),
    supabase.from('despesas').select('id,descricao,categoria_id,categoria_tipo,valor,status,data_pagamento').eq('status', 'PAGO').gte('data_pagamento', de).lte('data_pagamento', ate),
    supabase.from('reembolsos').select('id,usuario_nome,descricao,valor,status,data_reembolso').eq('status', 'REEMBOLSADO').gte('data_reembolso', de).lte('data_reembolso', ate),
    supabase.from('contas_receber').select('id,status,valor,data_vencimento,data_recebimento')
  ])
  const pedidosOk = pedidos.data || []
  const ids = pedidosOk.map(p => p.id)
  let itens = []
  if (ids.length) {
    const { data } = await supabase.from('pedido_itens').select('pedido_id,codigo,nome_produto,quantidade,preco_total,custo_unitario').in('pedido_id', ids)
    itens = data || []
  }
  // Custos via produtos quando snapshot ausente
  const codigos = [...new Set(itens.filter(i => i.custo_unitario == null && i.codigo).map(i => i.codigo))]
  let produtosCusto = {}
  if (codigos.length) {
    const { data } = await supabase.from('produtos').select('codigo,nome,custo').in('codigo', codigos)
    ;(data || []).forEach(p => { produtosCusto[p.codigo] = Number(p.custo || 0) })
  }
  return { pedidos: pedidosOk, itens, despesas: despesas.data || [], reembolsos: reembolsos.data || [], contas: contas.data || [], produtosCusto }
}

// ─── Cálculo do DRE ───
const GRUPOS_OPERACIONAL = {
  salario: { label: 'Salários e Benefícios', icone: '👥' },
  infra: { label: 'Aluguel e Infraestrutura', icone: '🏢' },
  veiculo: { label: 'Combustível e Veículos', icone: '⛽' },
  operacional: { label: 'Operacional / Manutenção', icone: '🛠️' },
  obra: { label: 'Obras e Reformas', icone: '🔨' },
  fornecedor: { label: 'Fornecedores diversos', icone: '📦' },
  outros: { label: 'Outros', icone: '💵' },
}

export function calcularDRE(dados, cfg) {
  const tImpVenda = Number(cfg?.taxa_imposto_venda ?? 12) / 100
  const tImpLucro = Number(cfg?.taxa_imposto_lucro ?? 6) / 100
  const tComissao = Number(cfg?.taxa_comissao ?? 5) / 100

  const receitaBruta = dados.pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const deducoes = receitaBruta * tImpVenda
  const receitaLiquida = receitaBruta - deducoes

  const semCusto = []
  const cmv = dados.itens.reduce((s, i) => {
    const qtd = Number(i.quantidade || 0)
    let custo = i.custo_unitario != null ? Number(i.custo_unitario) : (i.codigo ? dados.produtosCusto[i.codigo] : 0)
    if (!custo) { if (i.nome_produto && !semCusto.includes(i.nome_produto)) semCusto.push(i.nome_produto) }
    return s + qtd * (custo || 0)
  }, 0)
  const lucroBruto = receitaLiquida - cmv

  const operacionais = {}
  for (const tipo of Object.keys(GRUPOS_OPERACIONAL)) operacionais[tipo] = 0
  dados.despesas.forEach(d => {
    if (d.categoria_tipo === 'imposto') return
    const k = operacionais[d.categoria_tipo] != null ? d.categoria_tipo : 'outros'
    operacionais[k] += Number(d.valor || 0)
  })
  const reembolsosPagos = dados.reembolsos.reduce((s, r) => s + Number(r.valor || 0), 0)
  const comissoes = receitaBruta * tComissao
  const totalOperacional = Object.values(operacionais).reduce((s, v) => s + v, 0) + reembolsosPagos + comissoes

  const ebitda = lucroBruto - totalOperacional
  const impostoLucro = ebitda > 0 ? ebitda * tImpLucro : 0
  const lucroLiquido = ebitda - impostoLucro

  const pct = (n, d) => d > 0 ? (n / d) * 100 : 0
  return {
    receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto, operacionais, comissoes, reembolsosPagos,
    totalOperacional, ebitda, impostoLucro, lucroLiquido,
    margemBruta: pct(lucroBruto, receitaBruta),
    margemEbitda: pct(ebitda, receitaBruta),
    margemLiquida: pct(lucroLiquido, receitaBruta),
    qtdPedidos: dados.pedidos.length,
    ticketMedio: dados.pedidos.length ? receitaBruta / dados.pedidos.length : 0,
    clientesAtivos: new Set(dados.pedidos.map(p => p.cliente_id || p.cliente)).size,
    produtosSemCusto: semCusto,
    inadimplencia: (() => {
      const hoje = new Date().toISOString().slice(0, 10)
      const atrasadas = dados.contas.filter(c => c.status !== 'RECEBIDO' && c.status !== 'CANCELADO' && c.data_vencimento < hoje).reduce((s, c) => s + Number(c.valor || 0), 0)
      const aberto = dados.contas.filter(c => c.status !== 'RECEBIDO' && c.status !== 'CANCELADO').reduce((s, c) => s + Number(c.valor || 0), 0)
      return aberto > 0 ? (atrasadas / aberto) * 100 : 0
    })()
  }
}

export { GRUPOS_OPERACIONAL }
