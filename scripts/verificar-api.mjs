import {writeFile} from 'node:fs/promises';
const base=`http://127.0.0.1:${process.env.PORT||3000}`;
let token;
const resultados={verificadoEm:new Date().toISOString()};
try{
 const health=await fetch(base+'/health');if(!health.ok)throw new Error('HEALTH_FALHOU');
 const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_PASSWORD})});
 if(!login.ok)throw new Error(`LOGIN_${login.status}`);
 token=(await login.json()).token;
 const get=path=>fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});
 const q='filial=30098297&inicio=2026-01-01&fim=2026-09-09';
 const r=await get('/api/v1/indicadores?'+q);if(!r.ok)throw new Error(`INDICADORES_${r.status}`);const d=await r.json();
 const ranking=await get('/api/v1/ranking?'+q);if(!ranking.ok)throw new Error(`RANKING_${ranking.status}`);const ranks=await ranking.json();
 const vendas=await get('/api/v1/vendas?'+q+'&limite=2');if(!vendas.ok)throw new Error(`VENDAS_${vendas.status}`);const lista=await vendas.json();
 const first=lista.operacoes[0];if(!first)throw new Error('AMOSTRA_VAZIA');
 const detalhe=await get(`/api/v1/operacoes/${first.filial}/${first.tipo_operacao}/${first.cod_operacao}`);if(!detalhe.ok)throw new Error(`DETALHE_${detalhe.status}`);
 const anon=await fetch(base+'/api/v1/indicadores?'+q);if(anon.status!==401)throw new Error('ACESSO_ANONIMO_NAO_BLOQUEADO');
 const proibida=await get('/api/v1/indicadores?filial=30098400&inicio=2026-01-01&fim=2026-09-09');if(proibida.status!==403)throw new Error('FILIAL_NAO_BLOQUEADA');
 const logout=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}});if(!logout.ok)throw new Error('LOGOUT_FALHOU');
 if((await get('/api/v1/auth/me')).status!==401)throw new Error('SESSAO_NAO_REVOGADA');token=null;
 Object.assign(resultados,{health:health.status,login:login.status,indicadores:r.status,ranking:ranking.status,vendas:vendas.status,detalhe:detalhe.status,anonimo:anon.status,filialNaoAutorizada:proibida.status,logout:logout.status,
 vendasElegiveis:d.vendas,valorVendasCentavos:d.valor_vendas_centavos,pecasCabecalho:d.pecas_cabecalho,ticketMedioCentavos:d.ticket_medio_centavos,pecasPorVenda:d.pecas_por_venda,vendasComPendencia:d.vendas_com_pendencia,totalVendedores:ranks.total,totalListagem:lista.total,checkpointsCobremFim:d.checkpoints_cobrem_fim});
 if(d.vendas!==lista.total)throw new Error('TOTAL_LISTAGEM_DIVERGENTE');
 await writeFile('docs/validacao-api.json',JSON.stringify(resultados,null,2)+'\n');console.log(JSON.stringify(resultados,null,2));
}catch(e){console.error(/^[A-Z_0-9]+$/.test(e.message)?e.message:'VERIFICACAO_API_FALHOU');process.exitCode=1;}
finally{if(token)await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});}
