import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchComTimeout, NF_OCR_MODEL, NF_OCR_TIMEOUT_MS } from './ai.js'

test('OCR da NF usa Haiku e timeout de segurança', () => {
  assert.match(NF_OCR_MODEL, /haiku/i)
  assert.equal(NF_OCR_TIMEOUT_MS, 30_000)
})

test('fetchComTimeout aborta uma chamada de IA que não responde', async () => {
  let signalRecebido
  const fetchPendente = (_url, options) => {
    signalRecebido = options.signal
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Abortado', 'AbortError')))
    })
  }

  await assert.rejects(
    fetchComTimeout('https://api.invalid', {}, 10, fetchPendente),
    erro => erro?.code === 'NF_OCR_TIMEOUT'
  )
  assert.equal(signalRecebido.aborted, true)
})
