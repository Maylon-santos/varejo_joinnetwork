import {ErroApi} from './painel.mjs';
import {escopoUsuario,exigirPermissao} from './permissoes.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';

const medidas=['abordagens','iniciados','em_abordagem','em_atendimento','nao_iniciados','com_venda','sem_venda','concluidos','em_movimento_intenso','tempo_atendimento_segundos','tempo_disponivel_segundos'];
const vazio=()=>Object.fromEntries(medidas.map(k=>[k,0]));
const completar=row=>({...row,conversao_informada:row.concluidos?100*row.com_venda/row.concluidos:null,tempo_medio_segundos:row.concluidos?row.tempo_atendimento_segundos/row.concluidos:null});
export function consolidarFila(linhas){
 const totais=vazio(),vendedores=new Map(),dias=new Map();
 for(const linha of linhas){
  if(!vendedores.has(linha.vendedor_codigo))vendedores.set(linha.vendedor_codigo,{vendedor_codigo:linha.vendedor_codigo,nome:linha.nome,...vazio()});
  if(!dias.has(linha.dia))dias.set(linha.dia,{dia:linha.dia,...vazio()});
  const vendedor=vendedores.get(linha.vendedor_codigo);vendedor.nome=linha.nome;
  for(const target of [totais,vendedor,dias.get(linha.dia)])for(const k of medidas)target[k]+=Number(linha[k]??0);
 }
 return {totais:completar(totais),por_vendedor:[...vendedores.values()].map(completar),por_dia:[...dias.values()].map(completar)};
}

