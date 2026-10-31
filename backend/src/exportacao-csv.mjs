import {validarDia} from './sincronizar-cancelamentos.mjs';
import {elegivel} from './painel.mjs';

export function periodoExportacao({inicio,fim,ano,agora=new Date()}={}){
 if(ano!=null){if(!/^20\d{2}$/.test(String(ano))||inicio||fim)throw Error('PERIODO_INVALIDO');inicio=`${ano}-01-01`;fim=`${ano}-12-31`;}
 else if(!inicio&&!fim){
  const hoje=agora.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const d=new Date(hoje+'T12:00:00Z');d.setUTCDate(0);inicio=d.toISOString().slice(0,7)+'-01';
  const ontem=new Date(hoje+'T12:00:00Z');ontem.setUTCDate(ontem.getUTCDate()-1);fim=ontem.toISOString().slice(0,10);
 }
 validarDia(inicio);validarDia(fim);if(inicio>fim||Date.parse(fim)-Date.parse(inicio)>365*86400000)throw Error('PERIODO_INVALIDO');return {inicio,fim};
}
export function decimalCentavos(v){if(v==null)return '';const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'-':''}${a/100n}.${String(a%100n).padStart(2,'0')}`;}
export function serializarCsv(cabecalho,linhas){
 const campo=v=>{const s=v==null?'':String(v);return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 return [cabecalho,...linhas.map(r=>cabecalho.map(c=>r[c]))].map(r=>r.map(campo).join(';')).join('\r\n')+'\r\n';
}

// Campos comerciais mínimos. Não exporta clientes, contatos ou meios de pagamento.
export async function lerBaseExportacao(pool,{tenant,filiais,inicio,fim}){
 periodoExportacao({inicio,fim});if(!tenant||!filiais?.length||filiais.some(f=>!/^\d+$/.test(f)))throw Error('CONFIGURACAO_INVALIDA');
 const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='60s'");
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  const cadastro=(await db.query('SELECT filial::text,cod_filial,fantasia FROM cadastro_filiais WHERE filial=ANY($1::bigint[]) ORDER BY filial',[filiais])).rows;
  if(filiais.some(f=>!cadastro.some(c=>c.filial===f)))throw Error('CADASTRO_AUTORIZADO_AUSENTE');
  const args=[filiais,inicio,fim];
  const operacoes=(await db.query(`SELECT o.filial::text,o.cod_operacao::text,o.data_operacao::text,o.quantidade,
   o.valor_final_centavos::text,o.subtotal_itens_centavos::text,o.ajuste_centavos::text,o.conciliacao,
   o.evento_codigo,o.vendedor_codigo FROM operacoes o
   WHERE o.filial=ANY($1::bigint[]) AND o.data_operacao BETWEEN $2::date AND $3::date AND ${elegivel}
   ORDER BY o.data_operacao,o.filial,o.cod_operacao`,args)).rows;
  const marcas=(await db.query(`SELECT o.filial::text,o.cod_operacao::text,i.ordem,i.quantidade,
   p.classificacao->'marca'->>'codigo' AS marca_codigo,p.classificacao->'marca'->>'descricao' AS marca
   FROM operacoes o JOIN operacao_itens i USING(filial,tipo_operacao,cod_operacao)
   LEFT JOIN estoque_atual e ON e.filial=i.filial AND e.sku=i.sku
   LEFT JOIN cadastro_produtos p ON p.produto=e.produto AND p.cod_produto=i.cod_produto
   WHERE o.filial=ANY($1::bigint[]) AND o.data_operacao BETWEEN $2::date AND $3::date AND ${elegivel}
   ORDER BY o.filial,o.cod_operacao,i.ordem`,args)).rows;
  const cobertura=(await db.query(`SELECT filial::text,recurso,ate::text FROM sync_checkpoints WHERE filial=ANY($1::bigint[]) ORDER BY filial,recurso`,[filiais])).rows;
  const outras=(await db.query(`SELECT o.tipo_operacao,count(*)::int AS quantidade FROM operacoes o
   WHERE o.filial=ANY($1::bigint[]) AND o.data_operacao BETWEEN $2::date AND $3::date AND NOT (${elegivel}) GROUP BY o.tipo_operacao ORDER BY o.tipo_operacao`,args)).rows;
  await db.query('COMMIT');return {origem:'banco_piloto',extraido_em:new Date().toISOString(),inicio,fim,filiais:cadastro,operacoes,marcas,cobertura,excluidas:outras};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}

export function montarRelatorios(base,dimensoes={}){
 periodoExportacao(base);
 const filiais=new Map(base.filiais.map(f=>[f.filial,f]));const marcas=new Map();
 for(const item of base.marcas){const chave=JSON.stringify([item.filial,item.cod_operacao]);if(!marcas.has(chave))marcas.set(chave,[]);marcas.get(chave).push(item);}
 const cadastro=base.filiais.map(f=>({empresa:dimensoes[f.filial]?.empresa??'',unidade:dimensoes[f.filial]?.unidade??'',canal:dimensoes[f.filial]?.canal??'',filial:f.filial,cod_filial:f.cod_filial,fantasia:f.fantasia}));
 const cupons=base.operacoes.map(o=>{
  const f=filiais.get(o.filial);if(!f||o.data_operacao<base.inicio||o.data_operacao>base.fim)throw Error('OPERACAO_FORA_DO_ESCOPO');
  const itens=marcas.get(JSON.stringify([o.filial,o.cod_operacao]))??[];
  const conhecidas=new Map(itens.filter(i=>i.marca_codigo&&i.marca).map(i=>[i.marca_codigo,i.marca]));
  const completa=itens.length>0&&itens.every(i=>i.marca_codigo&&i.marca)&&itens.reduce((s,i)=>s+BigInt(i.quantidade),0n)===BigInt(o.quantidade);
  const unica=completa&&conhecidas.size===1;
  return {data:o.data_operacao,empresa:dimensoes[o.filial]?.empresa??'',unidade:dimensoes[o.filial]?.unidade??'',canal:dimensoes[o.filial]?.canal??'',
   marca_codigo:unica?[...conhecidas.keys()][0]:'',marca:unica?[...conhecidas.values()][0]:'',situacao_marca:unica?'unica':completa?'multiplas':'incompleta',
   filial:o.filial,cod_filial:f.cod_filial,fantasia:f.fantasia,tipo_movimento:'venda',cod_operacao:o.cod_operacao,cupom_fiscal:'',
   valor:decimalCentavos(o.valor_final_centavos),subtotal_itens:decimalCentavos(o.subtotal_itens_centavos),ajuste_informado:decimalCentavos(o.ajuste_centavos),
   pecas:String(o.quantidade),conciliacao:o.conciliacao,evento:o.evento_codigo,vendedor_codigo:o.vendedor_codigo};
 });
 const grupos=new Map();for(const [indice,c] of cupons.entries()){
  const dimensao=Object.fromEntries(['data','empresa','unidade','canal','marca_codigo','marca','situacao_marca','filial','cod_filial','fantasia','tipo_movimento'].map(k=>[k,c[k]]));
  const chave=JSON.stringify(dimensao);const g=grupos.get(chave)??{...dimensao,operacoes:0,centavos:0n,pecas:0n};
  g.operacoes++;g.centavos+=BigInt(base.operacoes[indice].valor_final_centavos);g.pecas+=BigInt(c.pecas);grupos.set(chave,g);
 }
 const diario=[...grupos.values()].map(({centavos,pecas,...g})=>({...g,valor:decimalCentavos(centavos),pecas:pecas.toString()}));
 const comum=['data','empresa','unidade','canal','marca_codigo','marca','situacao_marca','filial','cod_filial','fantasia','tipo_movimento'];
 const relatorios={faturamento_diario:{colunas:[...comum,'operacoes','valor','pecas'],linhas:diario},vendas_por_cupom:{colunas:[...comum,'cod_operacao','cupom_fiscal','valor','subtotal_itens','ajuste_informado','pecas','conciliacao','evento','vendedor_codigo'],linhas:cupons},cadastro_filiais:{colunas:['empresa','unidade','canal','filial','cod_filial','fantasia'],linhas:cadastro}};
 const avisos=['Devoluções e bruto/líquido aguardam homologação (R22). Valor representa o cabeçalho das vendas S ativas, sem presumir líquido.',
  'Empresa, unidade e canal ficam vazios quando não há mapeamento confirmado. Cupom fiscal ausente; cod_operacao é a chave interna do ERP.',
  'Marca vem do cadastro atual por SKU/produto, sem ratear o cabeçalho entre marcas. Marca vazia: classificação incompleta ou cupom com múltiplas marcas.',
  'Cadastro de filiais é a posição atual na extração; não representa cadastro histórico.'];
 if(base.origem==='banco_piloto'&&base.inicio<'2026-01-01')avisos.push('Histórico anterior a 2026 não carregado no piloto; ausência de registros não comprova ausência de vendas.');
 if(base.origem==='banco_piloto'&&base.filiais.some(f=>['vendas','cancelamentos'].some(r=>!base.cobertura.some(c=>c.filial===f.filial&&c.recurso===r&&c.ate>=base.fim))))avisos.push('Checkpoints não cobrem o fim do período em todas as filiais.');
 if(base.origem==='erp_direto')avisos.push('Consulta direta ERP; cancelamentos refletem o estado no cabeçalho recebido. Não houve homologação dos totais de 2025.');
 return {relatorios,manifesto:{inicio:base.inicio,fim:base.fim,origem:base.origem,extraido_em:base.extraido_em,formato:{encoding:'UTF-8',separador:';',datas:'AAAA-MM-DD',decimal:'.',moeda:'BRL',ausente:'campo vazio'},avisos,linhas:Object.fromEntries(Object.entries(relatorios).map(([k,v])=>[k,v.linhas.length])),cobertura:base.cobertura,excluidas:base.excluidas}};
}
