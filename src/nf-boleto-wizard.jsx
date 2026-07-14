import { useState, useEffect, useRef, useCallback } from 'react'
import {
  inputStyle, btnSmall, fmtMoney, uploadPdf, uploadArquivo, updatePedido, addHistorico,
  savePedidoItens, FORMAS_PAGAMENTO_PEDIDO, fetchMetaDiaria, fetchTotalVendidoHoje,
} from './db.js'
import { AttachmentInput } from './attachment.jsx'
import { Field, FormAlert } from './field.jsx'
import { Stepper, Progress, Badge, Skeleton, Separator } from './ui-primitives.jsx'
import { criarNotificacao } from './notificacoes.js'
import { upsertContaReceberDoPedido, isFormaBoleto } from './financeiro-db.js'
import { transcreverNf } from './ai.js'
import { extrairDadosNfDeXml, extrairDadosNfDeTexto, ehXmlNfe } from './nf-extractor.js'

// ─── Wizard "Anexar NF + Boleto" (3 steps) ─────────────────────────────────────
// Substitui o antigo AnexarNfBoletoModal. Step 1 extrai da NF (XML determinístico
// ou DANFE via OCR+parser ancorado no rótulo — nunca o "1,04"), Step 2 anexa o boleto
// e gera a cobrança, Step 3 celebra a venda com a barra da meta diária.
const STEPS = [{ label: 'Nota Fiscal' }, { label: 'Boleto' }, { label: 'Concluído' }]
const VERDE_CTA = '#10B981'        // mesmo verde do botão da listagem ("Anexar NF + Boleto")
const VERDE_CTA_HOVER = '#059669'

const isoHojeMais = (dias) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Number(dias || 0))
  return d.toISOString().slice(0, 10)
}
const prazoDaForma = (forma, fallback = 0) =>
  FORMAS_PAGAMENTO_PEDIDO.find(f => f.v === forma)?.dias ?? fallback

