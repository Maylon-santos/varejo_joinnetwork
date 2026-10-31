import {access,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {periodoExportacao} from '../backend/src/exportacao-csv.mjs';
import {erroSeguro} from '../backend/src/postgres.mjs';
const executar=promisify(execFile);process.umask(0o077);
try{
 const {inicio,fim}=periodoExportacao();
 const raiz='artifacts/exportacoes-csv',pasta=`${raiz}/diario_${inicio}_${fim}`;
 await mkdir(raiz,{recursive:true,mode:0o700});
 let existe=false;try{await access(`${pasta}/manifesto.json`);existe=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!existe)await executar(process.execPath,['scripts/exportar-relatorios.mjs',`--inicio=${inicio}`,`--fim=${fim}`,`--saida=${pasta}`],{maxBuffer:65536,timeout:120000});
 // Retomada usa o mesmo lote/snapshot. O remetente pula aceitos e bloqueia resultados incertos.
 const r=await executar(process.execPath,['scripts/enviar-relatorios-talk.mjs',pasta],{maxBuffer:65536,timeout:240000});
 process.stdout.write(r.stdout);console.log(JSON.stringify({evento:'relatorios_diarios_concluidos',inicio,fim,lote_reutilizado:existe}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}
