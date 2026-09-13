import { aplicarCancelamentos } from './cancelamentos.mjs';

export function validarDia(dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Data inválida');
  const d = new Date(`${dia}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== dia) throw new TypeError('Data inválida');
  return dia;
}

export function janelaCancelamentos(inicioHistorico, checkpoint, fim) {
  validarDia(inicioHistorico); validarDia(fim);
  let inicio = inicioHistorico;
  if (checkpoint) {
    validarDia(checkpoint);
    if (checkpoint > fim) throw new Error('Checkpoint posterior ao fim');
    const anterior = new Date(`${checkpoint}T00:00:00Z`);
    anterior.setUTCDate(anterior.getUTCDate() - 1);
    inicio = [inicioHistorico, anterior.toISOString().slice(0, 10)].sort().at(-1);
  }
  if (inicio > fim) throw new Error('Período inválido');
  return { inicio, fim };
}

export async function consultarCancelamentos({ baseUrl, token, filial, inicio, fim, fetchImpl = fetch }) {
  validarDia(inicio); validarDia(fim);
  if (inicio > fim || !/^\d+$/.test(String(filial)) || !token) throw new TypeError('Configuração inválida');
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new TypeError('URL inválida');
  url.pathname = url.pathname.replace(/\/$/, '') + '/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDASCANCELADAS';
  url.search = new URLSearchParams({ filial: String(filial), data_caninicial: inicio, data_canfinal: fim }).toString();
  const response = await fetchImpl(url, {
    headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`ERP_HTTP_${response.status}`);
  const body = await response.json();
  // Não avançar checkpoint de uma resposta explicitamente incompleta.
  if (!Array.isArray(body.value) || body['odata.nextLink'] || body['@odata.nextLink'] || body['odata.nextlink']
      || body['odata.count'] == null || Number(body['odata.count']) !== body.value.length) {
    throw new Error('Resposta incompleta ou paginação ainda não suportada');
  }
  const eventos = [...aplicarCancelamentos(new Map(), body.value, filial).values()];
  for (const evento of eventos) {
    const millis = Number(/^\/Date\((-?\d+)/.exec(evento.data_cancelou)[1]);
    if (!Number.isFinite(millis) || !Number.isFinite(new Date(millis).getTime())) throw new Error('Data inválida no retorno');
    const dia = new Date(millis).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (dia < inicio || dia > fim) throw new Error('Cancelamento fora do período solicitado');
  }
  return eventos;
}

// O repositório deve isolar tenant/filial, serializar ciclos concorrentes e
// persistir eventos + checkpoint na mesma transação (incluindo rollback).
export async function sincronizarCancelamentos({ repositorio, tenant, filial, inicioHistorico, fim, consultar }) {
  if (!tenant || !/^\d+$/.test(String(filial))) throw new TypeError('Escopo inválido');
  return repositorio.transacao({ tenant, filial: String(filial) }, async tx => {
    const checkpoint = await tx.lerCheckpoint();
    const janela = janelaCancelamentos(inicioHistorico, checkpoint, fim);
    const eventos = await consultar({ filial: String(filial), ...janela });
    const normalizados = [...aplicarCancelamentos(new Map(), eventos, filial).values()];
    await tx.salvarCancelamentos(normalizados);
    await tx.salvarCheckpoint(janela.fim);
    return { quantidade: normalizados.length, ...janela };
  });
}
