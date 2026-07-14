-- ─────────────────────────────────────────────────────────────────────────────
-- Migration v12 — Configurações chave/valor (meta diária de vendas)
-- ADITIVA e idempotente. Não altera nem remove nada existente.
--
-- Objetivo: guardar a meta diária de vendas (usada na tela "Venda concluída" do
-- wizard NF+Boleto) fora do código, editável sem deploy. Tabela genérica chave/
-- valor para servir também a futuras configurações.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave         TEXT PRIMARY KEY,
  valor         TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Mesmo padrão de RLS "acesso público" das demais tabelas do app (usa anon key).
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "configuracoes_all" ON public.configuracoes;
CREATE POLICY "configuracoes_all" ON public.configuracoes FOR ALL USING (true) WITH CHECK (true);

-- Seed inicial da meta diária. ON CONFLICT DO NOTHING => não sobrescreve se o
-- admin já tiver ajustado o valor (rodar a migration de novo é seguro).
INSERT INTO public.configuracoes (chave, valor)
VALUES ('meta_diaria_vendas', '26000')
ON CONFLICT (chave) DO NOTHING;
