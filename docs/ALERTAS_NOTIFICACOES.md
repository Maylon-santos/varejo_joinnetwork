# Alertas e resumo diário: requisitos do piloto

## Escopo aprovado em 23/11/2026

Preferências de notificações para metas atingidas, novas pendências de conferência, Lista da Vez e resumo diário após as 22h, respeitando conta, tenant, filiais e permissões. Web Push/PWA ainda não foram implementados. A aprovação dos requisitos não significa que existam dispositivos inscritos ou envios ativos.

O titular definiu o primeiro piloto: **somente sua conta, em seu iPhone**, com **um resumo diário por filial após as 22h**. Notificações de cada atendimento da Lista da Vez ficam fora deste primeiro teste. Metas e pendências permanecem no escopo futuro das preferências, sem ativação implícita.

| Alerta | Regra proposta |
| --- | --- |
| Meta atingida | Conferir a meta mensal vigente e os mesmos números do painel. Uma notificação por meta/filial no mês; alteração da meta não redispara automaticamente no primeiro piloto. |
| Conferência | Avisar sobre novas pendências identificadas após a inscrição, sem disparar uma notificação para cada pendência antiga. Consolidar ocorrências próximas e abrir a Conferência já filtrada. |
| Lista da Vez | Fora do primeiro piloto. Não disparar a cada atendimento ou atualização periódica; eventual gatilho será definido numa etapa posterior. |
| Resumo diário | Primeiro piloto: execução após as 22h, com proposta inicial de 22h05, horário de São Paulo, para a data comercial do dia. Uma notificação por destinatário/filial/dia. O titular solicitou vendas, peças, valor, PA e ticket no próprio aviso; não incluir dados de clientes ou vendedores. O clique abre a filial e o dia correspondentes, com sessão e autorização. |

Formato solicitado, com os números de exemplo fornecidos pelo titular:

```text
Resumo do dia · Itupeva · 23/11/2026
28 vendas · 95 peças
Valor das vendas: R$ 14.216,58
PA: 3,39 · Ticket médio: R$ 507,74
```

PA segue a métrica de peças por venda do painel: 95 ÷ 28. Ticket médio: 14.216,58 ÷ 28. Arredondar somente na apresentação e não confundir a quantidade de vendas com atendimentos registrados na Lista da Vez. Os dados reais serão calculados no momento da geração; o exemplo não comprova os resultados comerciais do dia.

O resumo usa as regras comerciais existentes do painel. Não subtrair entradas como devoluções nem alterar bruto/líquido sem a homologação pendente. Atualização atrasada, filial ainda aberta ou coleta incompleta precisam ficar sinalizadas; o horário de 22h05 não comprova sozinho um fechamento definitivo. Definir tolerância e política de reenvio antes de automatizar correções de resumo.

O resumo por push é separado do envio de relatórios anteriormente pausado na R30. Não reativar aquele timer nem os webhooks da API externa para implementar este canal.

## O que falta para testar no celular

1. Implementar manifesto/ícones, instalação PWA e service worker, sem cache offline de respostas autenticadas, vendas, tokens ou dados pessoais.
2. Implementar preferências e inscrição autenticada de cada dispositivo; credencial VAPID privada no servidor, remetente/fila, deduplicação, tratamento de inscrições expiradas e egress restrito aos serviços de push.
3. Piloto escolhido: conta do titular e seu iPhone; nenhuma conta adicional recebe alertas sem aderir. Selecionar as filiais permitidas nas preferências e apresentar o horário proposto de 22h05. Gatilhos de atendimento da Lista da Vez ficam fora do primeiro teste.
4. No iPhone com iOS 16.4 ou superior: adicionar o painel à Tela de Início, abri-lo pelo ícone, entrar com a conta e tocar em **Ativar notificações** para autorizar. Android exige navegador compatível e autorização de notificações. Não é necessário informar número de telefone ou fornecer a senha pelo chat.
5. Enviar uma notificação de teste somente ao dispositivo inscrito. Conferir recebimento com tela bloqueada, abertura da página correta e exigência de sessão; repetir com notificações negadas, usuário inativo, filial removida, logout e inscrição expirada.
6. Simular o resumo diário com relógio/dados de teste, inclusive 21h59/22h05 em São Paulo, coleta atrasada, repetição do job e alteração de permissão. Confirmar que não há duplicatas nem exposição de outras filiais antes de habilitar o primeiro resumo real. Metas, conferência e Lista da Vez exigirão testes próprios quando forem implementados.

A autorização do sistema operacional precisa ser dada no próprio aparelho. Modo Foco/Silencioso, conexão e configurações de notificações podem atrasar ou silenciar a exibição. Push não substitui o histórico de alertas no painel.

Referências: [WebKit — Web Push no iOS e iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
