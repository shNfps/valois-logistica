// ─── GERADOR DE PDF DE ORÇAMENTO (HTML → Print) ───

function fmtCnpj(v) {
  if (!v) return ''
  const n = String(v).replace(/\D/g, '').slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return n.slice(0,2)+'.'+n.slice(2)
  if (n.length <= 8) return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5)
  if (n.length <= 12) return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8)
  return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8,12)+'-'+n.slice(12)
}

export function gerarOrcamentoPdf({ cliente, vendedor, carrinho, total, clienteObj }) {
  if (!clienteObj && !cliente.trim()) { alert('Informe o cliente'); return }
  const fmtVal = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',')
  const numOrc = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '') +
    '-' + Math.floor(Math.random() * 9000 + 1000)
  const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const logoSrc = window.location.origin + '/logo_2025.png'

  const rows = carrinho.map(i => `
    <tr>
      <td class="cod">${i.codigo || '—'}</td>
      <td>${i.nome}</td>
      <td class="center">${i.qtd}</td>
      <td class="right">${fmtVal(i.preco)}</td>
      <td class="right green bold">${fmtVal(i.preco * i.qtd)}</td>
    </tr>`).join('')

  const clienteInfo = clienteObj ? `
    ${clienteObj.cnpj ? `<div class="info-detail">CNPJ: ${fmtCnpj(clienteObj.cnpj)}</div>` : ''}
    ${clienteObj.endereco ? `<div class="info-detail">${clienteObj.endereco}${clienteObj.cidade ? ' — ' + clienteObj.cidade : ''}</div>` : ''}
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Orçamento ${numOrc} — ${cliente}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#0A1628;font-size:13px}
  .header{background:#0A1628;color:#fff;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
  .header-left{display:flex;align-items:center;gap:16px}
  .logo{height:60px;width:auto;object-fit:contain}
  .co-name{font-size:15px;font-weight:800;letter-spacing:.3px}
  .co-sub{font-size:10px;color:#94A3B8;margin-top:3px}
  .orc-meta{text-align:right}
  .orc-meta h2{font-size:13px;font-weight:700}
  .orc-meta span{font-size:11px;color:#94A3B8}
  .content{padding:24px 32px;max-width:860px;margin:0 auto}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}
  .box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px}
  .box-label{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
  .box-val{font-size:14px;font-weight:700;color:#0A1628}
  .info-detail{font-size:11px;color:#64748B;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#0A1628;color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:left}
  td{padding:9px 12px;font-size:12px;border-bottom:1px solid #E2E8F0;vertical-align:middle}
  tr:nth-child(even) td{background:#F8FAFC}
  .cod{font-family:monospace;font-size:11px;color:#64748B}
  .center{text-align:center}
  .right{text-align:right}
  .green{color:#059669}
  .bold{font-weight:700}
  .total-bar{background:#DBEAFE;border-radius:8px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
  .total-label{font-size:12px;font-weight:700;color:#1D4ED8}
  .total-val{font-size:22px;font-weight:800;color:#059669}
  .footer{margin-top:18px;padding-top:14px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.8}
  .print-btn{position:fixed;bottom:24px;right:24px;background:#0A1628;color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.35);font-family:inherit}
  .print-btn:hover{background:#1E3A5F}
  @media print{.print-btn{display:none}body{font-size:12px}}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <img src="${logoSrc}" class="logo" alt="Valois" onerror="this.style.display='none'"/>
    <div>
      <div class="co-name">VALOIS DESCARTÁVEIS E LIMPEZA</div>
      <div class="co-sub">Av. José Bento Ribeiro Dantas, 2001 — Armação dos Búzios - RJ</div>
      <div class="co-sub">(21) 97013-4833</div>
    </div>
  </div>
  <div class="orc-meta">
    <h2>Orçamento Nº ${numOrc}</h2>
    <span>${data}</span>
  </div>
</div>

<div class="content">
  <div class="grid2">
    <div class="box">
      <div class="box-label">Vendedor</div>
      <div class="box-val">${vendedor}</div>
    </div>
    <div class="box">
      <div class="box-label">Cliente</div>
      <div class="box-val">${cliente}</div>
      ${clienteInfo}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:80px">Código</th>
        <th>Produto</th>
        <th style="width:48px;text-align:center">Qtd</th>
        <th style="width:110px;text-align:right">Preço Unit.</th>
        <th style="width:110px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total-bar">
    <span class="total-label">TOTAL DO ORÇAMENTO</span>
    <span class="total-val">${fmtVal(total)}</span>
  </div>

  <div class="footer">
    <div>Pagamento: À Vista / A Combinar</div>
    <div>Orçamento válido por 7 dias. &nbsp; Obrigado pela preferência!</div>
  </div>
</div>

<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para gerar o orçamento'); return }
  win.document.write(html)
  win.document.close()
}
