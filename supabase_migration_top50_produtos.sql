-- ============================================================
-- VALOIS LOGÍSTICA — Migration: Top 50 Produtos + Cotações
-- ============================================================
-- Tudo aditivo (CREATE/ADD/GRANT). Seguro pra rodar direto na main
-- conforme política do projeto. Não altera nem remove dados.
--
-- Conteúdo:
--   1. Tabela cotacoes_sku (preço Valois vs até 3 concorrentes)
--   2. RPC get_top50_produtos() — todas as métricas do relatório
--   3. RPC get_ultima_cotacao_por_sku(text[]) — fetch em lote pra UI
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela: cotacoes_sku
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cotacoes_sku (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_codigo            text NOT NULL,
  data_cotacao          date NOT NULL,
  preco_valois          numeric(10,2),
  preco_concorrente_1   numeric(10,2),
  nome_concorrente_1    text,
  preco_concorrente_2   numeric(10,2),
  nome_concorrente_2    text,
  preco_concorrente_3   numeric(10,2),
  nome_concorrente_3    text,
  observacao            text,
  criado_por            text NOT NULL,
  criado_em             timestamptz DEFAULT now()
);

ALTER TABLE public.cotacoes_sku ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotacoes_sku_all" ON public.cotacoes_sku
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cotacoes_sku_codigo_idx
  ON public.cotacoes_sku (sku_codigo, data_cotacao DESC);

