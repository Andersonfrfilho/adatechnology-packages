import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CancelDocumentDto {
  @ApiProperty({ description: 'Chave de acesso da NF-e/NFC-e (44 dígitos)' })
  @IsString()
  chaveAcesso: string

  @ApiProperty({ description: 'Número do protocolo de autorização' })
  @IsString()
  protocolo: string

  @ApiProperty({ description: 'Justificativa do cancelamento (mín 15 caracteres)' })
  @IsString()
  justificativa: string

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

  @ApiPropertyOptional({ description: 'Série da nota' })
  @IsOptional()
  @IsString()
  serie?: string
}
