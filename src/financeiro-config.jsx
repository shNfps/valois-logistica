import { useState, useEffect, useCallback } from 'react'
import { fmtCnpj, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchCategoriasDespesa, createCategoriaDespesa, deleteCategoriaDespesa, fetchFornecedores, createFornecedor, updateFornecedor, deleteFornecedor, fetchConfigFinanceiro, updateConfigFinanceiro, backfillContasReceber } from './financeiro-db.js'

const TIPOS = ['fornecedor', 'salario', 'infra', 'veiculo', 'imposto', 'operacional', 'obra', 'reembolso', 'outros']

function CategoriasSection() {
  const [items, setItems] = useState([])
  const [nome, setNome] = useState(''); const [tipo, setTipo] = useState('outros')
  const [icone, setIcone] = useState('💵'); const [cor, setCor] = useState('#64748B')

  const load = useCallback(async () => setItems(await fetchCategoriasDespesa()), [])
  useEffect(() => { load() }, [load])
  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    await createCategoriaDespesa({ nome: nome.trim(), tipo, icone, cor })
    setNome(''); setIcone('💵'); setCor('#64748B'); setTipo('outros'); load()
  }
  const excluir = async (c) => { if (confirm(`Desativar "${c.nome}"?`)) { await deleteCategoriaDespesa(c.id); load() } }

  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>📂 Categorias de despesa</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 80px 100px', gap: 8, marginBottom: 12 }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <input value={icone} onChange={e => setIcone(e.target.value)} placeholder="🏷️" style={{ ...inputStyle, textAlign: 'center' }} maxLength={3} />
        <input type="color" value={cor} onChange={e => setCor(e.target.value)} style={{ ...inputStyle, padding: 4, cursor: 'pointer' }} />
        <button onClick={criar} style={{ ...btnPrimary, height: 42 }}>+ Criar</button>
      </div>
      <div style={{ background: '#F8FAFC', borderRadius: 8, overflow: 'hidden' }}>
        {items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: c.cor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{c.icone}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{c.nome}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.tipo}</div>
            </div>
            <button onClick={() => excluir(c)} style={{ ...btnSmall, color: '#B91C1C', fontSize: 11 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FornecedoresSection() {
  const [items, setItems] = useState([])
  const [nome, setNome] = useState(''); const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState(''); const [tel, setTel] = useState('')
  const [editId, setEditId] = useState(null)

  const load = useCallback(async () => setItems(await fetchFornecedores()), [])
  useEffect(() => { load() }, [load])
  const reset = () => { setNome(''); setCnpj(''); setEmail(''); setTel(''); setEditId(null) }
  const salvar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    const payload = { nome: nome.trim(), cnpj: cnpj.replace(/\D/g, '') || null, email: email.trim() || null, telefone: tel.trim() || null }
    if (editId) await updateFornecedor(editId, payload)
    else await createFornecedor(payload)
    reset(); load()
  }
  const editar = (f) => { setEditId(f.id); setNome(f.nome); setCnpj(f.cnpj || ''); setEmail(f.email || ''); setTel(f.telefone || '') }
  const excluir = async (f) => { if (confirm(`Desativar "${f.nome}"?`)) { await deleteFornecedor(f.id); load() } }

  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>🏢 Fornecedores recorrentes</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr 130px 110px', gap: 8, marginBottom: 12 }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
        <input value={fmtCnpj(cnpj)} onChange={e => setCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="CNPJ" style={inputStyle} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
        <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Telefone" style={inputStyle} />
        <button onClick={salvar} style={{ ...btnPrimary, height: 42 }}>{editId ? 'Salvar' : '+ Criar'}</button>
      </div>
      {editId && <button onClick={reset} style={{ ...btnSmall, fontSize: 11, marginBottom: 12 }}>Cancelar edição</button>}
      <div style={{ background: '#F8FAFC', borderRadius: 8, overflow: 'hidden' }}>
        {items.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Nenhum fornecedor</div>}
        {items.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{f.nome}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.cnpj ? fmtCnpj(f.cnpj) : ''} {f.email && `· ${f.email}`} {f.telefone && `· ${f.telefone}`}</div>
            </div>
            <button onClick={() => editar(f)} style={{ ...btnSmall, fontSize: 11 }}>✏️</button>
            <button onClick={() => excluir(f)} style={{ ...btnSmall, color: '#B91C1C', fontSize: 11 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertasSection() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetchConfigFinanceiro().then(setCfg) }, [])
  if (!cfg) return null
  const salvar = async () => { setSaving(true); await updateConfigFinanceiro(cfg); setSaving(false); alert('Configurações salvas') }
  const upd = (k, v) => setCfg(c => ({ ...c, [k]: v }))
  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>🔔 Alertas automáticos</h4>
      <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Avisar X dias antes do vencimento</label>
      <input type="number" min="1" max="30" value={cfg.dias_alerta_vencimento} onChange={e => upd('dias_alerta_vencimento', Number(e.target.value))} style={{ ...inputStyle, width: 120, marginBottom: 10 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={cfg.alertar_inadimplencia} onChange={e => upd('alertar_inadimplencia', e.target.checked)} />
        <span style={{ fontSize: 13 }}>Notificar comercial sobre clientes inadimplentes</span>
      </label>

      <h4 style={{ margin: '16px 0 12px', fontSize: 14, color: '#0A1628' }}>📊 DRE — taxas e visão</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#64748B' }}>Impostos sobre venda (%)</label>
          <input type="number" step="0.5" min="0" max="50" value={cfg.taxa_imposto_venda ?? 12} onChange={e => upd('taxa_imposto_venda', Number(e.target.value))} style={inputStyle} />
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>ICMS, PIS, COFINS</div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#64748B' }}>Impostos sobre lucro (%)</label>
          <input type="number" step="0.5" min="0" max="50" value={cfg.taxa_imposto_lucro ?? 6} onChange={e => upd('taxa_imposto_lucro', Number(e.target.value))} style={inputStyle} />
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Simples Nacional</div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#64748B' }}>Comissão (%)</label>
          <input type="number" step="0.5" min="0" max="20" value={cfg.taxa_comissao ?? 5} onChange={e => upd('taxa_comissao', Number(e.target.value))} style={inputStyle} />
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Sobre receita bruta</div>
        </div>
      </div>
      <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>Visão do DRE</label>
      <select value={cfg.dre_visao || 'completo'} onChange={e => upd('dre_visao', e.target.value)} style={{ ...inputStyle, width: 220, marginBottom: 10, cursor: 'pointer' }}>
        <option value="completo">Completo (com cascata)</option>
        <option value="simplificado">Simplificado</option>
      </select>
      <div style={{ fontSize: 11, color: '#0EA5E9', marginBottom: 14 }}>💡 Cadastre o custo dos produtos em <b>Admin → Produtos</b> para o CMV calcular corretamente.</div>

      <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
    </div>
  )
}

// Backfill: cria contas a receber de pedidos antigos com NF sem cobrança.
// Simule antes (dry-run) e execute; idempotente (não duplica ao rodar de novo).
function BackfillSection() {
  const [rel, setRel] = useState(null)
  const [rodando, setRodando] = useState(false)
  const [modo, setModo] = useState('')
  const rodar = async (dryRun) => {
    if (!dryRun && !confirm('Executar o backfill e CRIAR as contas a receber faltantes?\n\nGrava no banco. Não duplica contas já existentes.')) return
    setRodando(true); setModo(dryRun ? 'sim' : 'exec')
    try { setRel(await backfillContasReceber({ dryRun })) }
    finally { setRodando(false) }
  }
  const motivos = rel ? Object.entries(rel.motivos || {}) : []
  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#0A1628' }}>🔄 Backfill de contas a receber (NFs antigas)</h4>
      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
        Cria cobranças para pedidos antigos com NF, valor e cliente que ainda não têm conta a receber.
        Sem data exata de boleto, o vencimento é calculado pelo prazo (marcado como automático). Idempotente.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => rodar(true)} disabled={rodando} style={{ ...btnSmall, height: 38 }}>🔍 Simular (dry-run)</button>
        <button onClick={() => rodar(false)} disabled={rodando} style={{ ...btnPrimary, height: 38 }}>▶ Executar backfill</button>
      </div>
      {rodando && <div style={{ fontSize: 13, color: '#64748B', marginTop: 12 }}>Processando...</div>}
      {rel && !rodando && (
        <div style={{ marginTop: 14, background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: rel.dryRun ? '#B45309' : '#065F46', marginBottom: 8 }}>
            {rel.dryRun ? '🔍 Simulação (nada foi gravado)' : '✅ Backfill executado'}{rel.erro ? ` · erro: ${rel.erro}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, marginBottom: 8 }}>
            <span>Analisados: <b>{rel.analisados}</b></span>
            <span style={{ color: '#059669' }}>{rel.dryRun ? 'A criar' : 'Criadas'}: <b>{rel.criados}</b></span>
            {rel.atualizados > 0 && <span style={{ color: '#1D4ED8' }}>Atualizadas: <b>{rel.atualizados}</b></span>}
            <span style={{ color: '#94A3B8' }}>Ignorados: <b>{rel.ignorados}</b></span>
          </div>
          {motivos.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748B' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Motivos dos ignorados:</div>
              {motivos.map(([m, n]) => <div key={m} style={{ paddingLeft: 8 }}>• {m}: <b>{n}</b></div>)}
            </div>
          )}
          {rel.pendentesCorrecao?.length > 0 && (
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 8, background: '#FEF3C7', borderRadius: 8, padding: '8px 10px' }}>
              <b>Pendentes de correção manual (sem vencimento):</b>
              {rel.pendentesCorrecao.slice(0, 20).map((p, i) => <div key={i}>#{p.ref} · {p.cliente} · NF {p.nf || '—'}</div>)}
              {rel.pendentesCorrecao.length > 20 && <div>… +{rel.pendentesCorrecao.length - 20}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ConfiguracoesTab() {
  return (
    <div>
      <AlertasSection />
      <BackfillSection />
      <CategoriasSection />
      <FornecedoresSection />
    </div>
  )
}
