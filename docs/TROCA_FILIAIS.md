# Troca de filiais e limite de consultas

## Causa identificada

O servidor aplicava uma única cota de 120 requisições por minuto pelo endereço de conexão TCP. O painel é atendido por um proxy reverso: esse endereço pode representar o próprio proxy, compartilhando a cota entre usuários. Consultas, miniaturas de produtos e fotos de vendedores consumiam a mesma cota.

Cada carga da Visão geral pode fazer quatro consultas de dados e buscar até vinte fotos de produtos, além das fotos de vendedores. Cancelar no navegador não desfaz uma requisição que já alcançou o servidor. Várias aplicações dos filtros em sequência podiam esgotar o contador mesmo com um uso normal do painel. O HTTP 429 indica essa proteção; não indica indisponibilidade do banco, perda de vendas ou falha na sincronização.

## Correção

- Consultas autenticadas: 120 por minuto por conta e tenant. Sessões diferentes da mesma conta compartilham a cota. A identidade vem da autenticação existente, não de headers enviados pelo cliente.
- Leitura de imagens/fotos: 240 por minuto por conta e tenant, sem consumir o orçamento das consultas. Escrita/alteração de fotos continua na cota funcional normal.
- Teto de entrada antes da autenticação: 1.800 por minuto por endereço TCP; tráfego anônimo: 120 por minuto. Login mantém dez tentativas por quinze minutos. Os IPs declarados por headers não são usados como identidade confiável.
- `Retry-After` informa o número de segundos restante na janela que bloqueou a requisição, em vez de sempre devolver 60 segundos. O limite de buckets continua em 10.000 por limitador.
- Aplicações rápidas dos filtros, atualização e repetição são agrupadas por 250 ms. A versão anterior é invalidada e suas consultas/fotos são canceladas imediatamente; só o último filtro é carregado. Não há cache de dados de outra conta ou filial.
- Fotos de produtos são buscadas conforme se aproximam da área visível, com no máximo quatro downloads simultâneos; a troca de filial desconecta a observação e cancela os downloads antigos.
- A legenda usa os filtros efetivamente aplicados. Alterar o seletor sem aplicar não renomeia os resultados anteriores. Uma falha de consulta fica explícita, sem apresentar atualização anterior como se fosse da nova filial.
- Ao receber 429, o botão de repetição mostra a contagem restante e é liberado ao fim do intervalo. Não há repetição automática de gravações ou rajada de novas consultas.
- Datas ficam em linhas próprias até 430 px para acomodar o texto localizado do Safari. A mensagem e seu botão podem quebrar de linha sem alargar o celular.

Os limites continuam protegendo o serviço. A mudança evita que fotos e contas diferentes compartilhem a cota funcional; não promete tráfego ilimitado nem substitui teste de carga de todos os usuários simultâneos.

## Verificação

`backend/tests/limites-http.test.mjs` verifica isolamento por conta/tenant, compartilhamento entre sessões da mesma conta, rejeição de tentativa de trocar IP por header, quotas de imagens/consultas/anônimos/login e expiração da janela.

`scripts/verificar-troca-filiais-ui.mjs` usa PostgreSQL isolado e dados sintéticos para conferir dez seleções rápidas com uma única consulta final, doze cargas sequenciais sem 429, descarte da resposta antiga, legenda correta, imagens sob demanda, contagem de espera, recuperação e logout. A suíte de navegação móvel também é repetida. As capturas ficam em `artifacts/troca-filiais-20261123/`.

As regras comerciais, concessões, autenticação e sincronização não são alteradas. Publicação concluída somente na API do painel, após backup conferido: assets HTTPS iguais, limitador na imagem, saúde e interface com dados sintéticos aprovados. A verificação no navegador não substitui teste de carga simultânea nem constitui teste real no iPhone. [Evidência de publicação](validacao-troca-filiais.json).