-- ------------------------------------------------------------
-- 2. RPC: get_top50_produtos()
-- ------------------------------------------------------------
-- Notas de modelagem:
--   * ABC calculada sobre o universo TODO de SKUs com código,
--     depois recortada pro top 50. Assim classe_abc reflete o
--     catálogo real, não a janela do relatório.
--   * Denominador de pct_sobre_total = faturamento empresa (inclui
--     itens sem código). Curva ABC usa só itens com código (fecha
--     em 100%). São coisas diferentes intencionalmente.
--   * produtos.codigo não é unique (23 duplicados em prod) — usamos
--     DISTINCT ON (codigo) ORDER BY id pra deduplicar.
--   * cli_id usa COALESCE(p.cliente_id, lookup por nome) — mesma
--     regra do top 20 clientes, capta ~97% do faturamento.
--   * #variable_conflict use_column: lição do bug anterior. Em
--     PL/pgSQL com RETURNS TABLE, nomes de colunas viram variáveis
--     OUT e bagunçam referências bare nas CTEs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top50_produtos()
RETURNS TABLE (
  codigo                    text,
  nome_produto              text,
  categoria                 text,
  fat_12m                   numeric,
  qtd_12m                   numeric,
  pct_sobre_total           numeric,
  pct_acumulado             numeric,
  classe_abc                text,
  fat_janabr_25             numeric,
  fat_janabr_26             numeric,
  yoy_pct                   numeric,
  fat_90d                   numeric,
  fat_90d_anterior          numeric,
  tendencia_pct             numeric,
  qtd_clientes_unicos_12m   integer,
  qtd_clientes_unicos_90d   integer,
  ticket_medio_pedido       numeric,
  top20_clientes            jsonb,
  status                    text
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
  hoje                 timestamptz := now();
  janela_12m_ini       timestamptz := hoje - interval '12 months';
  janela_90d_ini       timestamptz := hoje - interval '90 days';
  janela_90d_ant_ini   timestamptz := hoje - interval '180 days';
  janela_90d_ant_fim   timestamptz := hoje - interval '90 days';
  ano_atual            int := extract(year FROM hoje)::int;
  janabr_atual_ini     timestamptz := make_timestamptz(ano_atual,     1, 1, 0, 0, 0);
  janabr_atual_fim     timestamptz := make_timestamptz(ano_atual,     5, 1, 0, 0, 0);
  janabr_ant_ini       timestamptz := make_timestamptz(ano_atual - 1, 1, 1, 0, 0, 0);
  janabr_ant_fim       timestamptz := make_timestamptz(ano_atual - 1, 5, 1, 0, 0, 0);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      pi.codigo,
      pi.nome_produto,
      COALESCE(pi.quantidade,  0)::numeric AS quantidade,
      COALESCE(pi.preco_total, 0)::numeric AS preco_total,
      p.id          AS pedido_id,
      p.criado_em,
      COALESCE(
        p.cliente_id,
        (SELECT c.id FROM clientes c
          WHERE lower(trim(c.nome)) = lower(trim(p.cliente))
          LIMIT 1)
      ) AS cli_id
    FROM pedido_itens pi
    JOIN pedidos p ON p.id = pi.pedido_id
    WHERE p.criado_em >= hoje - interval '13 months'
      AND p.status <> 'CANCELADO'
      AND pi.codigo IS NOT NULL
      AND COALESCE(pi.preco_total, 0) > 0
  ),
  base12 AS (
    SELECT * FROM base WHERE criado_em >= janela_12m_ini
  ),
  -- Total empresa nos 12m (inclui pedidos sem itens decompostos)
  -- Denominador de pct_sobre_total.
  total_empresa AS (
    SELECT COALESCE(SUM(p.valor_total), 0)::numeric AS total
    FROM pedidos p
    WHERE p.criado_em >= janela_12m_ini
      AND p.status <> 'CANCELADO'
      AND COALESCE(p.valor_total, 0) > 0
  ),
  -- Agregação por SKU (universo COMPLETO, não só top 50)
  agg_sku AS (
    SELECT
      b.codigo,
      MAX(b.nome_produto)                                                       AS nome_produto,
      SUM(b.preco_total)                                                        AS fat_12m,
      SUM(b.quantidade)                                                         AS qtd_12m,
      COUNT(DISTINCT b.pedido_id)                                               AS pedidos_distintos,
      COUNT(DISTINCT b.cli_id)                                                  AS qtd_clientes_unicos_12m,
      COUNT(DISTINCT b.cli_id) FILTER (WHERE b.criado_em >= janela_90d_ini)     AS qtd_clientes_unicos_90d,
      SUM(b.preco_total) FILTER (WHERE b.criado_em >= janabr_ant_ini   AND b.criado_em < janabr_ant_fim)   AS fat_janabr_25,
      SUM(b.preco_total) FILTER (WHERE b.criado_em >= janabr_atual_ini AND b.criado_em < janabr_atual_fim) AS fat_janabr_26,
      SUM(b.preco_total) FILTER (WHERE b.criado_em >= janela_90d_ini)                                       AS fat_90d,
      SUM(b.preco_total) FILTER (WHERE b.criado_em >= janela_90d_ant_ini AND b.criado_em < janela_90d_ant_fim) AS fat_90d_anterior
    FROM base12 b
    GROUP BY b.codigo
  ),
  -- ABC calculada sobre o UNIVERSO INTEIRO de SKUs com código
  -- (denominador = soma total dos SKUs com código, fecha em 100%)
  abc_universo AS (
    SELECT
      a.codigo,
      a.fat_12m,
      SUM(a.fat_12m) OVER ()                                                              AS soma_skus,
      SUM(a.fat_12m) OVER (ORDER BY a.fat_12m DESC, a.codigo
                            ROWS UNBOUNDED PRECEDING)                                     AS acum
    FROM agg_sku a
  ),
  com_abc AS (
    SELECT
      au.codigo,
      ROUND((au.acum / NULLIF(au.soma_skus, 0) * 100)::numeric, 2) AS pct_acumulado,
      CASE
        WHEN (au.acum / NULLIF(au.soma_skus, 0) * 100) <= 80 THEN 'A'
        WHEN (au.acum / NULLIF(au.soma_skus, 0) * 100) <= 95 THEN 'B'
        ELSE 'C'
      END AS classe_abc
    FROM abc_universo au
  ),
  -- Top 50 por faturamento
  top50 AS (
    SELECT * FROM agg_sku ORDER BY fat_12m DESC LIMIT 50
  ),
  -- Top 20 clientes por SKU (drill-down)
  top20_cli AS (
    SELECT
      t.codigo,
      (
        SELECT jsonb_agg(jsonb_build_object(
                 'cliente_id', cli_id,
                 'nome',       nome,
                 'fat',        ROUND(fat::numeric, 2),
                 'qtd',        ROUND(qtd::numeric, 2)
               ) ORDER BY fat DESC)
        FROM (
          SELECT b.cli_id,
                 (SELECT c.nome FROM clientes c WHERE c.id = b.cli_id) AS nome,
                 SUM(b.preco_total) AS fat,
                 SUM(b.quantidade)  AS qtd
          FROM base12 b
          WHERE b.codigo = t.codigo AND b.cli_id IS NOT NULL
          GROUP BY b.cli_id
          ORDER BY fat DESC
          LIMIT 20
        ) x
      ) AS top20_clientes
    FROM top50 t
  ),
  -- Dedup produtos.codigo (23 duplicados em prod) — pega 1 linha por código
  prod_unico AS (
    SELECT DISTINCT ON (pr.codigo) pr.codigo, pr.categoria
    FROM produtos pr
    WHERE pr.codigo IS NOT NULL
    ORDER BY pr.codigo, pr.id
  )
  SELECT
    t.codigo,
    t.nome_produto,
    pu.categoria,
    ROUND(t.fat_12m::numeric, 2)                                                                AS fat_12m,
    ROUND(t.qtd_12m::numeric, 2)                                                                AS qtd_12m,
    ROUND((t.fat_12m * 100.0 / NULLIF((SELECT total FROM total_empresa), 0))::numeric, 2)       AS pct_sobre_total,
    ca.pct_acumulado,
    ca.classe_abc,
    ROUND(COALESCE(t.fat_janabr_25, 0)::numeric, 2)                                             AS fat_janabr_25,
    ROUND(COALESCE(t.fat_janabr_26, 0)::numeric, 2)                                             AS fat_janabr_26,
    CASE WHEN COALESCE(t.fat_janabr_25, 0) = 0 THEN NULL
         ELSE ROUND(((t.fat_janabr_26 - t.fat_janabr_25) / t.fat_janabr_25 * 100)::numeric, 2)
    END                                                                                          AS yoy_pct,
    ROUND(COALESCE(t.fat_90d, 0)::numeric, 2)                                                    AS fat_90d,
    ROUND(COALESCE(t.fat_90d_anterior, 0)::numeric, 2)                                           AS fat_90d_anterior,
    CASE WHEN COALESCE(t.fat_90d_anterior, 0) = 0 THEN NULL
         ELSE ROUND(((t.fat_90d - t.fat_90d_anterior) / t.fat_90d_anterior * 100)::numeric, 2)
    END                                                                                          AS tendencia_pct,
    t.qtd_clientes_unicos_12m::int,
    t.qtd_clientes_unicos_90d::int,
    ROUND((t.fat_12m / NULLIF(t.pedidos_distintos, 0))::numeric, 2)                              AS ticket_medio_pedido,
    tc.top20_clientes,
    CASE
      WHEN ( (CASE WHEN COALESCE(t.fat_janabr_25, 0) = 0 THEN NULL
                   ELSE (t.fat_janabr_26 - t.fat_janabr_25) / t.fat_janabr_25 * 100 END) < -25 )
        OR ( (CASE WHEN COALESCE(t.fat_90d_anterior, 0) = 0 THEN NULL
                   ELSE (t.fat_90d - t.fat_90d_anterior) / t.fat_90d_anterior * 100 END) < -30 )
        THEN 'CRITICO'
      WHEN ( (CASE WHEN COALESCE(t.fat_janabr_25, 0) = 0 THEN NULL
                   ELSE (t.fat_janabr_26 - t.fat_janabr_25) / t.fat_janabr_25 * 100 END) BETWEEN -25 AND -10 )
        OR ( (CASE WHEN COALESCE(t.fat_90d_anterior, 0) = 0 THEN NULL
                   ELSE (t.fat_90d - t.fat_90d_anterior) / t.fat_90d_anterior * 100 END) BETWEEN -30 AND -15 )
        THEN 'ATENCAO'
      WHEN ( (CASE WHEN COALESCE(t.fat_janabr_25, 0) = 0 THEN NULL
                   ELSE (t.fat_janabr_26 - t.fat_janabr_25) / t.fat_janabr_25 * 100 END) > 10 )
        THEN 'CRESCENDO'
      ELSE 'ESTAVEL'
    END AS status
  FROM top50 t
  LEFT JOIN com_abc ca       ON ca.codigo = t.codigo
  LEFT JOIN prod_unico pu    ON pu.codigo = t.codigo
  LEFT JOIN top20_cli tc     ON tc.codigo = t.codigo
  ORDER BY t.fat_12m DESC;
