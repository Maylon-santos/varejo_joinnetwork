import { readFile } from 'node:fs/promises';
import { criarPool, erroSeguro } from '../backend/src/postgres.mjs';
import { RepositorioPostgres } from '../backend/src/repositorio-postgres.mjs';
import { consultarCancelamentos, sincronizarCancelamentos, validarDia } from '../backend/src/sincronizar-cancelamentos.mjs';
// Execução única. --amostra grava eventos, mas não declara histórico sincronizado.
const args = new Map(process.argv.slice(2).map(a => { const [k,...v]=a.split('=');return [k,v.join('=') || true]; }));
let pool;
try {
  for (const key of args.keys()) if (!['--filial','--fim','--inicio','--amostra'].includes(key)) throw new Error('Argumento desconhecido');
  const filial = String(args.get('--filial') || '');
  const fim = args.get('--fim'); validarDia(fim);
  const config = JSON.parse(await readFile(new URL('../config/piloto.json', import.meta.url)));
  // Agrupamento das demais lojas ainda pendente. Itupeva é a filial validada.
  if (!config.branchIds.includes(filial) || (!config.tenantGroupingConfirmed && filial !== '30098297')) throw new Error('Filial não liberada');
  const tenant = process.env.TENANT_KEY;
  pool = criarPool(process.env.TENANT_DATABASE_URL);
  const repositorio = new RepositorioPostgres(pool, tenant);
  const consultar = janela => consultarCancelamentos({ ...janela, baseUrl: process.env.MILLENNIUM_BASE_URL, token: process.env.MILLENNIUM_BASIC_TOKEN });
  let resultado;
  if (args.has('--amostra')) {
    const inicio=args.get('--inicio'); validarDia(inicio);
    const eventos=await consultar({filial,inicio,fim});
    await repositorio.transacao({tenant,filial}, tx => tx.salvarCancelamentos(eventos));
    resultado={modo:'amostra',filial,inicio,fim,quantidade:eventos.length,checkpointAvancado:false};
  } else {
    if(args.has('--inicio')) throw new Error('Início manual permitido somente em amostra');
    // Primeira execução usa início integral do histórico; retomadas usam checkpoint.
    // Falha fechada se API indicar página parcial. Paginação geral ainda pendente.
    resultado=await sincronizarCancelamentos({repositorio,tenant,filial,inicioHistorico:config.initialImport.from,fim,consultar});
    resultado={modo:'ciclo_unico',filial,...resultado,checkpointAvancado:true};
  }
  console.log(JSON.stringify(resultado));
} catch(error) { console.error('Sincronização não concluída:',erroSeguro(error));process.exitCode=1; }
finally { await pool?.end(); }
