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
 server=criarServidor({frontend:await criarFrontend(),auth,gestaoPermissoes:criarGestaoPermissoes(control,'teste'),imagemProduto:async()=>({type:'image/jpeg',body:Buffer.from([1,2,3])}),painel:criarPainel(pool,'teste',['1']),filiais:['1'],limitar:()=>true,limitarLogin:()=>true});
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
 await mkdir('artifacts/deploy',{recursive:true});await setup();
 await pool.query("UPDATE operacao_itens SET cod_produto='P100',sku='SKU100',descricao='Produto de teste',preco_tabela_centavos=8000,preco_aplicado_centavos=5000,desconto_informado=0 WHERE cod_operacao=1");
 await pool.query("UPDATE operacoes SET complementos=$1::jsonb,complementos_importados_em=now() WHERE cod_operacao=1",[JSON.stringify({codigo_condicaopgto:'Q4',desc_condicoes_pgto:'CRÉDITO 4X',lancamentos:Array.from({length:4},(_,i)=>({n_documento:'1/'+(i+1),desc_tipopgto:'CARTÃO DE CRÉDITO',historico:'Parcela de teste '+(i+1),valor_inicial_centavos:'2500',data_vencimento:'2026-10-13'}))})]);
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(base);await page.fill('#email','admin@teste.local');await page.fill('#password',senha);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});await page.click('[data-page="sales"]');await page.getByRole('button',{name:'Ver detalhes da operação 1',exact:true}).click();await page.locator('.detail-payment').waitFor();assert.equal(await page.locator('.price-warning').count(),1);await page.locator('.detail-payment summary').click();assert.equal(await page.locator('.payment-installments li').count(),4);assert.ok((await page.locator('.detail-table').innerText()).includes('Código P100'));assert.ok((await page.locator('.detail-table').innerText()).includes('SKU SKU100'));await page.screenshot({path:'artifacts/deploy/complementos-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/complementos-mobile.png',fullPage:true});
 await page.click('#detail-close');await pool.query('UPDATE operacao_itens SET desconto_informado=NULL WHERE cod_operacao=1');await page.getByRole('button',{name:'Ver detalhes da operação 1',exact:true}).click();await page.locator('.detail-table').waitFor();assert.equal(await page.locator('.price-warning').count(),0);assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(base)));await writeFile('docs/validacao-complementos-ui.json',JSON.stringify({verificadoEm:new Date().toISOString(),ambiente:'dados sintéticos isolados',codigoESku:true,precosComplementares:true,avisoDescontoZero:true,ausenciaNaoEquivaleZero:true,resumoParcelas:4,semConsultaERPNoDetalhe:true,desktopMobile:true,mobileSemOverflow:true,errors},null,2)+'\n');console.log('Preços, aviso e parcelas validados no desktop e celular.');
}finally{await browser?.close();await cleanup();}
