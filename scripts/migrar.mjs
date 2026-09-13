import { criarPool, erroSeguro } from '../backend/src/postgres.mjs';
import { migrar } from '../backend/src/migracoes.mjs';
const control = criarPool(process.env.CONTROL_DATABASE_URL);
const tenant = criarPool(process.env.TENANT_DATABASE_URL);
try {
  const key = process.env.TENANT_KEY;
  if (!key) throw new Error('Tenant não configurado');
  console.log('Migrations central:', (await migrar(control, new URL('../database/migrations/control/', import.meta.url))).length);
  console.log('Migrations tenant:', (await migrar(tenant, new URL('../database/migrations/tenant/', import.meta.url))).length);
  await tenant.query('INSERT INTO tenant_identity(singleton,tenant_key) VALUES(true,$1) ON CONFLICT(singleton) DO NOTHING', [key]);
  const identity = await tenant.query('SELECT tenant_key FROM tenant_identity');
  if (identity.rows[0]?.tenant_key !== key) throw new Error('Banco pertence a outro tenant');
  const db = (await tenant.query('SELECT current_database() AS nome')).rows[0].nome;
  await control.query('INSERT INTO tenants(tenant_key,nome,database_name) VALUES($1,$2,$3) ON CONFLICT(tenant_key) DO NOTHING', [key, process.env.TENANT_DISPLAY_NAME || key, db]);
  const registered = await control.query('SELECT database_name FROM tenants WHERE tenant_key=$1', [key]);
  if (registered.rows[0]?.database_name !== db) throw new Error('Cadastro central diverge do banco configurado');
  console.log('Identidade do tenant e cadastro central verificados.');
} catch (error) { console.error('Migration não concluída:', erroSeguro(error)); process.exitCode = 1; }
finally { await Promise.all([control.end(), tenant.end()]); }
