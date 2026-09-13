import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=`http://127.0.0.1:${process.env.PORT||3100}`;
let browser,page,stage='início',token;
const checks=[],errors=[];
const dir='artifacts/ui';await mkdir(dir,{recursive:true});
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();
 page.on('pageerror',()=>errors.push('erro_javascript'));
 page.on('response',async r=>{if(r.url()===base+'/api/v1/auth/login'&&r.status()===200){try{token=(await r.json()).token;}catch{}}});
 page.setDefaultTimeout(12000);
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('#login-view').waitFor({state:'visible'});
 await page.screenshot({path:`${dir}/login-desktop.png`,fullPage:true});checks.push('login_renderizado');
 stage='credenciais inválidas';await page.locator('#email').fill(process.env.ADMIN_EMAIL);await page.locator('#password').fill('senha-incorreta-de-teste');await page.locator('#login-submit').click();await page.locator('#login-error').waitFor({state:'visible'});checks.push('login_invalido');
 stage='login válido';await page.locator('#password').fill(process.env.ADMIN_PASSWORD);await page.locator('#login-submit').click();await page.locator('#app-view').waitFor({state:'visible'});await page.locator('#overview-panel').waitFor({state:'visible'});await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});checks.push('login_real');
 async function aplicar(inicio,fim){await page.locator('#period').selectOption('custom');await page.locator('#start-date').fill(inicio);await page.locator('#end-date').fill(fim);await page.locator('#filters button[type=submit]').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#loading').waitFor({state:'hidden'});}
 stage='indicadores e gráfico';await aplicar('2026-01-01','2026-09-09');
 if(!(await page.locator('#metric-value').innerText()).includes('R$'))throw new Error('metric');
 if(await page.locator('#chart svg').count()!==1)throw new Error('chart');
 await page.screenshot({path:`${dir}/painel-desktop.png`,fullPage:true});checks.push('filtros_indicadores_grafico');
 stage='paginação ranking';const before=await page.locator('#ranking-summary').innerText();await page.locator('#rank-next').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});if(before===await page.locator('#ranking-summary').innerText())throw new Error('pagination');checks.push('paginacao_ranking');
 stage='conferência e modal';await page.locator('[data-page=quality]').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#sales-panel').waitFor({state:'visible'});await page.locator('#quality-state').selectOption('erro_erp_confirmado');await page.locator('#loading').waitFor({state:'hidden'});
 if(await page.locator('#sales-body .operation-link').count()===0)throw new Error('pending');
 await page.locator('#sales-body .operation-link').first().click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#detail-dialog .detail-table').waitFor({state:'visible'});await page.screenshot({path:`${dir}/conferencia-desktop.png`,fullPage:true});await page.keyboard.press('Escape');await page.locator('#detail-dialog').waitFor({state:'hidden'});checks.push('conferencia_detalhes_escape');
 stage='movimentações';await page.locator('[data-page=sales]').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#sales-next').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#sales-type').selectOption('E');await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});checks.push('movimentacoes_paginacao_tipo');
 stage='período vazio';await page.locator('[data-page=overview]').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await aplicar('2026-01-01','2026-01-01');if((await page.locator('#metric-sales').innerText())!=='0')throw new Error('empty');checks.push('periodo_vazio');
 stage='recuperação de falha';await page.route('**/api/v1/indicadores?*',route=>route.abort());await page.locator('#refresh').click();await page.locator('#page-error').waitFor({state:'visible'});await page.unroute('**/api/v1/indicadores?*');await page.locator('#retry').click();await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#overview-panel').waitFor({state:'visible'});checks.push('erro_e_retentativa');
 stage='mobile';await aplicar('2026-09-01','2026-09-09');await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${dir}/painel-mobile.png`,fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1))throw new Error('horizontal_overflow');checks.push('mobile_sem_overflow');
 stage='tablet';await page.setViewportSize({width:820,height:1180});await page.screenshot({path:`${dir}/painel-tablet.png`,fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1))throw new Error('tablet_overflow');checks.push('tablet_sem_overflow');
 stage='sessão revogada';await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}});token=null;await page.locator('#refresh').click();await page.locator('#login-view').waitFor({state:'visible'});checks.push('sessao_revogada_retorna_login');
 stage='logout';await page.locator('#password').fill(process.env.ADMIN_PASSWORD);await page.locator('#login-submit').click();await page.locator('#app-view').waitFor({state:'visible'});await page.waitForLoadState('networkidle');await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#logout').click();await page.locator('#login-view').waitFor({state:'visible'});token=null;checks.push('logout');
 if(errors.length)throw new Error('javascript');
 const report={verificadoEm:new Date().toISOString(),browser:'Chrome headless local (navegador integrado indisponível)',checks,errosJavascript:errors.length,desktop:'1440x1000',mobile:'390x844',tablet:'820x1180'};await writeFile('docs/validacao-interface.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){if(page)await page.screenshot({path:`${dir}/falha.png`,fullPage:true}).catch(()=>{});console.error(JSON.stringify({resultado:'falhou',etapa:stage,checks,errosJavascript:errors.length}));process.exitCode=1;}
finally{if(token)await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});await browser?.close();}