END $$;

-- ------------------------------------------------------------
-- 3. RPC: get_ultima_cotacao_por_sku(text[])
-- Fetch em lote pra UI mostrar "última cotação em X" sem 50 round-trips.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ultima_cotacao_por_sku(codigos text[])
RETURNS TABLE (
  sku_codigo           text,
  data_cotacao         date,
  preco_valois         numeric,
  melhor_concorrente_nome  text,
  melhor_concorrente_preco numeric,
  observacao           text
)
LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT c.*,
           ROW_NUMBER() OVER (PARTITION BY c.sku_codigo ORDER BY c.data_cotacao DESC, c.criado_em DESC) AS rn
    FROM cotacoes_sku c
    WHERE c.sku_codigo = ANY(codigos)
  ),
  ultima AS (
    SELECT * FROM ranked WHERE rn = 1
  )
  SELECT
    u.sku_codigo,
    u.data_cotacao,
    u.preco_valois,
    -- Melhor concorrente = menor preço entre os 3 (ou null se nenhum)
    (SELECT nome  FROM (VALUES
      (u.nome_concorrente_1, u.preco_concorrente_1),
      (u.nome_concorrente_2, u.preco_concorrente_2),
      (u.nome_concorrente_3, u.preco_concorrente_3)) v(nome, preco)
     WHERE preco IS NOT NULL ORDER BY preco ASC LIMIT 1) AS melhor_concorrente_nome,
    (SELECT preco FROM (VALUES
      (u.nome_concorrente_1, u.preco_concorrente_1),
      (u.nome_concorrente_2, u.preco_concorrente_2),
      (u.nome_concorrente_3, u.preco_concorrente_3)) v(nome, preco)
     WHERE preco IS NOT NULL ORDER BY preco ASC LIMIT 1) AS melhor_concorrente_preco,
    u.observacao
  FROM ultima u;
$$;

-- ------------------------------------------------------------
-- 4. Permissões pra anon/authenticated chamarem via PostgREST
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_top50_produtos()                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ultima_cotacao_por_sku(text[])    TO anon, authenticated;
