# Navegação no celular

Em telas de até 760 px, o botão **Abrir menu de navegação** fica no cabeçalho. Ele abre um painel lateral com as páginas disponíveis para a conta e destaca a página atual. Ao escolher uma página, o menu fecha e o conteúdo volta ao topo. O acesso a Integrações e API mantém sua abertura em outra aba.

O menu fecha pelo botão X, por **Voltar ao painel**, ao tocar fora ou com Escape. O teclado permanece no diálogo enquanto ele está aberto; ao fechar, o foco retorna ao botão de abertura. Ao navegar, o foco segue para o conteúdo. A rolagem do fundo fica bloqueada e as opções do menu rolam separadamente em aparelhos mais baixos.

Existe apenas um conjunto de links: ele é transferido da barra lateral para o diálogo móvel. As permissões continuam definidas pelo painel e validadas no servidor. Não são criadas opções adicionais ou permissões por meio do menu. Ao retornar à largura de computador/tablet, o diálogo fecha e os links retornam à barra lateral. Expiração de sessão também fecha o menu e restaura a navegação antes do próximo login.

Os filtros no celular usam período em linha inteira, datas em linhas próprias até 430 px (lado a lado acima disso) e uma linha própria para aplicar filtros/atualizar. Campos com fonte de 16 px evitam o zoom de foco do Safari; os botões do cabeçalho e das ações têm área de toque de pelo menos 44 px. A seleção e a aplicação dos filtros preservam as regras existentes.

## Verificação

`scripts/verificar-navegacao-mobile.mjs` usa o servidor real com PostgreSQL isolado e dados sintéticos. Verifica 320, 390, 430 e 760 px, retorno para 900/1440 px, ausência de transbordamento, navegação, foco por Tab/Shift+Tab, fechamento, opções permitidas/restritas, expiração de sessão e logout. Evidência: `docs/validacao-navegacao-mobile-ui.json`. As capturas sintéticas ficam em `artifacts/navegacao-mobile-20261123/`.

## Instalação como aplicativo e notificações

Manifesto, ícones e service worker foram acrescentados em 23/11/2026. No iPhone, instalar pelo Safari em **Compartilhar → Adicionar à Tela de Início**, abrir pelo ícone e entrar. A área **Notificações** permite ativar o aparelho, solicitar um teste e escolher as filiais do resumo diário. O piloto é restrito à conta definida na configuração privada; o menu aparece somente para essa conta com acesso a indicadores da filial completa.

O service worker recebe/exibe avisos e abre o painel; não armazena tokens, respostas autenticadas, vendas ou dados pessoais em cache offline. A sessão do painel continua em memória, com login exigido ao recarregar. As inscrições ficam cifradas no servidor e o logout desativa o aparelho correspondente. Webhooks de terceiros e relatórios antigos são canais separados.

O resumo diário começa após 22h05 de São Paulo; atraso da coleta fica identificado como parcial após 22h30. Metas, conferência e Lista da Vez permanecem posteriores. Instalação/consentimento no próprio iPhone e recebimento real precisam ser confirmados pelo titular; os testes de navegador usam dados sintéticos.

[Procedimento, regras e operação](ALERTAS_NOTIFICACOES.md). Requisito do iPhone/iPad: aplicativo adicionado à Tela de Início com iOS/iPadOS 16.4 ou superior, conforme [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
