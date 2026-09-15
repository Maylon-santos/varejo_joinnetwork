-- Somente Admin recebe acesso automaticamente. Os demais cargos são configurados na tela.
UPDATE access_roles SET permissoes=permissoes || '["fila:ler","fila:operar","fila:gerenciar"]'::jsonb WHERE role='Admin';
CREATE FUNCTION permissoes_admin_fila() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='Admin' THEN
  NEW.permissoes=NEW.permissoes || '["fila:ler","fila:operar","fila:gerenciar"]'::jsonb;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fila_perfis_novos BEFORE INSERT ON access_roles FOR EACH ROW EXECUTE FUNCTION permissoes_admin_fila();
