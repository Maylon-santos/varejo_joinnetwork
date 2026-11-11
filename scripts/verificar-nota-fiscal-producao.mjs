// Somente leitura: capturas comerciais privadas; evidência pública apenas agregada.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
let browser,etapa='configuracao';
try{
 const dominio='aeropostale.joinnetwork.com.br',base='https://'+dominio;
 const filial=process.env.NOTA_FISCAL_FILIAL||'30098297',dia=process.env.NOTA_FISCAL_DIA||'2026-11-10';
 if(!/^\d+$/.test(filial)||!/^\d{4}-\d{2}-\d{2}$/.test(dia))throw Error('PARAMETROS_INVALIDOS');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 await mkdir('artifacts/deploy',{recursive:true});
 const args=process.env.DEPLOY_VERIFY_IP?['--host-resolver-rules=MAP '+dominio+' '+process.env.DEPLOY_VERIFY_IP]:[];
 browser=await chromium.launch({channel:'chrome',headless:true,args});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 etapa='assets';
 for(const file of ['app.js','styles.css']){
  const response=await page.request.get(base+'/assets/'+file);assert.equal(response.status(),200);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(await response.body()),hash(await readFile(new URL('../frontend/assets/'+file,import.meta.url))));
 }
 assert.equal((await page.request.get(base+'/health')).status(),200);
 etapa='login';await page.goto(base);
 const logged=page.waitForResponse(r=>r.url().endsWith('/auth/login'));
 await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');
 const login=await logged;assert.equal(login.status(),200);const session=await login.json();assert.ok(session.token);
 await page.locator('#app-view').waitFor({state:'visible'});
 const get=async(path,status=200)=>{
  const r=await page.evaluate(async({path,token})=>{const r=await fetch('/api/v1'+path,{headers:{Authorization:'Bearer '+token}});return {status:r.status,data:await r.json()};},{path,token:session.token});
  assert.equal(r.status,status);return r.data;
 };
 etapa='api';const filiais=(await get('/filiais')).filiais;
 assert.deepEqual(filiais.map(f=>f.filial).sort(),[...config.branchIds].sort());
 await get('/indicadores?'+new URLSearchParams({filial:'999999999',inicio:dia,fim:dia}),403);
 const q=new URLSearchParams({filial,inicio:dia,fim:dia,limite:'100',tipo:'S',estado:'ativas'});
 const sales=await get('/vendas?'+q);assert.ok(sales.operacoes.length>0);let selected,note;
 for(const op of sales.operacoes){
  const detail=await get(`/operacoes/${op.filial}/${op.tipo_operacao}/${op.cod_operacao}`);
  const n=detail.operacao.complementos?.nota_fiscal;
  if(n?.numero_nota!=null&&n?.modelo!=null&&n?.idnfe!=null){selected=op;note=n;break;}
 }
 assert.ok(selected&&note);
 for(const key of ['numero_nota','modelo','idnfe','status'])assert.ok(Object.hasOwn(note,key));
 etapa='interface';await page.click('[data-page="sales"]');await page.selectOption('#branch',filial);await page.selectOption('#period','custom');await page.fill('#start-date',dia);await page.fill('#end-date',dia);await page.click('#filters button[type="submit"]');await page.locator('#loading').waitFor({state:'hidden'});
 const button=page.getByRole('button',{name:'Ver detalhes da operação '+selected.cod_operacao,exact:true});
 for(let i=0;i<30&&!await button.count();i++){assert.equal(await page.locator('#sales-next').isEnabled(),true);await page.click('#sales-next');await page.locator('#loading').waitFor({state:'hidden'});}
 await button.click();const section=page.locator('#detail-dialog .detail-invoice');await section.waitFor();
 const values=await section.locator('.invoice-fields strong').allTextContents();
 assert.deepEqual(values,['numero_nota','modelo','idnfe','status'].map(k=>note[k]==null||note[k]===''?'Não informado':String(note[k])));
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#detail-dialog').evaluate(n=>n.scrollWidth>n.clientWidth),false);
  await page.screenshot({path:`artifacts/deploy/nota-fiscal-producao-${width}.png`});
 }
 await page.click('#detail-close');await page.click('#logout');assert.deepEqual(errors,[]);
 await writeFile('docs/validacao-nota-fiscal-producao.json',JSON.stringify({verificadoEm:new Date().toISOString(),dominio,assetsIdenticosAoCodigoLocal:true,health:200,login:200,filiaisAutorizadas:filiais.length,filialNaoAutorizada:403,notaFiscalPersistida:true,quatroCamposVisiveis:true,conteudoIgualAoBanco:true,statusNuloNaAmostra:note.status==null,desktopCelularSemOverflow:true,somenteLeitura:true,errors},null,2)+'\n');
 console.log('Produção: saúde, login, 15 filiais, nota fiscal persistida e computador/celular aprovados.');
}catch(e){console.error(JSON.stringify({etapa,codigo:/^[A-Z_]+$/.test(e.message)?e.message:'VALIDACAO_PRODUCAO_FALHOU',tipo:e.name}));process.exitCode=1;}
finally{await browser?.close();}
