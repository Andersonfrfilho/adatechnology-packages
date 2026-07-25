/**
 * Example de uso do @adatechnology/meta-whatsapp-provider — SDK stateless para enviar
 * mensagens/templates via WhatsApp Cloud API. Sem banco, sem webhook — só o client.
 *
 * Rodar: bun run packages/backend/meta-whatsapp-provider/example/index.ts
 * Requer WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_WABA_ID no ambiente
 * para as chamadas reais — sem eles, o script mostra os payloads que seriam enviados.
 */
import { MetaGraphError } from '../../meta-graph-core/src/index'
import { WhatsAppMessageProvider } from '../src/WhatsAppMessageProvider'
import { WhatsAppTemplateProvider } from '../src/WhatsAppTemplateProvider'

const accessToken = process.env['WHATSAPP_ACCESS_TOKEN']
const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID']
const wabaId = process.env['WHATSAPP_WABA_ID']
const testRecipient = process.env['WHATSAPP_TEST_RECIPIENT'] // número no formato 5511999999999

if (!accessToken || !phoneNumberId) {
  console.log('Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID para rodar o exemplo real.')
  console.log('\nSem credenciais, aqui está o formato de config esperado:')
  console.log({
    accessToken: '<token>',
    phoneNumberId: '<phone-number-id>',
    wabaId: '<whatsapp-business-account-id>',
  })
  process.exit(0)
}

async function main() {
  const messages = new WhatsAppMessageProvider({ accessToken: accessToken!, phoneNumberId })
  const templates = new WhatsAppTemplateProvider({ accessToken: accessToken!, wabaId })

  if (testRecipient) {
    console.log(`Enviando mensagem de texto para ${testRecipient}...`)
    const result = await messages.sendText(testRecipient, 'Olá! Este é um envio de teste do meta-whatsapp-provider.')
    console.log('Enviado, waMessageId:', result.waMessageId)
  } else {
    console.log('Defina WHATSAPP_TEST_RECIPIENT para disparar um envio de teste real.')
  }

  if (wabaId) {
    console.log('\nListando templates aprovados...')
    const list = await templates.listTemplates()
    for (const template of list) {
      console.log(`- ${template.displayName} (${template.status}, ${template.variableCount} variável(is))`)
    }
  } else {
    console.log('\nDefina WHATSAPP_WABA_ID para listar templates.')
  }
}

main().catch((error) => {
  if (error instanceof MetaGraphError) {
    console.error(`Erro da Graph API [${error.code}]:`, error.message)
    process.exitCode = 1
    return
  }
  throw error
})
