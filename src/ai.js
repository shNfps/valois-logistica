const API = 'https://api.anthropic.com/v1/messages'

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

export async function extractItemsFromPdf(pdfUrl) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Configure VITE_ANTHROPIC_API_KEY no arquivo .env')
  const resp = await fetch(pdfUrl)
  if (!resp.ok) throw new Error('Não foi possível baixar o PDF do orçamento')
  const base64 = await blobToBase64(await resp.blob())
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extraia todos os itens/produtos deste orçamento. Retorne APENAS um JSON array com os campos: nome_produto (string), quantidade (número), unidade (string, ex: "un","cx","kg","L"), preco_unitario (número), preco_total (número). Sem texto adicional.' }
        ]
      }]
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ${res.status} na API do Claude`)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('IA não retornou uma lista de itens válida')
  return JSON.parse(match[0])
}
