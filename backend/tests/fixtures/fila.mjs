import {criarReprocessamentos} from '../../src/reprocessar-vendas.mjs';
import {criarFuncionarios} from '../../src/funcionarios.mjs';
import {criarProdutos} from '../../src/produtos.mjs';
import {randomUUID} from 'node:crypto';
import {criarPool} from '../../src/postgres.mjs';import {migrar} from '../../src/migracoes.mjs';
import {criarAuth,criarAdmin} from '../../src/admin-auth.mjs';import {criarServidor} from '../../src/http-api.mjs';
import {criarPainel} from '../../src/painel.mjs';import {criarFila} from '../../src/fila-atendimento.mjs';
import {criarGestaoPermissoes} from '../../src/gestao-permissoes.mjs';import {criarFrontend} from '../../src/frontend.mjs';
export async function ambienteFila({imagemProduto}={}){
 const schema='fila_'+randomUUID().replaceAll('-',''),ca=criarPool(process.env.CONTROL_DATABASE_URL),ta=criarPool(process.env.TENANT_DATABASE_URL);let control,pool,server;
 async function close(){if(server)await new Promise(r=>server.close(r));await Promise.all([control?.end(),pool?.end()]);await ca.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await ta.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await Promise.all([ca.end(),ta.end()]);}
 try{
 await ca.query(`CREATE SCHEMA ${schema}`);await ta.query(`CREATE SCHEMA ${schema}`);control=criarPool(process.env.CONTROL_DATABASE_URL,{options:`-c search_path=${schema}`});pool=criarPool(process.env.TENANT_DATABASE_URL,{options:`-c search_path=${schema}`});
 await migrar(control,new URL('../../../database/migrations/control/',import.meta.url));await migrar(pool,new URL('../../../database/migrations/tenant/',import.meta.url));
 await control.query("INSERT INTO tenants(tenant_key,nome,database_name) VALUES('teste','Teste','teste'),('outro','Outro','outro')");await pool.query("INSERT INTO tenant_identity(tenant_key) VALUES('teste')");
 const filiais=Array.from({length:10},(_,i)=>String(i+1));for(const filial of filiais){await pool.query("INSERT INTO cadastro_filiais(filial,cod_filial,trans_id) VALUES($1,$2,1)",[filial,'Loja teste '+filial]);for(const [code,nome] of [['10','Ana Exemplo'],['20','Bruno Exemplo'],['30','Carla Exemplo']])await pool.query("INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,vendedor_codigo,vendedor_nome) VALUES($1,'S',$2,current_date,1,100,false,$3,$4)",[code,filial,code,nome]);}
 const senha='Senha de teste apenas para fila!';for(const email of ['admin@fila.local','vendas@fila.local','leitor@fila.local'])await criarAdmin(control,{tenant:'teste',email,senha});
 await control.query("UPDATE admin_users SET role='Vendas' WHERE email='vendas@fila.local'");await control.query("UPDATE access_roles SET permissoes=permissoes||'[\"fila:ler\",\"fila:operar\"]'::jsonb WHERE role='Vendas' AND tenant_key='teste'");
 await control.query("UPDATE admin_users SET role='Gerentes' WHERE email='leitor@fila.local'");await control.query("UPDATE access_roles SET permissoes='[\"fila:ler\"]' WHERE role='Gerentes' AND tenant_key='teste'");
 for(const email of ['vendas@fila.local','leitor@fila.local'])for(const f of filiais)await control.query("INSERT INTO user_branches(user_id,tenant_key,filial,vendedor_codigo) SELECT id,tenant_key,$2,'10' FROM admin_users WHERE email=$1",[email,f]);
 const auth=await criarAuth(control,'teste'),fila=criarFila(pool,'teste',filiais);server=criarServidor({reprocessamentos:criarReprocessamentos(pool,'teste',filiais),funcionarios:criarFuncionarios(pool,'teste',filiais),auth,fila,imagemProduto,produtos:criarProdutos(pool,'teste',filiais),painel:criarPainel(pool,'teste',filiais),filiais,gestaoPermissoes:criarGestaoPermissoes(control,'teste'),frontend:await criarFrontend(),limitar:()=>true,limitarLogin:()=>true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const tokens={};for(const role of ['admin','vendas','leitor'])tokens[role]=(await auth.login(role+'@fila.local',senha)).token;
 return {pool,control,auth,fila,filiais,senha,tokens,base:`http://127.0.0.1:${server.address().port}`,close,dia:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})};
 }catch(e){await close();throw e;}
}
