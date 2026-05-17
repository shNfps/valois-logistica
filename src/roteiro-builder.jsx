import { useState, useEffect } from 'react'
import { inputStyle, btnPrimary, btnSmall, card, addHistorico, updatePedido, addRotaPedidos } from './db.js'
import { fetchMotoristas, fetchUltimoRoteiroDoMotorista, gerarNumeroRoteiro, createRoteiro, updateRoteiro, enriquecerComEnderecos, VEICULOS_ROTEIRO } from './roteiro-db.js'
import { criarNotificacao } from './notificacoes.js'
import { gerarRoteiroPdf } from './roteiro-pdf.js'
import { PassoSelecionarPedidos, PassoConfirmacao } from './roteiro-passos.jsx'

const stepBadge = (n, active, done) => ({
  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
  background: done ? '#10B981' : active ? '#0A1628' : '#E2E8F0',
  color: done || active ? '#fff' : '#94A3B8'
})

function Stepper({ step }) {
  const steps = ['Dados básicos', 'Selecionar pedidos', 'Confirmação']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const n = i + 1
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={stepBadge(n, step === n, step > n)}>{step > n ? '✓' : n}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: step >= n ? '#0A1628' : '#94A3B8' }}>{s}</span>
            {i < 2 && <span style={{ color: '#CBD5E1', margin: '0 4px' }}>›</span>}
          </div>
        )
      })}
    </div>
  )
}

function Passo1({ form, setForm, motoristas, onProximo }) {
  const onMotoristaChange = async (nome) => {
    setForm(f => ({ ...f, motorista: nome }))
    if (!nome) return
    const last = await fetchUltimoRoteiroDoMotorista(nome)
    if (last) setForm(f => ({ ...f, placa: f.placa || last.placa || '', veiculo: f.veiculo || last.veiculo || '' }))
  }
  const proximo = () => {
    if (!form.data) return alert('Informe a data')
    if (!form.motorista) return alert('Selecione o motorista')
    if (!form.veiculo) return alert('Selecione o veículo')
    onProximo()
  }
  return (
    <div style={{ ...card, padding: 22 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0A1628' }}>1. Dados básicos</h4>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Data do roteiro</label>
      <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={{ ...inputStyle, marginBottom: 14 }} />
      <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Motorista</label>
      <select value={form.motorista} onChange={e => onMotoristaChange(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer' }}>
        <option value="">Selecione...</option>
        {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
      </select>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Veículo</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {VEICULOS_ROTEIRO.map(v => {
          const active = form.veiculo === v.key
          return <button key={v.key} type="button" onClick={() => setForm(f => ({ ...f, veiculo: v.key }))}
            style={{ padding: '8px 14px', borderRadius: 10, border: `2px solid ${active ? '#3B82F6' : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', color: active ? '#1D4ED8' : '#64748B', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {v.icon} {v.label}
          </button>
        })}
      </div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Placa</label>
      <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase().slice(0, 8) }))} placeholder="ABC1D23" style={{ ...inputStyle, marginBottom: 18 }} />
      <button onClick={proximo} style={{ ...btnPrimary, width: '100%' }}>Próximo →</button>
    </div>
  )
}

export function RoteiroBuilder({ pedidos, user, onClose, onConcluido }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ data: hoje, motorista: '', veiculo: '', placa: '' })
  const [motoristas, setMotoristas] = useState([])
  const [selecionados, setSelecionados] = useState([]) // [pedidoId,...] na ordem
  const [otimizado, setOtimizado] = useState({ distanciaKm: 0, duracaoMin: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchMotoristas().then(setMotoristas) }, [])

  const disponiveis = pedidos.filter(p => p.status === 'NF_EMITIDA')

  const salvar = async ({ status, baixarPdf }) => {
    if (selecionados.length === 0) return alert('Selecione ao menos 1 pedido')
    setSaving(true)
    const numero = await gerarNumeroRoteiro(form.data)
    const pedidosOrdenados = selecionados.map(id => pedidos.find(p => p.id === id)).filter(Boolean)
    const cidadesArr = [...new Set(pedidosOrdenados.map(p => p.cidade).filter(Boolean))]
    const payload = {
      motorista_nome: form.motorista, cidade: cidadesArr[0] || '', cidades: cidadesArr, veiculo: form.veiculo,
      status, placa: form.placa || null, numero_roteiro: numero, data_roteiro: form.data,
      distancia_km: otimizado.distanciaKm || null, duracao_min: otimizado.duracaoMin || null,
      ordem_pedidos: selecionados, criado_por: user.nome
    }
    const rota = await createRoteiro(payload)
    if (!rota) { setSaving(false); return alert('Erro ao salvar roteiro') }
    if (status !== 'rascunho') {
      await addRotaPedidos(rota.id, selecionados)
      for (const p of pedidosOrdenados) {
        await updatePedido(p.id, { status: 'EM_ROTA', entregue_por: form.motorista })
        await addHistorico(p.id, user.nome, `Incluído no roteiro ${numero} (motorista ${form.motorista})`)
      }
      await criarNotificacao('motorista', `🚛 Novo roteiro ${numero}`,
        `${pedidosOrdenados.length} entregas · ${cidadesArr.join(', ')} · ${form.motorista}`, null)
    }
    if (baixarPdf) {
      const enriquecidos = await enriquecerComEnderecos(pedidosOrdenados)
      gerarRoteiroPdf({ roteiro: rota, pedidos: enriquecidos, criadoPor: user.nome })
      await updateRoteiro(rota.id, { pdf_url: `${numero}.pdf` })
    }
    setSaving(false); onConcluido?.(rota); onClose()
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#0A1628' }}>🗺️ Montar Roteiro de Entrega</h3>
      <Stepper step={step} />
      {step === 1 && <Passo1 form={form} setForm={setForm} motoristas={motoristas} onProximo={() => setStep(2)} />}
      {step === 2 && <PassoSelecionarPedidos
        pedidos={disponiveis} selecionados={selecionados} setSelecionados={setSelecionados}
        onOtimizado={setOtimizado} onVoltar={() => setStep(1)} onProximo={() => setStep(3)} />}
      {step === 3 && <PassoConfirmacao
        form={form} selecionados={selecionados} pedidos={pedidos} otimizado={otimizado}
        saving={saving} onVoltar={() => setStep(2)}
        onSalvarRascunho={() => salvar({ status: 'rascunho', baixarPdf: false })}
        onGerarPdf={() => salvar({ status: 'ativa', baixarPdf: true })}
        onConfirmarRota={() => salvar({ status: 'ativa', baixarPdf: true })} />}
    </div>
  )
}
