-- Banco do tenant, como owner. Sem escrita nos registros comerciais.
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO varejo_notificacoes_worker',current_database()); END $$;
GRANT USAGE ON SCHEMA public TO varejo_notificacoes_worker;
GRANT SELECT ON tenant_identity,operacoes,cancelamentos,sync_status,sync_checkpoints,cadastro_filiais TO varejo_notificacoes_worker;
