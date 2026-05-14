import { useState, useEffect, useRef } from 'react'
import { inputStyle, btnPrimary, btnSmall, card, fmtMoney, fmt } from './db.js'
import { filtrarPedidosPorPeriodo, executarLote, salvarLogLote, fetchLogsLote, marcarJaProcessados } from './batch-extractor-logic.js'
import { FailedListModal } from './batch-failed-list.jsx'

const PERIODOS = [{ key: 'hoje', label: 'Apenas pedidos de hoje' }, { key: 'semana', label: 'Pedidos da semana atual' }, { key: 'mes', label: 'Pedidos do m\u00eas' }, { key: 'pendentes', label: 'Todos os pedidos pendentes (sem itens)' }, { key: 'custom', label: 'Selecionar per\u00edodo personalizado' }]

function PeriodoModal({ pedidos, modo, onClose, onStart }) {
  const [periodo, setPeriodo] = useState('hoje')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [jaProcessadosSet, setJaProcessadosSet] = useState(null)
  useEffect(() => {
    marcarJaProcessados(pedidos.map(p => p.id)).then(setJaProcessadosSet).catch(() => setJaProcessadosSet(new Set()))
  }, [pedidos])
  const customRange = periodo === 'custom' && dateFrom && dateTo ? [dateFrom, dateTo] : null
  const filtered = filtrarPedidosPorPeriodo(pedidos, periodo, customRange)
  const pendentes = jaProcessadosSet ? filtered.filter(p => !jaProcessadosSet.has(p.id)) : filtered
  const loading = jaProcessadosSet === null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, maxWidth: 460, width: '100%', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quais pedidos processar?</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>{'\u2715'}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {PERIODOS.map(p => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: periodo === p.key ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${periodo === p.key ? '#BFDBFE' : '#E2E8F0'}`, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="periodo" checked={periodo === p.key} onChange={() => setPeriodo(p.key)} />
              <span style={{ fontWeight: periodo === p.key ? 600 : 400 }}>{p.label}</span>
            </label>
          ))}
        </div>
        {periodo === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
          </div>
        )}
        <div style={{ background: '#F1F5F9', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          {loading ? <span style={{ color: '#64748B' }}>Verificando pedidos j\u00e1 processados...</span> : <>
            <span style={{ fontWeight: 700, color: '#334155' }}>{pendentes.length} pedidos a extrair</span>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>{filtered.length - pendentes.length} j\u00e1 processados ser\u00e3o pulados</span>
          </>}
        </div>
        <button onClick={() => onStart(pendentes, modo)} disabled={loading || pendentes.length === 0} style={{ ...btnPrimary, width: '100%', opacity: (loading || pendentes.length === 0) ? 0.5 : 1 }}>
          {loading ? 'Carregando...' : 'Iniciar processamento'}
        </button>
      </div>
    </div>
  )
}

const STATUS_ICONS = { processing: '\u23F3', success: '\u2705', error: '\u274C', skipped: '\u23ED\uFE0F' }
const ERR_LABELS = { rate_limit: 'rate limit (429) \u2014 API saturada', pdf_fetch: 'erro ao baixar PDF', parse: 'IA retornou JSON inv\u00E1lido', other: 'outros erros' }

function formatDuration(seg) {
  if (!seg || seg < 0) return '0s'
  const s = Math.round(seg), m = Math.floor(s / 60), r = s % 60
  return s < 60 ? `${s}s` : r === 0 ? `${m}min` : `${m}min ${r}s`
}

function ProgressModal({ onClose, progressItems, stats, finished, onRetryFailed, onPause, onCancel, paused, startTime, onViewFailed }) {
  const listRef = useRef(null)
  const [, tick] = useState(0)
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight) }, [progressItems])
  useEffect(() => {
    if (finished) return
    const id = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [finished])
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const elapsedSeg = startTime ? (Date.now() - startTime) / 1000 : 0
  const avgPerItem = stats.done > 0 ? elapsedSeg / stats.done : 0
  const etaSeg = stats.done > 0 && stats.done < stats.total ? (stats.total - stats.done) * avgPerItem : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, maxWidth: 600, width: '100%', padding: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{finished ? 'Extração concluída' : 'Processando...'}</h3>
          {finished && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>{'\u2715'}</button>}
        </div>
        {!finished && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Processando {stats.done}/{stats.total} | Tempo: {formatDuration(elapsedSeg)}{stats.done > 0 && <> | ETA: ~{formatDuration(etaSeg)} | ~{Math.round(avgPerItem)}s por pedido</>}</div>
            <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(to right,#2563EB,#10B981)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 320, marginBottom: 14, border: '1px solid #E2E8F0', borderRadius: 8 }}>
          {progressItems.map((item, i) => (
            <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{STATUS_ICONS[item.status] || '\u2B1C'}</span>
              <span style={{ fontWeight: 600, color: '#0A1628', minWidth: 80 }}>NF {item.ref}</span>
              <span style={{ color: '#64748B', flex: 1 }}>({item.cliente})</span>
              {item.status === 'success' && <span style={{ color: '#059669', fontWeight: 600 }}>{item.itensCount} itens</span>}
              {item.status === 'error' && <span style={{ color: '#EF4444', fontSize: 11 }}>{item.error}</span>}
              {item.status === 'skipped' && <span style={{ color: '#94A3B8' }}>j\u00e1 processado</span>}
              {item.status === 'processing' && <span style={{ color: '#2563EB' }}>processando...</span>}
            </div>
          ))}
        </div>
        <div style={{ background: '#F1F5F9', borderRadius: 8, padding: '10px 14px', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <span>Processados: <b>{stats.done}/{stats.total}</b></span>
          <span>Sucesso: <b style={{ color: '#059669' }}>{stats.sucessos}</b></span>
          <span>Falhas: <b style={{ color: '#EF4444' }}>{stats.falhas}</b></span>
          <span>Itens: <b>{stats.totalItens}</b></span>
          {stats.totalNovos > 0 && <span>Novos produtos: <b style={{ color: '#7C3AED' }}>{stats.totalNovos}</b></span>}
        </div>
        {finished ? (
          <FinishedFooter stats={stats} onRetryFailed={onRetryFailed} onClose={onClose} onViewFailed={onViewFailed} />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onPause} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>{paused ? '\u25B6 Retomar' : '\u23F8 Pausar'}</button>
            <button onClick={onCancel} style={{ ...btnSmall, flex: 1, justifyContent: 'center', color: '#EF4444' }}>{'\u2715'} Cancelar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FinishedFooter({ stats, onRetryFailed, onClose, onViewFailed }) {
  const tempoMin = stats.tempoSeg ? (stats.tempoSeg / 60).toFixed(1) : '0'
  const errosPorTipo = stats.errosPorTipo || {}
  const tiposOrdenados = Object.entries(errosPorTipo).sort((a, b) => b[1] - a[1])
  return (
    <div>
      <div style={{ background: '#D1FAE5', borderRadius: 8, padding: '12px 14px', marginBottom: 10, fontSize: 13 }}>
        <div>{'\u2705'} <b>{stats.sucessos}</b> pedidos processados com sucesso</div>
        {stats.falhas > 0 && <div>{'\u274C'} <b>{stats.falhas}</b> pedidos com erro</div>}
        {tiposOrdenados.length > 0 && (
          <div style={{ marginLeft: 22, marginTop: 2, fontSize: 12, color: '#475569' }}>
            {tiposOrdenados.map(([tipo, n]) => <div key={tipo}>{'\u2022'} <b>{n}</b> {ERR_LABELS[tipo] || tipo}</div>)}
          </div>
        )}
        {stats.totalNovos > 0 && <div>{'\uD83D\uDCE6'} <b>{stats.totalNovos}</b> novos produtos adicionados ao cat\u00e1logo</div>}
        <div>{'\uD83D\uDCB0'} Valor total: <b>{fmtMoney(stats.totalValor)}</b></div>
        <div>{'\u23F1'} Tempo total: <b>{tempoMin} minutos</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stats.falhas > 0 && onViewFailed && <button onClick={onViewFailed} style={{ ...btnSmall, flex: 1, justifyContent: 'center', color: '#2563EB' }}>Ver lista de falhas</button>}
        {stats.falhas > 0 && <button onClick={onRetryFailed} style={{ ...btnSmall, flex: 1, justifyContent: 'center', color: '#F59E0B' }}>Tentar novamente com IA</button>}
        <button onClick={onClose} style={{ ...btnPrimary, flex: 1 }}>Fechar</button>
      </div>
    </div>
  )
}

export function BatchExtractorButtons({ pedidos, refresh, userName }) {
  const [modo, setModo] = useState(null) // 'pedidos' | 'catalogo' | 'tudo'
  const [showProgress, setShowProgress] = useState(false)
  const [progressItems, setProgressItems] = useState([])
  const [stats, setStats] = useState({ done: 0, total: 0, sucessos: 0, falhas: 0, totalItens: 0, totalNovos: 0, totalValor: 0 })
  const [finished, setFinished] = useState(false)
  const [failedPedidos, setFailedPedidos] = useState([])
  const signalRef = useRef({ paused: false, cancelled: false })
  const [paused, setPaused] = useState(false)
  const [logs, setLogs] = useState(null)
  const [showFailed, setShowFailed] = useState(false)
  const startTime = useRef(0)

  const loadLogs = async () => { setLogs(await fetchLogsLote()) }

  const handleStart = async (filtered, modoVal) => {
    setModo(null)
    setShowProgress(true)
    setProgressItems([])
    setFinished(false)
    setPaused(false)
    signalRef.current = { paused: false, cancelled: false }
    startTime.current = Date.now()
    setStats({ done: 0, total: filtered.length, sucessos: 0, falhas: 0, totalItens: 0, totalNovos: 0, totalValor: 0, errosPorTipo: {} })

    const result = await executarLote(filtered, modoVal, (ev) => {
      if (ev.type === 'skipped') setProgressItems(p => [...p, ev])
      else if (ev.type === 'processing') setProgressItems(p => [...p, ev])
      else if (ev.type === 'done') {
        setProgressItems(p => p.map(x => x.ref === ev.ref && x.status === 'processing' ? ev : x))
        setStats(s => ({ ...s, done: ev.done, sucessos: ev.status === 'success' ? s.sucessos + 1 : s.sucessos, falhas: ev.status === 'error' ? s.falhas + 1 : s.falhas, totalItens: s.totalItens + (ev.itensCount || 0), totalNovos: s.totalNovos + (ev.novosProdutos || 0), totalValor: s.totalValor + (ev.valorTotal || 0), errosPorTipo: ev.status === 'error' && ev.errorType ? { ...(s.errosPorTipo || {}), [ev.errorType]: ((s.errosPorTipo || {})[ev.errorType] || 0) + 1 } : (s.errosPorTipo || {}) }))
        // Atualização incremental: mostra valor_total na tela à medida que processa
        if (ev.status === 'success') refresh?.()
      }
    }, signalRef.current)

    const tempoSeg = Math.round((Date.now() - startTime.current) / 1000)
    setStats(s => ({ ...s, done: s.total, tempoSeg }))
    setFailedPedidos(result.erros.map(e => { const p = filtered.find(p => p.id === e.pedidoId); return p ? { ...p, _error: e.error, _errorType: e.errorType } : null }).filter(Boolean))
    setFinished(true)
    refresh?.()
    await salvarLogLote({ total_pedidos: filtered.length, sucesso: result.sucessos, falhas: result.falhas, novos_produtos: result.totalNovos, iniciado_por: userName || 'admin', concluido_em: new Date().toISOString(), detalhes: { modo: modoVal, skipped: result.skippedCount, totalItens: result.totalItens, totalValor: result.totalValor, tempoSeg, erros: result.erros.map(e => ({ ref: e.ref, error: e.error })) } })
  }

  const handlePause = () => { signalRef.current.paused = !signalRef.current.paused; if (signalRef.current._resume) signalRef.current._resume(); setPaused(p => !p) }
  const handleCancel = () => { signalRef.current.cancelled = true; setFinished(true); setStats(s => ({ ...s, tempoSeg: Math.round((Date.now() - startTime.current) / 1000) })) }

  const btnStyle = { ...btnSmall, fontSize: 12, padding: '6px 14px', fontWeight: 600 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setModo('pedidos')} style={{ ...btnStyle, color: '#7C3AED', borderColor: '#DDD6FE' }}>{'🤖'} Extrair tudo das NFs e salvar nos pedidos</button>
        <button onClick={() => setModo('catalogo')} style={{ ...btnStyle, color: '#059669', borderColor: '#A7F3D0' }}>{'📦'} Extrair das NFs e adicionar ao cat\u00e1logo</button>
        <button onClick={() => setModo('tudo')} style={{ ...btnStyle, color: '#0EA5E9', borderColor: '#BAE6FD' }}>{'⚡'} Processar NFs (pedidos + cat\u00e1logo)</button>
        <button onClick={loadLogs} style={{ ...btnStyle, color: '#64748B' }}>{'📋'} Hist\u00f3rico</button>
      </div>
      {logs && <LogsPanel logs={logs} onClose={() => setLogs(null)} />}
      {modo && <PeriodoModal pedidos={pedidos} modo={modo} onClose={() => setModo(null)} onStart={handleStart} />}
      {showProgress && <ProgressModal onClose={() => setShowProgress(false)} progressItems={progressItems} stats={stats} finished={finished} onRetryFailed={() => { setShowProgress(false); handleStart(failedPedidos, modo || 'pedidos') }} onPause={handlePause} onCancel={handleCancel} paused={paused} startTime={startTime.current} onViewFailed={() => setShowFailed(true)} />}
      {showFailed && <FailedListModal items={failedPedidos} onClose={() => setShowFailed(false)} onRetry={() => { setShowFailed(false); setShowProgress(false); handleStart(failedPedidos, modo || 'pedidos') }} onRetryOne={(p) => { setShowFailed(false); setShowProgress(false); handleStart([p], modo || 'pedidos') }} />}
    </div>
  )
}

function LogsPanel({ logs, onClose }) {
  return (
    <div style={{ ...card, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Hist\u00f3rico de extra\u00e7\u00f5es em lote</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8' }}>{'\u2715'}</button>
      </div>
      {logs.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Nenhuma extra\u00e7\u00e3o em lote realizada ainda.</div>}
      {logs.map(l => (
        <div key={l.id} style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#64748B', minWidth: 120 }}>{fmt(l.iniciado_em)}</span>
          <span style={{ fontWeight: 600 }}>{l.iniciado_por}</span>
          <span style={{ color: '#059669' }}>{'\u2705'} {l.sucesso}</span>
          {l.falhas > 0 && <span style={{ color: '#EF4444' }}>{'\u274C'} {l.falhas}</span>}
          <span style={{ color: '#64748B' }}>{l.total_pedidos} pedidos</span>
          {l.novos_produtos > 0 && <span style={{ color: '#7C3AED' }}>+{l.novos_produtos} produtos</span>}
        </div>
      ))}
    </div>
  )
}

// Mini indicador para o header
export function BatchIndicator({ done, total, visible }) {
  if (!visible) return null
  return (
    <span style={{ background: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, marginLeft: 8 }}>
      {'🤖'} Processando {done}/{total}...
    </span>
  )
}
