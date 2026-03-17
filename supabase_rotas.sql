-- ─── TABELA ROTAS ───
create table if not exists rotas (
  id uuid primary key default gen_random_uuid(),
  motorista_nome text not null,
  cidade text not null,
  veiculo text not null check (veiculo in ('van','kombi','carro','moto')),
  status text not null default 'ativa' check (status in ('ativa','finalizada')),
  criado_em timestamptz default now()
);

-- ─── TABELA ROTA_PEDIDOS ───
create table if not exists rota_pedidos (
  id uuid primary key default gen_random_uuid(),
  rota_id uuid not null references rotas(id) on delete cascade,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  unique(rota_id, pedido_id)
);

-- ─── RLS ───
alter table rotas enable row level security;
alter table rota_pedidos enable row level security;

create policy "allow_all_rotas" on rotas
  for all using (true) with check (true);

create policy "allow_all_rota_pedidos" on rota_pedidos
  for all using (true) with check (true);

-- ─── ÍNDICES ───
create index if not exists idx_rotas_status on rotas(status);
create index if not exists idx_rotas_motorista on rotas(motorista_nome);
create index if not exists idx_rota_pedidos_rota on rota_pedidos(rota_id);
create index if not exists idx_rota_pedidos_pedido on rota_pedidos(pedido_id);
