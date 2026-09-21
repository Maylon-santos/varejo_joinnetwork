UPDATE access_roles SET permissoes=permissoes || '["consolidado:ler","metas:gerenciar"]'::jsonb
 WHERE role IN ('Admin','Diretoria','Supervisao');
CREATE FUNCTION permissoes_consolidado_metas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role IN ('Admin','Diretoria','Supervisao') THEN NEW.permissoes=NEW.permissoes || '["consolidado:ler","metas:gerenciar"]'::jsonb; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consolidado_perfis_novos BEFORE INSERT ON access_roles FOR EACH ROW EXECUTE FUNCTION permissoes_consolidado_metas();
