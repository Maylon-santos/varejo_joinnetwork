import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
const origin='https://aeropostale.joinnetwork.com.br';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
try{
 await mkdir('artifacts/deploy',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],posts=[];
 page.on('pageerror',()=>errors.push('ERRO_JS'));page.on('request',r=>{if(r.url().includes('/api/v1/fila')&&r.method()!=='GET')posts.push(r.method());});
 await page.goto(origin);const login=page.waitForResponse(r=>r.url().endsWith('/api/v1/auth/login'));await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');const session=await (await login).json();assert.ok(session.token);await page.locator('#app-view').waitFor({state:'visible'});
 const get=path=>page.evaluate(async({path,session})=>{const r=await fetch(path,{headers:{Authorization:'Bearer '+session}});return {status:r.status,data:await r.json()};},{path,session:session.token});
 const branches=await get('/api/v1/filiais');assert.equal(branches.status,200);assert.equal(branches.data.filiais.length,14);const roles=await get('/api/v1/acessos/perfis');assert.ok(roles.data.perfis.find(r=>r.role==='Admin').permissoes.includes('fila:relatorios'));
 const dia=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),filiais=[];
 for(const b of branches.data.filiais){
  const q=await get('/api/v1/fila?'+new URLSearchParams({filial:b.filial,dia}));assert.equal(q.status,200);if(q.data.jornada)assert.equal(typeof q.data.jornada.movimento_intenso,'boolean');
  const r=await get('/api/v1/fila/relatorio?'+new URLSearchParams({filial:b.filial,inicio:dia,fim:dia}));assert.equal(r.status,200);assert.equal(r.data.filial,b.filial);
  const t=r.data.totais;assert.equal(t.abordagens,t.concluidos+t.nao_iniciados+t.em_abordagem+t.em_atendimento);assert.equal(t.concluidos,t.com_venda+t.sem_venda);assert.equal(t.iniciados,t.concluidos+t.em_atendimento);
  for(const k of ['abordagens','concluidos','com_venda','sem_venda'])assert.equal(t[k],r.data.por_vendedor.reduce((a,v)=>a+v[k],0));
  assert.ok(t.tempo_disponivel_segundos>=0);if(!t.concluidos){assert.equal(t.conversao_informada,null);assert.equal(t.tempo_medio_segundos,null);}
  filiais.push({filial:b.filial,jornada:q.data.jornada?.estado??'nao_aberta',relatorio:true,totaisConsistentes:true});
 }
 assert.equal((await get('/api/v1/fila/relatorio?'+new URLSearchParams({filial:'99999999',inicio:dia,fim:dia}))).status,403);
 await page.click('[data-page="queue"]');await page.locator('.queue-setup,.queue-summary').first().waitFor();await page.locator('#queue-report-section>summary').click();const consultado=page.waitForResponse(r=>r.url().includes('/fila/relatorio?'));await page.getByRole('button',{name:'Consultar relatório',exact:true}).click();assert.equal((await consultado).status(),200);await page.getByRole('heading',{name:'Resultados por vendedor',exact:true}).waitFor();
 await page.screenshot({path:'artifacts/deploy/fila-relatorio-producao-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/fila-relatorio-producao-mobile.png',fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);await page.click('#logout');
 const report={verificadoEm:new Date().toISOString(),dominio:'aeropostale.joinnetwork.com.br',filiais,permissaoRelatoriosAdmin:true,filialNaoAutorizada:403,desktopMobile:true,mobileSemOverflow:true,nenhumaMutacaoDeFilaPeloTeste:true,errors};await writeFile('docs/validacao-fila-relatorio-producao.json',JSON.stringify(report,null,2)+'\n');console.log('R16.2: relatórios das 14 filiais e interface pública verificados, sem alterar jornadas ou atendimentos.');
}finally{await browser.close();}
