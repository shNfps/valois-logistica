// ─── Extração de dados da Nota Fiscal (determinística e testável) ───────────────
// Corrige o bug do "1,04": o valor total NUNCA sai de um `\d+,\d{2}` genérico de
// primeiro match (que capturava alíquota/quantidade/valor unitário). A ordem de
// prioridade é:
//   1. XML da NF-e  → lê <vNF> (total), <nNF> (número) e os nós <det> (itens).
//   2. Texto (DANFE PDF/imagem transcrita) → ancorado no rótulo VALOR TOTAL DA NOTA
//      / Nº / tabela DADOS DOS PRODUTOS.
//   3. Fallback → maior valor monetário do documento, marcado como incerto.
//
// Este módulo é PURO (sem imports) de propósito: roda no browser e sob `node --test`.
// A transcrição do PDF/imagem (OCR via IA) vive fora daqui — aqui só entra texto/XML.

// Formato de saída padronizado consumido pelo wizard.
export function nfVazia(fonte = 'texto') {
  return { fonte, numero: null, valorTotal: null, valorIncerto: false, dataEmissao: null, itens: [] }
}

// ─── Parsing de valor monetário em pt-BR (texto do DANFE) ───
// Aceita "1.234,56", "1234,56", "1.234", "1234", "R$ 1.234,56". Retorna Number|null.
// Regra pt-BR: vírgula é decimal, ponto é milhar. Também tolera ponto-decimal puro
// ("1234.56") quando não há vírgula e o ponto não está agrupando milhares.
export function parseValorBR(raw) {
  if (raw == null) return null
  let s = String(raw).replace(/r\$/gi, '').replace(/\s/g, '')
  s = s.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(s)) return null
  const temVirgula = s.includes(','), temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // o último separador é o decimal (cobre "1.234,56" e "1,234.56")
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (temVirgula) {
    s = s.replace(/,/g, '.') // vírgula decimal pt-BR
  } else if (temPonto) {
    // só ponto: se agrupa milhares (1.234 / 1.234.567) é separador; senão é decimal
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Valor monetário pt-BR ESTRITO (2 casas + vírgula decimal). NÃO é o "primeiro
// match genérico" proibido: só alimenta o fallback (maior valor) e a leitura logo
// após um rótulo específico. Um "1.04" (ponto-decimal, alíquota) nem é candidato.
const RE_MONEY_BR = /-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g

export function valoresMonetarios(texto) {
  const out = []
  for (const m of String(texto).matchAll(RE_MONEY_BR)) {
    const v = parseValorBR(m[0])
    if (v != null) out.push(v)
  }
  return out
}

// Normaliza p/ busca de rótulo: sem acento, MAIÚSCULO, espaços colapsados.
// IMPORTANTE: todo o parsing de texto opera SOBRE a string normalizada e fatia
// ELA MESMA — nunca se mistura índice do normalizado com o texto original (NFD
// muda o tamanho da string). Dígitos, vírgulas e pontos são preservados.
function norm(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[ \t]+/g, ' ')
}

// Valor total da nota — ancorado no rótulo, cobrindo os DOIS layouts de DANFE:
//  (a) "RÓTULO valor" na mesma linha;
//  (b) GRADE padrão (SEFAZ): rótulos numa linha e os valores na linha seguinte. Como
//      VALOR TOTAL DA NOTA é a ÚLTIMA coluna do bloco de totais, o valor é o ÚLTIMO
//      número da 1ª linha de valores após o rótulo. Nunca pega base/alíquota/produtos.
const reMoneyLinha = () => /-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g
function valorTotalDaNota(N) {
  const rotulos = ['VALOR TOTAL DA NOTA', 'V. TOTAL DA NOTA', 'VALOR TOTAL DA NF', 'VLR TOTAL DA NOTA'].map(norm)
  for (const alvo of rotulos) {
    let idx = N.indexOf(alvo)
    while (idx !== -1) {
      const linhas = N.slice(idx + alvo.length).split('\n')
      const mesma = (linhas[0] || '').match(reMoneyLinha())      // valor na mesma linha do rótulo
      if (mesma) { const v = parseValorBR(mesma[0]); if (v != null && v > 0) return v }
      for (let i = 1; i < linhas.length && i < 6; i++) {         // grade: valores na linha seguinte
        const monies = (linhas[i] || '').match(reMoneyLinha())
        if (monies) { const v = parseValorBR(monies[monies.length - 1]); if (v != null && v > 0) return v }
      }
      idx = N.indexOf(alvo, idx + alvo.length)
    }
  }
  return null
}

// ─── DANFE (texto transcrito de PDF/imagem) ───
export function extrairDadosNfDeTexto(texto) {
  const res = nfVazia('texto')
  if (!texto || !String(texto).trim()) return res
  const N = norm(texto)

  // 1) Valor total — ancorado no rótulo oficial (grade DANFE ou mesma linha).
  const valorRotulo = valorTotalDaNota(N)
  if (valorRotulo != null && valorRotulo > 0) {
    res.valorTotal = valorRotulo
    res.valorIncerto = false
  } else {
    // 2) Fallback — maior valor monetário do documento (marcado incerto p/ conferência).
    const todos = valoresMonetarios(N)
    if (todos.length) { res.valorTotal = Math.max(...todos); res.valorIncerto = true }
  }

  res.numero = extrairNumeroDeTexto(texto)

  // Data de emissão (só informativa; o vencimento usa hoje + prazo por decisão do fluxo).
  const emi = N.match(/(?:DATA DE EMISSAO|EMISSAO|DT\.? EMISSAO)[^0-9]{0,12}(\d{2}\/\d{2}\/\d{4})/)
  if (emi) { const [d, m, a] = emi[1].split('/'); res.dataEmissao = `${a}-${m}-${d}` }

  res.itens = extrairItensDeTexto(texto)
  return res
}

