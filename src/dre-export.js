// Exporta o DRE em HTML formatado e abre a janela de impressão
// (mesma estratégia de orcamento-pdf.js). O usuário escolhe "Salvar como PDF".
import { GRUPOS_OPERACIONAL } from './dre-calculo.js'

const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',')
const pct = v => v.toFixed(1).replace('.', ',') + '%'

function linha(label, valor, opts = {}) {
  const cor = opts.tipo === 'receita' ? '#059669' : opts.tipo === 'despesa' ? '#DC2626' : '#0F172A'
  const fw = opts.total ? 700 : 400
  const bg = opts.total ? '#F1F5F9' : 'transparent'
  const indent = opts.indent ? 16 + opts.indent * 12 : 16
  return `<tr style="background:${bg};font-weight:${fw}">
    <td style="padding:6px ${indent}px;border-bottom:1px solid #E2E8F0">${label}</td>
    <td style="padding:6px 12px;text-align:right;color:${cor};border-bottom:1px solid #E2E8F0">${fmt(valor)}</td>
  </tr>`
}

export function gerarDREPdf({ dre, periodoLabel, periodoRange }) {
  const data = new Date().toLocaleDateString('pt-BR')
  const logoSrc = window.location.origin + '/logo_2025.png'

  const linhasOp = Object.entries(GRUPOS_OPERACIONAL)
    .filter(([k]) => dre.operacionais[k])
    .map(([k, g]) => linha(`${g.icone} ${g.label}`, -dre.operacionais[k], { tipo: 'despesa', indent: 1 }))
    .join('')

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DRE — Valois Logística</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;color:#0F172A;padding:24px}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0F172A;padding-bottom:12px;margin-bottom:18px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand img{height:40px}
  .title{font-size:22px;font-weight:800}
  .subtitle{color:#64748B;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}
  thead th{padding:8px 12px;background:#0F172A;color:#fff;text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:0.5px}
  thead th:last-child{text-align:right}
  .cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
  .card{border:1px solid #E2E8F0;border-radius:8px;padding:12px;border-left-width:4px;border-left-style:solid}
  .card .lbl{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px}
  .card .val{font-size:22px;font-weight:800;margin-top:4px}
  .footer{margin-top:24px;font-size:10px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;padding-top:10px}
  @media print { body { padding: 12px } @page { margin: 14mm } }
</style></head><body>
  <div class="header">
    <div class="brand"><img src="${logoSrc}" onerror="this.style.display='none'"/><div><div class="title">VALOIS LOGÍSTICA</div><div class="subtitle">Demonstrativo de Resultados (DRE) — ${periodoLabel}</div></div></div>
    <div style="text-align:right;font-size:11px;color:#64748B">Período: ${periodoRange.de} a ${periodoRange.ate}<br/>Emitido em: ${data}</div>
  </div>

  <div class="cards">
    <div class="card" style="border-left-color:${dre.margemBruta >= 30 ? '#059669' : dre.margemBruta >= 15 ? '#F59E0B' : '#DC2626'}">
      <div class="lbl">Margem Bruta</div><div class="val">${pct(dre.margemBruta)}</div>
    </div>
    <div class="card" style="border-left-color:${dre.margemEbitda >= 10 ? '#059669' : dre.margemEbitda >= 5 ? '#F59E0B' : '#DC2626'}">
      <div class="lbl">Margem EBITDA</div><div class="val">${pct(dre.margemEbitda)}</div>
    </div>
    <div class="card" style="border-left-color:${dre.margemLiquida >= 7 ? '#059669' : dre.margemLiquida >= 3 ? '#F59E0B' : '#DC2626'}">
      <div class="lbl">Margem Líquida</div><div class="val">${pct(dre.margemLiquida)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Conta</th><th>Valor</th></tr></thead>
    <tbody>
      ${linha('(+) Receita Bruta', dre.receitaBruta, { tipo: 'receita', total: true })}
      ${linha('(−) Deduções / Impostos sobre venda', -dre.deducoes, { tipo: 'despesa', indent: 1 })}
      ${linha('(=) Receita Líquida', dre.receitaLiquida, { total: true })}
      ${linha('(−) CMV — Custo das Mercadorias Vendidas', -dre.cmv, { tipo: 'despesa' })}
      ${linha('(=) Lucro Bruto', dre.lucroBruto, { total: true })}
      <tr><td colspan="2" style="padding:8px 16px;background:#F1F5F9;font-size:10px;text-transform:uppercase;font-weight:700;color:#64748B">(−) Despesas operacionais</td></tr>
      ${linhasOp}
      ${linha('💰 Comissões (vendedores)', -dre.comissoes, { tipo: 'despesa', indent: 1 })}
      ${linha('💸 Reembolsos pagos', -dre.reembolsosPagos, { tipo: 'despesa', indent: 1 })}
      ${linha('Total operacional', -dre.totalOperacional, { tipo: 'despesa', total: true })}
      ${linha('(=) EBITDA — Lucro operacional', dre.ebitda, { total: true })}
      ${linha('(−) Impostos sobre lucro', -dre.impostoLucro, { tipo: 'despesa', indent: 1 })}
      ${linha('(=) Lucro Líquido', dre.lucroLiquido, { tipo: dre.lucroLiquido >= 0 ? 'receita' : 'despesa', total: true })}
    </tbody>
  </table>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:11px;margin-bottom:18px">
    <div><div style="color:#64748B">Pedidos entregues</div><div style="font-weight:700">${dre.qtdPedidos}</div></div>
    <div><div style="color:#64748B">Ticket médio</div><div style="font-weight:700">${fmt(dre.ticketMedio)}</div></div>
    <div><div style="color:#64748B">Clientes ativos</div><div style="font-weight:700">${dre.clientesAtivos}</div></div>
    <div><div style="color:#64748B">Inadimplência</div><div style="font-weight:700">${pct(dre.inadimplencia)}</div></div>
  </div>

  <div class="footer">Relatório gerado automaticamente pelo sistema Valois Logística</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return }
  w.document.write(html); w.document.close()
}
