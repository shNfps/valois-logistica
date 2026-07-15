-- ─────────────────────────────────────────────────────────────────────────────
-- Migration — Relatório de vendas por vendedor (aba Relatórios)
-- ADITIVA e idempotente. Não altera/remove nada existente.
--
-- Regras (confirmadas com o cliente):
--   • "NF emitida" = status IN ('NF_EMITIDA','EM_ROTA','ENTREGUE')  (STATUS_VENDA)
--   • vendedor     = clientes.vendedor_nome (via cliente_id; fallback nome; senão 'Sem vendedor')
--   • exibição     = usuarios.nome_exibicao_relatorio quando houver (Luana → 'Valois')
--   • comissão     = usuarios.comissao_pct (default 5); Valois/Sem vendedor = 0 (não são usuários)
--   • período      = pedidos.criado_em, intervalo [p_inicio, p_fim)  (fim EXCLUSIVO)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Colunas aditivas em usuarios (comissão + nome de exibição no relatório) ───
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS comissao_pct            numeric DEFAULT 5;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS nome_exibicao_relatorio text;

-- Configuração atual (idempotente; default 5 já cobre os demais vendedores):
UPDATE public.usuarios SET comissao_pct = 2 WHERE lower(nome) = 'nay';
UPDATE public.usuarios SET comissao_pct = 0 WHERE lower(nome) IN ('karine','luana');
-- Luana (sócia) não aparece como vendedora nos relatórios: seus pedidos entram como 'Valois'.
UPDATE public.usuarios SET nome_exibicao_relatorio = 'Valois' WHERE lower(nome) = 'luana';

-- 2) VIEW base — resolve cada pedido NF-emitida ao vendedor de exibição + comissão ──
--    O LEFT JOIN LATERAL ... LIMIT 1 garante no máx. 1 usuário por vendedor_nome
--    (evita duplicar pedido caso existam nomes iguais → não infla faturamento).
CREATE OR REPLACE VIEW public.vw_pedidos_vendedor AS
WITH ped AS (
  SELECT p.id, p.criado_em, p.numero_nf, p.valor_total, p.cliente,
    COALESCE(p.cliente_id,
      (SELECT c.id FROM public.clientes c WHERE lower(c.nome) = lower(p.cliente) LIMIT 1)) AS cli_id
  FROM public.pedidos p
  WHERE p.status IN ('NF_EMITIDA','EM_ROTA','ENTREGUE')
)
SELECT
  ped.id, ped.criado_em, ped.numero_nf, ped.valor_total, ped.cliente,
  COALESCE(NULLIF(TRIM(c.segmento), ''), 'Sem segmento')                 AS segmento,
  COALESCE(u.nome_exibicao_relatorio, c.vendedor_nome, 'Sem vendedor')   AS vendedor,
  COALESCE(u.comissao_pct, 0)                                            AS comissao_pct
FROM ped
LEFT JOIN public.clientes c ON c.id = ped.cli_id
LEFT JOIN LATERAL (
  SELECT comissao_pct, nome_exibicao_relatorio
  FROM public.usuarios u
  WHERE lower(u.nome) = lower(c.vendedor_nome)
  LIMIT 1
) u ON true;

-- 3) RANKING (Simples) — % de participação e comissão calculados no banco ───────
CREATE OR REPLACE FUNCTION public.get_ranking_vendedores(
  p_inicio timestamptz, p_fim timestamptz,
  p_vendedores text[] DEFAULT NULL, p_segmentos text[] DEFAULT NULL)
RETURNS TABLE(
  vendedor text, pedidos int, faturamento numeric, ticket_medio numeric,
  pct_participacao numeric, comissao_pct numeric, comissao_total numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    v.vendedor,
    COUNT(*)::int,
    COALESCE(SUM(v.valor_total), 0),
    COALESCE(AVG(v.valor_total), 0),
    ROUND(SUM(v.valor_total) / NULLIF(SUM(SUM(v.valor_total)) OVER (), 0) * 100, 2),
    MAX(v.comissao_pct),
    COALESCE(SUM(v.valor_total * v.comissao_pct / 100.0), 0)
  FROM public.vw_pedidos_vendedor v
  WHERE v.criado_em >= p_inicio AND v.criado_em < p_fim
    AND (p_vendedores IS NULL OR v.vendedor = ANY(p_vendedores))
    AND (p_segmentos  IS NULL OR v.segmento = ANY(p_segmentos))
  GROUP BY v.vendedor
  ORDER BY 3 DESC, 2 DESC;  -- 3=faturamento, 2=pedidos (nomes do RETURNS TABLE não são visíveis no corpo)
$$;

-- 4) TOP PRODUTOS por vendedor (Completo) — base pedido_itens ───────────────────
CREATE OR REPLACE FUNCTION public.get_top_produtos_por_vendedor(
  p_inicio timestamptz, p_fim timestamptz, p_limit int DEFAULT 10,
  p_vendedores text[] DEFAULT NULL, p_segmentos text[] DEFAULT NULL)
