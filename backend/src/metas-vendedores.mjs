import {ErroApi,elegivel} from './painel.mjs';
import {periodoMeta,periodoConsolidado} from './consolidado.mjs';
import {uuidMeta,hashMeta} from './metas-crescimento.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
const campos='filial::text,vendedor_codigo,competencia::text,valor_centavos::text,pa_centesimos,ticket_centavos::text,funcao,admissao::text,versao,atualizado_em';
export function percentualVendedor(realizado,meta){if(meta<=0n)return null;const v=realizado*10000n/meta,a=v<0n?-v:v;return `${v<0n?'-':''}${a/100n}.${String(a%100n).padStart(2,'0')}`;}
const decimal=(n,d)=>d===0n?null:((n*10000n+d/2n)/d).toString().padStart(5,'0').replace(/(\d{4})$/,'.$1').replace(/^\./,'0.');
const codigoValido=c=>typeof c==='string'&&c.trim()!==''&&c.length<=100;
function valor(v){if(v===null)return null;if(typeof v!=='string'||!/^\d{1,12}\.\d{2}$/.test(v))throw new ErroApi(400,'META_VENDEDOR_INVALIDA');return (BigInt(v.split('.')[0])*100n+BigInt(v.split('.')[1])).toString();}
export function validarMetaVendedor(b){
 if(!b||Object.keys(b).sort().join(',')!=='admissao,funcao,pa,requisicao,ticket,valor,versao'||!uuidMeta(b.requisicao)||!Number.isInteger(b.versao)||b.versao<0||b.versao>2147483646)throw new ErroApi(400,'META_VENDEDOR_INVALIDA');
 const v=valor(b.valor),ticket=valor(b.ticket);let pa=null;
 if(b.pa!==null){if(typeof b.pa!=='string'||!/^\d{1,4}\.\d{2}$/.test(b.pa))throw new ErroApi(400,'META_VENDEDOR_INVALIDA');pa=Number(b.pa.split('.')[0])*100+Number(b.pa.split('.')[1]);if(pa>100000)throw new ErroApi(400,'META_VENDEDOR_INVALIDA');}
 if(b.funcao!==null&&(typeof b.funcao!=='string'||!b.funcao.trim()||b.funcao.length>80))throw new ErroApi(400,'META_VENDEDOR_INVALIDA');
 if(b.admissao!==null){try{validarDia(b.admissao);}catch{throw new ErroApi(400,'META_VENDEDOR_INVALIDA');}}
 return {valor_centavos:v,ticket_centavos:ticket,pa_centesimos:pa,funcao:b.funcao?.trim()??null,admissao:b.admissao};
}
export function criarMetasVendedores({escopo,transacao}){
 const autorizar=(u,f,escrita=false)=>{if(!escopo(u,escrita?'metas:gerenciar':'consolidado:ler').includes(f))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');};
 return {
  metasVendedores:async(user,filial,mes,inicio,fim)=>{
   autorizar(user,filial);const periodo=periodoMeta(mes);periodoConsolidado(inicio,fim);if(inicio<periodo.inicio||fim>periodo.fim)throw new ErroApi(400,'META_VENDEDOR_PERIODO_INVALIDO');
   return transacao(async db=>{
    const rows=(await db.query(`WITH cadastro AS (
      SELECT DISTINCT ON(vendedor_codigo) vendedor_codigo,vendedor_nome FROM operacoes WHERE filial=$1 AND NULLIF(btrim(vendedor_codigo),'') IS NOT NULL ORDER BY vendedor_codigo,data_operacao DESC,cod_operacao DESC
     ), ids AS (SELECT vendedor_codigo FROM cadastro UNION SELECT vendedor_codigo FROM metas_vendedores WHERE filial=$1 AND competencia=$2), realizado AS (
      SELECT vendedor_codigo,count(*)::int AS vendas,sum(quantidade)::text AS pecas,sum(valor_final_centavos)::text AS valor_centavos,
       count(*) FILTER(WHERE conciliacao<>'conciliada' AND NOT(erro_erp_confirmado_por IS NOT NULL AND conciliacao IN ('divergente','quantidade_divergente')))::int AS pendencias
      FROM operacoes o WHERE filial=$1 AND data_operacao BETWEEN $3 AND $4 AND ${elegivel} GROUP BY vendedor_codigo)
     SELECT ids.vendedor_codigo,c.vendedor_nome,COALESCE(r.vendas,0) AS vendas,COALESCE(r.pecas,'0') AS pecas,COALESCE(r.valor_centavos,'0') AS valor_centavos,COALESCE(r.pendencias,0) AS pendencias
     FROM ids LEFT JOIN cadastro c USING(vendedor_codigo) LEFT JOIN realizado r USING(vendedor_codigo) ORDER BY c.vendedor_nome NULLS LAST,ids.vendedor_codigo`,[filial,periodo.inicio,inicio,fim])).rows;
    const metas=(await db.query(`SELECT ${campos} FROM metas_vendedores WHERE filial=$1 AND competencia=$2`,[filial,periodo.inicio])).rows;
    for(const r of rows){
     r.meta=metas.find(m=>m.vendedor_codigo===r.vendedor_codigo)??{valor_centavos:null,pa_centesimos:null,ticket_centavos:null,funcao:null,admissao:null,versao:0};
     const vendas=BigInt(r.vendas),pecas=BigInt(r.pecas),valor=BigInt(r.valor_centavos);r.pa=decimal(pecas,vendas);r.ticket_centavos=vendas?((valor+(valor<0n?-vendas:vendas)/2n)/vendas).toString():null;
     r.atingimento={vendas:r.meta.valor_centavos===null?null:percentualVendedor(valor,BigInt(r.meta.valor_centavos)),pa:r.meta.pa_centesimos===null||!vendas?null:percentualVendedor(pecas*100n,BigInt(r.meta.pa_centesimos)*vendas),ticket:r.meta.ticket_centavos===null||!vendas?null:percentualVendedor(valor,BigInt(r.meta.ticket_centavos)*vendas)};
    }
    const sem=(await db.query(`SELECT count(*)::int AS vendas,COALESCE(sum(quantidade),0)::text AS pecas,COALESCE(sum(valor_final_centavos),0)::text AS valor_centavos FROM operacoes o WHERE filial=$1 AND data_operacao BETWEEN $2 AND $3 AND NULLIF(btrim(vendedor_codigo),'') IS NULL AND ${elegivel}`,[filial,inicio,fim])).rows[0];
    return {filial,competencia:mes,inicio,fim,pode_editar:user.permissoes.includes('metas:gerenciar'),vendedores:rows,sem_vendedor:sem,regra:'Vendas não canceladas importadas, com valores e peças do cabeçalho. Inclui pendências. PA = peças ÷ vendas; ticket médio = valor ÷ vendas. Metas mensais integrais, sem rateio automático.'};
   });
  },
  salvarMetaVendedor:async(user,filial,codigo,mes,body,revalidar=async()=>user)=>{
   autorizar(user,filial,true);if(!codigoValido(codigo))throw new ErroApi(400,'VENDEDOR_INVALIDO');const {inicio}=periodoMeta(mes),v=validarMetaVendedor(body);const hash=hashMeta({filial,codigo,mes,...v,versao:body.versao});
   return transacao(async db=>{
    await db.query("SET LOCAL lock_timeout='5s'");await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':meta-vendedor:' || $1,0))",[JSON.stringify([filial,codigo,mes])]);
    const atual=await revalidar();if(!atual||atual.id!==user.id)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');autorizar(atual,filial,true);
    const repetida=(await db.query('SELECT ator_id,pedido_hash,depois FROM metas_vendedores_historico WHERE requisicao=$1',[body.requisicao])).rows[0];
    if(repetida){if(repetida.ator_id!==user.id||repetida.pedido_hash!==hash)throw new ErroApi(409,'REQUISICAO_REUTILIZADA');return {meta:repetida.depois};}
    if(!(await db.query('SELECT 1 FROM operacoes WHERE filial=$1 AND vendedor_codigo=$2 LIMIT 1',[filial,codigo])).rowCount)throw new ErroApi(404,'VENDEDOR_NAO_ENCONTRADO');
    const antes=(await db.query(`SELECT ${campos} FROM metas_vendedores WHERE filial=$1 AND vendedor_codigo=$2 AND competencia=$3 FOR UPDATE`,[filial,codigo,inicio])).rows[0]??null;
    if((antes?.versao??0)!==body.versao)throw new ErroApi(409,'META_DESATUALIZADA');
    const depois=(await db.query(`INSERT INTO metas_vendedores(filial,vendedor_codigo,competencia,valor_centavos,pa_centesimos,ticket_centavos,funcao,admissao,atualizado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(filial,vendedor_codigo,competencia) DO UPDATE SET valor_centavos=EXCLUDED.valor_centavos,pa_centesimos=EXCLUDED.pa_centesimos,ticket_centavos=EXCLUDED.ticket_centavos,funcao=EXCLUDED.funcao,admissao=EXCLUDED.admissao,versao=metas_vendedores.versao+1,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now() RETURNING ${campos}`,[filial,codigo,inicio,v.valor_centavos,v.pa_centesimos,v.ticket_centavos,v.funcao,v.admissao,user.id])).rows[0];
    await db.query('INSERT INTO metas_vendedores_historico(requisicao,filial,vendedor_codigo,competencia,ator_id,pedido_hash,antes,depois) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[body.requisicao,filial,codigo,inicio,user.id,hash,JSON.stringify(antes),JSON.stringify(depois)]);return {meta:depois};
   },true).catch(e=>{if(e.code==='23505')throw new ErroApi(409,'REQUISICAO_REUTILIZADA');if(e.code==='55P03')throw new ErroApi(409,'META_EM_EDICAO');throw e;});
  }
 };
}
