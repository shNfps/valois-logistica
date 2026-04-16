import { supabase } from './supabase.js'

function gerarNumeroOS() {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `OS-${dd}${mm}-${rand}`
}

// ─── EQUIPAMENTOS ───
export async function fetchEquipamentos() {
  const { data, error } = await supabase.from('equipamentos').select('*').order('criado_em', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function fetchEquipamentosByCliente(clienteId) {
  const { data, error } = await supabase.from('equipamentos').select('*').eq('cliente_id', clienteId).order('tipo')
  if (error) { console.error(error); return [] }
  return data || []
}

export async function createEquipamento(eq) {
  const { data, error } = await supabase.from('equipamentos').insert(eq).select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateEquipamento(id, updates) {
  const { error } = await supabase.from('equipamentos').update(updates).eq('id', id)
  if (error) console.error(error)
}

export async function deleteEquipamento(id) {
  const { error } = await supabase.from('equipamentos').delete().eq('id', id)
  if (error) console.error(error)
}

// ─── ORDENS DE SERVIÇO ───
export async function fetchOrdensServico() {
  const { data, error } = await supabase.from('ordens_servico').select('*').order('data_agendada', { ascending: true })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function fetchOSByStatus(status) {
  const { data, error } = await supabase.from('ordens_servico').select('*').eq('status', status).order('data_agendada')
  if (error) { console.error(error); return [] }
  return data || []
}

export async function fetchOSBySolicitante(nome) {
  const { data, error } = await supabase.from('ordens_servico').select('*').eq('solicitante_nome', nome).order('criado_em', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function createOrdemServico(os) {
  const numero_os = gerarNumeroOS()
  const { data, error } = await supabase.from('ordens_servico').insert({ ...os, numero_os }).select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateOrdemServico(id, updates) {
  const { error } = await supabase.from('ordens_servico').update(updates).eq('id', id)
  if (error) console.error(error)
}

export async function iniciarOS(id, tecnicoNome) {
  await updateOrdemServico(id, { status: 'EM_ANDAMENTO', tecnico_nome: tecnicoNome })
}

export async function concluirOS(id, observacao, fotoPosterior, equipamentoId) {
  await updateOrdemServico(id, {
    status: 'CONCLUIDA',
    observacao_conclusao: observacao || null,
    foto_depois: fotoPosterior || null,
    concluido_em: new Date().toISOString()
  })
  if (equipamentoId) {
    await updateEquipamento(equipamentoId, { ultima_manutencao: new Date().toISOString().slice(0, 10) })
  }
}

export async function cancelarOS(id) {
  await updateOrdemServico(id, { status: 'CANCELADA' })
}

export async function uploadFotoManutencao(file) {
  const clean = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `manutencao/${Date.now()}_${clean}`
  const { error } = await supabase.storage.from('documentos').upload(filename, file, { contentType: file.type })
  if (error) { console.error(error); return null }
  const { data } = supabase.storage.from('documentos').getPublicUrl(filename)
  return data.publicUrl
}
