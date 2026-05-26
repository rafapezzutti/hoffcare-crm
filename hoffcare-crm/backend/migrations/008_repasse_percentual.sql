-- Migration 008: Percentual de repasse para profissionais odontológicos
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS repasse_percentual NUMERIC(5,2) DEFAULT NULL;

-- Comentário: valor entre 0 e 100 representando o % pago ao profissional
-- sobre o total dos procedimentos realizados. NULL = sem repasse configurado (recebe 100%).
-- Editável apenas por usuários com role 'responsavel' ou 'admin'.
