import {readFileSync} from 'node:fs';

// Catálogo conferido na origem. Não aplica as exclusões ou regras de exportação CSV.
const catalogo=JSON.parse(readFileSync(new URL('../../../config/exportacao-csv.json',import.meta.url),'utf8')).descricoes_eventos;

export function descricaoEvento(codigo){
 if(typeof codigo!=='string'||!Object.hasOwn(catalogo,codigo))return null;
 const descricao=catalogo[codigo];
 return typeof descricao==='string'&&descricao.trim()?descricao:null;
}
