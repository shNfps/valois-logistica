import { supabase } from './supabase.js'

export async function criarNotificacao(setorDestino, titulo, mensagem, pedidoId = null) {
  const { error } = await supabase.from('notificacoes').insert({
    usuario_destino: setorDestino,
    setor_destino: setorDestino,
    titulo,
    mensagem,
    pedido_id: pedidoId || null
  })
  if (error) console.error('Notif error:', error)
}

export async function fetchNotificacoes(userNome, userSetor) {
  const isAdmin = userSetor === 'admin'
  let q = supabase.from('notificacoes').select('*').order('criado_em', { ascending: false }).limit(50)
  if (!isAdmin) q = q.or(`setor_destino.eq.${userSetor},usuario_destino.eq.${userNome}`)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}

export async function marcarLida(id) {
  const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
  if (error) console.error(error)
}

export async function marcarTodasLidas(userNome, userSetor) {
  const isAdmin = userSetor === 'admin'
  let q = supabase.from('notificacoes').update({ lida: true }).eq('lida', false)
  if (!isAdmin) q = q.or(`setor_destino.eq.${userSetor},usuario_destino.eq.${userNome}`)
  const { error } = await q
  if (error) console.error(error)
}
