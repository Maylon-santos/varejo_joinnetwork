import {ErroApi,filtros,elegivel} from './painel.mjs';
import {escopoUsuario,exigirPermissao} from './permissoes.mjs';
export function criarProdutos(pool,tenant,filiais){
 async function snapshot(user,params,executar){
  if(user.tenant_key!==tenant)throw new ErroApi(403,'TENANT_INCORRETO');
  const acesso=escopoUsuario(user,filiais);exigirPermissao(acesso.permissoes,'produtos:ler');
  if(!acesso.filiais.includes(params.get('filial')))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
  const busca=params.get('busca')??'',pagina=params.get('pagina')??'1';
  if(busca.length>100||!/^\d{1,5}$/.test(pagina)||+pagina<1||+pagina>10000)throw new ErroApi(400,'FILTRO_INVALIDO');
  const db=await pool.connect();
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
   if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
   const result=await executar(db,acesso,{filial:params.get('filial'),busca:busca.trim(),pagina:+pagina,limite:30});await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 return {
  top:(user,params)=>snapshot(user,params,async(db,acesso)=>{
   exigirPermissao(acesso.permissoes,'vendas:ler');const f=filtros(params,acesso.filiais);
   const args=[f.filial,f.inicio,f.fim,acesso.vendedores===null?null:(acesso.vendedores[f.filial]??'')];
   const cte=`WITH itens AS (SELECT i.*,o.data_operacao,
    CASE WHEN NULLIF(i.cod_produto,'') IS NOT NULL THEN 'produto:'||i.cod_produto WHEN NULLIF(i.sku,'') IS NOT NULL THEN 'sku:'||i.sku ELSE 'item:'||i.cod_operacao||':'||i.ordem END AS chave
    FROM operacoes o JOIN operacao_itens i USING(cod_operacao,tipo_operacao,filial)
    WHERE o.filial=$1 AND o.data_operacao BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR o.vendedor_codigo=$4) AND ${elegivel}),
    grupos AS (SELECT chave,max(cod_produto) AS cod_produto,
     (array_agg(descricao ORDER BY data_operacao DESC,cod_operacao DESC,ordem))[1] AS descricao,
     count(DISTINCT sku)::int AS variacoes,sum(quantidade) AS pecas,count(DISTINCT cod_operacao)::int AS vendas,
     sum(quantidade::numeric*preco_centavos) AS subtotal_centavos,
     (array_agg(jsonb_build_object('filial',filial::text,'tipo_operacao',tipo_operacao,'cod_operacao',cod_operacao::text,'ordem',ordem)
       ORDER BY data_operacao DESC,cod_operacao DESC,ordem) FILTER(WHERE NULLIF(imagem_url,'') IS NOT NULL))[1] AS imagem
     FROM itens GROUP BY chave)`;
   const total=(await db.query(`${cte} SELECT count(*)::int AS produtos,COALESCE(sum(pecas),0)::text AS pecas FROM grupos`,args)).rows[0];
   const rows=(await db.query(`${cte} SELECT chave,cod_produto,descricao,variacoes,pecas::text,vendas,subtotal_centavos::text,
    round(100*pecas::numeric/NULLIF(sum(pecas) OVER(),0),4)::text AS participacao_percentual,
    ${acesso.permissoes.includes('imagens:ler')?'imagem':'NULL::jsonb AS imagem'} FROM grupos ORDER BY grupos.pecas DESC,grupos.subtotal_centavos DESC,grupos.chave LIMIT 20`,args)).rows;
   return {top:rows,total,agrupamento:'produto',criterio:'pecas',filtros:f};
  }),
  resumoEstoque:(user,params)=>snapshot(user,params,async(db,acesso,f)=>{
   exigirPermissao(acesso.permissoes,'estoque:ler');
   const grupos={};
   for(const campo of ['marca','categoria'])grupos[campo]=(await db.query(`WITH base AS (
    SELECT COALESCE(NULLIF(p.classificacao->$2->>'codigo',''),'nao_classificado') AS codigo,
      p.classificacao->$2->>'descricao' AS nome,e.* FROM estoque_atual e JOIN cadastro_produtos p USING(produto) WHERE filial=$1)
    SELECT codigo,CASE WHEN codigo='nao_classificado' THEN 'Sem classificação' ELSE COALESCE(max(NULLIF(nome,'')),codigo) END AS nome,
     count(*)::int AS skus,count(*) FILTER(WHERE NOT presente_ultima_carga OR saldo IS NULL)::int AS sem_saldo,
     count(*) FILTER(WHERE presente_ultima_carga AND saldo<0)::int AS negativos,
     sum(saldo) FILTER(WHERE presente_ultima_carga)::text AS saldo_disponivel
    FROM base GROUP BY codigo ORDER BY codigo='nao_classificado',nome,codigo`,[f.filial,campo])).rows;
   const sincronizacao=(await db.query("SELECT ultimo_sucesso,ultimo_erro_codigo,ultimo_sucesso<now()-interval '30 minutes' AS desatualizado FROM sync_estoques WHERE filial=$1",[f.filial])).rows[0]??null;
   return {grupos,sincronizacao,filial:f.filial};
  }),
  listar:(user,params)=>snapshot(user,params,async(db,acesso,f)=>{
   const estoque=acesso.permissoes.includes('estoque:ler'),estado=params.get('saldo')??'todos';
   if(!['todos','positivo','zero','negativo','desconhecido'].includes(estado))throw new ErroApi(400,'FILTRO_INVALIDO');
   if(estado!=='todos')exigirPermissao(acesso.permissoes,'estoque:ler');
   const condicoes={todos:'true',positivo:'e.presente_ultima_carga AND e.saldo>0',zero:'e.presente_ultima_carga AND e.saldo=0',negativo:'e.presente_ultima_carga AND e.saldo<0',desconhecido:'(NOT e.presente_ultima_carga OR e.saldo IS NULL)'};
   const where=`e.filial=$1 AND ($2::text='' OR strpos(lower(p.descricao),lower($2))>0 OR strpos(lower(p.cod_produto),lower($2))>0 OR strpos(lower(e.sku),lower($2))>0 OR strpos(e.barra,$2)>0) AND ${condicoes[estado]}`;
   const args=[f.filial,f.busca];
   const total=(await db.query(`SELECT count(*)::int AS total FROM estoque_atual e JOIN cadastro_produtos p USING(produto) WHERE ${where}`,args)).rows[0].total;
   const rows=(await db.query(`SELECT e.sku,e.produto::text,p.cod_produto,p.descricao,e.cor,e.tamanho,e.barra,p.classificacao,p.enriquecido_em ${estoque?',CASE WHEN e.presente_ultima_carga THEN e.saldo::text END AS saldo,e.presente_ultima_carga,e.data_atualizacao_erp':''}
    FROM estoque_atual e JOIN cadastro_produtos p USING(produto) WHERE ${where} ORDER BY p.cod_produto,e.sku LIMIT $3 OFFSET $4`,[...args,f.limite,(f.pagina-1)*f.limite])).rows;
   const sync=(await db.query('SELECT ultimo_sucesso,ultima_carga_completa,ultimo_erro_codigo,falhas_consecutivas,ultimo_sucesso<now()-interval \'30 minutes\' AS desatualizado FROM sync_estoques WHERE filial=$1',[f.filial])).rows[0]??null;
   return {total,pagina:f.pagina,limite:f.limite,produtos:rows,estoque_permitido:estoque,sincronizacao:sync,regra:'Saldo disponível informado pelo ERP, já descontadas as reservas. Estoque atual; não é posição histórica do período de vendas.'};
  }),
  indicadores:(user,params)=>snapshot(user,params,async(db,acesso,base)=>{
   exigirPermissao(acesso.permissoes,'vendas:ler');const f=filtros(params,acesso.filiais),vendedor=acesso.vendedores===null?null:(acesso.vendedores[f.filial]??'');
   const args=[f.filial,f.inicio,f.fim,vendedor,base.busca];
   const cte=`WITH itens AS (
    SELECT i.*,o.data_operacao FROM operacoes o JOIN operacao_itens i USING(cod_operacao,tipo_operacao,filial)
    WHERE o.filial=$1 AND o.data_operacao BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR o.vendedor_codigo=$4) AND ${elegivel}
    AND ($5::text='' OR strpos(lower(i.descricao),lower($5))>0 OR strpos(lower(i.cod_produto),lower($5))>0 OR strpos(lower(i.sku),lower($5))>0)
   ), grupos AS (SELECT CASE WHEN NULLIF(sku,'') IS NOT NULL THEN 'sku:'||sku WHEN NULLIF(cod_produto,'') IS NOT NULL THEN 'codigo:'||cod_produto ELSE 'sem-identidade:'||cod_operacao||':'||ordem END AS chave,
    (array_agg(cod_produto ORDER BY data_operacao DESC,cod_operacao DESC,ordem))[1] AS cod_produto,
    (array_agg(descricao ORDER BY data_operacao DESC,cod_operacao DESC,ordem))[1] AS descricao,
    max(sku) AS sku,sum(quantidade) AS pecas,count(DISTINCT cod_operacao)::int AS vendas,
    sum(quantidade::numeric*preco_centavos) AS subtotal_centavos,
    sum(quantidade) FILTER(WHERE desconto_informado IS NOT NULL) AS pecas_com_desconto,
    round(sum(quantidade*desconto_informado)/NULLIF(sum(quantidade) FILTER(WHERE desconto_informado IS NOT NULL),0),4) AS desconto_medio_percentual
    FROM itens GROUP BY chave)`;
   const resumo=(await db.query(`${cte} SELECT count(*)::int AS total,COALESCE(sum(pecas),0)::text AS pecas,COALESCE(sum(subtotal_centavos),0)::text AS subtotal_centavos,COALESCE(sum(pecas_com_desconto),0)::text AS pecas_com_desconto FROM grupos`,args)).rows[0];
   const rows=(await db.query(`${cte} SELECT chave,cod_produto,descricao,sku,pecas::text,vendas,subtotal_centavos::text,COALESCE(pecas_com_desconto,0)::text AS pecas_com_desconto,desconto_medio_percentual::text FROM grupos ORDER BY grupos.pecas DESC,grupos.chave LIMIT $6 OFFSET $7`,[...args,base.limite,(base.pagina-1)*base.limite])).rows;
   const sincronizacao=(await db.query(`SELECT c.recurso,c.ate::text,s.ultimo_sucesso,s.ultimo_erro_codigo FROM sync_checkpoints c LEFT JOIN sync_status s USING(filial,recurso) WHERE c.filial=$1 AND c.recurso IN ('vendas','cancelamentos')`,[f.filial])).rows;
   return {...resumo,produtos:rows,pagina:base.pagina,limite:base.limite,sincronizacao,checkpoints_cobrem_fim:['vendas','cancelamentos'].every(r=>sincronizacao.some(s=>s.recurso===r&&s.ate>=f.fim)),regra:'Vendas não canceladas no período. Subtotal dos produtos: quantidade × preço recebido, sem reaplicar desconto ou incluir ajustes da venda. Desconto médio ponderado pelas peças com percentual informado; itens sem informação ficam fora da média. Consulte também a cobertura do desconto.'};
  }),
 };
}
