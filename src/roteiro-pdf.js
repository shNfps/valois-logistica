import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { labelVeiculo, fmtDuracao } from './roteiro-db.js'
import { isUrgente } from './obs-comercial.jsx'

const NAVY = [10, 22, 40]      // #0A1628
const BLUE = [37, 99, 235]     // #2563EB
const GREEN = [16, 185, 129]   // #10B981
const GREY_BG = [241, 245, 249]
const GREY_LINE = [226, 232, 240]
const WARN_BG = [254, 243, 199]
const ERR_BG = [254, 226, 226]
const TXT = [15, 23, 42]
const MUTED = [100, 116, 139]

const fmtDataBr = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function cabecalho(doc, w) {
  // Faixa colorida lateral azul→verde
  doc.setFillColor(...BLUE);  doc.rect(14, 12, 4, 14, 'F')
  doc.setFillColor(...GREEN); doc.rect(18, 12, 4, 14, 'F')
  // Marca
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.setTextColor(...BLUE); doc.text('VA', 26, 22)
  doc.setTextColor(...GREEN); doc.text('LOIS', 35, 22)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text('DESCARTÁVEIS E LIMPEZA', 26, 27)
  // Título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...NAVY)
  doc.text('ROTEIRO DE ENTREGA', w - 14, 22, { align: 'right' })
  // Borda inferior navy
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(14, 32, w - 14, 32)
}

function blocoInfo(doc, y, w, r, criadoPor) {
  doc.setFillColor(...GREY_BG); doc.roundedRect(14, y, w - 28, 14, 2, 2, 'F')
  doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'bold')
  doc.text('ROTEIRO Nº', 18, y + 6); doc.text('DATA', 78, y + 6); doc.text('EMITIDO POR', w - 80, y + 6)
  doc.setFontSize(10); doc.setTextColor(...TXT)
  doc.text(r.numero_roteiro || '—', 18, y + 11)
  doc.text(fmtDataBr(r.data_roteiro || r.criado_em), 78, y + 11)
  doc.text(criadoPor || r.criado_por || '—', w - 80, y + 11)
  return y + 18
}

function blocoMotoristaVeiculo(doc, y, w, r) {
  const cidades = (r.cidades?.length ? r.cidades : [r.cidade]).filter(Boolean).join(' · ')
  const rows = [
    ['Motorista', r.motorista_nome || '—', 'CNH', '__________________'],
    ['Veículo', labelVeiculo(r.veiculo), 'Placa', r.placa || '__________________'],
    ['Destino(s)', cidades || '—', 'Saída', '__:__'],
    ['KM Inicial', '_________', 'KM Final', '_________'],
    ['Previsão Retorno', '__:__', '', '']
  ]
  autoTable(doc, {
    startY: y, margin: { left: 14, right: 14 }, theme: 'grid',
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: TXT, lineColor: GREY_LINE, lineWidth: 0.2 },
    columnStyles: {
      0: { fillColor: GREY_BG, fontStyle: 'bold', textColor: NAVY, cellWidth: 32 },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { fillColor: GREY_BG, fontStyle: 'bold', textColor: NAVY, cellWidth: 32 },
      3: { cellWidth: 'auto' }
    }
  })
  return doc.lastAutoTable.finalY + 6
}

function cardsResumo(doc, y, w, totais) {
  const cards = [
    { l: 'Total de paradas', v: `${totais.paradas} entregas`, icon: '📦' },
    { l: 'Distância estimada', v: totais.distanciaKm ? `${totais.distanciaKm.toFixed(1)} km` : '—', icon: '📏' },
    { l: 'Tempo previsto', v: fmtDuracao(totais.duracaoMin), icon: '⏱️' },
    { l: 'Cidades', v: `${totais.cidades} ${totais.cidades === 1 ? 'cidade' : 'cidades'}`, icon: '🏢' }
  ]
  const cw = (w - 28 - 12) / 4
  cards.forEach((c, i) => {
    const x = 14 + i * (cw + 4)
    doc.setFillColor(255); doc.setDrawColor(...GREY_LINE); doc.setLineWidth(0.3)
    doc.roundedRect(x, y, cw, 16, 2, 2, 'FD')
    doc.setFillColor(...BLUE); doc.rect(x, y, 1.5, 16, 'F')
    doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'bold')
    doc.text(c.l.toUpperCase(), x + 3.5, y + 5)
    doc.setFontSize(10); doc.setTextColor(...NAVY)
    doc.text(c.v, x + 3.5, y + 12)
  })
  return y + 22
}

