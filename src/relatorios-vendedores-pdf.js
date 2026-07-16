import { jsPDF } from 'jspdf'
import 'jspdf-autotable' // registra doc.autoTable + doc.lastAutoTable (funciona em Vite e Node)

// PDF dos relatórios de vendas por vendedor. Recebe os MESMOS dados já
// carregados das RPCs (ranking/produtos/clientes/pedidos) — nunca recalcula.

// ── Paleta (tokens do theme.css convertidos p/ RGB) ──
const BLUE = [43, 53, 142]      // --valois-blue #2B358E
const BLUE_DK = [30, 37, 100]   // --valois-blue-dark #1E2564
const GREEN = [126, 204, 40]    // --valois-green #7ECC28
const GREEN_TX = [47, 107, 14]  // verde escuro p/ texto de comissão
const TXT = [26, 33, 64]        // --text-primary #1A2140
const MUTED = [107, 114, 144]   // --text-secondary #6B7290
const LINE = [228, 232, 240]    // --border #E4E8F0
const BG = [246, 248, 251]      // --background #F6F8FB
const WHITE = [255, 255, 255]

const TIPO_LABEL = { simples: 'Simples', completo: 'Completo', personalizado: 'Personalizado' }

const fmtMoney = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pad2 = (n) => String(n).padStart(2, '0')
const fmtDataBr = (d) => { const x = new Date(d); return `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${x.getFullYear()}` }
const fmtDataHora = (d) => { const x = new Date(d); return `${fmtDataBr(x)} às ${pad2(x.getHours())}:${pad2(x.getMinutes())}` }
const isoLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}` }

export function nomeArquivo(tipo, periodo) {
  return `relatorio-vendedores-${tipo}_${isoLocal(periodo.from)}_${isoLocal(periodo.to)}.pdf`
}

// ── Cabeçalho (só na 1ª página) ──
function cabecalho(doc, w, { tipo, periodo, geradoEm, filtros }) {
  doc.setFillColor(...BLUE); doc.rect(14, 12, 4, 15, 'F')
  doc.setFillColor(...GREEN); doc.rect(18, 12, 4, 15, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.setTextColor(...BLUE); doc.text('VALOIS', 26, 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text('DESCARTÁVEIS E LIMPEZA', 26, 25)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TXT)
  doc.text('Relatório de Vendas por Vendedor', w - 14, 18, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...BLUE)
  doc.text(TIPO_LABEL[tipo] || tipo, w - 14, 24, { align: 'right' })

  doc.setDrawColor(...BLUE_DK); doc.setLineWidth(0.6); doc.line(14, 30, w - 14, 30)

  doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${fmtDataBr(periodo.from)} a ${fmtDataBr(periodo.to)}`, 14, 37)
  doc.text(`Gerado em ${fmtDataHora(geradoEm)}`, w - 14, 37, { align: 'right' })

  let y = 42
  if (filtros && (filtros.vendedores?.length || filtros.segmentos?.length)) {
    const partes = []
    if (filtros.vendedores?.length) partes.push(`Vendedores: ${filtros.vendedores.join(', ')}`)
    if (filtros.segmentos?.length) partes.push(`Segmentos: ${filtros.segmentos.join(', ')}`)
    doc.setFontSize(8.5); doc.setTextColor(...BLUE_DK)
    const linhas = doc.splitTextToSize(`Filtros — ${partes.join('  ·  ')}`, w - 28)
    doc.text(linhas, 14, y + 1)
    y += linhas.length * 4 + 2
  }
  return y + 2
}

// ── Rodapé "X de Y" em TODAS as páginas (2ª passada, no fim) ──
function rodapes(doc, w, h) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(14, h - 12, w - 14, h - 12)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text('Valois Descartáveis e Limpeza', 14, h - 7)
    doc.text(`${i} de ${total}`, w - 14, h - 7, { align: 'right' })
  }
}