export function NfBoletoWizard({ pedido, clientes = [], user, onClose, onSaved, initialStep = 1 }) {
  const [step, setStep] = useState(initialStep)

  // ── Dados extraídos / editáveis (Step 1) ──
  const [numNf, setNumNf] = useState(pedido.numero_nf || '')
  const [valor, setValor] = useState(pedido.valor_total ? String(pedido.valor_total) : '')
  const [valorIncerto, setValorIncerto] = useState(false)
  const [itens, setItens] = useState([])
  const [extraiu, setExtraiu] = useState(false)
  const [nfFile, setNfFile] = useState(null)
  const [nfUrl, setNfUrl] = useState(pedido.nf_url || null)
  const [extraindo, setExtraindo] = useState(false)

  // ── Boleto / cobrança (Step 2) ──
  const [forma, setForma] = useState(pedido.forma_pagamento || 'a_vista')
  const [venc, setVenc] = useState(pedido.data_vencimento_pagamento || isoHojeMais(prazoDaForma(pedido.forma_pagamento, pedido.prazo_pagamento_dias || 0)))
  const [vencManual, setVencManual] = useState(false)
  const [editarPrazo, setEditarPrazo] = useState(false)
  const [boletoFile, setBoletoFile] = useState(null)

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const ehBoleto = isFormaBoleto(forma)
  const valorNum = Number(valor) || 0
  const podeContinuar = !!numNf.trim() && valorNum > 0

  // Vencimento = HOJE + prazo (decisão do fluxo). Recalcula ao trocar a forma, a menos
  // que o usuário tenha ajustado a data manualmente.
  useEffect(() => {
    if (!vencManual) setVenc(isoHojeMais(prazoDaForma(forma, pedido.prazo_pagamento_dias || 0)))
  }, [forma, vencManual, pedido.prazo_pagamento_dias])

  // Fecha com ESC (exceto durante gravação).
  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [saving, onClose])

  // ── Extração ao anexar a NF ──
  const extrair = useCallback(async (file) => {
    setErro(''); setExtraindo(true); setExtraiu(false)
    try {
      let dados
      if (ehXmlNfe(file.name) || (file.type || '').includes('xml')) {
        dados = extrairDadosNfDeXml(await file.text())
      } else {
        const objUrl = URL.createObjectURL(file)
        try {
          const texto = await transcreverNf(objUrl, file.type || 'application/pdf')
          dados = extrairDadosNfDeTexto(texto)
        } finally { URL.revokeObjectURL(objUrl) }
      }
      if (dados.numero) setNumNf(dados.numero)
      if (dados.valorTotal != null) setValor(String(dados.valorTotal))
      setValorIncerto(!!dados.valorIncerto)
      setItens((dados.itens || []).map(i => ({
        codigo: i.codigo || '', nome_produto: i.nome_produto || '',
        quantidade: i.quantidade ?? '', unidade: i.unidade || 'un', preco_unitario: i.preco_unitario ?? '',
      })))
      setExtraiu(true)
    } catch (e) {
      console.error(e)
      setErro('Não consegui ler a NF automaticamente. Preencha os campos manualmente abaixo.')
      setExtraiu(true) // libera edição manual — usuário nunca fica travado
    } finally { setExtraindo(false) }
  }, [])

  const onNfFiles = (files) => {
    const f = files[0] || null
    setNfFile(f)
    if (f) extrair(f)
    else { setExtraiu(false); setItens([]) }
  }

  const updItem = (idx, campo, val) => setItens(p => p.map((it, i) => i === idx ? { ...it, [campo]: val } : it))
  const removeItem = (idx) => setItens(p => p.filter((_, i) => i !== idx))
  const addItem = () => setItens(p => [...p, { codigo: '', nome_produto: '', quantidade: '', unidade: 'un', preco_unitario: '' }])

  // ── Step 1 → salva número, valor e itens NO PEDIDO ──
  const continuar = async () => {
    setErro('')
    if (!numNf.trim()) return setErro('Informe o número da NF.')
    if (!(valorNum > 0)) return setErro('Informe o valor total da NF (maior que zero).')
    setSaving(true)
    try {
      let url = nfUrl
      if (nfFile) { const u = await uploadArquivo(nfFile, 'notas-fiscais'); if (u) url = u; setNfUrl(u) }
      // itens salvos SEMPRE no pedido (nunca no catálogo); valor_total = total da NF.
      const itensLimpos = itens
        .filter(i => (i.nome_produto || '').trim())
        .map(i => ({ codigo: i.codigo, nome_produto: i.nome_produto, quantidade: Number(i.quantidade) || 0, unidade: i.unidade || 'un', preco_unitario: Number(i.preco_unitario) || 0 }))
      await savePedidoItens(pedido.id, itensLimpos, valorNum)
      await updatePedido(pedido.id, { numero_nf: numNf.trim(), nf_url: url })
      setSaving(false); setStep(2)
    } catch (e) { console.error(e); setErro('Erro ao salvar os dados da NF. Tente novamente.'); setSaving(false) }
  }

  // ── Step 2 → anexa boleto, gera a conta a receber ──
  const finalizar = async () => {
    setErro('')
    if (ehBoleto && !boletoFile && !pedido.boleto_url) return setErro('Anexe o PDF do boleto.')
    if (ehBoleto && !venc) return setErro('Defina o vencimento do boleto.')
    setSaving(true)
    try {
      let boleto_url = pedido.boleto_url
      if (boletoFile) { const u = await uploadPdf(boletoFile, 'boletos'); if (u) boleto_url = u }
      const prazo = prazoDaForma(forma, pedido.prazo_pagamento_dias || 0)
      const updates = {
        nf_url: nfUrl, boleto_url, status: 'NF_EMITIDA', numero_nf: numNf.trim(),
        forma_pagamento: forma, prazo_pagamento_dias: prazo,
        data_vencimento_pagamento: venc || null, valor_total: valorNum,
      }
      await updatePedido(pedido.id, updates)
      await addHistorico(pedido.id, user.nome, `Anexou NF nº ${numNf.trim()}${ehBoleto ? ' + boleto' : ''}`)
      await criarNotificacao('motorista', `🚛 NF ${numNf.trim()} de ${pedido.cliente} - ${pedido.cidade || ''}`, `Pronta para entrega · Por: ${user.nome}`, pedido.id)
      const cli = clientes.find(c => c.id === pedido.cliente_id || (c.nome || '').toLowerCase() === (pedido.cliente || '').toLowerCase())
      const vendedorNome = cli?.vendedor_nome || pedido.criado_por || null
      const pedidoAtualizado = { ...pedido, ...updates }
      const r = await upsertContaReceberDoPedido(pedidoAtualizado, { vendedorNome })
      if (r.ok && r.conta) {
        await criarNotificacao('financeiro', `📥 Nova conta a receber: ${pedido.cliente}`, `NF ${numNf.trim()} · ${fmtMoney(r.conta.valor || valorNum)} · venc. ${r.conta.data_vencimento}`, pedido.id)
      }
      onSaved?.()
      setSaving(false); setStep(3)
    } catch (e) { console.error(e); setErro('Erro ao gerar a cobrança. Tente novamente.'); setSaving(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Anexar NF e boleto"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.62)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <style>{`
        @keyframes valoisPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes valoisCoin{0%{transform:translate(var(--dx),-40px) scale(.6);opacity:0}
          15%{opacity:1}70%{opacity:1}100%{transform:translate(0,var(--dy)) scale(1);opacity:0}}
        @keyframes valoisPop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion: reduce){
          .valois-coin{display:none!important}
          .valois-pop{animation:none!important}
        }
      `}</style>

      <div className="valois-pop" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 520, padding: 22, margin: '20px 0', boxShadow: '0 24px 64px rgba(15,23,42,0.28)', animation: 'valoisPop .28s ease' }}>
        {/* Cabeçalho + barra de progressão */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Anexar NF + Boleto</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{pedido.cliente} · {pedido.numero_ref || ''}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ margin: '16px 2px 20px' }}><Stepper steps={STEPS} current={step} /></div>

        {step === 1 && (
          <Step1
            numNf={numNf} setNumNf={setNumNf} valor={valor} setValor={setValor} valorIncerto={valorIncerto}
            itens={itens} updItem={updItem} removeItem={removeItem} addItem={addItem}
            nfFile={nfFile} onNfFiles={onNfFiles} extraindo={extraindo} extraiu={extraiu}
            existingUrl={pedido.nf_url} erro={erro} podeContinuar={podeContinuar} saving={saving} onContinuar={continuar}
          />
        )}
        {step === 2 && (
          <Step2
            numNf={numNf} nfUrl={nfUrl} valor={valorNum} forma={forma} setForma={setForma}
            venc={venc} setVenc={v => { setVenc(v); setVencManual(true) }} editarPrazo={editarPrazo} setEditarPrazo={setEditarPrazo}
            ehBoleto={ehBoleto} boletoFile={boletoFile} setBoletoFile={setBoletoFile} existingBoleto={pedido.boleto_url}
            erro={erro} saving={saving} onVoltar={() => { setErro(''); setStep(1) }} onFinalizar={finalizar}
          />
        )}
        {step === 3 && (
          <Step3 user={user} valorVenda={valorNum} onClose={() => { onSaved?.(); onClose() }} />
        )}
      </div>
    </div>
  )
}

// ─── STEP 1 — Nota Fiscal ───
function Step1({ numNf, setNumNf, valor, setValor, valorIncerto, itens, updItem, removeItem, addItem, nfFile, onNfFiles, extraindo, extraiu, existingUrl, erro, podeContinuar, saving, onContinuar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Nota Fiscal (XML da NF-e, PDF ou imagem)" hint="XML é o mais preciso. Até 10 MB.">
        <AttachmentInput files={nfFile ? [nfFile] : []} onFiles={onNfFiles} accept=".xml,.pdf,image/*" existingUrl={existingUrl} />
      </Field>

      {extraindo && (
        <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-control)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--valois-blue)' }}>⏳ Lendo a nota fiscal…</div>
          <Skeleton width="45%" height={12} /><Skeleton width="70%" height={12} /><Skeleton width="60%" height={12} />
        </div>
      )}

      {extraiu && !extraindo && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Número da NF" required>
            <input value={numNf} inputMode="numeric" onChange={e => setNumNf(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 12345" style={inputStyle} />
          </Field>
          <Field label="Valor total da NF" required
            error={!(Number(valor) > 0) ? 'Informe o valor' : undefined}>
            <input value={valor} inputMode="decimal" onChange={e => setValor(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0,00"
              style={{ ...inputStyle, borderColor: valorIncerto ? 'var(--warning)' : undefined, fontWeight: 700 }} />
          </Field>
        </div>
        {valorIncerto && <FormAlert tipo="aviso">⚠️ Extração incerta — não achei o rótulo <b>VALOR TOTAL DA NOTA</b>, usei o maior valor do documento. Confira antes de continuar.</FormAlert>}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Itens da nota <Badge variant="info" style={{ marginLeft: 4 }}>salvos no pedido</Badge></span>
            <button type="button" onClick={addItem} style={{ ...btnSmall, fontSize: 12, height: 28 }}>+ Item</button>
          </div>
          {itens.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 2px' }}>Nenhum item lido — adicione manualmente se precisar (o valor da cobrança usa o total da NF acima).</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {itens.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 74px 26px', gap: 6, alignItems: 'center' }}>
                <input value={it.nome_produto} onChange={e => updItem(i, 'nome_produto', e.target.value)} placeholder="Produto" style={{ ...inputStyle, height: 34, fontSize: 12.5 }} />
                <input value={it.quantidade} onChange={e => updItem(i, 'quantidade', e.target.value)} placeholder="Qtd" inputMode="decimal" style={{ ...inputStyle, height: 34, fontSize: 12.5, textAlign: 'center', padding: '0 6px' }} />
                <input value={it.preco_unitario} onChange={e => updItem(i, 'preco_unitario', e.target.value)} placeholder="Unit." inputMode="decimal" style={{ ...inputStyle, height: 34, fontSize: 12.5, textAlign: 'right', padding: '0 8px' }} />
                <button type="button" onClick={() => removeItem(i)} aria-label="Remover item" style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {erro && <FormAlert tipo="erro">{erro}</FormAlert>}

      <button onClick={onContinuar} disabled={!podeContinuar || saving}
        style={{ ...ctaBase, background: 'var(--valois-blue)', opacity: (!podeContinuar || saving) ? 0.5 : 1, cursor: (!podeContinuar || saving) ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Salvando…' : 'Continuar →'}
      </button>
    </div>
  )
}

// ─── STEP 2 — Boleto ───
function Step2({ numNf, nfUrl, valor, forma, setForma, venc, setVenc, editarPrazo, setEditarPrazo, ehBoleto, boletoFile, setBoletoFile, existingBoleto, erro, saving, onVoltar, onFinalizar }) {
  const [hover, setHover] = useState(false)
  const podeFinalizar = !ehBoleto || !!boletoFile || !!existingBoleto
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status: NF verde, boleto pendente */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, background: 'var(--valois-green-soft)', border: '1px solid #CDEBA6', borderRadius: 'var(--radius-control)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge variant="success">✓ NF</Badge>
            {nfUrl && <a href={nfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--valois-blue)' }}>abrir ↗</a>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>Nº {numNf || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtMoney(valor)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)', padding: '10px 12px' }}>
          <Badge variant="neutral">● Boleto</Badge>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 6 }}>Pendente</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>anexe abaixo</div>
        </div>
      </div>

      {/* Prazo + vencimento (auto, com opção discreta de alterar) */}
      <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-control)', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Prazo (da criação do pedido)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{FORMAS_PAGAMENTO_PEDIDO.find(f => f.v === forma)?.l || forma}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Vencimento</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{venc ? venc.split('-').reverse().join('/') : '—'}</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditarPrazo(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--valois-blue)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: '6px 0 0', fontFamily: 'inherit' }}>
          {editarPrazo ? 'ocultar' : 'alterar prazo / vencimento'}
        </button>
        {editarPrazo && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Forma">
              <select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {FORMAS_PAGAMENTO_PEDIDO.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </Field>
            <Field label="Vencimento">
              <input type="date" value={venc} onChange={e => setVenc(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        )}
      </div>

      <Field label={ehBoleto ? 'PDF do boleto' : 'PDF do boleto (opcional para esta forma)'} required={ehBoleto}>
        <AttachmentInput files={boletoFile ? [boletoFile] : []} onFiles={f => setBoletoFile(f[0] || null)} accept=".pdf" existingUrl={existingBoleto} />
      </Field>

      {erro && <FormAlert tipo="erro">{erro}</FormAlert>}

      {/* CTA verde grande estilo checkout */}
      <button onClick={onFinalizar} disabled={!podeFinalizar || saving}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...ctaBase, height: 54, fontSize: 16, background: (!podeFinalizar || saving) ? '#9CE3C4' : (hover ? VERDE_CTA_HOVER : VERDE_CTA), boxShadow: (!podeFinalizar || saving) ? 'none' : '0 8px 20px rgba(16,185,129,0.32)', cursor: (!podeFinalizar || saving) ? 'not-allowed' : 'pointer', transition: 'all .18s' }}>
        {saving ? 'Gerando cobrança…' : (<><span style={{ fontSize: 18 }}>✓</span>{ehBoleto ? 'Anexar boleto e gerar cobrança' : 'Gerar cobrança e finalizar'}</>)}
      </button>
      <button onClick={onVoltar} disabled={saving} style={{ ...btnSmall, alignSelf: 'center', height: 34, background: 'transparent' }}>← voltar para a NF</button>
    </div>
  )
}

// ─── STEP 3 — Venda concluída ───
function Step3({ user, valorVenda, onClose }) {
  const [meta, setMeta] = useState(null)
  const [totalHoje, setTotalHoje] = useState(null)
  const [display, setDisplay] = useState(0)
  const [coins, setCoins] = useState([])
  const primeiro = (user?.nome || '').split(' ')[0] || 'você'

  useEffect(() => {
    let vivo = true
    Promise.all([fetchMetaDiaria(), fetchTotalVendidoHoje()]).then(([m, t]) => {
      if (!vivo) return
      setMeta(m); setTotalHoje(t)
      const base = Math.max(0, t - valorVenda)
      const reduz = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduz) { setDisplay(t); return }
      // moedas + contagem crescente (~1.8s)
      setCoins(Array.from({ length: 14 }, (_, i) => ({ id: i, dx: `${Math.round((Math.random() - 0.5) * 220)}px`, dy: `${40 + Math.random() * 30}px`, delay: (Math.random() * 0.5).toFixed(2), dur: (1.1 + Math.random() * 0.7).toFixed(2) })))
      const t0 = performance.now(), durMs = 1800
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / durMs)
        const eased = 1 - Math.pow(1 - p, 3)
        if (vivo) setDisplay(base + (t - base) * eased)
        if (p < 1 && vivo) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return () => { vivo = false }
  }, [valorVenda])

  const carregando = meta == null || totalHoje == null
  const pct = !carregando && meta > 0 ? Math.min((totalHoje / meta) * 100, 100) : 0
  const atingiu = !carregando && totalHoje >= meta
  const falta = carregando ? 0 : Math.max(0, meta - totalHoje)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'center', padding: '4px 2px 2px' }}>
      <div>
        <div style={{ fontSize: 46, lineHeight: 1 }}>🎉</div>
        <h2 style={{ margin: '10px 0 2px', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Venda concluída!</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Obrigado, <b style={{ color: 'var(--text-primary)' }}>{primeiro}</b> — cobrança gerada com sucesso.</p>
        <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: VERDE_CTA_HOVER }}>+ {fmtMoney(valorVenda)}</div>
      </div>

      <div style={{ position: 'relative', background: 'var(--background)', borderRadius: 14, padding: '16px 18px' }}>
        {/* moedas caindo na barra */}
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60, pointerEvents: 'none', overflow: 'visible' }}>
          {coins.map(c => (
            <span key={c.id} className="valois-coin" style={{ position: 'absolute', left: '50%', top: 8, fontSize: 18, '--dx': c.dx, '--dy': c.dy, animation: `valoisCoin ${c.dur}s ${c.delay}s ease-in forwards` }}>🪙</span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>🎯 Meta diária</span>
          {!carregando && <span style={{ fontSize: 12, fontWeight: 800, color: atingiu ? VERDE_CTA_HOVER : 'var(--valois-blue)' }}>{Math.round(pct)}%</span>}
        </div>
        {carregando ? <Skeleton height={16} radius={999} /> : (
          <Progress value={pct} height={16} color={atingiu ? 'var(--valois-green)' : 'var(--valois-blue)'} />
        )}
        {!carregando && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmtMoney(display)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>meta {fmtMoney(meta)}</span>
          </div>
        )}
        {!carregando && (atingiu
          ? <div style={{ fontSize: 12.5, color: VERDE_CTA_HOVER, fontWeight: 700, marginTop: 8 }}>🏆 Meta diária batida! Bora pra próxima.</div>
          : <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Faltam {fmtMoney(falta)} para a meta de hoje</div>)}
      </div>

      <button onClick={onClose} style={{ ...ctaBase, background: 'var(--valois-blue)' }}>Fechar</button>
    </div>
  )
}

const ctaBase = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  height: 48, border: 'none', borderRadius: 'var(--radius-control)', color: '#fff',
  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
}