function tabelaEntregas(doc, y, w, pedidos) {
  const head = [['#', 'NF', 'Cliente', 'Endereço', 'Cidade', 'Obs.', 'Entregue?']]
  const body = pedidos.map((p, i) => {
    const obs = p.obs_comercial || ''
    return [
      String(i + 1),
      p.numero_nf || p.numero_ref || '—',
      p.cliente || '—',
      p.endereco_entrega || '—',
      p.cidade || '—',
      obs,
      '☐ SIM   ☐ NÃO'
    ]
  })
  // 3 linhas em branco para anotações
  for (let i = 0; i < 3; i++) body.push([String(pedidos.length + i + 1), '', '', '', '', '', '☐ SIM   ☐ NÃO'])

  autoTable(doc, {
    startY: y, margin: { left: 14, right: 14 }, theme: 'grid', head, body,
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: TXT, lineColor: GREY_LINE, lineWidth: 0.2, valign: 'middle' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 24 },
      5: { cellWidth: 32 },
      6: { cellWidth: 26, halign: 'center', fontSize: 8 }
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 5) return
      const txt = String(data.cell.raw || '')
      if (!txt) return
      if (isUrgente(txt)) { data.cell.styles.fillColor = ERR_BG; data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = 'bold' }
      else { data.cell.styles.fillColor = WARN_BG; data.cell.styles.textColor = [120, 53, 15] }
    }
  })
  return doc.lastAutoTable.finalY + 4
}

function blocoProblemasECondicoes(doc, y, w) {
  doc.setFontSize(9); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold')
  doc.text('PROBLEMAS ENCONTRADOS', 14, y); y += 3
  doc.setDrawColor(...GREY_LINE); doc.setLineWidth(0.2)
  for (let i = 1; i <= 3; i++) {
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(`${i}.`, 14, y + 4); doc.line(20, y + 5, w - 14, y + 5); y += 7
  }
  y += 2
  doc.setFontSize(9); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold')
  doc.text('CONDIÇÕES DO VEÍCULO NO RETORNO', 14, y); y += 5
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TXT)
  doc.text('(  ) Sem problemas', 14, y); y += 5
  doc.text('(  ) Problemas identificados: ', 14, y)
  doc.line(67, y + 1, w - 14, y + 1); return y + 8
}

function assinaturas(doc, y, w, r) {
  const half = (w - 28) / 2 - 4
  // Coluna 1 - motorista
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4)
  doc.line(14, y + 10, 14 + half, y + 10)
  doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'bold')
  doc.text('ASSINATURA DO MOTORISTA', 14, y + 14)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...TXT)
  doc.text(r.motorista_nome || '', 14, y + 19)
  doc.text('Horário Retorno: __:__', 14, y + 24)
  // Coluna 2 - conferência
  const x2 = w - 14 - half
  doc.line(x2, y + 10, w - 14, y + 10)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...MUTED)
  doc.text('RESPONSÁVEL PELA CONFERÊNCIA', x2, y + 14)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...TXT)
  doc.text('Nome: ________________________', x2, y + 19)
  doc.text('Data/Hora: __/__/____ às __:__', x2, y + 24)
  return y + 28
}

export function gerarRoteiroPdf({ roteiro, pedidos, criadoPor, baixar = true }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  cabecalho(doc, w)
  let y = 38
  y = blocoInfo(doc, y, w, roteiro, criadoPor)
  y = blocoMotoristaVeiculo(doc, y, w, roteiro)
  const cidadesUnicas = new Set(pedidos.map(p => p.cidade).filter(Boolean))
  y = cardsResumo(doc, y, w, {
    paradas: pedidos.length,
    distanciaKm: roteiro.distancia_km,
    duracaoMin: roteiro.duracao_min,
    cidades: cidadesUnicas.size
  })
  y = tabelaEntregas(doc, y, w, pedidos)
  if (y > 240) { doc.addPage(); y = 20 }
  y = blocoProblemasECondicoes(doc, y, w)
  y = assinaturas(doc, y, w, roteiro)
  // Rodapé
  const h = doc.internal.pageSize.getHeight()
  doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
  doc.text('Roteiro gerado pelo sistema Valois Logística — 1ª via motorista | 2ª via galpão', w / 2, h - 8, { align: 'center' })

  if (baixar) doc.save(`${roteiro.numero_roteiro || 'roteiro'}.pdf`)
  return doc
}
