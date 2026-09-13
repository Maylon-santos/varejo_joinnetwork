# SaaS Join Network — decisões para implementação futura

## Endereço definitivo do piloto — atualização de Maylon

Maylon informou o subdomínio `aeropostale.joinnetwork.com.br` como configurado. Este endereço substitui o exemplo anterior `.tech` para o piloto. A extensão dos demais clientes e dos portais comercial/administrativo continua sujeita à decisão futura; não foi inferida migração de todos os endereços para `.com.br`.

Verificação DNS nesta sessão: resolvedor 1.1.1.1 retornou registro A para `191.252.1.241`; 8.8.8.8 e resolvedor local ainda sem endereço, compatível com propagação em andamento. Nameservers do domínio pertencem à Umbler. HTTPS e publicação do aplicativo são etapas separadas do DNS.

Registro: 12/09/2026. Maylon aprovou o padrão `cliente.joinnetwork.tech` e pediu para guardar o desenho SaaS para uma etapa futura. Este documento não representa implantação nem autorização para ativar cobrança ou alterar DNS agora.

## Decisões aprovadas

- Usar subdomínio por cliente desde o início, apresentando a identidade da empresa antes do login. Exemplo: `aeropostale.joinnetwork.com.br`.
- Compartilhar a aplicação e manter banco exclusivo por empresa, além do banco central de empresas, usuários e acessos. Filiais pertencem ao cliente; não recebem bancos de empresas diferentes por padrão.
- Preservar este desenho no planejamento; implementar os recursos SaaS posteriormente.

## Desenho futuro proposto

- Site comercial em `joinnetwork.tech`: apresentação, planos e solicitação/contratação.
- Administração da plataforma em `admin.joinnetwork.tech`: clientes, planos e ativação. Endereços comerciais/administrativos ainda sujeitos à conferência dos serviços existentes.
- Entrada assistida inicialmente: cadastro → aprovação → reserva do nome → criação do banco e identidade → preparação do Admin → integração ERP/filiais → importação → homologação → operação.
- Contratação e cobrança automáticas numa etapa comercial posterior. Planos, limites, preços e gateway continuam a definir.
- Provisionamento deve ser idempotente, registrar falhas e permitir retomada; cliente só fica ativo após conclusão verificada.
- Implementar identidade do cliente pelo hostname validado, vínculo do usuário à empresa e autorização por filial na API. Sessões devem respeitar a separação entre clientes. Nomes desconhecidos não abrem ambientes automaticamente.
- Reservar nomes administrativos e todos os subdomínios já usados por outros produtos.
- Isolar credenciais ERP, agendamento, checkpoints e falhas por empresa.
- Implementar backups por cliente, testar restauração, monitorar capacidade e definir suporte e gestão do ciclo de assinatura.

## DNS: apontamento, não redirecionamento

O navegador deve manter `aeropostale.joinnetwork.com.br` durante o uso. Configurar apontamento DNS para a plataforma, com HTTPS e roteamento no servidor para o hostname correspondente.

- Registro A: nome aponta para o IPv4 do servidor.
- Registro CNAME: nome aponta para outro hostname, sem `https://`, caminho ou porta; não representa redirecionamento HTTP.
- Proposta para automação: DNS curinga `*.joinnetwork.tech`. O cadastro ativa o nome na aplicação, sem criar um registro DNS por cliente. Depende de conferir provedor, zona existente e certificados.
- Alternativa: criar registros individuais pela API do provedor DNS.
- HTTPS curinga via Let's Encrypt requer validação DNS-01; automatizar emissão/renovação com permissões DNS limitadas. O certificado `*.joinnetwork.tech` não cobre sozinho o domínio raiz.
- Preservar registros e serviços existentes; confirmar controle do DNS antes de configurar. Não existe mudança de DNS realizada nesta etapa.

Referências: [registros de subdomínio](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/), [DNS curinga](https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/), [validação e certificados](https://letsencrypt.org/docs/challenge-types/).

## Próximas decisões

- Identificar o provedor e o responsável pelo DNS de `joinnetwork.tech`.
- Preparar publicação do piloto com backup/restauração, HTTPS e homologação.
- Confirmar agrupamento das filiais Aeropostale e regras de acesso.
- Antes de expandir para dez clientes, testar isolamento e carga. Os números do cenário visual são ilustrativos, não capacidade homologada.

Apresentação: [planejamento HTML](planejamento/index.html).