RETURNS TABLE(vendedor text, posicao int, produto text, valor numeric, quantidade numeric)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT v.vendedor,
           COALESCE(NULLIF(TRIM(i.nome_produto), ''), '(sem nome)') AS produto,
           SUM(i.preco_total) AS valor, SUM(i.quantidade) AS quantidade
    FROM public.vw_pedidos_vendedor v
    JOIN public.pedido_itens i ON i.pedido_id = v.id
    WHERE v.criado_em >= p_inicio AND v.criado_em < p_fim
      AND (p_vendedores IS NULL OR v.vendedor = ANY(p_vendedores))
      AND (p_segmentos  IS NULL OR v.segmento = ANY(p_segmentos))
    GROUP BY v.vendedor, 2
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY vendedor ORDER BY valor DESC, produto) AS rn
    FROM base
  )
  SELECT vendedor, rn::int, produto, valor, quantidade
  FROM ranked WHERE rn <= p_limit
  ORDER BY vendedor, rn;
$$;

-- 5) TOP CLIENTES por vendedor (Completo) — base valor_total ────────────────────
CREATE OR REPLACE FUNCTION public.get_top_clientes_por_vendedor(
  p_inicio timestamptz, p_fim timestamptz, p_limit int DEFAULT 10,
  p_vendedores text[] DEFAULT NULL, p_segmentos text[] DEFAULT NULL)
RETURNS TABLE(vendedor text, posicao int, cliente text, valor numeric, pedidos int)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT v.vendedor,
           COALESCE(NULLIF(TRIM(v.cliente), ''), '(sem nome)') AS cliente,
           SUM(v.valor_total) AS valor, COUNT(*)::int AS pedidos
    FROM public.vw_pedidos_vendedor v
    WHERE v.criado_em >= p_inicio AND v.criado_em < p_fim
      AND (p_vendedores IS NULL OR v.vendedor = ANY(p_vendedores))
      AND (p_segmentos  IS NULL OR v.segmento = ANY(p_segmentos))
    GROUP BY v.vendedor, 2
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY vendedor ORDER BY valor DESC, cliente) AS rn
    FROM base
  )
  SELECT vendedor, rn::int, cliente, valor, pedidos
  FROM ranked WHERE rn <= p_limit
  ORDER BY vendedor, rn;
$$;

-- 6) LISTA de pedidos por vendedor (Completo) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pedidos_por_vendedor(
  p_inicio timestamptz, p_fim timestamptz,
  p_vendedores text[] DEFAULT NULL, p_segmentos text[] DEFAULT NULL)
RETURNS TABLE(vendedor text, cliente text, numero_nf text, valor_total numeric,
              criado_em timestamptz, comissao_pct numeric, comissao_valor numeric)
LANGUAGE sql STABLE AS $$
  SELECT v.vendedor, v.cliente, v.numero_nf, v.valor_total, v.criado_em, v.comissao_pct,
         ROUND(v.valor_total * v.comissao_pct / 100.0, 2)
  FROM public.vw_pedidos_vendedor v
  WHERE v.criado_em >= p_inicio AND v.criado_em < p_fim
    AND (p_vendedores IS NULL OR v.vendedor = ANY(p_vendedores))
    AND (p_segmentos  IS NULL OR v.segmento = ANY(p_segmentos))
  ORDER BY v.vendedor, v.criado_em DESC;
$$;

-- 7) SEGMENTOS distintos (checkboxes do Personalizado) ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_segmentos_clientes()
RETURNS TABLE(segmento text, clientes int)
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(TRIM(segmento), ''), 'Sem segmento'), COUNT(*)::int
  FROM public.clientes
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

-- 8) Permissões (o app usa a anon key) ──────────────────────────────────────────
GRANT SELECT ON public.vw_pedidos_vendedor TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_vendedores(timestamptz,timestamptz,text[],text[])            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_produtos_por_vendedor(timestamptz,timestamptz,int,text[],text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_clientes_por_vendedor(timestamptz,timestamptz,int,text[],text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pedidos_por_vendedor(timestamptz,timestamptz,text[],text[])          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_segmentos_clientes()                                                 TO anon, authenticated;
