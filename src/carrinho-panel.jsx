import { useState, useRef } from 'react'
import { fmtMoney, fmtCnpj, inputStyle, btnPrimary } from './db.js'
import { supabase } from './supabase.js'
import { gerarOrcamentoPdf } from './orcamento-pdf.js'
import { NovoClienteRapidoModal } from './views4.jsx'

// ─── AUTOCOMPLETE COM BUSCA ILIKE NO SUPABASE ───
function ClienteSearch({ value, onChange }) {
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const timerRef = useRef(null)

  const buscar = async (q) => {
    if (q.length < 2) { setResultados([]); return }
    const { data } = await supabase.from('clientes').select('id,nome,cidade,cnpj').ilike('nome', `%${q}%`).limit(8)
    setResultados(data || [])
  }

  const handleInput = (e) => {
    const v = e.target.value
    onChange({ nome: v, obj: null })
    setAberto(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(v), 280)
  }

  const selecionar = (c) => {
    onChange({ nome: c.nome, obj: c })
    setResultados([]); setAberto(false)
  }

  const showDrop = aberto && value.nome.length >= 2

  return (
    <div style={{ position: 'relative' }}>
      <input value={value.nome} onChange={handleInput}
        onFocus={() => value.nome.length >= 2 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 160)}
        placeholder="Buscar cliente (mín. 2 letras)..." style={inputStyle} />
      {showDrop && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '2px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 10px 10px', zIndex: 10, maxHeight: 210, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
          {resultados.map(c => (
            <div key={c.id} onMouseDown={() => selecionar(c)}
              style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0A1628' }}>{c.nome}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                {c.cidade && `📍 ${c.cidade}  `}{c.cnpj && fmtCnpj(c.cnpj)}
              </div>
            </div>
          ))}
          <div onMouseDown={() => { onChange({ nome: value.nome, obj: null, novo: true }); setAberto(false) }}
            style={{ padding: '9px 14px', cursor: 'pointer', color: '#3B82F6', fontWeight: 600, fontSize: 13 }}
            onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            ➕ Cadastrar "{value.nome.trim()}" como novo cliente
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PAINEL LATERAL DO CARRINHO ───
function CarrinhoPainel({ onClose, carrinho, total, alterarQtd, removerItem, vendedor }) {
  const [cliente, setCliente] = useState({ nome: '', obj: null })
  const [novoModal, setNovoModal] = useState(false)

  const handleCliente = (val) => {
    if (val.novo) { setNovoModal(true); return }
    setCliente(val)
  }

  const gerar = () => {
    if (!cliente.nome.trim()) { alert('Selecione o cliente'); return }
    gerarOrcamentoPdf({ cliente: cliente.nome, vendedor, carrinho, total, clienteObj: cliente.obj })
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201, width: 'min(390px,100vw)', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>

        {/* Cabeçalho */}
        <div style={{ padding: '15px 18px', background: '#0A1628', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>
            🛒 Carrinho ({carrinho.reduce((s, i) => s + i.qtd, 0)} iten{carrinho.reduce((s, i) => s + i.qtd, 0) !== 1 ? 's' : ''})
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Seleção de cliente */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Cliente</div>
          <ClienteSearch value={cliente} onChange={handleCliente} />
          {cliente.obj && (
            <div style={{ fontSize: 11, color: '#10B981', marginTop: 5, fontWeight: 600 }}>
              ✓ {cliente.obj.cidade ? `📍 ${cliente.obj.cidade}` : ''}{cliente.obj.cnpj ? `  ·  CNPJ: ${fmtCnpj(cliente.obj.cnpj)}` : ''}
            </div>
          )}
        </div>

        {/* Lista de itens (scrollável) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px' }}>
          {carrinho.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {i.codigo && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, marginRight: 4 }}>{i.codigo}</span>}
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{i.nome}</div>
                <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginTop: 2 }}>{fmtMoney(i.preco * i.qtd)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <button onClick={() => alterarQtd(i.id, i.qtd - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>-</button>
                <span style={{ fontSize: 13, fontWeight: 700, width: 22, textAlign: 'center' }}>{i.qtd}</span>
                <button onClick={() => alterarQtd(i.id, i.qtd + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>+</button>
                <button onClick={() => removerItem(i.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, paddingLeft: 4 }}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé fixo */}
        <div style={{ padding: '14px 16px', borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: '#334155', fontSize: 15 }}>Total</span>
            <span style={{ fontWeight: 800, color: '#059669', fontSize: 20 }}>{fmtMoney(total)}</span>
          </div>
          <button onClick={gerar} style={{ ...btnPrimary, width: '100%', background: '#0EA5E9' }}>📄 Gerar Orçamento PDF</button>
        </div>
      </div>

      {novoModal && (
        <NovoClienteRapidoModal
          nomeInicial={cliente.nome}
          onClose={() => setNovoModal(false)}
          onCriado={c => { if (c) setCliente({ nome: c.nome, obj: c }) }}
        />
      )}
    </>
  )
}

// ─── BOTÃO FLUTUANTE + ABERTURA DO PAINEL ───
export function CarrinhoFlutuante({ carrinho, total, alterarQtd, removerItem, vendedor }) {
  const [open, setOpen] = useState(false)
  if (carrinho.length === 0) return null
  const nItens = carrinho.reduce((s, i) => s + i.qtd, 0)
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ position: 'fixed', bottom: 24, right: 16, zIndex: 150, background: '#0A1628', color: '#fff', border: 'none', borderRadius: 28, padding: '14px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
        🛒 {nItens} iten{nItens !== 1 ? 's' : ''} · {fmtMoney(total)}
      </button>
      {open && <CarrinhoPainel onClose={() => setOpen(false)} carrinho={carrinho} total={total} alterarQtd={alterarQtd} removerItem={removerItem} vendedor={vendedor} />}
    </>
  )
}
