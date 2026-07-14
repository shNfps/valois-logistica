// Testes da extração da NF — rode com:  node --test
// Cobrem os 3 cenários pedidos + a regressão do "1,04".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseValorBR, valoresMonetarios,
  extrairDadosNfDeXml, extrairDadosNfDeTexto, extrairDadosNf,
} from './nf-extractor.js'

// ─── Fixture 1: XML da NF-e (padrão 4.00) ───
// Contém um vUnCom = 1.0400 e um pICMS = 1.04 de propósito: o total tem que sair
// de <vNF>, nunca de um 1,04 solto.
const XML_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
 <NFe><infNFe Id="NFe35260712345678000190550010000123451000123456" versao="4.00">
  <ide><cUF>35</cUF><nNF>12345</nNF><serie>1</serie><dhEmi>2026-07-10T09:30:00-03:00</dhEmi></ide>
  <emit><xNome>VALOIS COMERCIO LTDA</xNome></emit>
  <det nItem="1"><prod><cProd>1.842</cProd><xProd>DETERGENTE NEUTRO 5L</xProd><uCom>CX</uCom><qCom>10.0000</qCom><vUnCom>1.0400</vUnCom><vProd>10.40</vProd></prod>
   <imposto><ICMS><ICMS00><pICMS>1.04</pICMS><vICMS>1.04</vICMS></ICMS00></ICMS></imposto></det>
  <det nItem="2"><prod><cProd>3036</cProd><xProd>ALCOOL GEL 70% 5L</xProd><uCom>UN</uCom><qCom>50.0000</qCom><vUnCom>99.9200</vUnCom><vProd>4996.00</vProd></prod></det>
  <total><ICMSTot><vProd>5006.40</vProd><vNF>5006.40</vNF></ICMSTot></total>
 </infNFe></NFe>
</nfeProc>`

test('XML: lê vNF/nNF/itens de forma determinística (não o 1,04)', () => {
  const r = extrairDadosNfDeXml(XML_NFE)
  assert.equal(r.fonte, 'xml')
  assert.equal(r.numero, '12345')
  assert.equal(r.valorTotal, 5006.4)
  assert.equal(r.valorIncerto, false)
  assert.equal(r.dataEmissao, '2026-07-10')
  assert.equal(r.itens.length, 2)
  assert.equal(r.itens[0].codigo, '1842')
  assert.equal(r.itens[0].nome_produto, 'DETERGENTE NEUTRO 5L')
  assert.equal(r.itens[0].preco_unitario, 1.04)   // 1,04 é o UNITÁRIO, não o total
  assert.equal(r.itens[0].preco_total, 10.4)
  assert.equal(r.itens[1].preco_total, 4996)
  assert.notEqual(r.valorTotal, 1.04)              // regressão explícita
})

// ─── Fixture 2: DANFE em texto, layout padrão com rótulo ───
const DANFE_LABEL = `DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA
NF-e  Nº 000.012.345   SERIE 1
DATA DE EMISSAO 10/07/2026
CALCULO DO IMPOSTO
BASE DE CALCULO DO ICMS 5.006,40   VALOR DO ICMS 900,15   ALIQUOTA 1,04
VALOR TOTAL DOS PRODUTOS 5.006,40
VALOR TOTAL DA NOTA 5.006,40
DADOS DOS PRODUTOS / SERVICOS
1842 DETERGENTE NEUTRO 5L CX 10,0000 1,04 10,40
3036 ALCOOL GEL 70% 5L UN 50,0000 99,92 4.996,00
DADOS ADICIONAIS
`

test('DANFE texto: valor ancorado no rótulo VALOR TOTAL DA NOTA', () => {
  const r = extrairDadosNfDeTexto(DANFE_LABEL)
  assert.equal(r.valorTotal, 5006.4)
  assert.equal(r.valorIncerto, false)   // veio do rótulo → confiável
  assert.equal(r.numero, '12345')
  assert.equal(r.dataEmissao, '2026-07-10')
  assert.notEqual(r.valorTotal, 1.04)   // não pega a alíquota
  assert.ok(r.itens.length >= 1)
  assert.equal(r.itens[0].preco_total, 10.4)
})

// ─── Fixture 3: documento SEM o rótulo → fallback maior valor ───
const DANFE_SEM_LABEL = `RECIBO DE ENTREGA DE MERCADORIA
BASE DE CALCULO 5.006,40   VALOR DO ICMS 900,15   ALIQUOTA 1,04
CONFERIDO POR ____________
`

test('Sem rótulo: usa o maior valor monetário e marca como incerto', () => {
  const r = extrairDadosNfDeTexto(DANFE_SEM_LABEL)
  assert.equal(r.valorTotal, 5006.4)    // maior valor, nunca o 1,04
  assert.equal(r.valorIncerto, true)    // badge amarelo "confira"
  assert.notEqual(r.valorTotal, 1.04)
})

// ─── Regressão focada no bug relatado ───
test('nunca retorna 1,04 quando existe um total maior', () => {
  assert.notEqual(extrairDadosNfDeTexto(DANFE_LABEL).valorTotal, 1.04)
  assert.notEqual(extrairDadosNfDeTexto(DANFE_SEM_LABEL).valorTotal, 1.04)
  assert.notEqual(extrairDadosNfDeXml(XML_NFE).valorTotal, 1.04)
  // O 1,04 é candidato monetário, mas jamais vence o maior valor:
  assert.equal(Math.max(...valoresMonetarios('ALIQUOTA 1,04 TOTAL 5.006,40')), 5006.4)
})

// ─── Roteador ───
test('extrairDadosNf roteia XML x texto pelo conteúdo', () => {
  assert.equal(extrairDadosNf({ xml: XML_NFE }).fonte, 'xml')
  assert.equal(extrairDadosNf({ texto: DANFE_LABEL }).fonte, 'texto')
})

// ─── parseValorBR ───
test('parseValorBR cobre os formatos pt-BR e ponto-decimal', () => {
  assert.equal(parseValorBR('5.006,40'), 5006.4)
  assert.equal(parseValorBR('1.234,56'), 1234.56)
  assert.equal(parseValorBR('1234,56'), 1234.56)
  assert.equal(parseValorBR('1.234.567,89'), 1234567.89)
  assert.equal(parseValorBR('1.234'), 1234)      // ponto = milhar em pt-BR
  assert.equal(parseValorBR('1234'), 1234)
  assert.equal(parseValorBR('R$ 1.234,56'), 1234.56)
  assert.equal(parseValorBR('99,9200'), 99.92)
  assert.equal(parseValorBR('0,00'), 0)
  assert.equal(parseValorBR('1234.56'), 1234.56)  // ponto-decimal puro tolerado
  assert.equal(parseValorBR('abc'), null)
  assert.equal(parseValorBR(''), null)
  assert.equal(parseValorBR(null), null)
})
