import {erroSeguro} from './postgres.mjs';
import {inteiroErp} from './produtos-estoque-erp.mjs';
const colunas='filial bigint,sku text,produto bigint,cod_produto text,descricao text,cor text,tamanho text,barra text,saldo numeric,trans_id bigint,data_atualizacao_erp timestamptz';
export async function sincronizarEstoque({pool,tenant,filial,consultar,intervalo=360,forcar=false}){
 filial=inteiroErp(filial);
 if(!tenant||!Number.isSafeInteger(intervalo)||intervalo<30)throw Error('CONFIGURACAO_INVALIDA');
 const db=await pool.connect();let verificado=false;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='50s'");
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  verificado=true;
  await db.query('INSERT INTO sync_estoques(filial) VALUES($1) ON CONFLICT DO NOTHING',[filial]);
  const s=(await db.query("SELECT *,proxima_tentativa>now() AS aguardar,ultima_carga_completa IS NULL OR ultima_carga_completa<now()-interval '1 day' AS completa FROM sync_estoques WHERE filial=$1 FOR UPDATE",[filial])).rows[0];
  if(s.aguardar&&!forcar){await db.query('COMMIT');return {aguardando:true};}
  const completa=s.completa||s.cursor===null,cursor=completa?'0':(BigInt(s.cursor)>0n?BigInt(s.cursor)-1n:0n).toString();
  const rows=await consultar({filial,cursor});
  if(rows.some(r=>r.filial!==filial||BigInt(r.trans_id)<BigInt(cursor)))throw Error('ESTOQUE_ESCOPO_INVALIDO');
  let maior=BigInt(s.cursor??0);
  if(completa)await db.query('UPDATE estoque_atual SET presente_ultima_carga=false WHERE filial=$1',[filial]);
  for(let i=0;i<rows.length;i+=500){
   const lote=rows.slice(i,i+500),json=JSON.stringify(lote),cte=`WITH dados AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(${colunas}))`;
   for(const r of lote)if(BigInt(r.trans_id)>maior)maior=BigInt(r.trans_id);
   const conflito=await db.query(`${cte} SELECT 1 FROM dados d JOIN estoque_atual e USING(filial,sku) WHERE d.trans_id=e.trans_id AND d.saldo IS DISTINCT FROM e.saldo LIMIT 1`,[json]);
   if(conflito.rowCount)throw Error('ESTOQUE_TRANSACAO_DIVERGENTE');
   await db.query(`${cte} INSERT INTO cadastro_produtos(produto,cod_produto,descricao) SELECT DISTINCT ON(produto) produto,cod_produto,descricao FROM dados ORDER BY produto,trans_id DESC ON CONFLICT(produto) DO NOTHING`,[json]);
   await db.query(`${cte} INSERT INTO estoque_historico(filial,sku,trans_id,saldo,data_atualizacao_erp) SELECT filial,sku,trans_id,saldo,data_atualizacao_erp FROM dados ON CONFLICT DO NOTHING`,[json]);
   await db.query(`${cte} INSERT INTO estoque_atual(filial,sku,produto,cor,tamanho,barra,saldo,trans_id,data_atualizacao_erp)
    SELECT filial,sku,produto,cor,tamanho,barra,saldo,trans_id,data_atualizacao_erp FROM dados
    ON CONFLICT(filial,sku) DO UPDATE SET produto=EXCLUDED.produto,cor=EXCLUDED.cor,tamanho=EXCLUDED.tamanho,barra=EXCLUDED.barra,saldo=EXCLUDED.saldo,trans_id=EXCLUDED.trans_id,data_atualizacao_erp=EXCLUDED.data_atualizacao_erp,consultado_em=now(),presente_ultima_carga=true WHERE EXCLUDED.trans_id>=estoque_atual.trans_id`,[json]);
  }
  await db.query(`UPDATE sync_estoques SET cursor=$2,ultimo_sucesso=now(),ultima_carga_completa=CASE WHEN $3 THEN now() ELSE ultima_carga_completa END,falhas_consecutivas=0,ultimo_erro_codigo=NULL,proxima_tentativa=now()+$4*interval '1 second' WHERE filial=$1`,[filial,maior.toString(),completa,intervalo]);
  await db.query('COMMIT');return {filial,completa,recebidas:rows.length,cursor:maior.toString()};
 }catch(e){
  await db.query('ROLLBACK');
  if(verificado)await db.query(`INSERT INTO sync_estoques(filial,falhas_consecutivas,ultimo_erro_codigo,proxima_tentativa) VALUES($1,1,$2,now()+$3*interval '1 second') ON CONFLICT(filial) DO UPDATE SET falhas_consecutivas=sync_estoques.falhas_consecutivas+1,ultimo_erro_codigo=$2,proxima_tentativa=now()+$3*interval '1 second'*power(2,least(sync_estoques.falhas_consecutivas,4))`,[filial,erroSeguro(e),intervalo]);
  throw e;
 }finally{db.release();}
}
export async function enriquecerProdutos({pool,tenant,consultar,limite=5,parar=()=>false}){
 if(!Number.isSafeInteger(limite)||limite<1||limite>20)throw Error('LIMITE_INVALIDO');
 const db=await pool.connect();let total=0,falhas=0;
 try{
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  const produtos=(await db.query('SELECT produto::text FROM cadastro_produtos WHERE proxima_tentativa<=now() ORDER BY proxima_tentativa,produto LIMIT $1',[limite])).rows;
  for(const {produto} of produtos){
   if(parar())break;
   try{const p=await consultar({produto});if(p.produto!==produto)throw Error('PRODUTO_ERP_INVALIDO');
    await db.query(`UPDATE cadastro_produtos SET cod_produto=$2,descricao=$3,classificacao=$4,trans_id=$5,enriquecido_em=now(),proxima_tentativa=now()+interval '1 day',falhas_consecutivas=0,ultimo_erro_codigo=NULL WHERE produto=$1`,[produto,p.cod_produto,p.descricao,p.classificacao,p.trans_id]);total++;
   }catch(e){falhas++;await db.query(`UPDATE cadastro_produtos SET falhas_consecutivas=falhas_consecutivas+1,ultimo_erro_codigo=$2,proxima_tentativa=now()+interval '6 minutes'*power(2,least(falhas_consecutivas,6)) WHERE produto=$1`,[produto,erroSeguro(e)]);}
  }
  return {enriquecidos:total,falhas};
 }finally{db.release();}
}
