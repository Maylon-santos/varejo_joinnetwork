// Reconciliação limitada ao contrato comprovado: unidades inteiras,
// preço em centavos, ajuste monetário e ausência de frete/cortesia.
export function centavos(valor) {
  if (!['number', 'string'].includes(typeof valor)) throw new TypeError('Valor monetário ausente ou inválido');
  const texto = String(valor);
  if (!/^-?\d+(\.\d{1,2})?$/.test(texto)) throw new TypeError('Valor monetário deve ter até duas casas decimais');
  const negativo = texto.startsWith('-');
  const [inteiro, decimal = ''] = texto.replace(/^-/, '').split('.');
  return (negativo ? -1n : 1n) * (BigInt(inteiro) * 100n + BigInt(decimal.padEnd(2, '0')));
}

export const TOLERANCIA_VALOR_CENTAVOS = 2n;

export function reconciliarVenda(venda) {
  if (venda.tipo_operacao !== 'S' || venda.cancelada !== false) {
    return { status: 'nao_elegivel' };
  }
  if (!Array.isArray(venda.produtos) || !venda.produtos.length) throw new TypeError('Itens obrigatórios');
  if (venda.v_acerto === null || venda.v_acerto === undefined) {
    return { status: 'contrato_incompleto', motivo: 'v_acerto ausente; não presumir desconto zero' };
  }
  if ((venda.v_frete !== null && venda.v_frete !== undefined && centavos(venda.v_frete) !== 0n)
      || (venda.cortesia !== null && venda.cortesia !== undefined)) {
    return { status: 'regra_pendente', motivo: 'Composição de frete/cortesia ainda não homologada' };
  }
  let quantidade = 0;
  const itens = venda.produtos.reduce((total, item) => {
    if (!Number.isSafeInteger(item.quantidade) || item.quantidade <= 0) throw new TypeError('Quantidade deve ser inteiro positivo');
    quantidade += item.quantidade;
    return total + centavos(item.preco) * BigInt(item.quantidade);
  }, 0n);
  if (!Number.isSafeInteger(quantidade) || quantidade !== venda.qtde) return { status: 'quantidade_divergente' };
  const ajuste = centavos(venda.v_acerto);
  const informado = centavos(venda.valor_final);
  const esperado = itens + ajuste;
  // acerto é percentual informativo: não aplicar novamente sobre os itens.
  return {
    status: esperado - informado >= -TOLERANCIA_VALOR_CENTAVOS && esperado - informado <= TOLERANCIA_VALOR_CENTAVOS ? 'conciliada' : 'divergente',
    subtotalItensCentavos: itens.toString(),
    ajusteCentavos: ajuste.toString(),
    totalEsperadoCentavos: esperado.toString(),
    totalInformadoCentavos: informado.toString(),
    diferencaCentavos: (esperado - informado).toString(),
  };
}
