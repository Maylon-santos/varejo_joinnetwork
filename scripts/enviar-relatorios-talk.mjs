import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {validarDestinoTalk,enviarArquivoTalk} from '../backend/src/envio-talk.mjs';
import {erroSeguro} from '../backend/src/postgres.mjs';
process.umask(0o077);
try{
 const pastas=process.argv.slice(2);if(!pastas.length)throw Error('INFORME_LOTE_PRIVADO');
 const destino={url:process.env.TALK_SEND_URL,token:process.env.TALK_TOKEN,numero:process.env.TALK_ADMIN_NUMBER};validarDestinoTalk(destino);
 const raiz=resolve('artifacts/exportacoes-csv'),lotes=[];
 // Conferir todo o lote antes do primeiro envio. Nenhuma URL pública de arquivos.
 for(const entrada of pastas){
  const pasta=resolve(entrada),rel=relative(raiz,pasta);if(!rel||rel.startsWith('..')||rel.startsWith('/'))throw Error('LOTE_FORA_DO_ESCOPO');
  const manifesto=JSON.parse(await readFile(`${pasta}/manifesto.json`,'utf8'));const arquivos=[];
  for(const item of manifesto.arquivos){
   if(!/^[a-z0-9_-]+\.csv$/.test(item.arquivo))throw Error('ARQUIVO_INVALIDO');const bytes=await readFile(`${pasta}/${item.arquivo}`);
   if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('CHECKSUM_INVALIDO');arquivos.push({...item,bytes});
  }
  let recibo={arquivos:[]};try{recibo=JSON.parse(await readFile(`${pasta}/envio-talk.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(recibo.arquivos.some(a=>a.estado!=='aceito_api'))throw Error('ENVIO_ANTERIOR_INDETERMINADO_CONFERIR_TALK');
  if(recibo.arquivos.some(a=>!arquivos.some(f=>f.arquivo===a.arquivo&&f.sha256===a.sha256)))throw Error('RECIBO_DIVERGENTE');
  lotes.push({pasta,manifesto,arquivos,recibo});
 }
 for(const lote of lotes){
  const salvar=async()=>{await writeFile(`${lote.pasta}/envio-talk.json.tmp`,JSON.stringify(lote.recibo,null,2)+'\n',{mode:0o600});await rename(`${lote.pasta}/envio-talk.json.tmp`,`${lote.pasta}/envio-talk.json`);};
  for(const [indice,item] of lote.arquivos.entries()){
   if(lote.recibo.arquivos.some(a=>a.arquivo===item.arquivo))continue;
   const registro={arquivo:item.arquivo,sha256:item.sha256,estado:'em_envio',iniciado_em:new Date().toISOString()};lote.recibo.arquivos.push(registro);await salvar();
   const legenda=`Aeropostale — ${lote.manifesto.inicio} a ${lote.manifesto.fim}. Arquivo ${indice+1}/${lote.arquivos.length}. CSV UTF-8; separador ;, datas AAAA-MM-DD, valores BRL com ponto decimal.`+
    (indice===0?'\n\n'+lote.manifesto.avisos.join('\n\n')+'\n\nEnvio diário automático ainda não ativado.':'');
   try{Object.assign(registro,await enviarArquivoTalk({...destino,nome:item.arquivo,bytes:item.bytes,legenda}),{estado:'aceito_api',finalizado_em:new Date().toISOString()});await salvar();}
   catch(e){registro.estado='indeterminado';registro.erro=erroSeguro(e);await salvar();throw e;}
   console.log(JSON.stringify({arquivo:item.arquivo,aceito_api:true}));
  }
 }
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}
