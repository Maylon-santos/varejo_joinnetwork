# Documentação de Envio de Mensagens

## Métodos de Envio
- Mensagens de Texto
- Mensagens com Mídia

## Instruções
### Notas Importantes
Antes de enviar mensagens, é necessário registrar o token vinculado à conexão que enviará as mensagens. <br />Para registrar, acesse o menu 'Conexões', clique no botão de edição da conexão e insira o token no campo apropriado.

O número de envio não deve ter máscara ou caracteres especiais e deve ser composto por:
- Código do País
- Código de Área (DDD)
- Número de Telefone

---

## 1. Mensagens de Texto
Abaixo está a lista de informações necessárias para enviar mensagens de texto:

**Endpoint:** `https://apitalk.joinnetwork.com.br/api/messages/send`  
**Método:** POST  
**Headers:** Authorization Bearer (token registrado) e Content-Type (application/json)

**Body:**
```json
{
  "number": "558599999999",
  "body": "Mensagem",
  "userId": "ID do usuário ou \"\"",
  "queueId": "ID da fila ou \"\"",
  "sendSignature": "Assinar mensagem - true/false",
  "closeTicket": "Fechar o ticket - true/false"
}
```

### Envio de Teste
- Token Registrado *
- Número *
- Mensagem *
- ID do Usuário/Agente
- ID da Fila

**[BOTÃO] ENVIAR**

---

## 2. Mensagens com Mídia
Abaixo está a lista de informações necessárias para enviar mensagens com mídia:

**Endpoint:** `https://apitalk.joinnetwork.com.br/api/messages/send`  
**Método:** POST  
**Headers:** Authorization Bearer (token registrado) e Content-Type (multipart/form-data)

**FormData:**
- `number`: 558599999999
- `body`: Mensagem
- `userId`: ID do usuário ou ""
- `queueId`: ID da fila ou ""
- `medias`: arquivo
- `sendSignature`: Assinar mensagem - true/false
- `closeTicket`: Fechar o ticket - true/false




ex: de como enviar 

curl --request POST \
  --url https://apitalk.joinnetwork.com.br/api/messages/send \
  --header 'Authorization: Bearer toekn' \
  --header 'Content-Type: application/json' \
  --data '{
  "number": "5535992159761",
  "body": "Teste"
 
}'

curl --request POST \
  --url https://apitalk.joinnetwork.com.br/api/messages/send \
  --header 'Authorization: Bearer SEU_TOKEN_AQUI' \
  --header 'content-type: multipart/form-data' \
  --form number=558599999999 \
  --form 'body=Mensagem de exemplo' \
  --form medias=@/caminho/para/seu/arquivo.jpg