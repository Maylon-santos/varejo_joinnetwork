import test from 'node:test';
import assert from 'node:assert/strict';
import {hashSenha,verificarSenha,hashToken} from '../src/admin-auth.mjs';
import {filtros} from '../src/painel.mjs';
import {limitador} from '../src/http-api.mjs';
test('Senha tem salt individual, valida a correta e rejeita incorreta',async()=>{
 const senha='Senha de teste longa e aleatória';const a=await hashSenha(senha),b=await hashSenha(senha);
 assert.notEqual(a,b);assert.equal(await verificarSenha(senha,a),true);assert.equal(await verificarSenha('incorreta',a),false);
 assert.equal(await verificarSenha(senha,'invalido'),false);await assert.rejects(hashSenha('curta'));
 assert.notEqual(hashToken('token'),'token');
});
test('Filtros rejeitam data impossível, filial fora do escopo e paginação abusiva',()=>{
 for(const qs of ['filial=1&inicio=2026-02-30&fim=2026-03-01','filial=2&inicio=2026-01-01&fim=2026-01-02','filial=1&inicio=2026-01-01&fim=2026-01-02&limite=10000'])assert.throws(()=>filtros(new URLSearchParams(qs),['1']));
});
test('Limitador bloqueia excedente e libera após a janela',()=>{
 let now=0;const aceita=limitador({limite:2,janelaMs:100,agora:()=>now});
 assert.equal(aceita('ip'),true);assert.equal(aceita('ip'),true);assert.equal(aceita('ip'),false);now=101;assert.equal(aceita('ip'),true);
});
