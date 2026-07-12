import { useState } from 'react'
import { inputStyle, btnPrimary, btnSmall, fmtMoney, uploadPdf, updatePedido, addHistorico, FORMAS_PAGAMENTO_PEDIDO } from './db.js'
import { AttachmentInput } from './attachment.jsx'
import { Field, FormAlert } from './field.jsx'
import { criarNotificacao } from './notificacoes.js'
import { upsertContaReceberDoPedido, isFormaBoleto } from './financeiro-db.js'

// ─── Anexo de NF + Boleto (fluxo operacional que gera a conta a receber) ───
// Coleta: número da NF, PDF da NF, forma de pagamento, data EXATA de vencimento do
// boleto, PDF do boleto e (se necessário) o valor total. Ao salvar, marca o pedido
// como NF_EMITIDA e cria/atualiza a conta a receber (sem duplicar), via helper único.
export function AnexarNfBoletoModal({ pedido, clientes = [], user, onClose, onSaved }) {
  const [numNf, setNumNf] = useState(pedido.numero_nf || '')
  const [forma, setForma] = useState(pedido.forma_pagamento || 'a_vista')
  const [venc, setVenc] = useState(pedido.data_vencimento_pagamento || '')
  const [valor, setValor] = useState(pedido.valor_total ? String(pedido.valor_total) : '')
  const [nfFiles, setNfFiles] = useState([])
  const [boletoFiles, setBoletoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const ehBoleto = isFormaBoleto(forma)
  const jaTemNf = !!pedido.nf_url
  const valorNum = valor ? Number(valor) : Number(pedido.valor_total || 0)
  const semValor = !(valorNum > 0)

  const salvar = async () => {
    setErro('')
    if (!numNf.trim()) return setErro('Informe o número da NF.')
    if (!jaTemNf && nfFiles.length === 0) return setErro('Anexe o PDF da NF.')
    if (ehBoleto && !venc) return setErro('Forma boleto exige a data exata de vencimento do boleto.')
    if (ehBoleto && boletoFiles.length === 0 && !pedido.boleto_url) return setErro('Forma boleto exige o PDF do boleto anexado.')
    setSaving(true)
    try {
      let nf_url = pedido.nf_url
      if (nfFiles[0]) { const u = await uploadPdf(nfFiles[0], 'notas-fiscais'); if (u) nf_url = u }
      let boleto_url = pedido.boleto_url
      if (boletoFiles[0]) { const u = await uploadPdf(boletoFiles[0], 'boletos'); if (u) boleto_url = u }

      const fp = FORMAS_PAGAMENTO_PEDIDO.find(x => x.v === forma)
      const updates = {
        nf_url, boleto_url, status: 'NF_EMITIDA', numero_nf: numNf.trim(),
        forma_pagamento: forma, prazo_pagamento_dias: fp?.dias ?? pedido.prazo_pagamento_dias ?? 0,
        data_vencimento_pagamento: venc || null,
      }
      if (valor && Number(valor) > 0) updates.valor_total = Number(valor)
      await updatePedido(pedido.id, updates)
      await addHistorico(pedido.id, user.nome, `Anexou NF nº ${numNf.trim()}${ehBoleto ? ' + boleto' : ''}`)
      await criarNotificacao('motorista', `🚛 NF ${numNf.trim()} de ${pedido.cliente} - ${pedido.cidade || ''}`, `Pronta para entrega · Por: ${user.nome}`, pedido.id)

      // vendedor responsável: do cliente cadastrado, senão quem criou o pedido
      const cli = clientes.find(c => c.id === pedido.cliente_id || (c.nome || '').toLowerCase() === (pedido.cliente || '').toLowerCase())
      const vendedorNome = cli?.vendedor_nome || pedido.criado_por || null
      const pedidoAtualizado = { ...pedido, ...updates, valor_total: valorNum }
      const r = await upsertContaReceberDoPedido(pedidoAtualizado, { vendedorNome })
      if (r.ok && r.conta) {
        await criarNotificacao('financeiro', `📥 Nova conta a receber: ${pedido.cliente}`, `NF ${numNf.trim()} · ${fmtMoney(r.conta.valor || valorNum)} · venc. ${r.conta.data_vencimento}`, pedido.id)
      }
      onSaved?.()
      if (semValor) alert('NF anexada com sucesso. ⚠️ O pedido está SEM valor total, então a conta a receber ainda NÃO foi criada. Extraia os itens (🤖) ou informe o valor para gerar a cobrança automaticamente.')
      onClose()
    } catch (e) {
      console.error(e); setErro('Erro ao salvar. Tente novamente.'); setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, margin: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-primary)' }}>Anexar NF + Boleto</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{pedido.cliente} · {pedido.numero_ref || ''}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Número da NF" required>
              <input value={numNf} inputMode="numeric" onChange={e => setNumNf(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 12345" style={inputStyle} />
            </Field>
            <Field label="Valor total" hint={semValor ? 'Sem valor: conta não será criada' : 'R$ da NF'}>
              <input value={valor} inputMode="decimal" onChange={e => setValor(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0,00" style={{ ...inputStyle, borderColor: semValor ? 'var(--danger)' : undefined }} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Forma de pagamento" required>
              <select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {FORMAS_PAGAMENTO_PEDIDO.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </Field>
            <Field label="Vencimento do boleto" required={ehBoleto} hint={ehBoleto ? 'Data exata do boleto' : 'Opcional p/ esta forma'}>
              <input type="date" value={venc} onChange={e => setVenc(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label={jaTemNf ? 'PDF da NF (substituir — opcional)' : 'PDF da NF'} required={!jaTemNf}>
            <AttachmentInput files={nfFiles} onFiles={setNfFiles} accept=".pdf" existingUrl={pedido.nf_url} />
          </Field>

          {ehBoleto && (
            <Field label="PDF do boleto" required={!pedido.boleto_url}>
              <AttachmentInput files={boletoFiles} onFiles={setBoletoFiles} accept=".pdf" existingUrl={pedido.boleto_url} />
            </Field>
          )}

          {semValor && <FormAlert tipo="aviso">Pedido sem valor total — a NF será anexada, mas a conta a receber só é criada quando o valor for informado.</FormAlert>}
          {erro && <FormAlert tipo="erro">{erro}</FormAlert>}

          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '✓ Anexar e gerar cobrança'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
