import https from 'node:https';
import assert from 'node:assert/strict';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {validarDia} from '../backend/src/sincronizar-cancelamentos.mjs';
import {erroSeguro} from '../backend/src/postgres.mjs';
const hostname='aeropostale.joinnetwork.com.br';
const inicio=process.env.HOMOLOGACAO_INICIO||'2026-01-01',fim=process.env.HOMOLOGACAO_FIM||'2026-09-09';
const filial='30098297';let token;
function request(path,{method='GET',body}={}){
 return new Promise((resolve,reject)=>{
  const payload=body?JSON.stringify(body):undefined,headers={};
  if(payload){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(payload);}if(token)headers.Authorization=`Bearer ${token}`;
  const req=https.request({hostname,path,method,headers,timeout:15000,...(process.env.DEPLOY_VERIFY_IP?{lookup:(_host,opts,cb)=>opts.all?cb(null,[{address:process.env.DEPLOY_VERIFY_IP,family:4}]):cb(null,process.env.DEPLOY_VERIFY_IP,4)}:{})},res=>{
   let data='';res.setEncoding('utf8');res.on('data',part=>data+=part);res.on('end',()=>{try{if(res.statusCode!==200)throw Error('HTTP_'+res.statusCode);resolve(JSON.parse(data));}catch(e){reject(e);}});
  });req.on('timeout',()=>req.destroy(Error('TIMEOUT')));req.on('error',reject);req.end(payload);
 });
}
const moeda=v=>{const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'-':''}R$ ${(a/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${(a%100n).toString().padStart(2,'0')}`;};
try{
 validarDia(inicio);validarDia(fim);if(inicio>fim)throw Error('PERIODO_INVALIDO');
 const pasta=`docs/central/homologacao-${inicio}-${fim}`;
 // Não sobrescrever os campos preenchidos pelo usuário numa execução posterior.
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');const arquivo=`${pasta}/painel-${stamp}.md`;
 await mkdir(pasta,{recursive:true});
 token=(await request('/api/v1/auth/login',{method:'POST',body:{email:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_PASSWORD}})).token;
 assert.ok(token);
 const q=new URLSearchParams({filial,inicio,fim});
 const d=await request('/api/v1/indicadores?'+q);
 const soma={vendas:0,valor:0n,pecas:0n},meses=new Map();
 for(const dia of d.serie_diaria){
  soma.vendas+=dia.vendas;soma.valor+=BigInt(dia.valor_vendas_centavos);soma.pecas+=BigInt(dia.pecas_cabecalho);
  const mes=dia.data.slice(0,7),r=meses.get(mes)||{vendas:0,valor:0n,pecas:0n};
  r.vendas+=dia.vendas;r.valor+=BigInt(dia.valor_vendas_centavos);r.pecas+=BigInt(dia.pecas_cabecalho);meses.set(mes,r);
 }
 assert.equal(soma.vendas,d.vendas);assert.equal(soma.valor.toString(),d.valor_vendas_centavos);assert.equal(soma.pecas.toString(),d.pecas_cabecalho);
 assert.equal(d.checkpoints_cobrem_fim,true);
 const resumo=`| Valor de vendas | ${moeda(d.valor_vendas_centavos)} |\n| Vendas | ${d.vendas} |\n| Peças do cabeçalho | ${d.pecas_cabecalho} |\n| Ticket médio | ${d.ticket_medio_centavos==null?'Sem dados':moeda(d.ticket_medio_centavos)} |\n| PA | ${d.pecas_por_venda==null?'Sem dados':d.pecas_por_venda.replace('.',',')} |`;
 const mensal=[...meses].map(([mes,r])=>`| ${mes} | ${r.vendas} | ${moeda(r.valor)} | ${r.pecas} |`).join('\n');
 const diario=d.serie_diaria.map(r=>`| ${r.data} | ${r.vendas} | ${moeda(r.valor_vendas_centavos)} | ${r.pecas_cabecalho} |`).join('\n');
 await writeFile(arquivo,`# Homologação de ITUPEVA — ${inicio} a ${fim}\n\nExtração em ${new Date().toISOString()}. Fonte: API HTTPS do painel publicado; filial ${filial}. Nenhuma consulta ao ERP foi executada para gerar este documento.\n\n## Situação\n\n- [x] Conferir cobertura dos checkpoints até o fim do período.\n- [x] Conferir soma diária contra os totais do painel (vendas, valor e peças).\n- [ ] Comparar com relatório independente do ERP.\n- [ ] Registrar decisão de Maylon na ficha de aceite desta pasta.\n\nA consistência interna foi validada. A homologação com o ERP continua pendente; a confirmação anterior de cinco erros de itens não aprova os totais gerais.\n\n## Regras para a comparação\n\n${d.regra}\n\nUse a filial ${filial}, datas inclusivas ${inicio} a ${fim} e a data da operação. Peças e valores vêm do cabeçalho. Ticket é valor dividido por vendas; PA é peças dividido por vendas. O estado de cancelamento é o conhecido na extração, incluindo cancelamentos posteriores à data de venda.\n\nExcluídas: ${d.excluidas.canceladas} operações canceladas e ${d.excluidas.outras_operacoes_ativas} operações ativas de outros tipos. Pendências ainda não confirmadas: ${d.vendas_com_pendencia}.\n\n## Totais do painel\n\n| Indicador | Painel |\n| --- | ---: |\n${resumo}\n\n## Resumo mensal\n\n| Mês | Vendas | Valor | Peças |\n| --- | ---: | ---: | ---: |\n${mensal}\n\n## Detalhamento diário\n\nDias sem vendas elegíveis não aparecem na tabela.\n\n| Dia | Vendas | Valor | Peças |\n| --- | ---: | ---: | ---: |\n${diario}\n`);
 const aceite=`${pasta}/aceite.md`;
 try{await access(aceite);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(aceite,`# Conferência de Maylon — ITUPEVA\n\nPeríodo: ${inicio} a ${fim}. Filial: ${filial}.\n\n## Identificação do relatório ERP\n\nNome do relatório: preencher.\nData e horário da extração: preencher.\nFiltros e tratamento dos cancelamentos: preencher.\nDocumento do painel usado na comparação: preencher (nome da extração).\n\n## Totais do ERP\n\n| Indicador | ERP |\n| --- | --- |\n| Valor de vendas | preencher |\n| Vendas | preencher |\n| Peças | preencher |\n| Ticket médio | preencher |\n| PA | preencher |\n\n## Resultado\n\n- [ ] Filtros e regras equivalentes confirmados.\n- [ ] Totais conferidos com o painel.\n- [ ] Diferenças registradas e resolvidas, quando houver.\n- [ ] Homologação aprovada por Maylon para este período e filial.\n\nResponsável e data: preencher.\nDiferenças e observações: preencher.\n\nA aprovação deste período não altera automaticamente regras de bruto/líquido, devoluções, outras filiais ou permissões.\n`);}
 await writeFile(`${pasta}/painel-${stamp}.json`,JSON.stringify(d,null,2)+'\n');
 console.log(JSON.stringify({arquivo,aceite,consistenciaInterna:true,homologacaoERP:'pendente',dias:d.serie_diaria.length}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}
finally{if(token)await request('/api/v1/auth/logout',{method:'POST'}).catch(()=>{console.error('LOGOUT_FALHOU');process.exitCode=1;});}
