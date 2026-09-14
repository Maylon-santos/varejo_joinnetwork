import test from 'node:test';import assert from 'node:assert/strict';
import {escopoUsuario,exigirPermissao} from '../src/permissoes.mjs';
test('Escopo nega filiais não atribuídas, limita vendedor por filial e não confunde permissão com cargo',()=>{
 const user={role:'Vendas',somente_proprias_vendas:true,permissoes:['vendas:ler'],vinculos:[{filial:'1',vendedor_codigo:'10'},{filial:'999',vendedor_codigo:'20'}]};
 assert.deepEqual(escopoUsuario(user,['1','2']),{filiais:['1'],vendedores:{'1':'10'},permissoes:['vendas:ler']});
 assert.deepEqual(escopoUsuario({...user,vinculos:[]},['1']).filiais,[]);
 assert.deepEqual(escopoUsuario({...user,vinculos:[{filial:'1'}]},['1']).vendedores,{'1':''});
 assert.throws(()=>exigirPermissao(user.permissoes,'clientes:ler'),{status:403});
});
