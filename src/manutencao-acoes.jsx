import { useState } from 'react'
import { aceitarOS, iniciarOS, concluirOS, cancelarOS, updateOrdemServico } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'
import { AceitarModal, ConcluirModal, ReagendarModal, CancelarModal } from './manutencao-modals.jsx'
import { OSDetalhePanel } from './manutencao-agenda-panel.jsx'
import { formatData } from './manutencao-shared.js'

// Hook reutilizável com toda a máquina de ações de uma OS (aceitar/iniciar/concluir/
// cancelar/reagendar/observar) + o painel lateral e os modais. Usado pela Agenda e
// pela aba "Manutenções" para evitar duplicação.
export function useOSManager(user, reload) {
  const [selected, setSelected] = useState(null)
  const [aceitando, setAceitando] = useState(null)
  const [concluindo, setConcluindo] = useState(null)
  const [reagendando, setReagendando] = useState(null)
  const [cancelando, setCancelando] = useState(null)

  const sync = (osId, patch) => setSelected(p => (p && p.id === osId ? { ...p, ...patch } : p))

  const handleAceitar = async (osId, data, periodo) => {
    await aceitarOS(osId, user.nome, data, periodo)
    const os = aceitando
    if (os) await criarNotificacao(os.solicitante_nome, `✅ Sua OS ${os.numero_os} foi aceita`, `Aceita por ${user.nome} e agendada para ${formatData(data)}`)
    setAceitando(null); setSelected(null); reload()
  }
  const handleIniciar = async (os) => {
    await iniciarOS(os.id, user.nome)
    await criarNotificacao(os.solicitante_nome, `⚙️ OS ${os.numero_os} iniciada`, `Técnico ${user.nome} iniciou o serviço em ${os.cliente_nome}`)
    sync(os.id, { status: 'EM_ANDAMENTO', tecnico_nome: user.nome }); reload()
  }
  const handleConcluir = async (osId, obs, fotoUrl, eqId) => {
    await concluirOS(osId, obs, fotoUrl, eqId)
    const os = concluindo
    if (os) {
      await criarNotificacao(os.solicitante_nome, `✅ Serviço concluído em ${os.cliente_nome}`, `OS ${os.numero_os} finalizada por ${user.nome}`)
      await criarNotificacao('admin', `✅ OS ${os.numero_os} concluída`, `${os.cliente_nome} · ${user.nome}`)
    }
    setConcluindo(null); setSelected(null); reload()
  }
  const handleReagendar = async (osId, novaData, motivo) => {
    const os = reagendando
    await updateOrdemServico(osId, { data_agendada: novaData, tecnico_nome: user.nome })
    if (os) await criarNotificacao(os.solicitante_nome, `📅 OS ${os.numero_os} reagendada`, `Nova data: ${formatData(novaData)} · Motivo: ${motivo} · Técnico: ${user.nome}`)
    setReagendando(null); setSelected(null); reload()
  }
  const handleCancelar = async (osId, motivo) => {
    const os = cancelando
    await cancelarOS(osId, motivo)
    if (os) await criarNotificacao(os.solicitante_nome, `❌ OS ${os.numero_os} cancelada`, `Motivo: ${motivo} · Técnico: ${user.nome}`)
    setCancelando(null); setSelected(null); reload()
  }
  const handleObs = async (os, texto) => {
    const prev = os.observacao_conclusao || ''
    const nova = prev ? `${prev}\n[${user.nome}] ${texto}` : `[${user.nome}] ${texto}`
    await updateOrdemServico(os.id, { observacao_conclusao: nova })
    sync(os.id, { observacao_conclusao: nova }); reload()
  }

  const overlays = (
    <>
      {selected && <OSDetalhePanel os={selected} user={user} onClose={() => setSelected(null)}
        onAceitar={o => setAceitando(o)} onIniciar={handleIniciar} onConcluir={o => setConcluindo(o)}
        onReagendar={o => setReagendando(o)} onCancelar={o => setCancelando(o)} onObs={handleObs} />}
      {aceitando && <AceitarModal os={aceitando} onClose={() => setAceitando(null)} onConfirm={handleAceitar} />}
      {concluindo && <ConcluirModal os={concluindo} onClose={() => setConcluindo(null)} onConfirm={handleConcluir} />}
      {reagendando && <ReagendarModal os={reagendando} onClose={() => setReagendando(null)} onConfirm={handleReagendar} />}
      {cancelando && <CancelarModal os={cancelando} onClose={() => setCancelando(null)} onConfirm={handleCancelar} />}
    </>
  )

  return { selected, setSelected, openAceitar: o => setAceitando(o), overlays }
}
