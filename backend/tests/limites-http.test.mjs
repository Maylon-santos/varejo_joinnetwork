import test from 'node:test';
import assert from 'node:assert/strict';
import {criarServidor,limitador} from '../src/http-api.mjs';

const tokens=['a'.repeat(64),'b'.repeat(64),'c'.repeat(64),'d'.repeat(64)];
async function ambiente(t,opcoes={}){
 let now=0;
 const users=[{id:'1',tenant_key:'A'},{id:'2',tenant_key:'A'},{id:'1',tenant_key:'A'},{id:'1',tenant_key:'B'}].map(u=>({...u,role:'Admin',permissoes:[],vinculos:[]}));
 const server=criarServidor({auth:{autenticar:async token=>users[tokens.indexOf(token)]??null,login:async()=>null},painel:{restringir:()=>({})},filiais:['1'],funcionarios:{foto:async()=>Buffer.from('foto sintetica')},limitar:limitador({limite:2,janelaMs:10000,agora:()=>now}),limitarImagens:limitador({limite:3,janelaMs:10000,agora:()=>now}),limitarAnonimo:limitador({limite:2,janelaMs:10000,agora:()=>now}),...opcoes});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;
 return {now:n=>now=n,get:(path='/auth/me',token=tokens[0],headers={})=>fetch(base+'/api/v1'+path,{headers:{...(token?{Authorization:'Bearer '+token}:{}),...headers}}),post:(path,body,token)=>fetch(base+'/api/v1'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})};
}

test('Consultas são limitadas por conta/tenant, sem compartilhar cota pelo proxy ou por nova sessão',async t=>{
 const e=await ambiente(t);
 assert.equal((await e.get()).status,200);assert.equal((await e.get()).status,200);
 const bloqueio=await e.get();assert.equal(bloqueio.status,429);assert.equal(bloqueio.headers.get('Retry-After'),'10');
 assert.equal((await e.get('/auth/me',tokens[1])).status,200);
 assert.equal((await e.get('/auth/me',tokens[2])).status,429);
 assert.equal((await e.get('/auth/me',tokens[3])).status,200);
 assert.equal((await e.get('/auth/me',tokens[0],{'X-Real-IP':'198.51.100.1','X-Forwarded-For':'203.0.113.2'})).status,429);
 e.now(9000);assert.equal((await e.get()).headers.get('Retry-After'),'1');
 e.now(10001);assert.equal((await e.get()).status,200);
});

test('Fotos têm cota separada sem bloquear consultas; escrita de foto continua na cota funcional',async t=>{
 const e=await ambiente(t);
 for(let i=0;i<3;i++)assert.equal((await e.get('/funcionarios/1/10/foto')).status,200);
 assert.equal((await e.get('/funcionarios/1/10/foto')).status,429);
 assert.equal((await e.get()).status,200);assert.equal((await e.get()).status,200);
 assert.equal((await e.post('/funcionarios/1/10/foto',{imagem:'sintetica'},tokens[0])).status,429);
 assert.equal((await e.get()).status,429);
});

test('Tráfego não autenticado mantém limite próprio e não esgota a cota da conta',async t=>{
 const e=await ambiente(t);
 assert.equal((await e.get('/auth/me',null)).status,401);assert.equal((await e.get('/auth/me',null)).status,401);
 const r=await e.get('/auth/me',null);assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'10');
 assert.equal((await e.get()).status,200);
});

test('Teto de entrada permanece ativo antes da autenticação e não confia em headers de IP',async t=>{
 const e=await ambiente(t,{limitarEntrada:limitador({limite:2})});
 assert.equal((await e.get()).status,200);assert.equal((await e.get('/auth/me',tokens[1])).status,200);
 assert.equal((await e.get('/auth/me',tokens[3],{'X-Real-IP':'198.51.100.3'})).status,429);
});

test('Tentativas de login continuam limitadas independentemente das consultas autenticadas',async t=>{
 const e=await ambiente(t,{limitarLogin:limitador({limite:1,janelaMs:900000})});
 const body={email:'teste@exemplo.invalid',senha:'Senha sintetica para verificacao'};
 assert.equal((await e.post('/auth/login',body)).status,401);
 const r=await e.post('/auth/login',body);assert.equal(r.status,429);assert.equal((await r.json()).erro,'LIMITE_DE_LOGIN');
 assert.ok(Number(r.headers.get('Retry-After'))>60);
 assert.equal((await e.get()).status,200);
});
