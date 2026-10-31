import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {periodoExportacao,lerBaseExportacao,montarRelatorios,serializarCsv} from '../backend/src/exportacao-csv.mjs';

let pool;process.umask(0o077);
try{
 const {values:v}=parseArgs({options:{inicio:{type:'string'},fim:{type:'string'},ano:{type:'string'},snapshot:{type:'string'},saida:{type:'string'},dimensoes:{type:'string'}}});
 let base;
 if(v.snapshot){base=JSON.parse(await readFile(v.snapshot,'utf8'));if(v.inicio||v.fim||v.ano)throw Error('SNAPSHOT_JA_CONTEM_PERIODO');}
 else{
  const periodo=periodoExportacao(v),config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
  if(!process.env.TENANT_KEY)throw Error('TENANT_AUSENTE');pool=criarPool(process.env.TENANT_DATABASE_URL);
  base=await lerBaseExportacao(pool,{tenant:process.env.TENANT_KEY,filiais:config.tenantGroupingConfirmed?config.branchIds:['30098297'],...periodo});
 }
 const dimensoes=v.dimensoes?JSON.parse(await readFile(v.dimensoes,'utf8')):{};
 const {relatorios,manifesto}=montarRelatorios(base,dimensoes);
 // Exportações comerciais ficam exclusivamente na árvore privada ignorada pelo Git.
 const raiz=resolve('artifacts/exportacoes-csv'),saida=resolve(v.saida??`${raiz}/${base.inicio}_${base.fim}_${randomUUID()}`);
 if(!relative(raiz,saida)||relative(raiz,saida).startsWith('..')||relative(raiz,saida).startsWith('/'))throw Error('SAIDA_DEVE_SER_SUBPASTA_PRIVADA');
 await mkdir(raiz,{mode:0o700,recursive:true});await mkdir(saida,{mode:0o700});const arquivos=[];
 for(const [nome,r] of Object.entries(relatorios)){
  const arquivo=`${nome}_${base.inicio}_${base.fim}.csv`,csv=serializarCsv(r.colunas,r.linhas);
  await writeFile(`${saida}/${arquivo}.tmp`,csv,{encoding:'utf8',mode:0o600,flag:'wx'});await rename(`${saida}/${arquivo}.tmp`,`${saida}/${arquivo}`);
  arquivos.push({arquivo,linhas:r.linhas.length,sha256:createHash('sha256').update(csv).digest('hex')});
 }
 await writeFile(`${saida}/LEIA-ME.txt`,manifesto.avisos.join('\n\n')+'\n',{mode:0o600,flag:'wx'});
 await writeFile(`${saida}/manifesto.json`,JSON.stringify({...manifesto,arquivos},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({saida,linhas:manifesto.linhas,avisos:manifesto.avisos.length}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool?.end();}
