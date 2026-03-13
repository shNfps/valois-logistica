# Valois Logística

Sistema de Expedição e Entregas — Valois Descartáveis e Limpeza.

## Setup Rápido

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL da Etapa 2 do guia no SQL Editor do Supabase
3. Crie o bucket `documentos` no Storage do Supabase
4. Copie `.env.example` para `.env` e preencha com suas chaves
5. `npm install && npm run dev`

## Deploy

Suba para o GitHub e conecte na [Vercel](https://vercel.com).
Adicione as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Perfis

- **Comercial**: Cadastra pedidos com PDF do orçamento
- **Galpão**: Confere mercadorias e aprova/rejeita pedidos
- **Motorista**: Visualiza NF, coleta assinatura e CPF na entrega
