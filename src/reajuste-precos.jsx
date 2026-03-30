import { useState } from 'react'
import { supabase } from './supabase.js'
import { CATEGORIAS_PRODUTO, fmtMoney, inputStyle, btnPrimary, btnSmall, card } from './db.js'

export function ReajusteModal({ produtos, onClose, onSaved }) {
  const [percentual, setPercentual] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const pct = parseFloat(percentual) || 0
  const prodsFiltrados = categoria === 'todas'
    ? produtos
    : produtos.filter(p => p.categoria === categoria)

  const precoMedioAtual = prodsFiltrados.length
    ? prodsFiltrados.reduce((s, p) => s + Number(p.preco), 0) / prodsFiltrados.length
    : 0
  const precoMedioNovo = precoMedioAtual * (1 + pct / 100)

  const pctLabel = pct > 0 ? `+${pct}%` : `${pct}%`

  const aplicar = async () => {
    if (!pct) { alert('Informe o percentual de reajuste'); return }
    if (prodsFiltrados.length === 0) { alert('Nenhum produto encontrado'); return }
    const msg = `Tem certeza que deseja reajustar ${prodsFiltrados.length} produto(s) em ${pctLabel}?`
    if (!confirm(msg)) return

    setLoading(true)
    const fator = 1 + pct / 100
    let erros = 0

    for (const p of prodsFiltrados) {
      const novoPreco = Math.round(Number(p.preco) * fator * 100) / 100
      const { error } = await supabase
        .from('produtos')
        .update({ preco: novoPreco })
        .eq('id', p.id)
      if (error) erros++
    }

    setLoading(false)
    if (erros === 0) {
      setToast(`✅ ${prodsFiltrados.length} produto(s) reajustado(s) em ${pctLabel}`)
      setTimeout(() => { onSaved(); onClose() }, 2000)
    } else {
      alert(`Erro: ${erros} produto(s) não foram atualizados. Tente novamente.`)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: '100%', maxWidth: 420, padding: 24, margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A1628' }}>📊 Reajustar Preços</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>✕</button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Percentual de reajuste
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="number"
            value={percentual}
            onChange={e => setPercentual(e.target.value)}
            placeholder="Ex: 5, 10, -3"
            style={{ ...inputStyle, flex: 1 }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#64748B', minWidth: 16 }}>%</span>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Aplicar em
        </label>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer' }}
        >
          <option value="todas">Todos os produtos ({produtos.length})</option>
          {CATEGORIAS_PRODUTO.map(c => {
            const n = produtos.filter(p => p.categoria === c).length
            return n > 0 ? <option key={c} value={c}>{c} ({n})</option> : null
          })}
        </select>

        {pct !== 0 && prodsFiltrados.length > 0 && (
          <div style={{ background: pct > 0 ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${pct > 0 ? '#BBF7D0' : '#FED7AA'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pct > 0 ? '#166534' : '#9A3412', marginBottom: 6 }}>
              {prodsFiltrados.length} produto(s) serão afetados
            </div>
            <div style={{ fontSize: 12, color: pct > 0 ? '#166534' : '#9A3412' }}>
              Preço médio atual: <b>{fmtMoney(precoMedioAtual)}</b>
              {' → '}
              Novo preço médio: <b>{fmtMoney(precoMedioNovo)}</b>
            </div>
          </div>
        )}

        {toast && (
          <div style={{ background: '#D1FAE5', border: '1px solid #10B981', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#065F46' }}>
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>
            Cancelar
          </button>
          <button
            onClick={aplicar}
            disabled={loading || !pct || prodsFiltrados.length === 0}
            style={{ ...btnPrimary, flex: 2, opacity: (loading || !pct || prodsFiltrados.length === 0) ? 0.6 : 1 }}
          >
            {loading ? 'Aplicando...' : `Aplicar ${pctLabel || 'reajuste'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
