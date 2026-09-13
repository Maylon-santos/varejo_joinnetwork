# Interface do piloto

Abra **http://127.0.0.1:3100/** e use `ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env`. O Admin já foi criado. HTML, CSS e JavaScript são servidos pela API; não há processo de desenvolvimento separado nem dependências externas carregadas pelo navegador.

- Visão geral: vendas, ticket, peças por venda, quantidade, gráfico e ranking paginado. Períodos longos agrupam o gráfico por mês.
- Movimentações: paginação, tipos S/E, operações ativas/canceladas e detalhes dos itens.
- Conferência: vendas ativas com divergência de quantidade, filtradas pelo período escolhido. As cinco pendências históricas aparecem ao selecionar 01/01 a 09/09/2026.
- Consultas atualizadas a cada seis minutos enquanto a página está visível e sem detalhes abertos. Também há atualização manual.
- Indicadores baseados no cabeçalho ERP, ainda sujeitos à homologação. Entradas e cancelamentos não compõem as vendas.

A sessão permanece apenas em memória, sem localStorage ou cookies. Recarregar a página exige novo login; logout revoga a sessão no servidor. Nenhuma credencial é incluída nos arquivos estáticos. O servidor limita os arquivos públicos a uma lista explícita e aplica Content Security Policy.

## Executar e verificar

```sh
docker compose up -d --build --wait api
npm test
npm run test:integration
npm run test:ui
```

O teste de interface usa o Chrome local e as credenciais do `.env`, sem imprimi-las. Por padrão procura o Chrome em `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; `CHROME_EXECUTABLE` permite outro caminho. Requer dependências de desenvolvimento instaladas (`npm install`).

A verificação cobre login válido/inválido, filtros, gráfico, paginação, itens, período vazio, falha de consulta com retentativa, layouts mobile/tablet, revogação da sessão e logout. Evidência em [validacao-interface.json](../docs/validacao-interface.json). Capturas ficam em `artifacts/ui/`, ignoradas no controle de versão e no contexto Docker porque contêm dados comerciais.

O navegador integrado estava indisponível nesta sessão; a verificação foi realizada com Playwright e Chrome local. A aplicação está restrita ao ambiente local e à filial ITUPEVA; publicação e demais filiais seguem no roadmap.

## Correções de 13/09/2026

Login mobile com campos de 16 px para evitar zoom automático ao focar no iPhone; tabela mantém o conteúdo excedente em sua área de rolagem. Fotos são carregadas pela rota autenticada da API e exibidas como blobs temporários, evitando acesso HTTP direto no navegador HTTPS.

Detalhes consultam nome e telefones do cliente no ERP sob demanda, com indicador de carregamento, ausência e retentativa. Esses dados não são persistidos no banco. O fechamento dos detalhes aborta consultas e libera as imagens temporárias.
