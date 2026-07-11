import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger'
import { FiscalService } from './fiscal.service'
import { TestConnectionDto } from './dto/test-connection.dto'
import { EmitDocumentDto } from './dto/emit-document.dto'
import { CancelDocumentDto } from './dto/cancel-document.dto'

@ApiTags('Fiscal')
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Testar conexão com o SEFAZ/webservice fiscal' })
  @ApiResponse({ status: 200, description: 'Resultado do teste de conexão' })
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.fiscalService.testConnection(dto as Record<string, any>)
  }

  @Post('emit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emitir documento fiscal (NF-e, NFC-e, SAT, NFS-e, CT-e)' })
  @ApiResponse({ status: 200, description: 'Resultado da emissão' })
  async emit(@Body() dto: EmitDocumentDto) {
    const config: Record<string, any> = { ...(dto.config as any) }

    return this.fiscalService.emit({
      referenceId: dto.referenceId,
      config,
      totalAmount: dto.totalAmount,
      discountAmount: dto.discountAmount,
      items: dto.items,
      payments: dto.payments,
      nfeData: dto.nfeData as any,
    })
  }

  @Post('preview-cupom')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gerar PDF de preview do cupom (80mm + QR) sem emitir no SEFAZ/SAT',
  })
  @ApiResponse({ status: 200, description: 'PDF do cupom em Base64' })
  async previewCupom(@Body() dto: EmitDocumentDto) {
    return this.fiscalService.previewCupom({
      referenceId: dto.referenceId || `preview-${Date.now()}`,
      config: { ...(dto.config as any) },
      totalAmount: dto.totalAmount,
      discountAmount: dto.discountAmount,
      items: dto.items,
      payments: dto.payments,
    })
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar documento fiscal' })
  @ApiResponse({ status: 200, description: 'Resultado do cancelamento' })
  async cancel(@Body() dto: CancelDocumentDto) {
    const config: Record<string, any> = {
      model: dto.model,
      environment: dto.environment,
      uf: dto.uf,
      cnpj: dto.cnpj,
      certificadoBase64: dto.certificadoBase64,
      certificadoSenha: dto.certificadoSenha,
      csc: dto.csc,
      cscId: dto.cscId,
      serie: dto.serie,
    }

    return this.fiscalService.cancel({
      chaveAcesso: dto.chaveAcesso,
      protocolo: dto.protocolo,
      justificativa: dto.justificativa,
      config,
    })
  }

  @Post('certificate-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar certificado A1' })
  @ApiResponse({ status: 200, description: 'Informações do certificado' })
  async certificateInfo(@Body() body: { certificadoBase64: string; certificadoSenha: string }) {
    if (!body.certificadoBase64 || !body.certificadoSenha) {
      throw new BadRequestException('certificadoBase64 e certificadoSenha são obrigatórios')
    }
    return this.fiscalService.getCertificateInfo(body.certificadoBase64, body.certificadoSenha)
  }

  @Post('upload-certificate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de certificado A1 (.pfx)' })
  @ApiResponse({ status: 200, description: 'Base64 do certificado e informações de validação' })
  async uploadCertificate(@UploadedFile() file: Express.Multer.File, @Body('senha') senha?: string) {
    if (!file) {
      throw new BadRequestException('Arquivo .pfx é obrigatório')
    }
    if (!senha) {
      throw new BadRequestException('Senha do certificado é obrigatória')
    }
    return this.fiscalService.uploadCertificate(file, senha)
  }

  @Post('verify-qrcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar QR Code da NFC-e (estrutura + dígito verificador + hash/CSC)' })
  @ApiResponse({ status: 200, description: 'Resultado da verificação do QR Code' })
  async verifyQrCode(@Body() body: { qrCodeUrl: string; cscToken?: string }) {
    if (!body.qrCodeUrl) {
      throw new BadRequestException('qrCodeUrl é obrigatório')
    }
    return this.fiscalService.verifyQrCode({ qrCodeUrl: body.qrCodeUrl, cscToken: body.cscToken ?? '' })
  }

  @Get('consulta-cnpj/:cnpj')
  @ApiOperation({ summary: 'Consultar CNPJ na BrasilAPI e retornar dados da empresa' })
  @ApiResponse({ status: 200, description: 'Dados da empresa' })
  async consultaCnpj(@Param('cnpj') cnpj: string) {
    return this.fiscalService.consultaCnpj(cnpj)
  }

  @Post('validate-xml')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar estrutura de XML fiscal (NF-e, NFC-e, CT-e, CF-e/SAT, NFS-e)' })
  @ApiResponse({ status: 200, description: 'Resultado da validação do XML' })
  async validateXml(@Body() body: { xml: string }) {
    return this.fiscalService.validateXml(body.xml)
  }

  @Post('import-xml-batch')
  @UseInterceptors(FilesInterceptor('files', 500))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importar múltiplos XMLs fiscais em lote (.xml)' })
  @ApiResponse({ status: 200, description: 'Resultado da importação em lote' })
  async importXmlBatch(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Envie ao menos um arquivo .xml')
    }
    return this.fiscalService.importXmlBatch(files)
  }

  @Post('import-xml-text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Importar múltiplos XMLs fiscais como texto (array de strings)' })
  @ApiResponse({ status: 200, description: 'Resultado da importação em lote' })
  async importXmlText(@Body() body: { xmls: string[] }) {
    if (!body.xmls || body.xmls.length === 0) {
      throw new BadRequestException('Envie ao menos um XML')
    }
    return this.fiscalService.importXmlText(body.xmls)
  }

  @Post('consultar-distribuicao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consultar NF-es distribuídas para um CNPJ na SEFAZ Nacional' })
  @ApiResponse({ status: 200, description: 'Lista de documentos fiscais vinculados ao CNPJ' })
  async consultarDistribuicao(
    @Body()
    body: {
      cnpj: string
      uf: string
      environment: string
      certificadoBase64: string
      certificadoSenha: string
      ultNsu?: string
    },
  ) {
    return this.fiscalService.consultarDistribuicao(body)
  }
}
