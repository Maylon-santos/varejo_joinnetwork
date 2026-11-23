# Navegação no celular

Em telas de até 760 px, o botão **Abrir menu de navegação** fica no cabeçalho. Ele abre um painel lateral com as páginas disponíveis para a conta e destaca a página atual. Ao escolher uma página, o menu fecha e o conteúdo volta ao topo. O acesso a Integrações e API mantém sua abertura em outra aba.

O menu fecha pelo botão X, por **Voltar ao painel**, ao tocar fora ou com Escape. O teclado permanece no diálogo enquanto ele está aberto; ao fechar, o foco retorna ao botão de abertura. Ao navegar, o foco segue para o conteúdo. A rolagem do fundo fica bloqueada e as opções do menu rolam separadamente em aparelhos mais baixos.

Existe apenas um conjunto de links: ele é transferido da barra lateral para o diálogo móvel. As permissões continuam definidas pelo painel e validadas no servidor. Não são criadas opções adicionais ou permissões por meio do menu. Ao retornar à largura de computador/tablet, o diálogo fecha e os links retornam à barra lateral. Expiração de sessão também fecha o menu e restaura a navegação antes do próximo login.

Os filtros no celular usam período em linha inteira, datas em linhas próprias até 430 px (lado a lado acima disso) e uma linha própria para aplicar filtros/atualizar. Campos com fonte de 16 px evitam o zoom de foco do Safari; os botões do cabeçalho e das ações têm área de toque de pelo menos 44 px. A seleção e a aplicação dos filtros preservam as regras existentes.

## Verificação

`scripts/verificar-navegacao-mobile.mjs` usa o servidor real com PostgreSQL isolado e dados sintéticos. Verifica 320, 390, 430 e 760 px, retorno para 900/1440 px, ausência de transbordamento, navegação, foco por Tab/Shift+Tab, fechamento, opções permitidas/restritas, expiração de sessão e logout. Evidência: `docs/validacao-navegacao-mobile-ui.json`. As capturas sintéticas ficam em `artifacts/navegacao-mobile-20261123/`.

## Notificações como aplicativo: próxima etapa

O painel ainda não tem instalação como PWA, service worker, inscrições Web Push ou rotina de envio de notificações do navegador. Esta alteração do menu não implementa nem ativa essas funções. Os webhooks da API de terceiros são um mecanismo separado e continuam conforme sua configuração anterior.

Em 23/11, foram aprovados os quatro tipos de alerta, incluindo o resumo após as 22h. [Requisitos e teste do piloto](ALERTAS_NOTIFICACOES.md).

Uma implementação de Web Push precisa de:

1. Manifesto e ícones para instalação do painel na Tela de Início, com identidade e endereço do aplicativo.
2. Service worker para receber o evento push e exibir a notificação. Não armazenar respostas autenticadas, tokens, vendas ou dados pessoais em cache offline.
3. Botão **Ativar notificações**, acionado voluntariamente pelo usuário, com orientação para instalar o painel quando necessário e tratamento de permissão negada/revogação.
4. Cadastro autenticado de cada dispositivo, vinculado ao usuário e tenant, proteção contra inscrição de terceiros e limpeza/revalidação no logout, desativação ou alteração de acesso.
5. Remetente Web Push com credencial VAPID privada, fila de envio, deduplicação, tentativas limitadas e remoção de inscrições expiradas. Destinos devem ser validados para evitar requisições arbitrárias; o egress deve ser configurado especificamente para os serviços de push.
6. Preferências por tipo de alerta e horário. Antes de cada envio, revalidar conta ativa, filial e permissões. O clique abre uma página do próprio painel e exige sessão; a notificação deve usar texto mínimo para não expor dados de clientes ou valores na tela bloqueada.

Exemplos de alertas a definir: nova pendência de conferência, meta atingida, atualização na Lista da Vez ou resumo diário. Cada regra precisa de destinatários e frequência definidos antes da ativação. Entrega pode sofrer atraso ou bloqueio pelo aparelho, conexão e configurações do usuário; não substitui o registro no painel.

No iPhone/iPad, o Web Push é suportado para aplicativos web adicionados à Tela de Início, a partir do iOS/iPadOS 16.4. A solicitação de permissão deve partir de uma ação do usuário dentro do aplicativo instalado. Em navegadores Android compatíveis, a inscrição também depende da autorização de notificações.

Referências técnicas: [WebKit: Web Push no iOS e iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple: envio de Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