// ── Cards de resumo ──
function cardsResumo(doc, y, w, ranking) {
  const tot = ranking.reduce((s, v) => s + Number(v.faturamento || 0), 0)
  const ped = ranking.reduce((s, v) => s + Number(v.pedidos || 0), 0)
  const cards = [
    ['FATURAMENTO (NF EMITIDA)', fmtMoney(tot)],
    ['PEDIDOS', String(ped)],
    ['TICKET MÉDIO', fmtMoney(ped ? tot / ped : 0)],
  ]
  const cw = (w - 28 - 2 * 6) / 3
  cards.forEach(([l, v], i) => {
    const x = 14 + i * (cw + 6)
    doc.setFillColor(...WHITE); doc.setDrawColor(...LINE); doc.setLineWidth(0.3)
    doc.roundedRect(x, y, cw, 18, 2, 2, 'FD')
    doc.setFillColor(...BLUE); doc.rect(x, y, 1.6, 18, 'F')
    doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'bold')
    doc.text(l, x + 4, y + 6)
    doc.setFontSize(12); doc.setTextColor(...BLUE_DK)
    doc.text(v, x + 4, y + 13)
  })
  return y + 24
}

// ── Tabela do ranking ──
function tabelaRanking(doc, y, w, ranking) {
  const tot = ranking.reduce((s, v) => s + Number(v.faturamento || 0), 0)
  const head = [['#', 'Vendedor', 'Faturamento', 'Pedidos', 'Ticket médio', '% part.']]
  const body = ranking.map((v, i) => [
    String(i + 1), v.vendedor, fmtMoney(v.faturamento), String(v.pedidos),
    fmtMoney(v.ticket_medio), `${Number(v.pct_participacao || 0).toFixed(1)}%`,
  ])
  body.push(['', 'Total', fmtMoney(tot), String(ranking.reduce((s, v) => s + Number(v.pedidos || 0), 0)), '', '100%'])
  doc.autoTable({
    startY: y, margin: { left: 14, right: 14 }, theme: 'grid', head, body,
    headStyles: { fillColor: BLUE, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.4, textColor: TXT, lineColor: LINE, lineWidth: 0.2, valign: 'middle' },
    alternateRowStyles: { fillColor: BG },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: MUTED },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1) { // linha de total
        data.cell.styles.fillColor = [237, 240, 250]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = BLUE_DK
      }
    },
  })
  return doc.lastAutoTable.finalY
}

// ── Simples ──
export function gerarPdfSimples({ periodo, ranking, geradoEm = new Date() }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight()
  let y = cabecalho(doc, w, { tipo: 'simples', periodo, geradoEm })
  y = cardsResumo(doc, y, w, ranking)
  tabelaRanking(doc, y, w, ranking)
  rodapes(doc, w, h)
  return doc
}

// ── Completo / Personalizado: uma seção por vendedor, cada um em página nova ──
const MARGENS = { left: 14, right: 14, top: 16, bottom: 16 } // top/bottom → continuação e rodapé sem overlap

function espacoOuPagina(doc, y, precisa, h) {
  if (y + precisa > h - 16) { doc.addPage(); return 18 }
  return y
}

function bandaVendedor(doc, y, w, v) {
  doc.setFillColor(...BLUE); doc.roundedRect(14, y, w - 28, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255)
  doc.text(v.vendedor, 18, y + 8)
  doc.setFontSize(10); doc.text(fmtMoney(v.faturamento), w - 18, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
  const com = v.comissao_pct ? `Comissão ${v.comissao_pct}% · ${fmtMoney(v.comissao_total)}` : 'Comissão 0% · —'
  doc.text(`${v.pedidos} pedidos · Ticket médio ${fmtMoney(v.ticket_medio)} · ${com}`, 14, y + 17)
  return y + 22
}

function tituloMini(doc, y, txt) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLUE_DK)
  doc.text(txt, 14, y)
  return y + 1
}

