import { useState } from 'react'
import { btnSmall, card } from './db.js'
import { cancelarRota } from './roteiro-db.js'

// Modal de confirmação dupla para cancelar uma rota.
// Etapa 1: aviso com lista de efeitos + botão "Sim, quero cancelar".
// Etapa 2: confirmação final em vermelho para evitar clique acidental.
export function CancelarRotaModal({ rota, usuario, onClose, onConfirmed }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const confirmar = async () => {
    setSaving(true)
    const ok = await cancelarRota(rota.id, usuario)
    setSaving(false)
    if (ok) { onConfirmed?.(); onClose() }
    else alert('Não foi possível cancelar a rota. Tente novamente.')
  }

  const numero = rota.numero_roteiro || rota.id?.slice(0, 6)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, maxWidth: 440, width: '100%', padding: 24, margin: 0 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>
          🗑️ Cancelar rota {numero}?
        </h3>
        <div style={{ fontSize: 13, color: '#334155', marginBottom: 16, lineHeight: 1.55 }}>
          Tem certeza que deseja cancelar esta rota?
          <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
            <li>A rota será marcada como <b>CANCELADA</b></li>
            <li>Os pedidos vinculados voltam para status <b>NF_EMITIDA</b></li>
            <li>O motorista será notificado</li>
          </ul>
        </div>
        {step === 1 ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...btnSmall, fontSize: 12 }}>Voltar</button>
            <button onClick={() => setStep(2)} style={{ ...btnSmall, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 12, fontWeight: 700 }}>Sim, quero cancelar</button>
          </div>
        ) : (
          <div>
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', marginBottom: 12, fontWeight: 600 }}>
              ⚠️ Esta ação é definitiva. Confirme para prosseguir.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={saving} style={{ ...btnSmall, fontSize: 12 }}>Voltar</button>
              <button onClick={confirmar} disabled={saving} style={{ ...btnSmall, background: '#EF4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Cancelando...' : '✓ Confirmar cancelamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
