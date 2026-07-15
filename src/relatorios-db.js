import { supabase } from './supabase.js'

// RPCs do diagnóstico Top 20 (definidas em supabase_migration_diagnostico_top20.sql
// + fix em supabase_migration_diagnostico_top20_fix.sql).
// IMPORTANTE: retornamos {data, error} pra que a tela mostre o erro ao invés
// de exibir "tabela vazia" silenciosamente. Lição aprendida com o bug 42702.
export async function fetchDiagnosticoTop20() {
  const { data, error } = await supabase.rpc('get_diagnostico_top20')
  if (error) console.error('get_diagnostico_top20:', error)
  return { data: data || [], error: error || null }
}

export async function fetchDiagnosticoResumo() {
  const { data, error } = await supabase.rpc('get_diagnostico_top20_resumo')
  if (error) console.error('get_diagnostico_top20_resumo:', error)
  const row = Array.isArray(data) ? data[0] : data
  return { data: row || null, error: error || null }
}

// Visitas de retenção (CRUD)
export async function fetchVisitasRetencao(filtros = {}) {
  let q = supabase.from('visitas_retencao').select('*, clientes!inner(nome,cidade,segmento)')
  if (filtros.status)     q = q.eq('status', filtros.status)
  if (filtros.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
  const { data, error } = await q.order('data_agendada', { ascending: true, nullsFirst: false })
  if (error) { console.error('fetchVisitasRetencao:', error); return [] }
  return data || []
}

export async function fetchUltimaVisita(clienteId) {
  const { data, error } = await supabase
    .from('visitas_retencao')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.error('fetchUltimaVisita:', error); return null }
  return data
}

export async function criarVisitaRetencao(payload) {
  const { data, error } = await supabase
    .from('visitas_retencao')
    .insert({ ...payload, atualizado_em: new Date().toISOString() })
    .select().single()
  if (error) { console.error('criarVisitaRetencao:', error); return { data: null, error } }
  return { data, error: null }
}

export async function atualizarVisitaRetencao(id, updates) {
  const { error } = await supabase
    .from('visitas_retencao')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('atualizarVisitaRetencao:', error)
  return { error: error || null }
}

// ============= Top 50 Produtos =============
// RPCs em supabase_migration_top50_produtos.sql
export async function fetchTop50Produtos() {
  const { data, error } = await supabase.rpc('get_top50_produtos')
  if (error) console.error('get_top50_produtos:', error)
  return { data: data || [], error: error || null }
}

export async function fetchUltimasCotacoes(codigos) {
  if (!codigos?.length) return { data: {}, error: null }
  const { data, error } = await supabase.rpc('get_ultima_cotacao_por_sku', { codigos })
  if (error) { console.error('get_ultima_cotacao_por_sku:', error); return { data: {}, error } }
  // Vira mapa { codigo → linha } pra lookup O(1) na UI
  const map = {}
  ;(data || []).forEach(r => { map[r.sku_codigo] = r })
  return { data: map, error: null }
}

export async function criarCotacaoSku(payload) {
  const { data, error } = await supabase
    .from('cotacoes_sku')
    .insert(payload)
    .select().single()
  if (error) console.error('criarCotacaoSku:', error)
  return { data: data || null, error: error || null }
}

