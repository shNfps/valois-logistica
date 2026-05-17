import { useState } from 'react'
import { fmtMoney, btnSmall, card } from './db.js'
import { GRUPOS_OPERACIONAL } from './dre-calculo.js'

function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }
function variacao(atual, anterior) {
  if (!anterior) return null
  const v = ((atual - anterior) / Math.abs(anterior)) * 100
  return { v, seta: v > 0.5 ? '↑' : v < -0.5 ? '↓' : '→', cor: v > 0.5 ? '#059669' : v < -0.5 ? '#DC2626' : '#94A3B8' }
}

function Linha({ label, valor, anterior, tipo, total, onClick, icone, indent = 0 }) {
  const cor = tipo === 'receita' ? '#059669' : tipo === 'despesa' ? '#DC2626' : '#0A1628'
  const fw = total ? 800 : 500
  const v = variacao(valor, anterior)
  const bg = total ? '#F8FAFC' : 'transparent'
  const border = total ? '2px solid #0A1628' : '1px solid #F1F5F9'
  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', alignItems: 'center', padding: '10px 14px', paddingLeft: 14 + indent * 16, background: bg, borderBottom: border, cursor: onClick ? 'pointer' : 'default', fontSize: total ? 14 : 13, fontWeight: fw }}>
      <div style={{ color: '#0A1628', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icone && <span>{icone}</span>}
        <span>{label}</span>
        {onClick && <span style={{ fontSize: 10, color: '#94A3B8' }}>›</span>}
      </div>
      <div style={{ textAlign: 'right', color: cor, fontWeight: fw }}>{fmtMoney(valor)}</div>
      <div style={{ textAlign: 'right', fontSize: 11 }}>
        {v ? <span style={{ color: v.cor, fontWeight: 600 }}>{v.seta} {fmtPct(v.v)}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}
      </div>
    </div>
  )
}

function CardMargem({ label, valor, faixas }) {
  const cor = valor >= faixas[1] ? '#059669' : valor >= faixas[0] ? '#F59E0B' : '#DC2626'
  const bg = valor >= faixas[1] ? '#D1FAE5' : valor >= faixas[0] ? '#FEF3C7' : '#FEE2E2'
  return (
    <div style={{ ...card, padding: 16, margin: 0, borderLeft: `4px solid ${cor}` }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 4 }}>{valor.toFixed(1)}%</div>
      <span style={{ display: 'inline-block', background: bg, color: cor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginTop: 4 }}>
        {valor >= faixas[1] ? 'Saudável' : valor >= faixas[0] ? 'Atenção' : 'Crítico'}
      </span>
    </div>
  )
}

