// Executar da raiz: node --env-file=.env scripts/verificar-erp.mjs
// Apenas leitura de uma filial. Não imprime URL, token ou corpo de resposta.
const base = process.env.MILLENNIUM_BASE_URL;
const token = process.env.MILLENNIUM_BASIC_TOKEN;
if (!base || !token) {
  console.error('Configuração Millennium incompleta.');
  process.exitCode = 1;
} else {
  try {
    const url = new URL(base);
    if (url.username || url.password) throw new Error('invalid_url');
    // Usa o endereço configurado por Maylon, sem alterar protocolo ou porta.
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid_protocol');
    url.pathname = url.pathname.replace(/\/$/, '') + '/millenium!joinnetwork/varejo/listafiliais';
    url.search = new URLSearchParams({ filial: '30098297' }).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    console.log(`ERP: status ${response.status}`);
    if (!response.ok) process.exitCode = 1;
    else {
      const body = await response.json();
      const valid = Array.isArray(body.value);
      console.log(`Contrato value: ${valid ? 'válido' : 'inválido'}`);
      if (valid) console.log(`Filiais retornadas: ${body.value.length}; filial solicitada presente: ${body.value.some(x => String(x.filial) === '30098297')}`);
      else process.exitCode = 1;
    }
  } catch (error) {
    const code = error.cause?.code || error.code || error.name;
    console.error(`Validação não concluída (${String(code).replace(/[^a-zA-Z0-9_]/g, '')}).`);
    process.exitCode = 1;
  }
}
