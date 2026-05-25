-- ============================================================
-- VALOIS LOGÍSTICA — Fix: get_diagnostico_top20()
-- ============================================================
-- BUG: column reference "segmento" is ambiguous (SQLSTATE 42702)
--      no CTE med_segmento. Em PL/pgSQL, cada coluna de RETURNS TABLE
--      vira variável OUT visível em todo o corpo da função, então
--      `SELECT segmento FROM pre` virou ambíguo (variável OUT vs coluna).
--
-- FIX: adicionar diretiva `#variable_conflict use_column` no topo do
--      corpo PL/pgSQL — força o parser a preferir a coluna em conflitos.
--      Corpo SQL é IDÊNTICO ao já implantado, só a diretiva é nova.
--
-- Idempotente (CREATE OR REPLACE FUNCTION) — não afeta GRANTs nem
-- depende de DROP.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_diagnostico_top20()
RETURNS TABLE (
  cliente_id            uuid,
  nome                  text,
  cidade                text,
  segmento              text,
  vendedor_nome         text,
  fat_12m               numeric,
  fat_janabr_25         numeric,
  fat_janabr_26         numeric,
  yoy_pct               numeric,
  yoy_90d_pct           numeric,
  yoy_segmento_mediana  numeric,
  fat_mensal            jsonb,
  ticket_medio_12p      numeric,
  ticket_medio_3p       numeric,
  freq_hist_dias        numeric,
  freq_90d_dias         numeric,
  skus_12m              integer,
  skus_90d              integer,
  skus_90d_anteriores   integer,
  mix_var_pct           numeric,
  ultimo_pedido         timestamptz,
  dias_sem_pedido       integer,
  top5_skus             jsonb,
  skus_descontinuados   jsonb,
  status                text
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
  yoy90_recente_ini    timestamptz := hoje - interval '90 days';
  yoy90_anterior_ini   timestamptz := hoje - interval '1 year 90 days';
  yoy90_anterior_fim   timestamptz := hoje - interval '1 year';
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.criado_em,
      COALESCE(p.valor_total, 0)::numeric AS valor_total,
      COALESCE(
        p.cliente_id,
        (SELECT c.id FROM clientes c
          WHERE lower(trim(c.nome)) = lower(trim(p.cliente))
          LIMIT 1)
      ) AS cli_id
    FROM pedidos p
    WHERE p.criado_em >= hoje - interval '13 months'
      AND p.status <> 'CANCELADO'
      AND COALESCE(p.valor_total, 0) > 0
  ),
  base12 AS (
    SELECT * FROM base WHERE criado_em >= janela_12m_ini AND cli_id IS NOT NULL
  ),
  top20 AS (
    SELECT b.cli_id, SUM(b.valor_total) AS fat_12m
    FROM base12 b
    GROUP BY b.cli_id
    ORDER BY fat_12m DESC
    LIMIT 20
  ),
  agg AS (
    SELECT
      t.cli_id,
      t.fat_12m,
      SUM(b.valor_total) FILTER (WHERE b.criado_em >= janabr_ant_ini   AND b.criado_em < janabr_ant_fim)   AS fat_janabr_25,
      SUM(b.valor_total) FILTER (WHERE b.criado_em >= janabr_atual_ini AND b.criado_em < janabr_atual_fim) AS fat_janabr_26,
      SUM(b.valor_total) FILTER (WHERE b.criado_em >= yoy90_recente_ini)                                   AS fat_90d,
      SUM(b.valor_total) FILTER (WHERE b.criado_em >= yoy90_anterior_ini AND b.criado_em < yoy90_anterior_fim) AS fat_90d_anoanterior,
      MAX(b.criado_em) AS ultimo_pedido
    FROM top20 t
    JOIN base12 b USING (cli_id)
    GROUP BY t.cli_id, t.fat_12m
  ),
  mensal AS (
    SELECT
      t.cli_id,
      jsonb_object_agg(mes, total ORDER BY mes) AS fat_mensal
    FROM top20 t
    JOIN LATERAL (
      SELECT to_char(date_trunc('month', b.criado_em), 'YYYY-MM') AS mes,
             SUM(b.valor_total) AS total
      FROM base12 b
      WHERE b.cli_id = t.cli_id
      GROUP BY 1
    ) m ON true
    GROUP BY t.cli_id
  ),
  tickets AS (
    SELECT
      t.cli_id,
      AVG(CASE WHEN rn <= 12 THEN valor_total END) AS ticket_medio_12p,
      AVG(CASE WHEN rn <= 3  THEN valor_total END) AS ticket_medio_3p
    FROM top20 t
    JOIN LATERAL (
      SELECT b.valor_total,
             ROW_NUMBER() OVER (ORDER BY b.criado_em DESC) AS rn
      FROM base12 b
      WHERE b.cli_id = t.cli_id
    ) p ON true
    GROUP BY t.cli_id
  ),
  freq AS (
    SELECT
      t.cli_id,
      AVG(diff_dias) FILTER (WHERE escopo = '12m') AS freq_hist_dias,
      AVG(diff_dias) FILTER (WHERE escopo = '90d') AS freq_90d_dias
    FROM top20 t
    JOIN LATERAL (
      SELECT
        EXTRACT(EPOCH FROM (criado_em - LAG(criado_em) OVER (ORDER BY criado_em))) / 86400 AS diff_dias,
        CASE WHEN criado_em >= janela_90d_ini THEN '90d' ELSE '12m' END AS escopo
      FROM base12 b
      WHERE b.cli_id = t.cli_id
    ) x ON true
    WHERE diff_dias IS NOT NULL
    GROUP BY t.cli_id
  ),
  skus AS (
    SELECT
      t.cli_id,
      COUNT(DISTINCT pi.codigo) FILTER (WHERE b.criado_em >= janela_12m_ini)                                              AS skus_12m,
      COUNT(DISTINCT pi.codigo) FILTER (WHERE b.criado_em >= janela_90d_ini)                                              AS skus_90d,
      COUNT(DISTINCT pi.codigo) FILTER (WHERE b.criado_em >= janela_90d_ant_ini AND b.criado_em < janela_90d_ant_fim)     AS skus_90d_anteriores
    FROM top20 t
    JOIN base12 b ON b.cli_id = t.cli_id
    LEFT JOIN pedido_itens pi ON pi.pedido_id = b.id AND pi.codigo IS NOT NULL
    GROUP BY t.cli_id
  ),
  top5 AS (
    SELECT
      t.cli_id,
      (
        SELECT jsonb_agg(jsonb_build_object(
                 'codigo', codigo,
                 'nome',   nome_produto,
                 'valor',  ROUND(valor::numeric, 2),
                 'qtd',    ROUND(qtd::numeric,   2)
               ) ORDER BY valor DESC)
        FROM (
          SELECT pi.codigo, pi.nome_produto,
                 SUM(pi.preco_total) AS valor,
                 SUM(pi.quantidade)  AS qtd
          FROM pedido_itens pi
          JOIN base12 b ON b.id = pi.pedido_id
          WHERE b.cli_id = t.cli_id AND pi.codigo IS NOT NULL
          GROUP BY pi.codigo, pi.nome_produto
          ORDER BY valor DESC
          LIMIT 5
        ) s
      ) AS top5_skus
    FROM top20 t
  ),
  desc_skus AS (
    SELECT
      t.cli_id,
      (
        SELECT jsonb_agg(jsonb_build_object(
                 'codigo',         codigo,
                 'nome',           nome_produto,
                 'valor_perdido',  ROUND(valor_ant::numeric, 2),
                 'qtd_anterior',   ROUND(qtd_ant::numeric,   2)
               ) ORDER BY valor_ant DESC)
        FROM (
          SELECT
            pi.codigo,
            MAX(pi.nome_produto) AS nome_produto,
            SUM(pi.preco_total)  AS valor_ant,
            SUM(pi.quantidade)   AS qtd_ant
          FROM pedido_itens pi
          JOIN base12 b ON b.id = pi.pedido_id
          WHERE b.cli_id = t.cli_id
            AND pi.codigo IS NOT NULL
            AND b.criado_em >= janela_90d_ant_ini
            AND b.criado_em <  janela_90d_ant_fim
          GROUP BY pi.codigo
          HAVING NOT EXISTS (
            SELECT 1 FROM pedido_itens pi2
            JOIN base12 b2 ON b2.id = pi2.pedido_id
            WHERE b2.cli_id = t.cli_id
              AND pi2.codigo = pi.codigo
              AND b2.criado_em >= janela_90d_ini
          )
          ORDER BY valor_ant DESC
        ) d
      ) AS skus_descontinuados
    FROM top20 t
  ),
  pre AS (
    SELECT
      a.cli_id,
      c.nome, c.cidade, c.segmento, c.vendedor_nome,
      a.fat_12m, a.fat_janabr_25, a.fat_janabr_26,
      CASE WHEN COALESCE(a.fat_janabr_25, 0) = 0 THEN NULL
           ELSE ROUND(((a.fat_janabr_26 - a.fat_janabr_25) / a.fat_janabr_25 * 100)::numeric, 2)
      END AS yoy_pct,
      CASE WHEN COALESCE(a.fat_90d_anoanterior, 0) = 0 THEN NULL
           ELSE ROUND(((a.fat_90d - a.fat_90d_anoanterior) / a.fat_90d_anoanterior * 100)::numeric, 2)
      END AS yoy_90d_pct,
      m.fat_mensal,
      ROUND(tk.ticket_medio_12p::numeric, 2) AS ticket_medio_12p,
      ROUND(tk.ticket_medio_3p::numeric,  2) AS ticket_medio_3p,
      ROUND(f.freq_hist_dias::numeric, 1) AS freq_hist_dias,
      ROUND(f.freq_90d_dias::numeric,  1) AS freq_90d_dias,
      s.skus_12m::int, s.skus_90d::int, s.skus_90d_anteriores::int,
      CASE WHEN COALESCE(s.skus_90d_anteriores, 0) = 0 THEN NULL
           ELSE ROUND(((s.skus_90d::numeric - s.skus_90d_anteriores) / s.skus_90d_anteriores * 100)::numeric, 2)
      END AS mix_var_pct,
      a.ultimo_pedido,
      EXTRACT(day FROM (hoje - a.ultimo_pedido))::int AS dias_sem_pedido,
      t5.top5_skus,
      ds.skus_descontinuados
    FROM agg a
    JOIN clientes c   ON c.id = a.cli_id
    LEFT JOIN mensal m   ON m.cli_id = a.cli_id
    LEFT JOIN tickets tk ON tk.cli_id = a.cli_id
    LEFT JOIN freq f     ON f.cli_id = a.cli_id
    LEFT JOIN skus s     ON s.cli_id = a.cli_id
    LEFT JOIN top5 t5    ON t5.cli_id = a.cli_id
    LEFT JOIN desc_skus ds ON ds.cli_id = a.cli_id
  ),
  med_segmento AS (
    SELECT pre.segmento,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY pre.yoy_pct) AS mediana
    FROM pre
    WHERE pre.segmento IS NOT NULL AND pre.yoy_pct IS NOT NULL
    GROUP BY pre.segmento
  )
  SELECT
    p.cli_id,
    p.nome, p.cidade, p.segmento, p.vendedor_nome,
    ROUND(p.fat_12m::numeric, 2),
    ROUND(COALESCE(p.fat_janabr_25, 0)::numeric, 2),
    ROUND(COALESCE(p.fat_janabr_26, 0)::numeric, 2),
    p.yoy_pct, p.yoy_90d_pct,
    ROUND(ms.mediana::numeric, 2) AS yoy_segmento_mediana,
    p.fat_mensal,
    p.ticket_medio_12p, p.ticket_medio_3p,
    p.freq_hist_dias,   p.freq_90d_dias,
    p.skus_12m, p.skus_90d, p.skus_90d_anteriores, p.mix_var_pct,
    p.ultimo_pedido, p.dias_sem_pedido,
    p.top5_skus, p.skus_descontinuados,
    CASE
      WHEN (p.yoy_pct IS NOT NULL AND p.yoy_pct < -25)
        OR p.dias_sem_pedido > 60
        OR (p.mix_var_pct IS NOT NULL AND p.mix_var_pct < -30)
        THEN 'CRITICO'
      WHEN (p.yoy_pct IS NOT NULL AND p.yoy_pct BETWEEN -25 AND -10)
        OR p.dias_sem_pedido BETWEEN 30 AND 60
        OR (p.mix_var_pct IS NOT NULL AND p.mix_var_pct BETWEEN -30 AND -15)
        THEN 'ATENCAO'
      WHEN p.yoy_pct IS NOT NULL AND p.yoy_pct > 10
        THEN 'CRESCENDO'
      ELSE 'ESTAVEL'
    END AS status
  FROM pre p
  LEFT JOIN med_segmento ms ON ms.segmento = p.segmento
  ORDER BY p.fat_12m DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_diagnostico_top20() TO anon, authenticated;
