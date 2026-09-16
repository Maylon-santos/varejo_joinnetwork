import {validarDia} from './sincronizar-cancelamentos.mjs';
export class ErroApi extends Error{constructor(status,codigo){super(codigo);this.status=status;}}
export function filtros(params,filiais){
 const filial=params.get('filial'),inicio=params.get('inicio'),fim=params.get('fim');
 if(!filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
 try{validarDia(inicio);validarDia(fim);}catch{throw new ErroApi(400,'PERIODO_INVALIDO');}
 if(inicio>fim||(Date.parse(fim)-Date.parse(inicio))/86400000>365)throw new ErroApi(400,'PERIODO_INVALIDO');
 const limite=params.get('limite')??'50',pagina=params.get('pagina')??'1';
 if(!/^\d+$/.test(limite)||!/^\d+$/.test(pagina)||Number(limite)<1||Number(limite)>100||Number(pagina)<1||Number(pagina)>10000)throw new ErroApi(400,'PAGINACAO_INVALIDA');
 return {filial,inicio,fim,limite:Number(limite),pagina:Number(pagina)};
}
const efetiva="(o.cancelada OR EXISTS(SELECT 1 FROM cancelamentos c WHERE c.cod_operacao=o.cod_operacao AND c.tipo_operacao=o.tipo_operacao AND c.filial=o.filial))";
const statusConciliacao="(CASE WHEN o.erro_erp_confirmado_por IS NOT NULL AND o.conciliacao IN ('quantidade_divergente','divergente') THEN 'erro_erp_confirmado' ELSE o.conciliacao END)";
const scopeBase='o.filial=$1 AND o.data_operacao BETWEEN $2::date AND $3::date';
export const elegivel=`o.tipo_operacao='S' AND NOT ${efetiva}`;
export function criarPainel(pool,tenant,filiais,vendedores=null){
 const scope=scopeBase+' AND ($4::text IS NULL OR o.vendedor_codigo=$4)';
 const vendedor=filial=>vendedores===null?null:(vendedores[filial]??'');
 function argumentos(f){if(!filiais.includes(f.filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');return [f.filial,f.inicio,f.fim,vendedor(f.filial)];}

 async function snapshot(executar){
  const client=await pool.connect();
  try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await client.query("SET LOCAL statement_timeout='5s'");
   const r=await client.query('SELECT tenant_key FROM tenant_identity WHERE singleton');
   if(r.rows[0]?.tenant_key!==tenant)throw new Error('TENANT_INCORRETO');
   const result=await executar(client);await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async function cobertura(db,f){
  const status=(await db.query(`SELECT c.recurso,c.ate::text,s.ultimo_sucesso,s.ultimo_erro_codigo,s.falhas_consecutivas
   FROM sync_checkpoints c LEFT JOIN sync_status s USING(filial,recurso) WHERE c.filial=$1 ORDER BY c.recurso`,[f.filial])).rows;
  const temCobertura=['vendas','cancelamentos'].every(recurso=>status.some(s=>s.recurso===recurso&&s.ate>=f.fim));
  const minimo=(await db.query('SELECT min(data_operacao)::text AS data FROM operacoes WHERE filial=$1',[f.filial])).rows[0].data;
  return {sincronizacao:status,checkpoints_cobrem_fim:temCobertura,primeira_operacao_importada:minimo,
   observacao:'Checkpoints não substituem homologação com o ERP; períodos anteriores ao início importado podem não ter cobertura.'};
 }
 return {
  restringir:(permitidas,porVendedor=null)=>criarPainel(pool,tenant,filiais.filter(f=>permitidas.includes(f)),porVendedor),
  filiais:()=>snapshot(async db=>{
   const cadastros=(await db.query('SELECT filial::text,cod_filial,trans_id::text FROM cadastro_filiais WHERE filial=ANY($1::bigint[])',[filiais])).rows;
   const porId=new Map(cadastros.map(c=>[c.filial,c]));
   return {filiais:filiais.map(id=>porId.get(id)??{filial:id,cod_filial:null,trans_id:null}),tenant};
  }),
  indicadores:f=>snapshot(async db=>{
   const args=argumentos(f);
   const total=(await db.query(`SELECT count(*)::integer AS vendas,
    COALESCE(sum(o.valor_final_centavos),0)::text AS valor_vendas_centavos,
    COALESCE(sum(o.quantidade),0)::text AS pecas_cabecalho,
    round(sum(o.valor_final_centavos)::numeric/NULLIF(count(*),0),0)::text AS ticket_medio_centavos,
    round(sum(o.quantidade)::numeric/NULLIF(count(*),0),4)::text AS pecas_por_venda,
    count(*) FILTER(WHERE ${statusConciliacao} NOT IN ('conciliada','erro_erp_confirmado'))::integer AS vendas_com_pendencia
    FROM operacoes o WHERE ${scope} AND ${elegivel}`,args)).rows[0];
   const qualidade=(await db.query(`SELECT ${statusConciliacao} AS conciliacao,count(*)::integer AS quantidade FROM operacoes o
    WHERE ${scope} AND ${elegivel} GROUP BY ${statusConciliacao} ORDER BY ${statusConciliacao}`,args)).rows;
   const excluidas=(await db.query(`SELECT count(*) FILTER(WHERE ${efetiva})::integer AS canceladas,
    count(*) FILTER(WHERE o.tipo_operacao<>'S' AND NOT ${efetiva})::integer AS outras_operacoes_ativas
    FROM operacoes o WHERE ${scope}`,args)).rows[0];
   const serie=(await db.query(`SELECT o.data_operacao::text AS data,count(*)::integer AS vendas,sum(o.valor_final_centavos)::text AS valor_vendas_centavos,
    sum(o.quantidade)::text AS pecas_cabecalho FROM operacoes o WHERE ${scope} AND ${elegivel}
    GROUP BY o.data_operacao ORDER BY o.data_operacao`,args)).rows;
   return {filtros:{filial:f.filial,inicio:f.inicio,fim:f.fim},...total,indicadores_provisorios:true,qualidade,excluidas,serie_diaria:serie,...await cobertura(db,f),
    regra:'Operações S não canceladas. Valor e peças do cabeçalho ERP; inclui pendências sinalizadas. Entradas não são subtraídas como devoluções sem regra homologada. Bruto/líquido ainda não definidos.'};
  }),
  vendas:(f,{tipo='S',estado='ativas',conciliacao}={})=>snapshot(async db=>{
   if(!['S','E','todas'].includes(tipo)||!['ativas','canceladas','todas'].includes(estado))throw new ErroApi(400,'FILTRO_INVALIDO');
   const args=argumentos(f);let where=scope;
   if(tipo!=='todas'){args.push(tipo);where+=` AND o.tipo_operacao=$${args.length}`;}
   if(estado!=='todas')where+=` AND ${estado==='ativas'?'NOT ':''}${efetiva}`;
   if(conciliacao){if(conciliacao.length>50)throw new ErroApi(400,'FILTRO_INVALIDO');args.push(conciliacao);where+=` AND ${statusConciliacao}=$${args.length}`;}
   const total=(await db.query(`SELECT count(*)::integer AS total FROM operacoes o WHERE ${where}`,args)).rows[0].total;
   args.push(f.limite,(f.pagina-1)*f.limite);
   const rows=(await db.query(`SELECT o.cod_operacao::text,o.tipo_operacao,o.filial::text,o.data_operacao::text,
    o.quantidade,o.valor_final_centavos::text,${statusConciliacao} AS conciliacao,o.vendedor_codigo,o.vendedor_nome,${efetiva} AS cancelada
    FROM operacoes o WHERE ${where} ORDER BY o.data_operacao DESC,o.cod_operacao DESC,o.tipo_operacao
    LIMIT $${args.length-1} OFFSET $${args.length}`,args)).rows;
   return {total,pagina:f.pagina,limite:f.limite,operacoes:rows,...await cobertura(db,f)};
  }),
  clientes:(f,busca='',mes='')=>snapshot(async db=>{
   if(typeof busca!=='string'||busca.length>100)throw new ErroApi(400,'BUSCA_INVALIDA');
   if(!/^(?:0[1-9]|1[0-2])?$/.test(mes))throw new ErroApi(400,'MES_INVALIDO');
   const args=[...argumentos(f),busca.trim(),mes];
   const cte=`WITH base AS (
    SELECT DISTINCT ON(o.cod_operacao,o.tipo_operacao,c.dado->>'cliente_codigo')
      o.cod_operacao,o.tipo_operacao,o.data_operacao,c.dado,c.dado->>'cliente_codigo' AS codigo
    FROM operacoes o CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.clientes,'[]'::jsonb)) WITH ORDINALITY c(dado,ordem)
    WHERE ${scope} AND c.dado->>'cliente_codigo' ~ '^[1-9][0-9]{0,29}$'
    ORDER BY o.cod_operacao,o.tipo_operacao,c.dado->>'cliente_codigo',c.ordem
   ), unificados AS (
    SELECT codigo,count(*)::integer AS movimentacoes,min(data_operacao)::text AS primeira_movimentacao,
     max(data_operacao)::text AS ultima_movimentacao,
     (array_agg(dado ORDER BY data_operacao DESC,cod_operacao DESC,tipo_operacao))[1] AS cadastro
    FROM base GROUP BY codigo
   ), encontrados AS (SELECT * FROM unificados WHERE ($5::text='' OR strpos(lower(COALESCE(cadastro->>'nome','')),lower($5))>0 OR strpos(codigo,$5)>0) AND ($6::text='' OR left(cadastro->>'aniversario_mm_dd',2)=$6))`;
   const total=(await db.query(cte+' SELECT count(*)::integer AS total FROM encontrados',args)).rows[0].total;
   const clientes=(await db.query(cte+` SELECT codigo,cadastro->>'nome' AS nome,COALESCE(cadastro->'contatos','[]'::jsonb) AS contatos,
     cadastro->>'aniversario_mm_dd' AS aniversario_mm_dd,
     movimentacoes,primeira_movimentacao,ultima_movimentacao FROM encontrados ORDER BY lower(cadastro->>'nome'),codigo LIMIT $7 OFFSET $8`,[...args,f.limite,(f.pagina-1)*f.limite])).rows;
   const coberturaClientes=(await db.query(`SELECT count(*) FILTER(WHERE NOT o.clientes_identidade_importada)::integer AS operacoes_pendentes,
     count(*) FILTER(WHERE o.clientes_identidade_importada AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(o.clientes,'[]'::jsonb)) c WHERE c->>'cliente_codigo' IS NULL))::integer AS operacoes_sem_identificador
     FROM operacoes o WHERE ${scope}`,argumentos(f))).rows[0];
   return {total,clientes,pagina:f.pagina,limite:f.limite,...coberturaClientes,...await cobertura(db,f)};
  }),
  detalhe:(filial,tipo,codigo)=>snapshot(async db=>{
   if(!filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
   if(!/^[A-Z]+$/.test(tipo)||!/^\d{1,18}$/.test(codigo))throw new ErroApi(400,'CHAVE_INVALIDA');
   const args=[codigo,tipo,filial,vendedor(filial)];
   const r=await db.query(`SELECT o.*,o.conciliacao AS conciliacao_original,${statusConciliacao} AS conciliacao,o.data_operacao::text,${efetiva} AS cancelada FROM operacoes o
    WHERE o.cod_operacao=$1 AND o.tipo_operacao=$2 AND o.filial=$3 AND ($4::text IS NULL OR o.vendedor_codigo=$4)`,args);
   if(!r.rowCount)throw new ErroApi(404,'OPERACAO_NAO_ENCONTRADA');
   const itens=(await db.query('SELECT ordem,sku,cod_produto,descricao,quantidade,imagem_url,preco_centavos::text,preco_tabela_centavos::text,desconto_informado::text,preco_aplicado_centavos::text FROM operacao_itens WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 ORDER BY ordem',args.slice(0,3))).rows;
   const cancelamento=(await db.query('SELECT data_cancelou FROM cancelamentos WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',args.slice(0,3))).rows[0]??null;
   return {operacao:r.rows[0],itens,cancelamento};
  }),
  ranking:(f,ordenar='valor')=>snapshot(async db=>{
   const ordem={valor:'valor_vendas',pecas:'pecas',ticket:'ticket'}[ordenar];if(!ordem)throw new ErroApi(400,'ORDENACAO_INVALIDA');
   const args=argumentos(f);
   const total=(await db.query(`SELECT count(*)::integer AS total FROM (SELECT vendedor_codigo FROM operacoes o WHERE ${scope} AND ${elegivel} GROUP BY vendedor_codigo) r`,args)).rows[0].total;
   const rows=(await db.query(`WITH ranking AS (SELECT o.vendedor_codigo,
     (array_agg(o.vendedor_nome ORDER BY o.data_operacao DESC,o.cod_operacao DESC))[1] AS vendedor_nome,
     count(*)::integer AS vendas,sum(o.valor_final_centavos) AS valor_vendas,sum(o.quantidade) AS pecas,
     round(sum(o.valor_final_centavos)::numeric/NULLIF(count(*),0),0) AS ticket,
     count(*) FILTER(WHERE ${statusConciliacao} NOT IN ('conciliada','erro_erp_confirmado'))::integer AS vendas_com_pendencia
     FROM operacoes o WHERE ${scope} AND ${elegivel} GROUP BY o.vendedor_codigo)
    SELECT vendedor_codigo,COALESCE(vendedor_nome,'Sem identificação') AS vendedor_nome,vendas,
     valor_vendas::text AS valor_vendas_centavos,pecas::text AS pecas_cabecalho,ticket::text AS ticket_medio_centavos,round(pecas::numeric/NULLIF(vendas,0),4)::text AS pecas_por_venda,vendas_com_pendencia
    FROM ranking ORDER BY ${ordem} DESC,vendedor_codigo NULLS LAST LIMIT $5 OFFSET $6`,[...args,f.limite,(f.pagina-1)*f.limite])).rows;
   return {total,pagina:f.pagina,limite:f.limite,ordenar,ranking:rows,indicadores_provisorios:true,...await cobertura(db,f)};
  }),
 };
}
