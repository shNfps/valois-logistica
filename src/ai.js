const API = 'https://api.anthropic.com/v1/messages'

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

async function callClaude(pdfUrl, prompt, model = 'claude-sonnet-4-20250514', maxTokens = 2048) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Configure VITE_ANTHROPIC_API_KEY no arquivo .env')
  const resp = await fetch(pdfUrl)
  if (!resp.ok) throw new Error('Não foi possível baixar o PDF')
  const base64 = await blobToBase64(await resp.blob())
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }, { type: 'text', text: prompt }] }] })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.error?.message || `Erro ${res.status}`)
    e.status = res.status
    throw e
  }
  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('IA não retornou JSON válido')
  return JSON.parse(match[0])
}

export function extractItemsFromPdf(pdfUrl) {
  return callClaude(
    pdfUrl,
    'Extraia todos os itens/produtos deste orçamento. Retorne APENAS um JSON array com os campos: codigo (string, código do produto como "1.842" ou "3.036" — null se não encontrado), nome_produto (string), quantidade (número), unidade (string, ex: "un","cx","kg","L"), preco_unitario (número), preco_total (número), tem_imagem (boolean, true se houver foto ou imagem do produto visível no PDF próxima a este item). Sem texto adicional.',
    'claude-sonnet-4-20250514',
    2048
  )
}

// Extração leve: apenas código + nome, para reprocessamento em massa.
// Usa Haiku (mais rápido e barato) pois a tarefa é simples.
export function extractCodesFromPdf(pdfUrl) {
  return callClaude(
    pdfUrl,
    'Extraia apenas o código e o nome de cada produto deste orçamento. Retorne APENAS um JSON array: [{"codigo":"1234","nome_produto":"Nome do produto"}]. Use null para codigo se não houver. Sem texto adicional.',
    'claude-haiku-4-5-20251001',
    1024
  )
}

// Extração rápida de itens a partir da NF para o lote.
// Usa Haiku + prompt mínimo + max_tokens reduzido para minimizar latência.
export function extractItemsFromNf(pdfUrl) {
  return callClaude(
    pdfUrl,
    'Extraia os itens deste PDF de nota fiscal. Retorne APENAS um JSON válido, sem nenhum texto adicional, no formato: [{"codigo":"123","nome_produto":"Produto X","quantidade":10,"unidade":"UN","preco_unitario":15.50,"preco_total":155.00}]\n\nREGRAS:\n- codigo: número sem pontos (ex: 1842, não 1.842); null se ausente\n- quantidade: número\n- preco_unitario: número decimal\n- preco_total: número decimal (quantidade × preço unitário)\n- Sem texto antes ou depois do JSON',
    'claude-haiku-4-5-20251001',
    4000
  )
}
