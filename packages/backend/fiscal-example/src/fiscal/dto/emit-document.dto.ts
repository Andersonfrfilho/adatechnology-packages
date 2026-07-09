import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class EmitItemDto {
  @ApiProperty({ description: 'Código do produto', example: '001' })
  @IsString()
  codigo: string

  @ApiProperty({ description: 'Descrição do produto' })
  @IsString()
  descricao: string

  @ApiPropertyOptional({ description: 'Código NCM' })
  @IsOptional()
  @IsString()
  ncm?: string

  @ApiPropertyOptional({ description: 'CFOP', example: '5102' })
  @IsOptional()
  @IsString()
  cfop?: string

  @ApiPropertyOptional({ description: 'CST', example: '00' })
  @IsOptional()
  @IsString()
  cst?: string

  @ApiProperty({ description: 'Unidade', example: 'UN' })
  @IsString()
  unidade: string

  @ApiProperty({ description: 'Quantidade' })
  @IsNumber()
  quantidade: number

  @ApiProperty({ description: 'Valor unitário' })
  @IsNumber()
  valorUnitario: number

  @ApiProperty({ description: 'Valor total' })
  @IsNumber()
  valorTotal: number
}

class EmitPaymentDto {
  @ApiProperty({ description: 'Forma de pagamento', example: 'pix' })
  @IsString()
  method: string

  @ApiProperty({ description: 'Valor do pagamento' })
  @IsNumber()
  amount: number
}

class NfeDestinatarioDto {
  @ApiPropertyOptional({ description: 'CNPJ do destinatário' })
  @IsOptional()
  @IsString()
  cnpj?: string

  @ApiPropertyOptional({ description: 'CPF do destinatário' })
  @IsOptional()
  @IsString()
  cpf?: string

  @ApiProperty({ description: 'Nome do destinatário' })
  @IsString()
  xNome: string

  @ApiPropertyOptional({ description: 'Código IBGE do município' })
  @IsOptional()
  @IsString()
  codigoMunicipio?: string

  @ApiPropertyOptional({ description: 'CEP' })
  @IsOptional()
  @IsString()
  cep?: string

  @ApiPropertyOptional({ description: 'Logradouro' })
  @IsOptional()
  @IsString()
  logradouro?: string

  @ApiPropertyOptional({ description: 'Número' })
  @IsOptional()
  @IsString()
  numero?: string

  @ApiPropertyOptional({ description: 'Bairro' })
  @IsOptional()
  @IsString()
  bairro?: string

  @ApiPropertyOptional({ description: 'Município' })
  @IsOptional()
  @IsString()
  municipio?: string

  @ApiProperty({ description: 'UF' })
  @IsString()
  uf: string

  @ApiPropertyOptional({ description: 'Indicador de IE', example: '9' })
  @IsOptional()
  @IsString()
  indicadorIe?: string
}

class NfeDataDto {
  @ApiProperty({ description: 'Dados do destinatário' })
  @ValidateNested()
  @Type(() => NfeDestinatarioDto)
  destinatario: NfeDestinatarioDto

  @ApiPropertyOptional({ description: 'Natureza da operação' })
  @IsOptional()
  @IsString()
  naturezaOperacao?: string
}

class EmitConfigDto {
  @ApiProperty({ description: 'Modelo fiscal', enum: ['nfce', 'nfe', 'sat', 'nfse', 'nfse-notarp'] })
  @IsString()
  model: string

  @ApiProperty({ description: 'Ambiente', enum: ['homologacao', 'producao'] })
  @IsString()
  environment: string

  @ApiProperty({ description: 'UF do emitente' })
  @IsString()
  uf: string

  @ApiProperty({ description: 'CNPJ do emitente' })
  @IsString()
  cnpj: string

  @ApiPropertyOptional({ description: 'Inscrição estadual' })
  @IsOptional()
  @IsString()
  inscricaoEstadual?: string

  @ApiPropertyOptional({ description: 'Razão social' })
  @IsOptional()
  @IsString()
  razaoSocial?: string

  @ApiPropertyOptional({ description: 'Código IBGE do município' })
  @IsOptional()
  @IsString()
  codigoMunicipio?: string

  @ApiPropertyOptional({ description: 'CEP' })
  @IsOptional()
  @IsString()
  cep?: string

  @ApiPropertyOptional({ description: 'Logradouro' })
  @IsOptional()
  @IsString()
  logradouro?: string

  @ApiPropertyOptional({ description: 'Número' })
  @IsOptional()
  @IsString()
  numero?: string

  @ApiPropertyOptional({ description: 'Bairro' })
  @IsOptional()
  @IsString()
  bairro?: string

  @ApiPropertyOptional({ description: 'Município' })
  @IsOptional()
  @IsString()
  municipio?: string

  @ApiPropertyOptional({ description: 'CRT (1=Simples, 3=Normal)' })
  @IsOptional()
  @IsString()
  crt?: string

  @ApiPropertyOptional({ description: 'Série da nota' })
  @IsOptional()
  @IsString()
  serie?: string

  @ApiPropertyOptional({ description: 'Número da nota' })
  @IsOptional()
  @IsNumber()
  numeroNf?: number

  @ApiPropertyOptional({ description: 'Certificado A1 em base64' })
  @IsOptional()
  @IsString()
  certificadoBase64?: string

  @ApiPropertyOptional({ description: 'Senha do certificado' })
  @IsOptional()
  @IsString()
  certificadoSenha?: string

  @ApiPropertyOptional({ description: 'Token CSC (NFC-e)' })
  @IsOptional()
  @IsString()
  csc?: string

  @ApiPropertyOptional({ description: 'ID do CSC (NFC-e)' })
  @IsOptional()
  @IsString()
  cscId?: string

  @ApiPropertyOptional({ description: 'URL do webservice (NFS-e)' })
  @IsOptional()
  @IsString()
  webserviceUrl?: string

  @ApiPropertyOptional({ description: 'API Token (NotaRP)' })
  @IsOptional()
  @IsString()
  apiToken?: string

  @ApiPropertyOptional({ description: 'Código de ativação (SAT)' })
  @IsOptional()
  @IsString()
  activationCode?: string

  @ApiPropertyOptional({ description: 'Assinatura AC (SAT)' })
  @IsOptional()
  @IsString()
  signatureAC?: string

  @ApiPropertyOptional({ description: 'URL do SAT middleware' })
  @IsOptional()
  @IsString()
  satUrl?: string
}

export class EmitDocumentDto {
  @ApiProperty({ description: 'ID de referência do pedido' })
  @IsString()
  referenceId: string

  @ApiProperty({ description: 'Configuração do emissor' })
  @ValidateNested()
  @Type(() => EmitConfigDto)
  config: EmitConfigDto

  @ApiProperty({ description: 'Valor total da nota' })
  @IsNumber()
  totalAmount: number

  @ApiPropertyOptional({ description: 'Valor do desconto' })
  @IsOptional()
  @IsNumber()
  discountAmount?: number

  @ApiProperty({ description: 'Itens da nota', type: [EmitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmitItemDto)
  items: EmitItemDto[]

  @ApiProperty({ description: 'Pagamentos', type: [EmitPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmitPaymentDto)
  payments: EmitPaymentDto[]

  @ApiPropertyOptional({ description: 'Dados específicos NF-e (obrigatório para modelo nfe)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NfeDataDto)
  nfeData?: NfeDataDto
}
