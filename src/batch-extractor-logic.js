import { extractItemsFromNf } from './ai.js'
import { fetchProdutos, savePedidoItens, updateProduto, createProduto } from './db.js'
import { supabase } from './supabase.js'

const STATUS_COM_NF = new Set(['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'])
const CONCURRENCY = 5
const MAX_ATTEMPTS = 3 // 1 inicial + 2 retries com backoff

const sleep = ms => new Promise(r => setTimeout(r, ms))

export function classifyError(e) {
  if (e?.status === 429) return 'rate_limit'
  const msg = (e?.message || '').toLowerCase()
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('overload')) return 'rate_limit'
  if (msg.includes('pdf') || msg.includes('baixar') || msg.includes('download')) return 'pdf_fetch'
  if (msg.includes('json')) return 'parse'
  return 'other'
}

// Backoff: rate_limit espera mais para dar tempo da janela TPM resetar
function backoffMs(attempt, errType) {
  if (errType === 'rate_limit') return [3000, 12000][attempt - 1] || 12000
  return [800, 2000][attempt - 1] || 2000
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function matchItem(item, produtos) {
  const cod = item.codigo ? String(item.codigo).replace(/\./g, '') : null
  if (cod) {
    const byCode = produtos.find(p => p.codigo && p.codigo === cod)
    if (byCode) return byCode
  }
  const needle = norm(item.nome_produto)
  return produtos.find(p => {
    const pn = norm(p.nome)
    return pn.includes(needle) || needle.includes(pn)
  }) || null
}

// Processa batches de N promises por vez
async function processInBatches(items, fn, concurrency, onResult, signal) {
  let idx = 0
  const results = []
  async function next() {
    while (idx < items.length) {
      if (signal?.paused) { await new Promise(r => { signal._resume = r }); continue }
      if (signal?.cancelled) break
      const i = idx++
      const result = await fn(items[i], i)
      results.push(result)
      onResult?.(result, i)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  await Promise.allSettled(workers)
  return results
}

// Processa um pedido individual (lê o PDF da NF, não o do orçamento)
async function processarPedido(pedido, produtos, modo) {
  const ref = pedido.numero_ref || pedido.id.slice(0, 8)
  let lastError = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await extractItemsFromNf(pedido.nf_url)
      const itens = raw.map(i => {
        const cod = i.codigo ? String(i.codigo).replace(/\./g, '') : null
        const match = matchItem({ ...i, codigo: cod }, produtos)
        return { ...i, codigo: match?.codigo || cod || '', _catalogProd: match || null, _status: match ? 'catalogo' : 'novo' }
      })
      await savePedidoItens(pedido.id, itens)

      let novosProdutos = 0, atualizados = 0
      if (modo === 'catalogo' || modo === 'tudo') {
        for (const it of itens) {
          const preco = Number(it.preco_unitario) || 0
          const cod = it.codigo ? String(it.codigo).replace(/\./g, '') : null
          if (it._status === 'catalogo' && it._catalogProd) {
            if (preco > Number(it._catalogProd.preco)) { await updateProduto(it._catalogProd.id, { preco }); atualizados++ }
          } else if (cod) {
            await createProduto({ nome: it.nome_produto, preco, categoria: 'Outros', codigo: cod })
            novosProdutos++
          }
        }
      }
      const valorTotal = itens.reduce((s, i) => s + (Number(i.preco_total) || Number(i.quantidade || 0) * Number(i.preco_unitario || 0)), 0)
      return { pedidoId: pedido.id, ref, cliente: pedido.cliente, status: 'success', itensCount: itens.length, novosProdutos, atualizados, valorTotal }
    } catch (e) {
      lastError = e
      const errType = classifyError(e)
      console.warn(`[lote] NF ${ref} tentativa ${attempt}/${MAX_ATTEMPTS} falhou (${errType}):`, e?.message)
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt, errType))
    }
  }
  return { pedidoId: pedido.id, ref, cliente: pedido.cliente, status: 'error', error: lastError?.message || 'Erro desconhecido', errorType: classifyError(lastError), itensCount: 0, novosProdutos: 0, atualizados: 0, valorTotal: 0 }
}

// Filtra pedidos por período — apenas pedidos com NF emitida
export function filtrarPedidosPorPeriodo(pedidos, periodo, customRange) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return pedidos.filter(p => {
    if (!p.nf_url) return false
    if (!STATUS_COM_NF.has(p.status)) return false
    const d = new Date(p.criado_em)
    if (periodo === 'hoje') return d >= today
    if (periodo === 'semana') { const ws = new Date(today); ws.setDate(ws.getDate() - ws.getDay()); return d >= ws }
    if (periodo === 'mes') return d >= new Date(now.getFullYear(), now.getMonth(), 1)
    if (periodo === 'pendentes') return true
    if (periodo === 'custom' && customRange) {
      const [from, to] = customRange
      return d >= new Date(from) && d <= new Date(new Date(to).setHours(23, 59, 59, 999))
    }
    return true
  })
}

// Verifica quais pedidos já têm itens
export async function marcarJaProcessados(pedidoIds) {
  if (!pedidoIds.length) return new Set()
  const { data } = await supabase.from('pedido_itens').select('pedido_id').in('pedido_id', pedidoIds)
  return new Set((data || []).map(r => r.pedido_id))
}

// Execução principal do lote
export async function executarLote(pedidos, modo, onProgress, signal) {
  const produtos = await fetchProdutos()
  const jaProcessados = await marcarJaProcessados(pedidos.map(p => p.id))

  const pendentes = []
  const skipped = []
  for (const p of pedidos) {
    if (jaProcessados.has(p.id)) skipped.push({ pedidoId: p.id, ref: p.numero_ref || p.id.slice(0, 8), cliente: p.cliente, status: 'skipped' })
    else pendentes.push(p)
  }

  skipped.forEach((s, i) => onProgress?.({ type: 'skipped', ...s, index: i }))

  let done = 0, sucessos = 0, falhas = 0, totalItens = 0, totalNovos = 0, totalValor = 0
  const erros = []

  const results = await processInBatches(pendentes, async (pedido, i) => {
    onProgress?.({ type: 'processing', ref: pedido.numero_ref || pedido.id.slice(0, 8), cliente: pedido.cliente, index: skipped.length + i })
    const r = await processarPedido(pedido, produtos, modo)
    done++
    if (r.status === 'success') { sucessos++; totalItens += r.itensCount; totalNovos += r.novosProdutos; totalValor += r.valorTotal }
    else { falhas++; erros.push(r) }
    onProgress?.({ type: 'done', ...r, done, total: pendentes.length })
    return r
  }, CONCURRENCY, null, signal)

  return { results: [...skipped, ...results], sucessos, falhas, totalItens, totalNovos, totalValor, skippedCount: skipped.length, erros }
}

// Salvar log no Supabase
export async function salvarLogLote(log) {
  await supabase.from('extracao_lote_logs').insert(log)
}

// Buscar últimos logs
export async function fetchLogsLote(limit = 10) {
  const { data } = await supabase.from('extracao_lote_logs').select('*').order('iniciado_em', { ascending: false }).limit(limit)
  return data || []
}