export async function exportarTop50Excel(linhas) {
  const XLSX = await import('xlsx')

  const cabecalho = [
    'Código', 'Produto', 'Categoria', 'Classe ABC', 'Status',
    'Faturamento 12m (R$)', 'Qtd vendida 12m',
    '% sobre total', '% acumulado',
    'Jan-Abr 2025 (R$)', 'Jan-Abr 2026 (R$)', 'YoY %',
    'Últimos 90d (R$)', '90d anteriores (R$)', 'Tendência %',
    'Clientes únicos 12m', 'Clientes únicos 90d',
    'Ticket médio por pedido (R$)',
    'Top 5 clientes (valor 12m)'
  ]

  const fmtTopCli = arr => Array.isArray(arr) && arr.length
    ? arr.slice(0, 5).map(c => `${c.nome} (R$ ${Number(c.fat || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`).join(' | ')
    : '—'

  const rows = linhas.map(l => [
    l.codigo || '',
    l.nome_produto || '',
    l.categoria || '',
    l.classe_abc || '',
    l.status || '',
    Number(l.fat_12m || 0),
    Number(l.qtd_12m || 0),
    l.pct_sobre_total == null ? '' : Number(l.pct_sobre_total),
    l.pct_acumulado   == null ? '' : Number(l.pct_acumulado),
    Number(l.fat_janabr_25 || 0),
    Number(l.fat_janabr_26 || 0),
    l.yoy_pct == null ? '' : Number(l.yoy_pct),
    Number(l.fat_90d || 0),
    Number(l.fat_90d_anterior || 0),
    l.tendencia_pct == null ? '' : Number(l.tendencia_pct),
    Number(l.qtd_clientes_unicos_12m || 0),
    Number(l.qtd_clientes_unicos_90d || 0),
    Number(l.ticket_medio_pedido || 0),
    fmtTopCli(l.top20_clientes)
  ])

  const STATUS_COR = {
    CRITICO:   'FFFEE2E2', ATENCAO: 'FFFEF3C7',
    ESTAVEL:   'FFE0F2FE', CRESCENDO: 'FFD1FAE5'
  }
  const ABC_COR = { A: 'FFFEF3C7', B: 'FFE0F2FE', C: 'FFF1F5F9' }

  const aoa = [cabecalho, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const fmtBRL = '[$R$-pt-BR] #,##0.00'
  const fmtPct = '0.00"%"'
  const monetCols = [5, 9, 10, 12, 13, 17]
  const pctCols   = [7, 8, 11, 14]

  for (let r = 1; r <= rows.length; r++) {
    monetCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = fmtBRL })
    pctCols.forEach(c   => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = fmtPct })
    const stat = rows[r - 1][4]
    const cor = STATUS_COR[stat]
    if (cor) {
      for (let c = 0; c < cabecalho.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) ws[ref] = { t: 's', v: '' }
        ws[ref].s = { fill: { patternType: 'solid', fgColor: { rgb: cor } } }
      }
    }
    // ABC column override
    const abcRef = XLSX.utils.encode_cell({ r, c: 3 })
    const abcCor = ABC_COR[rows[r - 1][3]]
    if (abcCor && ws[abcRef]) {
      ws[abcRef].s = { fill: { patternType: 'solid', fgColor: { rgb: abcCor } }, font: { bold: true } }
    }
  }

  ws['!cols'] = [
    { wch: 10 }, { wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 11 },
    { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 9 },
    { wch: 16 }, { wch: 18 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 70 }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Top 50 Produtos')
  const fname = `valois-top50-produtos-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fname, { cellStyles: true })
}

// ----------- Export Excel via SheetJS (Top 20 Clientes) -----------
// headers em PT, R$ nas colunas monetárias, cor de fundo por status.
const STATUS_COR = {
  CRITICO:   'FFFEE2E2', // light red
  ATENCAO:   'FFFEF3C7', // light yellow
  ESTAVEL:   'FFE0F2FE', // light blue
  CRESCENDO: 'FFD1FAE5'  // light green
}

export async function exportarDiagnosticoExcel(linhas) {
  // import dinâmico pra não inchar o bundle inicial
  const XLSX = await import('xlsx')

  const cabecalho = [
    'Cliente', 'Cidade', 'Segmento', 'Vendedor', 'Status',
    'Faturamento 12m (R$)',
    'Jan-Abr 2025 (R$)', 'Jan-Abr 2026 (R$)', 'YoY %',
    'YoY móvel 90d %', 'YoY mediana segmento %',
    'Ticket médio últimos 12 (R$)', 'Ticket médio últimos 3 (R$)',
    'Frequência histórica (dias)', 'Frequência 90d (dias)',
    'SKUs únicos 12m', 'SKUs únicos 90d', 'SKUs 90d anteriores', 'Mix Δ %',
    'Último pedido', 'Dias sem pedido',
    'Top 5 SKUs (valor 12m)', 'SKUs descontinuados (valor perdido 90d)'
  ]

  const fmtSku = (arr) => Array.isArray(arr) && arr.length
    ? arr.map(s => `${s.nome || s.codigo} (R$ ${Number(s.valor || s.valor_perdido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`).join(' | ')
    : '—'

  const rows = linhas.map(l => [
    l.nome || '',
    l.cidade || '',
    l.segmento || '',
    l.vendedor_nome || '',
    l.status || '',
    Number(l.fat_12m || 0),
    Number(l.fat_janabr_25 || 0),
    Number(l.fat_janabr_26 || 0),
    l.yoy_pct == null ? '' : Number(l.yoy_pct),
    l.yoy_90d_pct == null ? '' : Number(l.yoy_90d_pct),
    l.yoy_segmento_mediana == null ? '' : Number(l.yoy_segmento_mediana),
    Number(l.ticket_medio_12p || 0),
    Number(l.ticket_medio_3p  || 0),
    l.freq_hist_dias == null ? '' : Number(l.freq_hist_dias),
    l.freq_90d_dias  == null ? '' : Number(l.freq_90d_dias),
    Number(l.skus_12m || 0),
    Number(l.skus_90d || 0),
    Number(l.skus_90d_anteriores || 0),
    l.mix_var_pct == null ? '' : Number(l.mix_var_pct),
    l.ultimo_pedido ? new Date(l.ultimo_pedido).toLocaleDateString('pt-BR') : '',
    l.dias_sem_pedido == null ? '' : Number(l.dias_sem_pedido),
    fmtSku(l.top5_skus),
    fmtSku(l.skus_descontinuados)
  ])

  const aoa = [cabecalho, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // formatação numérica
  const fmtBRL = '[$R$-pt-BR] #,##0.00'
  const fmtPct = '0.00"%"'
  const monetCols = [5, 6, 7, 11, 12]       // 0-indexed (F G H L M)
  const pctCols   = [8, 9, 10, 18]           // I J K S
  for (let r = 1; r <= rows.length; r++) {
    monetCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = fmtBRL })
    pctCols.forEach(c   => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = fmtPct })
    // cor de fundo da linha pelo status (col E = idx 4)
    const stat = rows[r - 1][4]
    const cor = STATUS_COR[stat]
    if (cor) {
      for (let c = 0; c < cabecalho.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) ws[ref] = { t: 's', v: '' }
        ws[ref].s = { fill: { patternType: 'solid', fgColor: { rgb: cor } } }
      }
    }
  }

  // larguras de coluna
  ws['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 11 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 9 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 8 },
    { wch: 14 }, { wch: 12 }, { wch: 60 }, { wch: 60 }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Top 20 Diagnóstico')
  const fname = `valois-diagnostico-top20-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fname, { cellStyles: true })
}

// ============= Relatório de Vendas por Vendedor =============
// RPCs em supabase_migration_relatorio_vendedores.sql. Agregação SEMPRE no banco.
// inicio/fim = ISO strings; intervalo [inicio, fim) (fim exclusivo).
// vendedores/segmentos = arrays de string (ou null = sem filtro; [] = nada marcado → vazio).
export async function fetchRankingVendedores(inicio, fim, vendedores = null, segmentos = null) {
  const { data, error } = await supabase.rpc('get_ranking_vendedores',
    { p_inicio: inicio, p_fim: fim, p_vendedores: vendedores, p_segmentos: segmentos })
  if (error) console.error('get_ranking_vendedores:', error)
  return { data: data || [], error: error || null }
}

export async function fetchTopProdutosVendedor(inicio, fim, { limit = 10, vendedores = null, segmentos = null } = {}) {
  const { data, error } = await supabase.rpc('get_top_produtos_por_vendedor',
    { p_inicio: inicio, p_fim: fim, p_limit: limit, p_vendedores: vendedores, p_segmentos: segmentos })
  if (error) console.error('get_top_produtos_por_vendedor:', error)
  return { data: data || [], error: error || null }
}

export async function fetchTopClientesVendedor(inicio, fim, { limit = 10, vendedores = null, segmentos = null } = {}) {
  const { data, error } = await supabase.rpc('get_top_clientes_por_vendedor',
    { p_inicio: inicio, p_fim: fim, p_limit: limit, p_vendedores: vendedores, p_segmentos: segmentos })
  if (error) console.error('get_top_clientes_por_vendedor:', error)
  return { data: data || [], error: error || null }
}

export async function fetchPedidosVendedor(inicio, fim, { vendedores = null, segmentos = null } = {}) {
  const { data, error } = await supabase.rpc('get_pedidos_por_vendedor',
    { p_inicio: inicio, p_fim: fim, p_vendedores: vendedores, p_segmentos: segmentos })
  if (error) console.error('get_pedidos_por_vendedor:', error)
  return { data: data || [], error: error || null }
}

export async function fetchSegmentosClientes() {
  const { data, error } = await supabase.rpc('get_segmentos_clientes')
  if (error) console.error('get_segmentos_clientes:', error)
  return { data: data || [], error: error || null }
}
