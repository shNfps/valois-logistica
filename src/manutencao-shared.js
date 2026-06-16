// Constantes e helpers compartilhados do módulo de Manutenção.
// Centralizado para manter os arquivos de UI enxutos e o visual consistente.

export const OS_TIPO_ICON = { instalacao: '🔧', manutencao: '⚙️', troca: '🔄', desinstalacao: '❌' }
export const OS_TIPO_LABEL = { instalacao: 'Instalação', manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação' }
export const TIPO_BORDER = { instalacao: '#10B981', manutencao: '#F97316', troca: '#3B82F6', desinstalacao: '#64748B' }
export const PERIODO_LABEL = { manha: '☀️ Manhã', tarde: '🌅 Tarde', dia_todo: '📅 Dia todo' }
export const PERIODO_SHORT = { manha: 'Manhã', tarde: 'Tarde', dia_todo: 'Dia todo' }

export const STATUS_COLORS = {
  ABERTA: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  ATRASADA: { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
  ACEITA: { bg: '#E0E7FF', color: '#4338CA', border: '#C7D2FE' },
  EM_ANDAMENTO: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  CONCLUIDA: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  CANCELADA: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
  AGENDADA: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' } // legado (OS antigas)
}
export const STATUS_LABEL = {
  ABERTA: 'ABERTA', ATRASADA: 'ATRASADA', ACEITA: 'ACEITA',
  EM_ANDAMENTO: 'ANDAMENTO', CONCLUIDA: 'CONCLUÍDA', CANCELADA: 'CANCELADA', AGENDADA: 'AGENDADA'
}

export function statusColor(os) { return STATUS_COLORS[statusEfetivo(os)] || STATUS_COLORS.ABERTA }
export function statusLabel(os) { const s = statusEfetivo(os); return STATUS_LABEL[s] || s }

// OS ABERTA cujo prazo de aceite (24h) já passou é tratada como ATRASADA.
export function isVencida(os) {
  return os.status === 'ABERTA' && os.prazo_aceite && new Date(os.prazo_aceite) < new Date()
}
// Status efetivo para exibição (resolve ABERTA vencida -> ATRASADA).
export function statusEfetivo(os) {
  return isVencida(os) ? 'ATRASADA' : os.status
}

// Contador regressivo até o prazo de aceite. alerta=true quando faltam < 3h.
export function formatCountdown(prazo) {
  if (!prazo) return null
  const diff = new Date(prazo) - new Date()
  if (diff <= 0) return { texto: 'Prazo vencido', vencido: true, alerta: true }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return { texto: `${h}h ${m}min`, vencido: false, alerta: diff < 3 * 3600000 }
}

// Chave de data local YYYY-MM-DD (evita deslocamento de fuso do toISOString).
export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatData(d) {
  if (!d) return null
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')
}