export function filtrosRelatorioFila(user,tenant,filiais,params){
 if(!user||user.tenant_key!==tenant)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
 const acesso=escopoUsuario(user,filiais);
 exigirPermissao(acesso.permissoes,'fila:ler');exigirPermissao(acesso.permissoes,'fila:relatorios');
 const {filial,inicio,fim,vendedor='',pagina='1'}=params;
 if(!acesso.filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
 try{validarDia(inicio);validarDia(fim);}catch{throw new ErroApi(400,'PERIODO_INVALIDO');}
 const dias=(Date.parse(fim)-Date.parse(inicio))/86400000+1;
 if(dias<1||dias>31)throw new ErroApi(400,'FILA_PERIODO_RELATORIO_INVALIDO');
 if(typeof vendedor!=='string'||vendedor.length>100||typeof pagina!=='string'||!/^\d{1,6}$/.test(pagina)||Number(pagina)<1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
 const proprio=acesso.vendedores?.[filial];
 if(acesso.vendedores&&(!proprio||(vendedor&&vendedor!==proprio)))throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
 return {filial,inicio,fim,vendedor:acesso.vendedores?proprio:(vendedor||null),pagina:Number(pagina),limite:30,somente_proprios:Boolean(acesso.vendedores),gerenciar:acesso.permissoes.includes('fila:gerenciar')&&!user.somente_proprias_vendas};
}

// O escopo entra antes de agregar, paginar ou calcular tempos.
const escopo=`p.filial=$1 AND p.dia BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR p.vendedor_codigo=$4)`;
const base=`FROM fila_atendimentos a JOIN fila_participantes p USING(filial,dia,vendedor_codigo) WHERE ${escopo}`;

export async function lerRelatorioFila(pool,tenant,filiais,user,params){
 const f=filtrosRelatorioFila(user,tenant,filiais,params),args=[f.filial,f.inicio,f.fim,f.vendedor],db=await pool.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='8s'");
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  const agora=(await db.query('SELECT transaction_timestamp() AS agora')).rows[0].agora;
  const linhas=(await db.query(`SELECT p.dia::text,p.vendedor_codigo,p.nome,
   count(a.id)::int AS abordagens,count(a.iniciado_em)::int AS iniciados,
   count(a.id) FILTER(WHERE a.finalizado_em IS NULL AND a.iniciado_em IS NULL)::int AS em_abordagem,
   count(a.id) FILTER(WHERE a.finalizado_em IS NULL AND a.iniciado_em IS NOT NULL)::int AS em_atendimento,
   count(a.id) FILTER(WHERE a.resultado='nao_iniciado')::int AS nao_iniciados,
   count(a.id) FILTER(WHERE a.resultado='com_venda')::int AS com_venda,
   count(a.id) FILTER(WHERE a.resultado='sem_venda')::int AS sem_venda,
   count(a.id) FILTER(WHERE a.resultado IN ('com_venda','sem_venda'))::int AS concluidos,
   count(a.id) FILTER(WHERE a.movimento_intenso)::int AS em_movimento_intenso,
   COALESCE(sum(extract(epoch FROM a.finalizado_em-a.iniciado_em)) FILTER(WHERE a.resultado IN ('com_venda','sem_venda')),0)::float8 AS tempo_atendimento_segundos
   FROM fila_participantes p LEFT JOIN fila_atendimentos a USING(filial,dia,vendedor_codigo)
   WHERE ${escopo} GROUP BY p.dia,p.vendedor_codigo,p.nome ORDER BY p.dia,p.vendedor_codigo`,args)).rows;
  // Reconstrói disponibilidade pelos eventos existentes da R16.1. Não confunde
  // tempo disponível com espera do cliente nem conta abordagem, pausa ou ausência.
  const tempos=(await db.query(`WITH transicoes AS (
   SELECT p.dia,p.vendedor_codigo,e.criado_em,(e.dados->'pedido'->>'versao')::int AS versao,
    e.acao IN ('abrir','chegada','retornar','concluir') AS disponivel,
    LEAST(COALESCE(j.fechada_em,$5::timestamptz),$5::timestamptz) AS fim
   FROM fila_participantes p JOIN fila_jornadas j USING(filial,dia)
   JOIN fila_eventos e USING(filial,dia)
   LEFT JOIN fila_atendimentos a ON e.acao='concluir' AND a.id=(e.dados->'pedido'->>'atendimento')::uuid
   WHERE ${escopo} AND (
    (e.acao='abrir' AND (e.dados->'pedido'->'vendedores') ? p.vendedor_codigo)
    OR (e.acao IN ('chegada','retornar','abordar','pausar','ausente') AND e.dados->'pedido'->>'vendedor'=p.vendedor_codigo)
    OR (e.acao='concluir' AND a.vendedor_codigo=p.vendedor_codigo))
  ), intervalos AS (
   SELECT *,lead(criado_em,1,fim) OVER(PARTITION BY dia,vendedor_codigo ORDER BY criado_em,versao) AS proximo FROM transicoes
  ) SELECT dia::text,vendedor_codigo,COALESCE(sum(GREATEST(0,extract(epoch FROM LEAST(proximo,fim)-criado_em))) FILTER(WHERE disponivel),0)::float8 AS segundos
   FROM intervalos GROUP BY dia,vendedor_codigo`,[...args,agora])).rows;
  const temposPorChave=new Map(tempos.map(t=>[`${t.dia}/${t.vendedor_codigo}`,t.segundos]));
  for(const l of linhas)l.tempo_disponivel_segundos=temposPorChave.get(`${l.dia}/${l.vendedor_codigo}`)??0;
  const resumo=consolidarFila(linhas);
  const motivos=(await db.query(`SELECT a.resultado,a.motivo,count(*)::int AS quantidade ${base}
   AND a.resultado IN ('sem_venda','nao_iniciado') GROUP BY a.resultado,a.motivo ORDER BY quantidade DESC,a.resultado,a.motivo`,args)).rows;
  const registros=(await db.query(`SELECT a.id,a.dia::text,a.vendedor_codigo,p.nome,a.modalidade,a.movimento_intenso,
   a.abordado_em,a.iniciado_em,a.finalizado_em,a.resultado,a.motivo,
   CASE WHEN a.finalizado_em IS NOT NULL AND a.iniciado_em IS NOT NULL THEN extract(epoch FROM a.finalizado_em-a.iniciado_em)::float8 END AS duracao_segundos
   ${base} ORDER BY a.abordado_em DESC,a.id DESC LIMIT $5 OFFSET $6`,[...args,f.limite,(f.pagina-1)*f.limite])).rows;
  // Eventos da jornada são exclusivos da gestão; o relatório do vendedor não
  // recebe autores, justificativas ou dados dos colegas.
  const movimentos=f.gerenciar?(await db.query(`SELECT dia::text,autor::text,dados->>'autor_nome' AS responsavel,criado_em,dados->'pedido'->'ativo' AS ativo,dados->'pedido'->>'motivo' AS motivo
   FROM fila_eventos WHERE filial=$1 AND dia BETWEEN $2::date AND $3::date AND acao='movimento_intenso'
   ORDER BY criado_em DESC LIMIT 100`,args.slice(0,3))).rows:[];
  await db.query('COMMIT');
  return {...f,...resumo,motivos,registros,movimentos,consultado_em:agora,total_registros:resumo.totais.abordagens};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
