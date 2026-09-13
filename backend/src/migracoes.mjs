import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function migrar(pool, diretorio) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended(current_database() || current_schema() || ':migrations',0))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, sha256 text NOT NULL, aplicado_em timestamptz NOT NULL DEFAULT now())');
    const aplicadas = [];
    for (const nome of (await readdir(diretorio)).filter(x => x.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(nome, diretorio), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const anterior = await client.query('SELECT sha256 FROM schema_migrations WHERE nome=$1', [nome]);
      if (anterior.rowCount) {
        if (anterior.rows[0].sha256 !== hash) throw new Error('Migration aplicada foi modificada');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(nome,sha256) VALUES($1,$2)', [nome, hash]);
      aplicadas.push(nome);
    }
    await client.query('COMMIT');
    return aplicadas;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
