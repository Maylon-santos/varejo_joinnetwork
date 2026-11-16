import {ErroApi, elegivel} from './painel.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';

export const hojeSaoPaulo=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function periodosCrescimento(ano,modo='acumulado',hoje=hojeSaoPaulo()){
 validarDia(hoje);const atual=Number(hoje.slice(0,4));
 if(typeof ano!=='string'||!/^20\d{2}$/.test(ano)||Number(ano)<2001||Number(ano)>atual||!['acumulado','completo'].includes(modo))throw new ErroApi(400,'COMPARATIVO_INVALIDO');
 if(modo==='completo'&&Number(ano)===atual)throw new ErroApi(400,'ANO_EM_ANDAMENTO');
 const periodo=y=>{const mes=modo==='completo'?12:Number(hoje.slice(5,7)),dia=modo==='completo'?31:Number(hoje.slice(8,10));const ultimo=new Date(Date.UTC(y,mes,0)).getUTCDate();return {ano:y,inicio:`${y}-01-01`,fim:`${y}-${String(mes).padStart(2,'0')}-${String(Math.min(dia,ultimo)).padStart(2,'0')}`};};
 return {modo,hoje,atual:periodo(Number(ano)),anterior:periodo(Number(ano)-1)};
}
// Valores inteiros e divisão por BigInt preservam centavos acima de Number.MAX_SAFE_INTEGER.
export function variacaoCrescimento(atual,anterior){
 const a=BigInt(atual),b=BigInt(anterior),delta=a-b;
 const n=b>0n?delta*10000n/b:null,abs=n===null?null:n<0n?-n:n;
 return {diferenca:delta.toString(),percentual:n===null?null:`${n<0n?'-':''}${abs/100n}.${String(abs%100n).padStart(2,'0')}`};
}
const vazio=()=>({valor_centavos:'0',vendas:0,pecas:'0',pendencias:0,ticket_medio_centavos:null});
function somar(total,r){total.valor_centavos=(BigInt(total.valor_centavos)+BigInt(r.valor_centavos)).toString();total.pecas=(BigInt(total.pecas)+BigInt(r.pecas)).toString();total.vendas+=r.vendas;total.pendencias+=r.pendencias;}
function ticket(r){const n=BigInt(r.valor_centavos),abs=n<0n?-n:n;r.ticket_medio_centavos=r.vendas?((n<0n?-1n:1n)*((abs+BigInt(Math.floor(r.vendas/2)))/BigInt(r.vendas))).toString():null;return r;}
function comparar(a,b){return {valor_centavos:variacaoCrescimento(a.valor_centavos,b.valor_centavos),vendas:variacaoCrescimento(a.vendas,b.vendas),pecas:variacaoCrescimento(a.pecas,b.pecas),ticket_medio_centavos:a.ticket_medio_centavos!==null&&b.ticket_medio_centavos!==null?variacaoCrescimento(a.ticket_medio_centavos,b.ticket_medio_centavos):{diferenca:null,percentual:null}};}
export async function consultarCrescimento(db,filiais,ano,modo,hoje,comparacao='anterior'){
 if(!['anterior','todos'].includes(comparacao))throw new ErroApi(400,'COMPARATIVO_INVALIDO');
 const periodos=periodosCrescimento(ano,modo,hoje);
 const cadastro=(await db.query(`SELECT ids.filial::text,c.cod_filial,c.fantasia,
  (SELECT min(data_operacao)::text FROM operacoes WHERE filial=ids.filial) AS primeira_operacao,
  (SELECT min(ate)::text FROM sync_checkpoints WHERE filial=ids.filial AND recurso IN ('vendas','cancelamentos') HAVING count(*)=2) AS atualizado_ate
  FROM unnest($1::bigint[]) AS ids(filial) LEFT JOIN cadastro_filiais c USING(filial)`,[filiais])).rows;
 const minimo=cadastro.map(r=>r.primeira_operacao).filter(Boolean).sort()[0];
 const primeiro=Math.max(2001,Math.min(Number(ano),Number(minimo?.slice(0,4)??hoje.slice(0,4))));
 const anos=Array.from({length:Number(hoje.slice(0,4))-primeiro+1},(_,i)=>primeiro+i).reverse();
 const historicos=anos.filter(y=>y<=Number(ano)).reverse().map(y=>periodosCrescimento(String(y),modo,hoje).atual);
 const consultados=comparacao==='todos'?historicos:[periodos.anterior,periodos.atual];
 const rows=(await db.query(`SELECT o.filial::text,extract(year FROM o.data_operacao)::int AS ano,extract(month FROM o.data_operacao)::int AS mes,
  count(*)::int AS vendas,COALESCE(sum(o.quantidade),0)::text AS pecas,COALESCE(sum(o.valor_final_centavos),0)::text AS valor_centavos,
  count(*) FILTER(WHERE o.conciliacao<>'conciliada' AND NOT(o.erro_erp_confirmado_por IS NOT NULL AND o.conciliacao IN ('divergente','quantidade_divergente')))::int AS pendencias
  FROM operacoes o JOIN unnest($2::date[],$3::date[]) AS p(inicio,fim) ON o.data_operacao BETWEEN p.inicio AND p.fim WHERE o.filial=ANY($1::bigint[]) AND ${elegivel}
  GROUP BY o.filial,extract(year FROM o.data_operacao),extract(month FROM o.data_operacao)`,[filiais,consultados.map(p=>p.inicio),consultados.map(p=>p.fim)])).rows;
 const total={atual:vazio(),anterior:vazio()};
 const resultado=cadastro.map(c=>{
  const atual=vazio(),anterior=vazio(),mensal=Array.from({length:Number(periodos.atual.fim.slice(5,7))},(_,i)=>({mes:i+1,atual:vazio(),anterior:vazio()}));
  for(const r of rows.filter(r=>r.filial===c.filial&&[periodos.atual.ano,periodos.anterior.ano].includes(r.ano))){const lado=r.ano===periodos.atual.ano?'atual':'anterior';somar(lado==='atual'?atual:anterior,r);somar(mensal[r.mes-1][lado],r);}
  ticket(atual);ticket(anterior);somar(total.atual,atual);somar(total.anterior,anterior);
  return {...c,atual,anterior,variacao:comparar(atual,anterior),sem_base_anterior:anterior.vendas===0,atualizacao_cobre_fim:!!c.atualizado_ate&&c.atualizado_ate>=periodos.atual.fim,mensal:mensal.map(m=>{ticket(m.atual);ticket(m.anterior);return {...m,variacao:comparar(m.atual,m.anterior)};})};
 });
 resultado.sort((a,b)=>BigInt(a.atual.valor_centavos)>BigInt(b.atual.valor_centavos)?-1:BigInt(a.atual.valor_centavos)<BigInt(b.atual.valor_centavos)?1:a.filial.localeCompare(b.filial));
 ticket(total.atual);ticket(total.anterior);total.variacao=comparar(total.atual,total.anterior);
 let historico;
 if(comparacao==='todos'){
  const resumo=(fonte,periodo)=>{const t=vazio(),mensal=Array.from({length:Number(periodo.fim.slice(5,7))},(_,i)=>({mes:i+1,...vazio()}));for(const r of fonte.filter(r=>r.ano===periodo.ano)){somar(t,r);somar(mensal[r.mes-1],r);}ticket(t);mensal.forEach(ticket);return {ano:periodo.ano,...t,mensal};};
  const variacoes=lista=>lista.map((r,i)=>({...r,variacao_anterior:i?comparar(r,lista[i-1]):null}));
  historico={periodos:historicos,filiais:cadastro.map(c=>({...c,anos:variacoes(historicos.map(p=>resumo(rows.filter(r=>r.filial===c.filial),p)))})),totais:variacoes(historicos.map(p=>resumo(rows,p)))};
 }

 return {comparacao,periodos,anos,filiais:resultado,total,...(historico?{historico}:{}),indicadores_provisorios:true,regra:'Vendas não canceladas, com valor e peças do cabeçalho. Inclui pendências de conferência. Entradas não são subtraídas como devoluções. Percentual não calculado quando o valor anterior é zero ou negativo.',observacao:'Comparação dos registros importados. Ausência de vendas não comprova que a filial estava fechada. Checkpoints informam a atualização final e não comprovam cobertura histórica integral.'};
}