export function DRETabela({ dre, dreAnterior, onDrillDown }) {
  return (
    <div style={{ ...card, padding: 0, margin: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', padding: '10px 14px', background: '#0F172A', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <div>Conta</div><div style={{ textAlign: 'right' }}>Valor</div><div style={{ textAlign: 'right' }}>vs. anterior</div>
      </div>

      <Linha label="(+) Receita Bruta" valor={dre.receitaBruta} anterior={dreAnterior?.receitaBruta} tipo="receita" total onClick={() => onDrillDown('receita')} icone="💚" />
      <Linha label="(−) Deduções / Impostos sobre venda" valor={-dre.deducoes} anterior={dreAnterior ? -dreAnterior.deducoes : null} tipo="despesa" indent={1} icone="📋" />
      <Linha label="(=) Receita Líquida" valor={dre.receitaLiquida} anterior={dreAnterior?.receitaLiquida} total />

      <Linha label="(−) CMV — Custo das Mercadorias Vendidas" valor={-dre.cmv} anterior={dreAnterior ? -dreAnterior.cmv : null} tipo="despesa" onClick={() => onDrillDown('cmv')} icone="📦" />
      <Linha label="(=) Lucro Bruto" valor={dre.lucroBruto} anterior={dreAnterior?.lucroBruto} total />

      <div style={{ padding: '10px 14px', background: '#F1F5F9', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>(−) Despesas operacionais</div>
      {Object.entries(GRUPOS_OPERACIONAL).map(([k, g]) => {
        const v = dre.operacionais[k] || 0
        if (!v && !dreAnterior?.operacionais?.[k]) return null
        return <Linha key={k} label={g.label} valor={-v} anterior={dreAnterior ? -(dreAnterior.operacionais[k] || 0) : null} tipo="despesa" indent={1} icone={g.icone} onClick={() => onDrillDown('op:' + k)} />
      })}
      <Linha label="Comissões (vendedores)" valor={-dre.comissoes} anterior={dreAnterior ? -dreAnterior.comissoes : null} tipo="despesa" indent={1} icone="💰" />
      <Linha label="Reembolsos pagos" valor={-dre.reembolsosPagos} anterior={dreAnterior ? -dreAnterior.reembolsosPagos : null} tipo="despesa" indent={1} icone="💸" onClick={() => onDrillDown('reembolsos')} />
      <Linha label="Total operacional" valor={-dre.totalOperacional} anterior={dreAnterior ? -dreAnterior.totalOperacional : null} tipo="despesa" total />

      <Linha label="(=) EBITDA — Lucro operacional" valor={dre.ebitda} anterior={dreAnterior?.ebitda} total />
      <Linha label="(−) Impostos sobre lucro" valor={-dre.impostoLucro} anterior={dreAnterior ? -dreAnterior.impostoLucro : null} tipo="despesa" indent={1} icone="🏛️" />
      <div style={{ background: dre.lucroLiquido >= 0 ? '#D1FAE5' : '#FEE2E2' }}>
        <Linha label="(=) Lucro Líquido" valor={dre.lucroLiquido} anterior={dreAnterior?.lucroLiquido} tipo={dre.lucroLiquido >= 0 ? 'receita' : 'despesa'} total />
      </div>
    </div>
  )
}

export function CardsMargens({ dre }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
      <CardMargem label="Margem Bruta" valor={dre.margemBruta} faixas={[15, 30]} />
      <CardMargem label="Margem EBITDA" valor={dre.margemEbitda} faixas={[5, 10]} />
      <CardMargem label="Margem Líquida" valor={dre.margemLiquida} faixas={[3, 7]} />
    </div>
  )
}

// Modal de drill-down: detalha as linhas do DRE.
export function DrillDownModal({ chave, dados, dre, onClose }) {
  if (!chave) return null
  let titulo = '', items = [], colunas = []
  if (chave === 'receita') {
    titulo = `Pedidos entregues (${dados.pedidos.length})`
    colunas = [{ label: 'Cliente', k: c => c.cliente }, { label: 'Status', k: c => c.status }, { label: 'Valor', k: c => fmtMoney(c.valor_total), right: true }]
    items = dados.pedidos
  } else if (chave === 'cmv') {
    titulo = 'Itens vendidos e custos'
    const map = {}
    dados.itens.forEach(i => {
      const k = i.codigo || i.nome_produto || 'sem-codigo'
      const custo = i.custo_unitario != null ? Number(i.custo_unitario) : (i.codigo ? dados.produtosCusto[i.codigo] : 0) || 0
      if (!map[k]) map[k] = { nome: i.nome_produto, qtd: 0, custoTotal: 0, custo }
      map[k].qtd += Number(i.quantidade || 0); map[k].custoTotal += Number(i.quantidade || 0) * custo
    })
    items = Object.values(map).sort((a, b) => b.custoTotal - a.custoTotal)
    colunas = [{ label: 'Produto', k: i => i.nome }, { label: 'Qtd', k: i => i.qtd, right: true }, { label: 'Custo un.', k: i => fmtMoney(i.custo), right: true }, { label: 'Total', k: i => fmtMoney(i.custoTotal), right: true }]
  } else if (chave === 'reembolsos') {
    titulo = `Reembolsos pagos (${dados.reembolsos.length})`
    colunas = [{ label: 'Funcionário', k: r => r.usuario_nome }, { label: 'Descrição', k: r => r.descricao }, { label: 'Valor', k: r => fmtMoney(r.valor), right: true }]
    items = dados.reembolsos
  } else if (chave.startsWith('op:')) {
    const tipo = chave.slice(3)
    titulo = `Despesas: ${GRUPOS_OPERACIONAL[tipo]?.label || tipo}`
    items = dados.despesas.filter(d => (d.categoria_tipo === tipo) || (tipo === 'outros' && !GRUPOS_OPERACIONAL[d.categoria_tipo]))
    colunas = [{ label: 'Descrição', k: d => d.descricao }, { label: 'Pago em', k: d => d.data_pagamento }, { label: 'Valor', k: d => fmtMoney(d.valor), right: true }]
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{titulo}</h3>
          <button onClick={onClose} style={{ ...btnSmall }}>Fechar</button>
        </div>
        {items.length === 0 ? <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Sem registros no período</div> : (
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '), gap: 8, padding: '8px 12px', background: '#F8FAFC', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              {colunas.map((c, i) => <div key={i} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.label}</div>)}
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '), gap: 8, padding: '8px 12px', borderTop: '1px solid #F1F5F9', fontSize: 12 }}>
                {colunas.map((c, j) => <div key={j} style={{ textAlign: c.right ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.k(it)}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