function tabelaDoisCampos(doc, y, w, head2, rows, vazio) {
  doc.autoTable({
    startY: y + 1, margin: MARGENS, theme: 'grid',
    head: [head2], body: rows.length ? rows : [[vazio, '—']],
    headStyles: { fillColor: BLUE_DK, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: TXT, lineColor: LINE, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: BG },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' } },
  })
  return doc.lastAutoTable.finalY
}

function tabelaPedidos(doc, y, w, peds) {
  const totV = peds.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totC = peds.reduce((s, p) => s + Number(p.comissao_valor || 0), 0)
  doc.autoTable({
    startY: y + 1, margin: MARGENS, theme: 'grid',
    head: [['Data', 'Cliente', 'Nº NF', 'Valor', 'Comissão']],
    body: peds.map(p => [
      fmtDataBr(p.criado_em), p.cliente || '—', p.numero_nf || '—',
      fmtMoney(p.valor_total), Number(p.comissao_valor) > 0 ? fmtMoney(p.comissao_valor) : '—',
    ]),
    foot: [['', 'Total', `${peds.length} ped.`, fmtMoney(totV), totC > 0 ? fmtMoney(totC) : '—']],
    showFoot: 'lastPage',
    headStyles: { fillColor: BLUE, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: [237, 240, 250], textColor: BLUE_DK, fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: TXT, lineColor: LINE, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: BG },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 'auto', fontStyle: 'bold' }, 2: { cellWidth: 22 },
      3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' },
    },
  })
  return doc.lastAutoTable.finalY
}

export function gerarPdfCompleto({ tipo = 'completo', periodo, ranking, produtos = {}, clientes = {}, pedidos = {}, filtros, geradoEm = new Date() }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight()
  const topo = cabecalho(doc, w, { tipo, periodo, geradoEm, filtros })
  if (!ranking.length) { rodapes(doc, w, h); return doc }

  const faixas = []
  ranking.forEach((v, i) => {
    if (i > 0) doc.addPage()                    // cada vendedor começa em página nova
    const from = doc.getNumberOfPages()         // página onde a banda do vendedor é desenhada
    let y = bandaVendedor(doc, i === 0 ? topo + 2 : 18, w, v)
    y = tituloMini(doc, y, 'Top 10 produtos vendidos')
    y = tabelaDoisCampos(doc, y, w, ['Produto', 'Valor'], (produtos[v.vendedor] || []).map(p => [p.produto, fmtMoney(p.valor)]), 'Sem itens lançados no período') + 6
    y = espacoOuPagina(doc, y, 34, h)
    y = tituloMini(doc, y, 'Top 10 clientes')
    y = tabelaDoisCampos(doc, y, w, ['Cliente', 'Valor'], (clientes[v.vendedor] || []).map(c => [c.cliente, fmtMoney(c.valor)]), 'Sem clientes no período') + 6
    y = espacoOuPagina(doc, y, 34, h)
    y = tituloMini(doc, y, 'Pedidos do período')
    tabelaPedidos(doc, y, w, pedidos[v.vendedor] || [])
    faixas.push({ vendedor: v.vendedor, from, to: doc.getNumberOfPages() })
  })

  // Cabeçalho corrido (nome do vendedor) nas páginas de continuação da seção.
  faixas.forEach(f => {
    for (let p = f.from + 1; p <= f.to; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MUTED)
      doc.text(`${f.vendedor} (continuação)`, 14, 11)
    }
  })
  rodapes(doc, w, h)
  doc._faixasVendedor = faixas // metadata p/ verificação (não vai pro PDF)
  return doc
}

// API pública p/ o botão.
export function baixarRelatorioVendedoresPdf({ tipo, periodo, ranking, produtos, clientes, pedidos, filtros, geradoEm = new Date() }) {
  const doc = tipo === 'simples'
    ? gerarPdfSimples({ periodo, ranking, geradoEm })
    : gerarPdfCompleto({ tipo, periodo, ranking, produtos, clientes, pedidos, filtros, geradoEm })
  doc.save(nomeArquivo(tipo, periodo))
}
