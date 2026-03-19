import { useState } from 'react'
import { extractCodesFromPdf } from './ai.js'
import { fetchProdutos, updateProduto, btnPrimary, btnSmall, card } from './db.js'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function findMatch(nomeExtraido, semCodigo) {
  const needle = norm(nomeExtraido)
  return semCodigo.find(p => {
    const pn = norm(p.nome)
    return pn.includes(needle) || needle.includes(pn)
  }) || null
}

async function processarEmLotes(pedidos, semCodigo, onProgress) {
  const BATCH = 3
  let remaining = [...semCodigo]
  let atualizados = 0

  for (let i = 0; i < pedidos.length && remaining.length > 0; i += BATCH) {
    const chunk = pedidos.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      chunk.map(p => extractCodesFromPdf(p.orcamento_url).catch(() => []))
    )
    for (let j = 0; j < results.length; j++) {
      onProgress(Math.min(i + j + 1, pedidos.length), pedidos.length)
      if (results[j].status !== 'fulfilled') continue
      for (const it of results[j].value) {
        if (!it.codigo) continue
        const cod = String(it.codigo).replace(/\./g, '')
        const match = findMatch(it.nome_produto, remaining)
        if (match) {
          await updateProduto(match.id, { codigo: cod })
          atualizados++
          remaining = remaining.filter(p => p.id !== match.id)
        }
      }
    }
  }
  return atualizados
}

export function ReprocessarCodigosModal({ pedidos, onClose, onDone }) {
  const [fase, setFase] = useState('confirm')
  const [prog, setProg] = useState({ atual: 0, total: 0 })
  const [resultado, setResultado] = useState(0)

  const iniciar = async () => {
    setFase('running')
    const produtosAll = await fetchProdutos()
    const semCodigo = produtosAll.filter(p => !p.codigo)
    if (semCodigo.length === 0) { setResultado(0); setFase('done'); return }

    const comOrcamento = pedidos.filter(p => p.orcamento_url)
    setProg({ atual: 0, total: comOrcamento.length })

    const atualizados = await processarEmLotes(
      comOrcamento,
      semCodigo,
      (atual, total) => setProg({ atual, total })
    )
    setResultado(atualizados)
    setFase('done')
    if (atualizados > 0) onDone?.()
  }

  const pct = prog.total ? Math.round((prog.atual / prog.total) * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: '100%', maxWidth: 400, padding: 28, textAlign: 'center', marginBottom: 0 }}>

        {fase === 'confirm' && (<>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#0A1628' }}>Reprocessar códigos</h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 8, lineHeight: 1.6 }}>
            Isso vai analisar todos os orçamentos para encontrar os códigos dos produtos sem código.
          </p>
          <p style={{ fontSize: 13, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
            ⚠️ Pode demorar alguns minutos e usar créditos da API. Continuar?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={iniciar} style={{ ...btnPrimary, flex: 1 }}>Continuar</button>
          </div>
        </>)}

        {fase === 'running' && (<>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Processando...</h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Orçamento {prog.atual} de {prog.total}
          </p>
          <div style={{ background: '#E2E8F0', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ background: '#3B82F6', height: '100%', borderRadius: 8, width: `${pct}%`, transition: 'width 0.4s' }} />
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{pct}% — Não feche esta tela</p>
        </>)}

        {fase === 'done' && (<>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{resultado > 0 ? '✅' : '🔍'}</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0A1628' }}>Concluído!</h3>
          <p style={{ fontSize: 14, color: '#334155', marginBottom: 20, lineHeight: 1.5 }}>
            {resultado > 0
              ? <><b style={{ color: '#059669' }}>{resultado} produto(s)</b> atualizados com código.<br /><span style={{ fontSize: 12, color: '#94A3B8' }}>Produtos restantes sem código devem ser preenchidos manualmente.</span></>
              : 'Nenhum código novo encontrado nos orçamentos. Preencha manualmente os produtos restantes.'}
          </p>
          <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Fechar</button>
        </>)}

      </div>
    </div>
  )
}
