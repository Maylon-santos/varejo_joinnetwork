import pg from 'pg';
export function criarPool(connectionString, options = {}) {
  if (!connectionString) throw new Error('URL do PostgreSQL não configurada');
  return new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000, ...options });
}
// Não retornar mensagens de dependências que possam conter URL ou parâmetros.
export function erroSeguro(error) {
  const code = error?.code || error?.message;
  return /^[A-Z0-9_]{2,50}$/.test(code ?? '') ? code : 'FALHA_VALIDACAO_OU_EXECUCAO';
}
