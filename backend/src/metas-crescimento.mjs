import {createHash} from 'node:crypto';
import {ErroApi} from './painel.mjs';
export const uuidMeta=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export const hashMeta=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function parametrosCrescimento(inicio,fim,crescimento){
 if(![inicio,fim].every(m=>typeof m==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(m))||inicio<'2001-01'||inicio>fim)throw new ErroApi(400,'META_INTERVALO_INVALIDO');
 const numero=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1,diferenca=numero(fim)-numero(inicio);
 if(diferenca>11)throw new ErroApi(400,'META_INTERVALO_INVALIDO');
 if(typeof crescimento!=='string'||!/^\d{1,4}\.\d{2}$/.test(crescimento))throw new ErroApi(400,'META_CRESCIMENTO_INVALIDO');
 const [i,d]=crescimento.split('.'),pontos=BigInt(i)*100n+BigInt(d);if(pontos>100000n)throw new ErroApi(400,'META_CRESCIMENTO_INVALIDO');
 const meses=Array.from({length:diferenca+1},(_,j)=>{const n=numero(inicio)+j;return String(Math.floor(n/12))+'-'+String(n%12+1).padStart(2,'0');});
 return {inicio,fim,crescimento_percentual:`${pontos/100n}.${String(pontos%100n).padStart(2,'0')}`,pontos,meses};
}
export function sugestaoCrescimento(base,pontos){
 const n=BigInt(base);if(n<=0n)return null;const valor=(n*(10000n+pontos)+5000n)/10000n;
 return valor<=99999999999999n?valor.toString():null;
}
export function requisicaoMensal(lote,competencia,primeira){
 if(competencia===primeira)return lote;
 const hex=hashMeta([lote,competencia]);return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
