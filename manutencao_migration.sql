-- Migration: Sistema de Manutenção
-- Tabelas: equipamentos, ordens_servico
-- Novo setor: manutencao

-- 1. Atualizar constraint de setor nos usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_setor_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_setor_check CHECK (setor IN ('admin','comercial','galpao','motorista','vendedor','manutencao'));

-- 2. Tabela de Equipamentos (inventário)
CREATE TABLE IF NOT EXISTS equipamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  modelo TEXT,
  numero_serie TEXT,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  local_instalacao TEXT,
  status TEXT DEFAULT 'instalado' CHECK (status IN ('instalado','em_estoque','defeito','descartado')),
  data_instalacao DATE,
  ultima_manutencao DATE,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso publico equipamentos" ON equipamentos FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS ordens_servico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_os TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('instalacao','manutencao','troca','desinstalacao')),
  cliente_id UUID REFERENCES clientes(id),
  cliente_nome TEXT NOT NULL,
  cidade TEXT,
  endereco TEXT,
  equipamento_id UUID REFERENCES equipamentos(id),
  equipamento_tipo TEXT,
  descricao TEXT NOT NULL,
  data_agendada DATE NOT NULL,
  periodo TEXT DEFAULT 'manha' CHECK (periodo IN ('manha','tarde','dia_todo')),
  solicitante_nome TEXT NOT NULL,
  tecnico_nome TEXT,
  status TEXT DEFAULT 'AGENDADA' CHECK (status IN ('AGENDADA','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  observacao_conclusao TEXT,
  foto_antes TEXT,
  foto_depois TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  concluido_em TIMESTAMPTZ
);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso publico os" ON ordens_servico FOR ALL USING (true) WITH CHECK (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE equipamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE ordens_servico;
