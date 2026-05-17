import { useState, useEffect } from 'react'
import { fmtCnpj, inputStyle, btnPrimary, btnSmall } from './db.js'
import { createDespesa, updateDespesa, gerarRecorrencias, uploadComprovante, isoHoje } from './financeiro-db.js'

const FORMAS = [
  { v: 'boleto', l: 'Boleto' }, { v: 'pix', l: 'PIX' }, { v: 'transferencia', l: 'Transferência' },
  { v: 'cartao', l: 'Cartão' }, { v: 'dinheiro', l: 'Dinheiro' }, { v: 'cheque', l: 'Cheque' }
]
const PERIODOS = [
  { v: 'mensal', l: 'Mensal' }, { v: 'bimestral', l: 'Bimestral' }, { v: 'trimestral', l: 'Trimestral' },
  { v: 'semestral', l: 'Semestral' }, { v: 'anual', l: 'Anual' }
]

export function DespesaModal({ user, categorias, fornecedoresHist = [], editando, onClose, onSaved }) {
  const [descricao, setDescricao] = useState(editando?.descricao || '')
  const [categoriaId, setCategoriaId] = useState(editando?.categoria_id || (categorias[0]?.id || ''))
  const [valor, setValor] = useState(editando?.valor || '')
  const [fornecedor, setFornecedor] = useState(editando?.fornecedor || '')
  const [cnpj, setCnpj] = useState(editando?.cnpj_fornecedor || '')
  const [dataVenc, setDataVenc] = useState(editando?.data_vencimento || isoHoje())
  const [formaPg, setFormaPg] = useState(editando?.forma_pagamento || 'boleto')
  const [numDoc, setNumDoc] = useState(editando?.numero_documento || '')
  const [anexo, setAnexo] = useState(null)
  const [obs, setObs] = useState(editando?.observacoes || '')
  const [recorrente, setRecorrente] = useState(editando?.recorrente || false)
  const [periodicidade, setPeriodicidade] = useState(editando?.periodicidade || 'mensal')
  const [saving, setSaving] = useState(false)
  const [showSugestoes, setShowSugestoes] = useState(false)

  const sugestoesFornecedor = fornecedoresHist
    .filter(f => f.nome && (!fornecedor || f.nome.toLowerCase().includes(fornecedor.toLowerCase())) && f.nome.toLowerCase() !== fornecedor.toLowerCase())
    .slice(0, 5)

  const salvar = async () => {
    if (!descricao.trim() || !valor || !dataVenc || !categoriaId) { alert('Preencha descrição, categoria, valor e vencimento'); return }
    setSaving(true)
    let anexoUrl = editando?.anexo_url || null
    if (anexo) anexoUrl = await uploadComprovante(anexo, 'despesas')
    const cat = categorias.find(c => c.id === categoriaId)
    const payload = {
      descricao: descricao.trim(), categoria_id: categoriaId, categoria_tipo: cat?.tipo || null,
      valor: Number(valor), fornecedor: fornecedor.trim() || null,
      cnpj_fornecedor: cnpj.replace(/\D/g, '') || null,
      data_vencimento: dataVenc, forma_pagamento: formaPg,
      numero_documento: numDoc.trim() || null, anexo_url: anexoUrl,
      observacoes: obs.trim() || null, recorrente, periodicidade: recorrente ? periodicidade : null
    }
    if (editando) {
      await updateDespesa(editando.id, payload)
    } else {
      const criada = await createDespesa({ ...payload, criado_por: user.nome })
      if (criada && recorrente) await gerarRecorrencias(criada, 12)
    }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{editando ? 'Editar despesa' : 'Nova despesa'}</h3>

        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Descrição *" style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 10, resize: 'vertical' }} />

        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer' }}>
          <option value="">Selecione categoria...</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor R$ *" style={inputStyle} />
          <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input value={fornecedor} onChange={e => { setFornecedor(e.target.value); setShowSugestoes(true) }} onFocus={() => setShowSugestoes(true)} onBlur={() => setTimeout(() => setShowSugestoes(false), 200)} placeholder="Fornecedor" style={inputStyle} />
          {showSugestoes && sugestoesFornecedor.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 2, zIndex: 5, maxHeight: 180, overflowY: 'auto' }}>
              {sugestoesFornecedor.map((f, i) => (
                <div key={i} onMouseDown={() => { setFornecedor(f.nome); if (f.cnpj) setCnpj(f.cnpj); setShowSugestoes(false) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}>
                  {f.nome} {f.cnpj && <span style={{ color: '#94A3B8', fontSize: 11 }}>· {fmtCnpj(f.cnpj)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <input value={fmtCnpj(cnpj)} onChange={e => setCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="CNPJ do fornecedor" style={{ ...inputStyle, marginBottom: 10 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <select value={formaPg} onChange={e => setFormaPg(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {FORMAS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <input value={numDoc} onChange={e => setNumDoc(e.target.value)} placeholder="Nº documento/boleto" style={inputStyle} />
        </div>

        <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6 }}>Anexo (PDF ou imagem)</label>
        <input type="file" accept="image/*,.pdf" onChange={e => setAnexo(e.target.files[0])} style={{ marginBottom: 10, width: '100%' }} />
        {editando?.anexo_url && !anexo && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>📎 Anexo atual será mantido</div>}

        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Observações" style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 12, resize: 'vertical' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Despesa recorrente?</span>
        </label>
        {recorrente && (
          <select value={periodicidade} onChange={e => setPeriodicidade(e.target.value)} style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer' }}>
            {PERIODOS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        )}
        {recorrente && !editando && <div style={{ fontSize: 11, color: '#0EA5E9', marginBottom: 12 }}>⚡ Serão criadas as próximas 12 ocorrências automaticamente</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

export function PagarModal({ despesa, onClose, onSaved }) {
  const [data, setData] = useState(isoHoje())
  const [forma, setForma] = useState(despesa?.forma_pagamento || 'boleto')
  const [saving, setSaving] = useState(false)
  if (!despesa) return null

  const confirmar = async () => {
    setSaving(true)
    await updateDespesa(despesa.id, { status: 'PAGO', data_pagamento: data, forma_pagamento: forma })
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Marcar como pago</h3>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>{despesa.descricao}</div>
        <label style={{ fontSize: 12, color: '#64748B' }}>Data do pagamento</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
        <label style={{ fontSize: 12, color: '#64748B' }}>Forma de pagamento</label>
        <select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer' }}>
          {FORMAS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}
