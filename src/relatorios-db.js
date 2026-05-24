import { supabase } from './supabase.js'

// RPCs do diagnóstico Top 20 (definidas em supabase_migration_diagnostico_top20.sql)
export async function fetchDiagnosticoTop20() {
  const { data, error } = await supabase.rpc('get_diagnostico_top20')
  if (error) { console.error('get_diagnostico_top20:', error); return [] }
  return data || []
}

export async function fetchDiagnosticoResumo() {
  const { data, error } = await supabase.rpc('get_diagnostico_top20_resumo')
  if (error) { console.error('get_diagnostico_top20_resumo:', error); return null }
  return Array.isArray(data) ? data[0] : data
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

// ----------- Export Excel via SheetJS -----------
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
