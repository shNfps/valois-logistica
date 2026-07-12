import { supabase } from './supabase.js'

// ─── Categorias de despesa ───
export async function fetchCategoriasDespesa() {
  const { data, error } = await supabase.from('categorias_despesa').select('*').eq('ativo', true).order('nome')
  if (error) { console.error(error); return [] }
  return data || []
}
export async function createCategoriaDespesa(c) {
  const { data, error } = await supabase.from('categorias_despesa').insert(c).select().single()
  if (error) { console.error(error); return null }
  return data
}
export async function updateCategoriaDespesa(id, updates) {
  const { error } = await supabase.from('categorias_despesa').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deleteCategoriaDespesa(id) {
  const { error } = await supabase.from('categorias_despesa').update({ ativo: false }).eq('id', id)
  if (error) console.error(error)
}

// ─── Despesas (contas a pagar) ───
export async function fetchDespesas(filtros = {}) {
  let q = supabase.from('despesas').select('*').order('data_vencimento', { ascending: true })
  if (filtros.status) q = q.eq('status', filtros.status)
  if (filtros.categoria_id) q = q.eq('categoria_id', filtros.categoria_id)
  if (filtros.de) q = q.gte('data_vencimento', filtros.de)
  if (filtros.ate) q = q.lte('data_vencimento', filtros.ate)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}
export async function createDespesa(d) {
  const { data, error } = await supabase.from('despesas').insert(d).select().single()
  if (error) { console.error(error); return null }
  return data
}
export async function updateDespesa(id, updates) {
  const { error } = await supabase.from('despesas').update({ ...updates, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) console.error(error)
}
export async function deleteDespesa(id) {
  const { error } = await supabase.from('despesas').delete().eq('id', id)
  if (error) console.error(error)
}

// Cria as próximas N ocorrências de uma despesa recorrente.
export async function gerarRecorrencias(despesa, n = 12) {
  if (!despesa.recorrente || !despesa.periodicidade) return
  const meses = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[despesa.periodicidade] || 1
  const base = new Date(despesa.data_vencimento + 'T00:00:00')
  const rows = []
  for (let i = 1; i <= n; i++) {
    const d = new Date(base); d.setMonth(d.getMonth() + meses * i)
    rows.push({
      descricao: despesa.descricao, categoria_id: despesa.categoria_id, categoria_tipo: despesa.categoria_tipo,
      valor: despesa.valor, fornecedor: despesa.fornecedor, cnpj_fornecedor: despesa.cnpj_fornecedor,
      data_vencimento: d.toISOString().slice(0, 10), forma_pagamento: despesa.forma_pagamento,
      numero_documento: null, observacoes: despesa.observacoes,
      recorrente: true, periodicidade: despesa.periodicidade,
      criado_por: despesa.criado_por, status: 'PENDENTE'
    })
  }
  const { error } = await supabase.from('despesas').insert(rows)
  if (error) console.error('Erro ao gerar recorrências:', error)
}

// Marca como pago e, se recorrente, cria a próxima ocorrência (se ainda não existir).
export async function pagarDespesa(despesa, dataPagamento, formaPagamento) {
  await updateDespesa(despesa.id, {
    status: 'PAGO',
    data_pagamento: dataPagamento,
    forma_pagamento: formaPagamento || despesa.forma_pagamento
  })
}

// ─── Reembolsos ───
export async function fetchReembolsos(filtros = {}) {
  let q = supabase.from('reembolsos').select('*').order('criado_em', { ascending: false })
  if (filtros.usuario_nome) q = q.eq('usuario_nome', filtros.usuario_nome)
  if (filtros.status) q = q.eq('status', filtros.status)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}
export async function createReembolso(r) {
  const { data, error } = await supabase.from('reembolsos').insert(r).select().single()
  if (error) { console.error(error); return null }
  return data
}
export async function updateReembolso(id, updates) {
  const { error } = await supabase.from('reembolsos').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deleteReembolso(id) {
  const { error } = await supabase.from('reembolsos').delete().eq('id', id)
  if (error) console.error(error)
}

// ─── Contas a receber ───
export async function fetchContasReceber(filtros = {}) {
  let q = supabase.from('contas_receber').select('*').order('data_vencimento', { ascending: true })
  if (filtros.status) q = q.eq('status', filtros.status)
  if (filtros.de) q = q.gte('data_vencimento', filtros.de)
  if (filtros.ate) q = q.lte('data_vencimento', filtros.ate)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}
export async function createContaReceber(c) {
  const { data, error } = await supabase.from('contas_receber').insert(c).select().single()
  if (error) { console.error(error); return null }
  return data
}
export async function updateContaReceber(id, updates) {
  const { error } = await supabase.from('contas_receber').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deleteContaReceber(id) {
  const { error } = await supabase.from('contas_receber').delete().eq('id', id)
  if (error) console.error(error)
}

// ─── Helpers de período / status ───
export function isoHoje() { return new Date().toISOString().slice(0, 10) }
export function diasAte(iso) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(iso + 'T00:00:00')
  return Math.round((alvo - hoje) / 86400000)
}
export function statusEfetivo(d) {
  if (d.status === 'PAGO' || d.status === 'RECEBIDO' || d.status === 'CANCELADO') return d.status
  return diasAte(d.data_vencimento) < 0 ? 'ATRASADO' : 'PENDENTE'
}

// ─── Fornecedores recorrentes ───
export async function fetchFornecedores() {
  const { data, error } = await supabase.from('fornecedores').select('*').eq('ativo', true).order('nome')
  if (error) { console.error(error); return [] }
  return data || []
}
export async function createFornecedor(f) {
  const { data, error } = await supabase.from('fornecedores').insert(f).select().single()
  if (error) { console.error(error); return null }
  return data
}
export async function updateFornecedor(id, updates) {
  const { error } = await supabase.from('fornecedores').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deleteFornecedor(id) {
  const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', id)
  if (error) console.error(error)
}

// ─── Config global ───
export async function fetchConfigFinanceiro() {
  const { data, error } = await supabase.from('config_financeiro').select('*').eq('id', 1).maybeSingle()
  if (error) { console.error(error); return null }
  return data || { dias_alerta_vencimento: 3, alertar_inadimplencia: true, forma_pagamento_padrao: 'a_vista' }
}
export async function updateConfigFinanceiro(updates) {
  const { error } = await supabase.from('config_financeiro').upsert({ id: 1, ...updates, atualizado_em: new Date().toISOString() })
  if (error) console.error(error)
}

// ─── Regras de recebimento parcial / saldo (fonte única de verdade) ───
// A coluna original é `valor` (valor total/original da conta). `valor_recebido`
// e `saldo_em_aberto` foram adicionados na migration v4. Helpers abaixo lidam
// com registros antigos (saldo_em_aberto nulo) recalculando na hora.
export function valorOriginal(c) { return Number(c?.valor || 0) }
export function valorRecebido(c) { return Number(c?.valor_recebido || 0) }
export function saldoAberto(c) {
  if (c?.saldo_em_aberto != null) return Math.max(Number(c.saldo_em_aberto), 0)
  return Math.max(valorOriginal(c) - valorRecebido(c), 0)
}

// Status efetivo de uma CONTA A RECEBER (recalcula a partir dos valores/vencimento).
// Segue a regra do fluxo: 0 recebido → PENDENTE/ATRASADO · parcial → PARCIAL ·
// quitado → RECEBIDO. CANCELADO/RENEGOCIADO são estados terminais e não mudam.
export function statusContaReceber(c) {
  if (!c) return 'PENDENTE'
  if (c.status === 'CANCELADO' || c.status === 'RENEGOCIADO') return c.status
  const valor = valorOriginal(c), recebido = valorRecebido(c)
  if (valor > 0 && recebido >= valor) return 'RECEBIDO'
  if (recebido > 0) return 'PARCIAL'
  return diasAte(c.data_vencimento) < 0 ? 'ATRASADO' : 'PENDENTE'
}

// Conta em aberto = ainda deve algo (não cancelada/renegociada/quitada).
export function contaEmAberto(c) {
  const st = statusContaReceber(c)
  if (st === 'CANCELADO' || st === 'RENEGOCIADO' || st === 'RECEBIDO') return false
  return saldoAberto(c) > 0
}
// Vencida = em aberto E venceu. É a base da inadimplência (1 boleto já basta).
export function contaVencida(c) { return contaEmAberto(c) && diasAte(c.data_vencimento) < 0 }
export function diasAtrasoConta(c) { return contaVencida(c) ? -diasAte(c.data_vencimento) : 0 }

// ─── Auto-criação/atualização de conta a receber a partir do pedido ───
const PRAZO_FORMA = { a_vista: 0, boleto_7: 7, boleto_14: 14, boleto_21: 21, boleto_28: 28, cartao: 0, pix: 0 }
export function isFormaBoleto(forma) { return String(forma || '').startsWith('boleto') }
export function formaToCR(forma) {
  if (isFormaBoleto(forma)) return 'boleto'
  return forma === 'pix' ? 'pix' : forma === 'cartao' ? 'cartao' : 'a_vista'
}

// Vencimento da conta: usa a data EXATA do boleto (data_vencimento_pagamento).
// Sem ela, cai no cálculo por prazo a partir de baseIso (marca automatico=true).
export function resolverVencimento(pedido, baseIso) {
  if (pedido.data_vencimento_pagamento) return { venc: pedido.data_vencimento_pagamento, automatico: false }
  const prazo = Number(pedido.prazo_pagamento_dias ?? PRAZO_FORMA[pedido.forma_pagamento] ?? 0)
  const base = baseIso ? new Date(baseIso + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + prazo)
  return { venc: base.toISOString().slice(0, 10), automatico: true }
}

// Cria OU atualiza a conta a receber do pedido, sem duplicar.
// Procura conta existente por pedido_id OU numero_nf. Preserva recebimentos já
// lançados e recalcula saldo/status. Retorna { ok, criado, conta, motivo }.
// opts: { vendedorNome, baseIso, origem }
export async function upsertContaReceberDoPedido(pedido, opts = {}) {
  if (!pedido?.id) return { ok: false, motivo: 'sem_pedido' }
  const valor = Number(pedido.valor_total || 0)
  const numero_nf = pedido.numero_nf || null

  // localizar conta existente (pedido_id tem prioridade; senão numero_nf)
  let existente = null
  {
    const { data } = await supabase.from('contas_receber').select('*').eq('pedido_id', pedido.id).maybeSingle()
    existente = data || null
  }
  if (!existente && numero_nf) {
    const { data } = await supabase.from('contas_receber').select('*').eq('numero_nf', numero_nf).limit(1)
    existente = (data && data[0]) || null
  }

  const { venc, automatico } = resolverVencimento(pedido, opts.baseIso)
  const meta = {
    numero_nf,
    cliente_id: pedido.cliente_id || null,
    cliente_nome: pedido.cliente,
    forma_pagamento: formaToCR(pedido.forma_pagamento),
    data_vencimento: venc,
    vencimento_automatico: automatico,
    boleto_url: pedido.boleto_url || existente?.boleto_url || null,
    nf_url: pedido.nf_url || existente?.nf_url || null,
    vendedor_nome: opts.vendedorNome || existente?.vendedor_nome || null,
    atualizado_em: new Date().toISOString(),
  }

  // Sem valor ainda (ex.: NF anexada antes de extrair os itens): não cria a conta,
  // mas mantém metadados atualizados na conta existente. Motivo logado com segurança.
  if (!(valor > 0)) {
    if (existente) { await supabase.from('contas_receber').update(meta).eq('id', existente.id) }
    else console.warn(`[contas_receber] pedido ${pedido.numero_ref || pedido.id} sem valor_total — conta não criada (aguardando extração/valor).`)
    return { ok: false, motivo: 'sem_valor', conta: existente || null }
  }

  if (existente) {
    const recebido = Number(existente.valor_recebido || 0)
    const saldo = Math.max(valor - recebido, 0)
    const terminal = existente.status === 'CANCELADO' || existente.status === 'RENEGOCIADO'
    const status = terminal ? existente.status
      : (valor > 0 && recebido >= valor ? 'RECEBIDO' : recebido > 0 ? 'PARCIAL' : (diasAte(venc) < 0 ? 'ATRASADO' : 'PENDENTE'))
    const updates = { ...meta, valor, pedido_id: pedido.id, saldo_em_aberto: saldo, status }
    const { error } = await supabase.from('contas_receber').update(updates).eq('id', existente.id)
    if (error) { console.error('[contas_receber] update:', error); return { ok: false, motivo: 'erro_update', error } }
    return { ok: true, criado: false, conta: { ...existente, ...updates } }
  }

  const insert = {
    ...meta, pedido_id: pedido.id, valor,
    data_emissao: isoHoje(), valor_recebido: 0, saldo_em_aberto: valor,
    origem: opts.origem || 'pedido_nf',
    status: diasAte(venc) < 0 ? 'ATRASADO' : 'PENDENTE',
  }
  const { data, error } = await supabase.from('contas_receber').insert(insert).select().single()
  if (error) { console.error('[contas_receber] insert:', error); return { ok: false, motivo: 'erro_insert', error } }
  return { ok: true, criado: true, conta: data }
}

// Compat: assinatura antiga usada no fluxo de anexar NF. Retorna a conta ou null.
export async function criarContaReceberDoPedido(pedido, opts) {
  const r = await upsertContaReceberDoPedido(pedido, opts)
  return r.ok ? r.conta : (r.conta || null)
}

// Pendência financeira do pedido: o que falta para gerar a conta a receber.
// Retorna null quando está tudo certo, ou { motivos:[], mensagem }.
// Só cobra dados a partir da NF emitida (não trava o fluxo comercial anterior).
export function pedidoFinanceiroPendente(pedido, conta) {
  if (!pedido || !['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(pedido.status)) return null
  const motivos = []
  if (!pedido.numero_nf) motivos.push('sem NF')
  if (!(Number(pedido.valor_total) > 0)) motivos.push('sem valor')
  if (isFormaBoleto(pedido.forma_pagamento)) {
    if (!pedido.data_vencimento_pagamento) motivos.push('sem vencimento do boleto')
    if (!pedido.boleto_url) motivos.push('sem PDF do boleto')
  }
  // Só cobra a existência da conta quando o chamador passa conta=null explicitamente
  // (telas que carregam contas). No comercial, chama sem o 2º arg e não gera falso positivo.
  if (!motivos.length && conta === null) motivos.push('conta a receber não gerada')
  if (!motivos.length) return null
  return { motivos, mensagem: `Dados financeiros incompletos: ${motivos.join(', ')}. Informe boleto, vencimento e valor para gerar a conta a receber.` }
}

// ─── Baixa / recebimento (fluxo único, preparado p/ conciliação bancária) ───
// origem: 'manual' | 'banco' | 'cnab' | 'webhook' | 'csv'. valorRecebido é o valor
// recebido NESTE evento (incremental) — soma ao já recebido. Nunca gera saldo negativo.
export async function registrarRecebimentoContaReceber({ contaId, valorRecebido: valorEvento, dataRecebimento, origem = 'manual', observacao } = {}) {
  const { data: conta, error } = await supabase.from('contas_receber').select('*').eq('id', contaId).single()
  if (error || !conta) return { ok: false, motivo: 'nao_encontrada' }
  const valor = Number(conta.valor || 0)
  const jaRecebido = Number(conta.valor_recebido || 0)
  let novoRecebido = jaRecebido + Number(valorEvento || 0)
  if (novoRecebido > valor) novoRecebido = valor   // recebido acima do total = quitação total
  if (novoRecebido < 0) novoRecebido = 0
  const saldo = Math.max(valor - novoRecebido, 0)
  const quitado = valor > 0 && saldo <= 0
  const dataEvento = dataRecebimento || isoHoje()
  const updates = {
    valor_recebido: novoRecebido,
    saldo_em_aberto: saldo,
    data_ultimo_recebimento: dataEvento,
    status: quitado ? 'RECEBIDO' : (novoRecebido > 0 ? 'PARCIAL' : (diasAte(conta.data_vencimento) < 0 ? 'ATRASADO' : 'PENDENTE')),
    atualizado_em: new Date().toISOString(),
  }
  if (quitado) updates.data_recebimento = dataEvento
  if (observacao != null && observacao !== '') updates.observacao_financeira = observacao
  const { error: upErr } = await supabase.from('contas_receber').update(updates).eq('id', contaId)
  if (upErr) { console.error('[contas_receber] recebimento:', upErr); return { ok: false, motivo: 'erro_update', error: upErr } }
  return { ok: true, quitado, origem, conta: { ...conta, ...updates } }
}

// Cancelar / renegociar (baixa sem recebimento) com observação financeira.
export async function atualizarStatusContaReceber(contaId, status, observacao) {
  const updates = { status, atualizado_em: new Date().toISOString() }
  if (observacao != null && observacao !== '') updates.observacao_financeira = observacao
  const { error } = await supabase.from('contas_receber').update(updates).eq('id', contaId)
  if (error) { console.error('[contas_receber] status:', error); return { ok: false, error } }
  return { ok: true }
}

// ─── Inadimplência (1 boleto vencido já basta) ───
// clientesById: mapa opcional { [cliente_id]: cliente } p/ enriquecer com
// vendedor/telefone/email. Retorna grupos ordenados por total em aberto.
export function clientesInadimplentes(contas, clientesById = {}) {
  const map = {}
  contas.forEach(c => {
    if (!contaVencida(c)) return
    const k = c.cliente_id || (c.cliente_nome || '').toLowerCase()
    if (!map[k]) map[k] = { cliente_nome: c.cliente_nome, cliente_id: c.cliente_id, total: 0, count: 0, maiorAtraso: 0, vendedor_nome: null, telefone: null, email: null, contas: [] }
    const g = map[k]
    g.total += saldoAberto(c); g.count++
    g.maiorAtraso = Math.max(g.maiorAtraso, diasAtrasoConta(c))
    if (!g.vendedor_nome && c.vendedor_nome) g.vendedor_nome = c.vendedor_nome
    g.contas.push(c)
  })
  Object.values(map).forEach(g => {
    const cli = g.cliente_id ? clientesById[g.cliente_id] : null
    if (cli) {
      g.vendedor_nome = g.vendedor_nome || cli.vendedor_nome || null
      g.telefone = cli.telefone || null
      g.email = cli.email || null
    }
  })
  return Object.values(map).sort((a, b) => b.total - a.total)
}

// Casa uma conta com um cliente (por id, senão por nome). Usado pelo alerta.
export function contaDoCliente(c, cliente) {
  const id = cliente?.id ?? cliente?.cliente_id ?? null
  const nome = (cliente?.nome ?? cliente?.cliente_nome ?? '').trim().toLowerCase()
  if (id && c.cliente_id) return c.cliente_id === id
  if (nome) return (c.cliente_nome || '').trim().toLowerCase() === nome
  return false
}

// Busca no banco as contas de UM cliente e devolve o resumo de inadimplência.
// Consulta por cliente_id e por cliente_nome (cobre registros legados sem id).
// Leve: roda só na seleção do cliente. Retorna null quando o cliente está em dia.
export async function fetchResumoInadimplenciaCliente(cliente) {
  const id = cliente?.id ?? cliente?.cliente_id ?? null
  const nome = (cliente?.nome ?? cliente?.cliente_nome ?? '').trim() || null
  if (!id && !nome) return null
  const rows = []
  if (id) {
    const { data } = await supabase.from('contas_receber').select('*').eq('cliente_id', id)
    ;(data || []).forEach(r => rows.push(r))
  }
  if (nome) {
    const { data } = await supabase.from('contas_receber').select('*').eq('cliente_nome', nome)
    ;(data || []).forEach(r => { if (!rows.find(x => x.id === r.id)) rows.push(r) })
  }
  return resumoInadimplenciaCliente(cliente, rows)
}

// Resumo de inadimplência de UM cliente (p/ alerta no comercial/vendedor).
// Retorna null quando o cliente está em dia. { total, count, maiorAtraso, contas }.
export function resumoInadimplenciaCliente(cliente, contas) {
  const vencidas = (contas || []).filter(c => contaDoCliente(c, cliente) && contaVencida(c))
  if (!vencidas.length) return null
  return {
    cliente_nome: cliente?.nome ?? cliente?.cliente_nome ?? '',
    total: vencidas.reduce((s, c) => s + saldoAberto(c), 0),
    count: vencidas.length,
    maiorAtraso: vencidas.reduce((m, c) => Math.max(m, diasAtrasoConta(c)), 0),
    contas: vencidas,
  }
}

// ─── Backfill: cria contas a receber de pedidos antigos com NF (idempotente) ───
// dryRun=true apenas simula e devolve o relatório sem gravar nada.
export async function backfillContasReceber({ dryRun = true } = {}) {
  const rel = { dryRun, analisados: 0, criados: 0, atualizados: 0, ignorados: 0, motivos: {}, pendentesCorrecao: [] }
  const ignora = (motivo, p) => {
    rel.ignorados++; rel.motivos[motivo] = (rel.motivos[motivo] || 0) + 1
    if (motivo.startsWith('sem vencimento')) rel.pendentesCorrecao.push({ ref: p.numero_ref || p.id, cliente: p.cliente, nf: p.numero_nf })
  }
  const { data: pedidos, error } = await supabase.from('pedidos').select('*').in('status', ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'])
  if (error) { console.error('[backfill] pedidos:', error); return { ...rel, erro: error.message } }
  const { data: contas } = await supabase.from('contas_receber').select('pedido_id,numero_nf')
  const temPedido = new Set((contas || []).map(c => c.pedido_id).filter(Boolean))
  const temNf = new Set((contas || []).map(c => String(c.numero_nf || '')).filter(Boolean))

  for (const p of (pedidos || [])) {
    rel.analisados++
    if (temPedido.has(p.id) || (p.numero_nf && temNf.has(String(p.numero_nf)))) { ignora('já possui conta', p); continue }
    if (!p.cliente && !p.cliente_id) { ignora('sem cliente', p); continue }
    if (!p.numero_nf) { ignora('sem NF', p); continue }
    if (!(Number(p.valor_total) > 0)) { ignora('sem valor_total', p); continue }
    const temVenc = !!p.data_vencimento_pagamento
    const temPrazo = p.prazo_pagamento_dias != null || !!p.forma_pagamento
    if (!temVenc && !temPrazo) { ignora('sem vencimento (correção manual)', p); continue }
    if (dryRun) { rel.criados++; continue }
    const baseIso = String(p.atualizado_em || p.criado_em || '').slice(0, 10) || isoHoje()
    const r = await upsertContaReceberDoPedido(p, { baseIso, origem: 'backfill' })
    if (r.ok && r.criado) rel.criados++
    else if (r.ok) rel.atualizados++
    else ignora(r.motivo || 'erro', p)
    // marca como visto p/ não recriar caso o mesmo numero_nf apareça duas vezes no lote
    temPedido.add(p.id); if (p.numero_nf) temNf.add(String(p.numero_nf))
  }
  return rel
}

// ─── Alertas anti-duplicação ───
export async function alertaJaDisparado(chave) {
  const { data } = await supabase.from('alertas_financeiro_disparados').select('chave').eq('chave', chave).maybeSingle()
  return !!data
}
export async function marcarAlertaDisparado(chave) {
  await supabase.from('alertas_financeiro_disparados').upsert({ chave, disparado_em: new Date().toISOString() })
}

// ─── Export CSV ───
export function toCsv(rows, headers) {
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const linhas = [headers.map(h => esc(h.label)).join(';')]
  rows.forEach(r => linhas.push(headers.map(h => esc(typeof h.get === 'function' ? h.get(r) : r[h.key])).join(';')))
  return '﻿' + linhas.join('\n')
}
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export async function uploadComprovante(file, folder = 'reembolsos') {
  const cleanName = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${folder}/${Date.now()}_${cleanName}`
  const { error } = await supabase.storage.from('documentos').upload(filename, file, { contentType: file.type })
  if (error) { console.error('Upload error:', error); return null }
  const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filename)
  return urlData.publicUrl
}
