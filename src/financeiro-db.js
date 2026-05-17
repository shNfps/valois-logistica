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

// ─── Auto-criação de conta a receber ao anexar NF ───
const PRAZO_FORMA = { a_vista: 0, boleto_7: 7, boleto_14: 14, boleto_28: 28, cartao: 0, pix: 0 }
export function formaToCR(forma) {
  if (forma?.startsWith('boleto')) return 'boleto'
  return forma === 'pix' ? 'pix' : forma === 'cartao' ? 'cartao' : 'a_vista'
}
export async function criarContaReceberDoPedido(pedido) {
  if (!pedido?.id) return null
  const { data: existente } = await supabase.from('contas_receber').select('id').eq('pedido_id', pedido.id).maybeSingle()
  if (existente) return existente
  const prazo = pedido.prazo_pagamento_dias ?? PRAZO_FORMA[pedido.forma_pagamento] ?? 0
  const hoje = new Date(); const venc = new Date(hoje); venc.setDate(hoje.getDate() + prazo)
  const payload = {
    pedido_id: pedido.id, cliente_id: pedido.cliente_id || null, cliente_nome: pedido.cliente,
    numero_nf: pedido.numero_nf || null, valor: Number(pedido.valor_total || 0),
    data_emissao: hoje.toISOString().slice(0, 10),
    data_vencimento: venc.toISOString().slice(0, 10),
    forma_pagamento: formaToCR(pedido.forma_pagamento), status: 'PENDENTE'
  }
  if (!payload.valor) { console.warn('Pedido sem valor_total, conta a receber não criada'); return null }
  const { data, error } = await supabase.from('contas_receber').insert(payload).select().single()
  if (error) { console.error(error); return null }
  return data
}

// ─── Inadimplência ───
export function clientesInadimplentes(contas) {
  const map = {}
  contas.forEach(c => {
    if (statusEfetivo(c) !== 'ATRASADO') return
    const k = c.cliente_id || c.cliente_nome
    if (!map[k]) map[k] = { cliente_nome: c.cliente_nome, cliente_id: c.cliente_id, total: 0, count: 0, contas: [] }
    map[k].total += Number(c.valor || 0); map[k].count++; map[k].contas.push(c)
  })
  return Object.values(map).filter(x => x.count >= 2).sort((a, b) => b.total - a.total)
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
