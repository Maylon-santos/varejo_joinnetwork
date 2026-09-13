import {chromium} from '@playwright/test';
import {criarPool} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);let browser,token;const base='http://127.0.0.1:3100';let etapa='login';
try{
 let op;
 const samples=(await pool.query("SELECT DISTINCT ON (i.imagem_url) i.imagem_url,o.cod_operacao::text,o.data_operacao::text FROM operacao_itens i JOIN operacoes o USING(cod_operacao,tipo_operacao,filial) WHERE i.imagem_url IS NOT NULL AND o.tipo_operacao='S' AND NOT o.cancelada LIMIT 40")).rows;
 for(const sample of samples){try{const r=await fetch(sample.imagem_url,{signal:AbortSignal.timeout(4000)});if(r.ok&&r.headers.get('content-type')?.startsWith('image/')){op=sample;break;}}catch{}}
 if(!op)throw Error('Sem imagem disponível na amostra');
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('requestfailed',r=>{if(r.resourceType()==='image')console.log('imagem: '+r.failure()?.errorText);});page.on('response',r=>{if(r.request().resourceType()==='image')console.log('imagem HTTP '+r.status());});
 page.on('response',async r=>{if(r.url().endsWith('/auth/login')&&r.ok())token=(await r.json()).token;});
 await page.goto(base);await page.locator('#email').fill(process.env.ADMIN_EMAIL);await page.locator('#password').fill(process.env.ADMIN_PASSWORD);await page.locator('#login-submit').click();await page.locator('#overview-panel').waitFor({state:'visible'});
 etapa='PA';if(await page.locator('#ranking-body tr').first().locator('td').count()!==6)throw Error();await page.screenshot({path:'artifacts/ui/ranking-pa.png',fullPage:true});
 await page.locator('#period').selectOption('custom');await page.locator('#start-date').fill(op.data_operacao);await page.locator('#end-date').fill(op.data_operacao);await page.locator('#filters button[type=submit]').click();await page.locator('#loading').waitFor({state:'hidden'});
 await page.locator('[data-page=sales]').click();await page.locator('#sales-panel').waitFor({state:'visible'});while(!await page.locator('#sales-body tr').filter({hasText:'#'+op.cod_operacao}).count()){await page.locator('#sales-next').click();await page.locator('#loading').waitFor({state:'hidden'});}await page.locator('#sales-body tr').filter({hasText:'#'+op.cod_operacao}).locator('button').click();await page.locator('.product-photo img').first().waitFor();
 etapa='imagem real';const thumb=await page.locator('.product-photo img').filter({visible:true}).all();const loaded=(await Promise.all(thumb.map(async img=>({img,src:await img.getAttribute('src')})))).find(x=>x.src===op.imagem_url).img;await loaded.evaluate(img=>new Promise((resolve,reject)=>{if(img.complete)return img.naturalWidth?resolve():reject();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});}));
 await page.screenshot({path:'artifacts/ui/produtos-miniaturas.png',fullPage:true});await loaded.locator('..').click();await page.locator('#photo-dialog').waitFor({state:'visible'});await page.screenshot({path:'artifacts/ui/produto-ampliado.png',fullPage:true});await page.keyboard.press('Escape');await page.locator('#detail-dialog').waitFor({state:'visible'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/ui/produtos-mobile.png',fullPage:true});console.log('PA, miniatura real, ampliação e retorno aos detalhes: OK');
}catch{console.error('Falha na etapa: '+etapa);process.exitCode=1;}finally{if(token)await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}});await browser?.close();await pool.end();}
