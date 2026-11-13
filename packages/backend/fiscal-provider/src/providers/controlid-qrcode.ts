/**
 * Gerador de QR Code para CF-e
 * Control-ID S@T-iD
 *
 * Gera QR codes para consulta de cupom fiscal na SEFAZ
 */

export interface QRCodeData {
  /** Chave de acesso (44 dígitos) */
  chaveAcesso: string

  /** Assinatura digital do cupom */
  assinatura?: string

  /** CNPJ do emitente */
  cnpj: string

  /** Data de emissão (DDMMYY) */
  dataEmissao: string

  /** Valor total (com 2 casas decimais) */
  valorTotal: string

  /** CPF do consumidor (opcional) */
  cpfConsumidor?: string

  /** Ambiente: 2 = homologação, 1 = produção */
  ambiente: '1' | '2'
}

/**
 * Gerar URL para QR Code SAT (SEFAZ SP)
 * A URL pode ser usada com APIs de geração de QR Code
 */
export function gerarURLQRCode(data: QRCodeData): string {
  // Formato: https://www1.nfe.fazenda.sp.gov.br/qrcode?chMDFe=[chave]
  // Para SAT, usamos a chave de acesso diretamente
  const ambiente = data.ambiente === '1' ? 'nfe.fazenda' : 'nfe.fazenda'
  return `https://www1.${ambiente}.sp.gov.br/qrcode?chMDFe=${data.chaveAcesso}`
}

/**
 * Gerar dados de QR Code em formato de string (para bibliotecas de QR Code)
 * Compatível com a especificação do SAT-CF-e
 */
export function gerarDadosQRCode(data: QRCodeData): string {
  // Formato para SAT CF-e:
  // chave_acesso|data_emissão|valor|cpf|assinatura
  const partes = [
    data.chaveAcesso,
    data.dataEmissao,
    data.valorTotal,
    data.cpfConsumidor || '',
    data.assinatura || '',
  ]

  return partes.join('|')
}

/**
 * Gerar ASCII art de QR Code (para testes)
 * Nota: Este é um exemplo simplificado. Em produção, usar qrcode npm
 */
export function gerarQRCodeASCII(chaveAcesso: string): string {
  // Padrão QR Code simplificado (para visualização)
  // Em produção, usar biblioteca como 'qrcode' ou 'qrcode.react'
  const linhas = [
    '┌─────────────────────┐',
    '│ ▄▄▄▄▄ ▀ █▀█ ▄▄▄▄▄ │',
    '│ █   █ ▄█▀█  █   █ │',
    '│ █ ▄ █  ▀█ █ █ ▄ █ │',
    '│ █▄█▄█ ▀ ▀▄▀ █▄█▄█ │',
    '│ ▀▀▀▀▀ ▀ ▀ ▀ ▀▀▀▀▀ │',
    '│     ▀ ▀▀  ▀ ▀     │',
    '│  ▄█▀ █▀█ ▀▄█▀ ▀   │',
    '│ ▀▀█▄ ▀▀▄  ▀▀█▄▀   │',
    '│ ▀▀▀▀▀ ▀ ▀ ▀▀▀▀▀ │',
    `│ Chave: ${chaveAcesso.slice(0, 15)} │`,
    '└─────────────────────┘',
  ]

  return linhas.join('\n')
}

/**
 * Gerar objeto completo com cupom + QR Code
 */
export interface CupomComQRCode {
  /** Cupom formatado para impressora */
  cupomImpresso: string

  /** URL para gerar QR Code (use serviço como goqr.me ou zxing)  */
  urlQRCode: string

  /** Dados para gerar QR Code localmente (string) */
  dadosQRCode: string

  /** QR Code em ASCII (para visualização em terminal) */
  qrCodeASCII: string

  /** HTML para exibir cupom + QR Code na web */
  htmlCupom: string
}

/**
 * Gerar cupom com QR Code para visualização
 */
export function gerarCupomComQRCode(
  cupomImpresso: string,
  qrcodeData: QRCodeData
): CupomComQRCode {
  const urlQR = gerarURLQRCode(qrcodeData)
  const dadosQR = gerarDadosQRCode(qrcodeData)
  const asciiQR = gerarQRCodeASCII(qrcodeData.chaveAcesso)

  const htmlCupom = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cupom Fiscal SAT</title>
    <style>
        body { font-family: monospace; background: #f5f5f5; margin: 20px; }
        .cupom {
            background: white;
            width: 400px;
            padding: 20px;
            margin: 0 auto;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .cupom-conteudo { white-space: pre-wrap; font-size: 12px; margin-bottom: 20px; }
        .qrcode-container { text-align: center; }
        .qrcode-container img { width: 200px; height: 200px; }
        .chave { font-size: 10px; color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="cupom">
        <div class="cupom-conteudo">${cupomImpresso.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="qrcode-container">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dadosQR)}"
                 alt="QR Code Cupom Fiscal">
            <div class="chave">Chave: ${qrcodeData.chaveAcesso}</div>
        </div>
    </div>
</body>
</html>
`

  return {
    cupomImpresso,
    urlQRCode: urlQR,
    dadosQRCode: dadosQR,
    qrCodeASCII: asciiQR,
    htmlCupom,
  }
}

export default {
  gerarURLQRCode,
  gerarDadosQRCode,
  gerarQRCodeASCII,
  gerarCupomComQRCode,
}
