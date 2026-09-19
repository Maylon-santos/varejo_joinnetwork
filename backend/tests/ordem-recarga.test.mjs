import test from 'node:test';import assert from 'node:assert/strict';
import {opcoesRecarga,ordenarRecarga} from '../src/ordem-recarga.mjs';
test('recarga prioriza código da filial sem mudar o escopo nem a ordem restante',()=>{
 const filiais=['1','2','3'],cadastros=[{filial:'1',cod_filial:'ITUPEVA'},{filial:'3',cod_filial:'AERO-023'}];
 assert.deepEqual(ordenarRecarga(filiais,cadastros,'AERO-023'),['3','1','2']);assert.deepEqual(filiais,['1','2','3']);
 assert.deepEqual(ordenarRecarga(filiais,cadastros,null),filiais);
 assert.throws(()=>ordenarRecarga(filiais,cadastros,'AERO-999'),/INVALIDA/);
 assert.throws(()=>ordenarRecarga(['1','2'],cadastros,'AERO-023'),/INVALIDA/);
 assert.throws(()=>ordenarRecarga(filiais,[...cadastros,{filial:'2',cod_filial:'AERO-023'}],'AERO-023'),/INVALIDA/);
});
test('prioridade exige carga completa e argumentos válidos',()=>{
 assert.deepEqual(opcoesRecarga(['--completa','--primeira=AERO-023']),{completa:true,primeira:'AERO-023'});
 assert.deepEqual(opcoesRecarga([]),{completa:false,primeira:null});
 for(const args of [['--primeira=AERO-023'],['--completa','--primeira='],['--completa','--primeira=X','--primeira=Y'],['--completa','--completa'],['--invalido']])assert.throws(()=>opcoesRecarga(args));
});
