import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TestConnectionDto {
  @ApiProperty({ description: 'Modelo fiscal', enum: ['nfce', 'nfe', 'sat', 'nfse', 'nfse-notarp', 'cte'] })
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

  @ApiPropertyOptional({ description: 'URL do webservice (NFS-e)' })
  @IsOptional()
  @IsString()
  webserviceUrl?: string

  @ApiPropertyOptional({ description: 'API Token (NotaRP)' })
  @IsOptional()
  @IsString()
  apiToken?: string
}
