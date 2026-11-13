/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O modelo padrão de e-mail (`notification.standard-email`) na tela: quem é, se está utilizável e
 * como fica com os exemplos do catálogo. A regra mora no `notification-contracts` — aqui só se
 * chama, para a tela e o servidor nunca discordarem do que é "utilizável".
 */

import {
  STANDARD_EMAIL_TEMPLATE_KEY,
  STANDARD_EMAIL_VARIABLES,
  assessStandardEmailTemplate,
  renderStandardEmail,
  type StandardEmailAssessment,
} from '@adatechnology/notification-contracts'

export function isStandardEmailKey(key: string): boolean {
  return key === STANDARD_EMAIL_TEMPLATE_KEY
}

/** Vale para o HTML inteiro do modelo; não depende da área de mensagem. */
export function assessStandardEmailDraft(html: string): StandardEmailAssessment {
  return assessStandardEmailTemplate(html)
}

function example(name: string): string {
  return STANDARD_EMAIL_VARIABLES.find((variable) => variable.name === name)?.example ?? ''
}

/** O modelo renderizado pelo mesmo `renderStandardEmail` do envio, com os exemplos do catálogo. */
export function buildStandardEmailPreviewHtml(templateHtml: string): string {
  return renderStandardEmail({
    template: { html: templateHtml, source: 'company', version: 0 },
    input: {
      attachments: [{ name: example('listaAnexos') }],
      bodyText: example('corpoMensagem'),
      footer: { platformNote: example('rodapePlataforma') },
      identity: { displayName: example('nomeEmpresa'), logo: { kind: 'initials' } },
      replyHint: example('faixaResposta'),
      signer: { name: example('nomeAssinante'), role: example('cargoAssinante') },
    },
  }).html
}
