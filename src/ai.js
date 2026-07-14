const API = 'https://api.anthropic.com/v1/messages'

// IDs de modelo centralizados — quando um modelo for aposentado, troque aqui.
const MODEL_SONNET = 'claude-sonnet-4-6'        // extração pesada (detecta imagem do produto)
const MODEL_HAIKU = 'claude-haiku-4-5-20251001' // extrações leves/rápidas

export const NF_OCR_MODEL = MODEL_HAIKU
export const NF_OCR_TIMEOUT_MS = 30_000
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

// Impede que a interface fique aguardando indefinidamente uma chamada de IA.
// Exportada para permitir teste unitário sem fazer uma requisição real.
export async function fetchComTimeout(url, options = {}, timeoutMs = NF_OCR_TIMEOUT_MS, fetchFn = globalThis.fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(url, { ...options, signal: controller.signal })
  } catch (e) {
    if (controller.signal.aborted) {
      const erro = new Error(`A leitura da nota fiscal excedeu ${Math.round(timeoutMs / 1000)} segundos.`)
      erro.code = 'NF_OCR_TIMEOUT'
      throw erro
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

async function callClaude(pdfUrl, prompt, model = MODEL_SONNET, maxTokens = 2048) {
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
    'Extraia todos os itens/produtos desta nota fiscal. Retorne APENAS um JSON array com os campos: codigo (string, código do produto como "1.842" ou "3.036" — null se não encontrado), nome_produto (string), quantidade (número), unidade (string, ex: "un","cx","kg","L"), preco_unitario (número), preco_total (número), tem_imagem (boolean, true se houver foto ou imagem do produto visível no PDF próxima a este item). Sem texto adicional.',
    MODEL_SONNET,
    2048
  )
}

// Extração leve: apenas código + nome, para reprocessamento em massa.
// Usa Haiku (mais rápido e barato) pois a tarefa é simples.
export function extractCodesFromPdf(pdfUrl) {
  return callClaude(
    pdfUrl,
    'Extraia apenas o código e o nome de cada produto deste orçamento. Retorne APENAS um JSON array: [{"codigo":"1234","nome_produto":"Nome do produto"}]. Use null para codigo se não houver. Sem texto adicional.',
    MODEL_HAIKU,
    1024
  )
}

// Extração rápida de itens a partir da NF para o lote.
// Usa Haiku + prompt mínimo + max_tokens reduzido para minimizar latência.
export function extractItemsFromNf(pdfUrl) {
  return callClaude(
    pdfUrl,
    'Extraia os itens deste PDF de nota fiscal. Retorne APENAS um JSON válido, sem nenhum texto adicional, no formato: [{"codigo":"123","nome_produto":"Produto X","quantidade":10,"unidade":"UN","preco_unitario":15.50,"preco_total":155.00}]\n\nREGRAS:\n- codigo: número sem pontos (ex: 1842, não 1.842); null se ausente\n- quantidade: número\n- preco_unitario: número decimal\n- preco_total: número decimal (quantidade × preço unitário)\n- Sem texto antes ou depois do JSON',
    MODEL_HAIKU,
    4000
  )
}

// Transcrição focada do DANFE (PDF ou imagem) para o parser determinístico do
// nf-extractor.js. A IA aqui é só "OCR": não interpreta, não soma, não escolhe o
// total — quem lê o rótulo VALOR TOTAL DA NOTA / Nº é o parser puro (testável).
// Usa Haiku porque esta é uma extração leve; Sonnet fica reservado à análise pesada.
// mediaType: 'application/pdf' ou 'image/png'|'image/jpeg'.
export async function transcreverNf(url, mediaType = 'application/pdf') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Configure VITE_ANTHROPIC_API_KEY no arquivo .env')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Não foi possível baixar o arquivo da NF')
  const base64 = await blobToBase64(await resp.blob())
  const source = { type: 'base64', media_type: mediaType, data: base64 }
  const bloco = mediaType.startsWith('image/') ? { type: 'image', source } : { type: 'document', source }
  const prompt = 'Transcreva somente estas partes deste DANFE, exatamente como aparecem: ' +
    '1) número da NF junto do rótulo Nº; 2) rótulo "VALOR TOTAL DA NOTA" junto do valor; ' +
    '3) seção "DADOS DOS PRODUTOS / SERVIÇOS", preservando uma linha completa por item, com código, ' +
    'descrição, unidade, quantidade, valor unitário e valor total. NÃO interprete e NÃO calcule. ' +
    'Responda somente com essas linhas, mantendo os rótulos e a ordem original.'
  const res = await fetchComTimeout(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: NF_OCR_MODEL, max_tokens: 4000, messages: [{ role: 'user', content: [bloco, { type: 'text', text: prompt }] }] })
  }, NF_OCR_TIMEOUT_MS)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.error?.message || `Erro ${res.status}`); e.status = res.status; throw e
  }
  const data = await res.json()
  return data.content?.[0]?.text?.trim() || ''
}

// Extração RÁPIDA da NF (PDF/imagem): Haiku + JSON compacto. Poucos tokens de saída =
// baixa latência (bem mais rápido que transcrever o DANFE). O modelo lê a GRADE do
// DANFE (rótulo em cima, valor embaixo) e devolve o valor da célula "VALOR TOTAL DA
// NOTA" — NUNCA soma itens/alíquota (origem do bug do "1,04"). O valor volta como
// string e é normalizado por parseValorBR no chamador. Caminho primário do wizard;
// o transcreverNf + parser determinístico fica como fallback.
export async function extrairNfPdfRapido(url, mediaType = 'application/pdf') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Configure VITE_ANTHROPIC_API_KEY no arquivo .env')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Não foi possível baixar o arquivo da NF')
  const base64 = await blobToBase64(await resp.blob())
  const source = { type: 'base64', media_type: mediaType, data: base64 }
  const bloco = mediaType.startsWith('image/') ? { type: 'image', source } : { type: 'document', source }
  const prompt = 'Leia esta nota fiscal (DANFE) e responda APENAS um JSON, sem texto antes ou depois:\n' +
    '{"numero":"","valor_total":"","data_emissao":"AAAA-MM-DD","itens":[{"codigo":"","nome":"","qtd":0,"unidade":"","unitario":0}]}\n' +
    'REGRAS:\n' +
    '- "valor_total": o número da célula "VALOR TOTAL DA NOTA" (bloco CÁLCULO DO IMPOSTO). No DANFE os rótulos ficam em uma linha e os valores na linha de baixo; VALOR TOTAL DA NOTA é a ÚLTIMA coluna. NUNCA some itens, NUNCA use base de cálculo, alíquota, valor dos produtos nem valor unitário. Mantenha o formato do documento (ex.: 475,62).\n' +
    '- "numero": número da NF (rótulo Nº), só dígitos.\n' +
    '- "itens": uma entrada por produto da tabela DADOS DO PRODUTO/SERVIÇO (código, descrição, quantidade, valor unitário).\n' +
    '- Campo ausente = string vazia. Só o JSON.'
  const res = await fetchComTimeout(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: NF_OCR_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: [bloco, { type: 'text', text: prompt }] }] })
  }, NF_OCR_TIMEOUT_MS)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.error?.message || `Erro ${res.status}`); e.status = res.status; throw e
  }
  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('IA não retornou JSON válido')
  return JSON.parse(m[0])
}
