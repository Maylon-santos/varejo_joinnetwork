import {criarGestaoUsuarios} from '../backend/src/gestao-usuarios.mjs';
import {chromium} from 'playwright';
import {criarFrontend} from '../backend/src/frontend.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {criarPool} from '../backend/src/postgres.mjs';
import {migrar} from '../backend/src/migracoes.mjs';
import {criarAuth,criarAdmin,hashToken} from '../backend/src/admin-auth.mjs';
import {criarPainel} from '../backend/src/painel.mjs';
import {criarServidor} from '../backend/src/http-api.mjs';
import {criarGestaoPermissoes} from '../backend/src/gestao-permissoes.mjs';
const schema='api_'+randomUUID().replaceAll('-','');
let controlAdmin,tenantAdmin,control,pool,server,base,auth,token;
const senha='Senha longa somente para integração!';
async function setup(){
 controlAdmin=criarPool(process.env.CONTROL_DATABASE_URL);tenantAdmin=criarPool(process.env.TENANT_DATABASE_URL);
 await controlAdmin.query(`CREATE SCHEMA ${schema}`);await tenantAdmin.query(`CREATE SCHEMA ${schema}`);
 control=criarPool(process.env.CONTROL_DATABASE_URL,{options:`-c search_path=${schema}`});pool=criarPool(process.env.TENANT_DATABASE_URL,{options:`-c search_path=${schema}`});
 await migrar(control,new URL('../database/migrations/control/',import.meta.url));await migrar(pool,new URL('../database/migrations/tenant/',import.meta.url));
 await control.query("INSERT INTO tenants(tenant_key,nome,database_name) VALUES('teste','Teste','teste'),('outro','Outro','outro')");
 await pool.query("INSERT INTO tenant_identity(tenant_key) VALUES('teste')");
 await criarAdmin(control,{tenant:'teste',email:'admin@teste.local',senha});await criarAdmin(control,{tenant:'outro',email:'outro@teste.local',senha});
 await pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,conciliacao,vendedor_codigo,vendedor_nome) VALUES
  (1,'S',1,'2026-09-01',2,10000,false,'conciliada','10','Nome antigo'),
  (2,'S',1,'2026-09-02',3,20000,false,'conciliada','10','Nome atual'),
  (3,'S',1,'2026-09-01',9,90000,true,'nao_elegivel','10','Nome atual'),
  (4,'S',1,'2026-09-01',9,90000,false,'conciliada','10','Nome atual'),
  (5,'E',1,'2026-09-01',1,5000,false,'nao_elegivel','10','Nome atual'),
  (6,'S',1,'2026-09-02',1,7000,false,'quantidade_divergente','20','Outro vendedor'),
  (7,'S',999,'2026-09-01',9,999999,false,'conciliada','10','Loja restrita')`);
 await pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(4,'S',1,now())");
 await pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,quantidade,preco_centavos) VALUES(1,'S',1,0,2,5000)");
 await pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,'vendas','2026-09-02'),(1,'cancelamentos','2026-09-02')");
 await pool.query(`UPDATE operacoes SET clientes=$1::jsonb,clientes_importados_em=now() WHERE cod_operacao=1 AND filial=1`,[JSON.stringify([{nome:'Cliente da operação 1',contatos:[{tipo:'Telefone',ddd:'11',telefone:'33330000'}]}])]);
 auth=await criarAuth(control,'teste');
 server=criarServidor({gestaoUsuarios:criarGestaoUsuarios(control,pool,'teste',['1']),frontend:await criarFrontend(),auth,gestaoPermissoes:criarGestaoPermissoes(control,'teste'),imagemProduto:async()=>({type:'image/jpeg',body:Buffer.from([1,2,3])}),painel:criarPainel(pool,'teste',['1']),filiais:['1'],limitar:()=>true,limitarLogin:()=>true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const session=await auth.login('admin@teste.local',senha);token=session.token;
}
async function cleanup(){
 if(server)await new Promise(resolve=>server.close(resolve));await Promise.all([pool?.end(),control?.end()]);
 if(controlAdmin){await controlAdmin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await controlAdmin.end();}
 if(tenantAdmin){await tenantAdmin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await tenantAdmin.end();}
}

let browser;
try{
 await mkdir('artifacts/deploy',{recursive:true});await setup();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=async(email)=>{await page.fill('#email',email);await page.fill('#password',senha);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});};
 await page.goto(base);await login('admin@teste.local');await page.click('[data-page="users"]');const form=page.locator('#users-content form');await form.getByLabel('E-mail',{exact:true}).fill('cadastro@teste.local');await form.getByLabel('Senha inicial',{exact:false}).fill(senha);await form.locator('.user-branch input[type=checkbox]').check();await form.locator('.user-branch select').selectOption('10');await form.getByRole('button',{name:'Salvar usuário'}).click();await page.locator('#users-message').getByText('Usuário salvo.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'cadastro@teste.local',exact:true}).click();assert.equal(await form.getByLabel('E-mail',{exact:true}).inputValue(),'cadastro@teste.local');assert.equal(await form.locator('.user-branch select').inputValue(),'10');assert.equal(await form.getByLabel('Nova senha',{exact:false}).inputValue(),'');
 await page.screenshot({path:'artifacts/deploy/usuarios-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/usuarios-mobile.png',fullPage:true});
 await page.click('#logout');await login('cadastro@teste.local');assert.equal(await page.locator('[data-page="users"]').isVisible(),false);assert.equal(await page.locator('[data-page="permissions"]').isVisible(),false);await page.click('#logout');await login('admin@teste.local');await page.click('[data-page="users"]');await page.getByRole('button',{name:'cadastro@teste.local',exact:true}).click();await form.getByLabel('Usuário ativo',{exact:true}).uncheck();await form.getByRole('button',{name:'Salvar usuário'}).click();await page.getByRole('button',{name:'cadastro@teste.local · Inativo',exact:true}).waitFor();await page.getByRole('button',{name:'admin@teste.local',exact:true}).click();assert.equal(await form.getByLabel('Usuário ativo',{exact:true}).isDisabled(),true);assert.equal(await form.getByRole('button',{name:'Salvar usuário'}).count(),0);assert.deepEqual(errors,[]);
 await writeFile('docs/validacao-usuarios-ui.json',JSON.stringify({verificadoEm:new Date().toISOString(),ambiente:'schemas temporários com dados sintéticos',criacao:true,vinculoVendedorPersistido:true,senhaNaoRetornada:true,loginVendedor:true,navegacaoRestrita:true,desativacao:true,proprioAdminProtegido:true,desktopMobile:true,mobileSemOverflow:true,errors},null,2)+'\n');console.log('Cadastro, login restrito, edição, desativação e celular validados.');
}finally{await browser?.close();await cleanup();}
