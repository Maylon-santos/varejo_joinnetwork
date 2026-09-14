import {atrasoAposFalhas} from './ciclo-sync.mjs';
import {erroSeguro} from './postgres.mjs';
export async function preencherComplementos({pool,repositorio,tenant,filial,consultar,limite=3,intervalo=360,parar=()=>false}){
 if(!Number.isSafeInteger(limite)||limite<1||limite>7)throw new Error('LIMITE_DIAS_INVALIDO');
 await repositorio.transacao({tenant,filial},async()=>{});
 const state=(await pool.query("SELECT falhas_consecutivas,proxima_tentativa>now() AS aguardar FROM sync_status WHERE filial=$1 AND recurso='complementos'",[filial])).rows[0];
 if(state?.aguardar)return {aguardando:true,filial};
 const dias=(await pool.query('SELECT DISTINCT data_operacao::text AS dia FROM operacoes WHERE filial=$1 AND complementos IS NULL ORDER BY dia DESC LIMIT $2',[filial,limite])).rows;
 let atualizadas=0;
 try{
  for(const {dia} of dias){
   if(parar())return {interrompido:true,filial,atualizadas};
   const ops=await consultar({filial,inicio:dia,fim:dia});
   atualizadas+=await repositorio.transacao({tenant,filial},tx=>tx.preencherComplementos(ops));
   const remaining=await pool.query('SELECT 1 FROM operacoes WHERE filial=$1 AND data_operacao=$2 AND complementos IS NULL LIMIT 1',[filial,dia]);
   if(remaining.rowCount)throw new Error('COMPLEMENTOS_OPERACOES_AUSENTES');
  }
  await pool.query("INSERT INTO sync_status(filial,recurso,ultimo_sucesso,proxima_tentativa) VALUES($1,'complementos',now(),now()+$2*interval '1 second') ON CONFLICT(filial,recurso) DO UPDATE SET ultimo_sucesso=now(),falhas_consecutivas=0,ultimo_erro_codigo=NULL,proxima_tentativa=EXCLUDED.proxima_tentativa",[filial,intervalo]);
  return {filial,dias:dias.length,atualizadas};
 }catch(e){
  const falhas=(state?.falhas_consecutivas||0)+1;
  await pool.query("INSERT INTO sync_status(filial,recurso,falhas_consecutivas,ultimo_erro_codigo,proxima_tentativa) VALUES($1,'complementos',$2,$3,now()+$4*interval '1 second') ON CONFLICT(filial,recurso) DO UPDATE SET falhas_consecutivas=EXCLUDED.falhas_consecutivas,ultimo_erro_codigo=EXCLUDED.ultimo_erro_codigo,proxima_tentativa=EXCLUDED.proxima_tentativa",[filial,falhas,erroSeguro(e),atrasoAposFalhas(intervalo,falhas)]);
  throw e;
 }
}