// Número da NF a partir do texto. Ancorado nos rótulos, nunca "primeiro número".
export function extrairNumeroDeTexto(texto) {
  const N = norm(texto)
  const rotulos = ['NF-E N', 'NFE N', 'NUMERO', 'Nº', 'N°'].map(norm)
  for (const alvo of rotulos) {
    let idx = N.indexOf(alvo)
    while (idx !== -1) {
      const janela = N.slice(idx + alvo.length, idx + alvo.length + 30)
      const m = janela.match(/(\d[\d.\s]{2,})/)
      if (m) {
        const digitos = m[1].replace(/\D/g, '')
        if (digitos.length >= 3) return String(Number(digitos)) // remove zeros à esquerda
      }
      idx = N.indexOf(alvo, idx + alvo.length)
    }
  }
  return null
}

// Itens da tabela "DADOS DOS PRODUTOS / SERVIÇOS" (best-effort; tudo editável na UI).
// Heurística de linha: código, descrição e ao final UN QTD V.UNIT V.TOTAL (pt-BR).
export function extrairItensDeTexto(texto) {
  const N = norm(texto)
  let ini = N.indexOf('DADOS DOS PRODUTOS')
  if (ini === -1) ini = N.indexOf('DADOS DO PRODUTO')
  if (ini === -1) return []
  let fim = N.indexOf('DADOS ADICIONAIS', ini)
  if (fim === -1) fim = N.indexOf('CALCULO DO ISSQN', ini)
  if (fim === -1) fim = N.length
  const bloco = N.slice(ini, fim)
  const itens = []
  for (const linhaRaw of bloco.split(/\r?\n/)) {
    const linha = linhaRaw.trim()
    // COD  DESCRIÇÃO  UN  QTD  V.UNIT  V.TOTAL  (com V.UNIT/V.TOTAL em pt-BR estrito)
    const m = linha.match(/^(\d{2,})\s+(.+?)\s+([A-Z]{1,5})\s+([\d.,]+)\s+(\d{1,3}(?:\.\d{3})*,\d{2,})\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/)
    if (m) {
      const [, codigo, nome, unidade, qtd, vUnit, vTotal] = m
      itens.push({
        codigo: codigo.replace(/\D/g, ''),
        nome_produto: nome.trim(),
        quantidade: parseValorBR(qtd) ?? 0,
        unidade,
        preco_unitario: parseValorBR(vUnit) ?? 0,
        preco_total: parseValorBR(vTotal) ?? 0,
      })
    }
  }
  return itens
}

// ─── XML da NF-e (determinístico) ───
// Parsing por tag ancorada (funciona no browser e no node --test, sem DOMParser).
function tag(xml, nome) {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'i'))
  return m ? m[1].trim() : null
}

export function extrairDadosNfDeXml(xml) {
  const res = nfVazia('xml')
  if (!xml || !String(xml).includes('<')) return res
  const src = String(xml)

  const nNF = tag(src, 'nNF')
  if (nNF) res.numero = String(Number(nNF.replace(/\D/g, '')) || nNF.replace(/\D/g, ''))

  // <vNF> é único (fica em <total><ICMSTot>), diferente do <vProd> por item.
  const vNF = tag(src, 'vNF')
  const total = vNF != null ? Number(vNF) : null
  if (total != null && Number.isFinite(total) && total > 0) {
    res.valorTotal = total
    res.valorIncerto = false
  }

  const emi = tag(src, 'dhEmi') || tag(src, 'dEmi')
  if (emi) res.dataEmissao = emi.slice(0, 10)

  // Itens: cada <det> tem um <prod> com xProd/qCom/uCom/vUnCom/vProd/cProd.
  for (const mDet of src.matchAll(/<det(?:\s[^>]*)?>([\s\S]*?)<\/det>/gi)) {
    const d = mDet[1]
    const nome = tag(d, 'xProd')
    if (!nome) continue
    const codigo = tag(d, 'cProd')
    const q = tag(d, 'qCom'); const vun = tag(d, 'vUnCom'); const vpr = tag(d, 'vProd')
    res.itens.push({
      codigo: codigo ? String(codigo).replace(/\./g, '') : '',
      nome_produto: nome,
      quantidade: q != null ? Number(q) : 0,
      unidade: tag(d, 'uCom') || 'UN',
      preco_unitario: vun != null ? Number(vun) : 0,
      preco_total: vpr != null ? Number(vpr) : 0,
    })
  }

  // Se não veio <vNF> mas há itens, soma-os como último recurso (marcado incerto).
  if (res.valorTotal == null && res.itens.length) {
    const soma = res.itens.reduce((s, i) => s + (Number(i.preco_total) || 0), 0)
    if (soma > 0) { res.valorTotal = Number(soma.toFixed(2)); res.valorIncerto = true }
  }
  return res
}

// Detecta se um arquivo/string é XML de NF-e (usado pela UI para rotear).
export function ehXmlNfe(nomeOuConteudo = '') {
  const s = String(nomeOuConteudo)
  return /\.xml$/i.test(s) || /<\?xml|<nfeProc|<NFe|<infNFe|<nNF>/i.test(s)
}

// ─── Roteador: decide XML x texto pelo conteúdo ───
export function extrairDadosNf({ xml, texto } = {}) {
  if (xml && ehXmlNfe(xml)) return extrairDadosNfDeXml(xml)
  return extrairDadosNfDeTexto(texto || xml || '')
}
