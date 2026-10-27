/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. O host injeta banco, cifra e fila; o módulo não escolhe nenhum dos três.
 *
 * Capacidade por ausência: sem `cipher`, `encryptedDocuments` é erro de composição e falha no BOOT.
 * A alternativa — gravar em claro o que o produto declarou cifrado — é silenciosa e só aparece num
 * vazamento (`security.md` §5).
 */

import type {
  CustomerModuleConfig,
  DocumentCipherPort,
  FieldIndexQueuePort,
  LoggerPort,
} from '@adatechnology/customer-contracts'

import type { CustomerDatabase } from './database.types'
import { ConfigMissingError } from './shared/errors'
import { CustomerRepository } from './repositories/CustomerRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { AddAddressUseCase, RemoveAddressUseCase, UpdateAddressUseCase } from './use-cases/Address.use-case'
import { CreateCustomerUseCase, UpdateCustomerUseCase } from './use-cases/Customer.use-case'
import { FindByDocumentUseCase, SetDocumentUseCase } from './use-cases/Document.use-case'
import { GetSettingsUseCase, UpdateSettingsUseCase } from './use-cases/Settings.use-case'
import { SetWhatsAppPhoneUseCase, UpsertByPhoneUseCase } from './use-cases/UpsertByPhone.use-case'

export type CreateCustomerModuleParams = {
  readonly db: CustomerDatabase
  readonly config: CustomerModuleConfig
  /** Obrigatória apenas se `config.encryptedDocuments` listar algum documento. */
  readonly cipher?: DocumentCipherPort
  /**
   * Para onde vai a INTENÇÃO de criar índice quando um campo vira filtrável. O módulo não roda DDL
   * a partir de requisição HTTP: quem cria índice é migration, e a fila é o que liga as duas coisas
   * sem dar `CREATE INDEX` na mão de uma tela de configuração.
   */
  readonly fieldIndexQueue?: FieldIndexQueuePort
  readonly logger?: LoggerPort
}

export type CustomerModule = ReturnType<typeof createCustomerModule>

export function createCustomerModule(params: CreateCustomerModuleParams) {
  const { db, config } = params

  const encryptedDocuments = config.encryptedDocuments ?? []
  if (encryptedDocuments.length > 0 && !params.cipher) {
    throw new ConfigMissingError(
      `cipher é obrigatória: o produto declarou ${encryptedDocuments.join(', ')} como cifrado.`,
    )
  }

  const customers = new CustomerRepository(db)
  const settings = new SettingsRepository(db)
  const documentDependencies = { db, cipher: params.cipher, encryptedDocuments }
  const setDocument = new SetDocumentUseCase(documentDependencies)
  const customerDependencies = {
    db,
    repository: customers,
    setDocument,
    ...(config.defaultCountryCode ? { defaultCountryCode: config.defaultCountryCode } : {}),
    ...(params.cipher ? { cipher: params.cipher } : {}),
    encryptedDocuments,
  }

  return {
    config,
    /** Exposta para a rota de ficha decifrar documento na leitura — a listagem não decifra. */
    cipher: params.cipher,
    repositories: { customers, settings },
    useCases: {
      upsertByPhone: new UpsertByPhoneUseCase(db, customers, config.defaultCountryCode),
      setWhatsAppPhone: new SetWhatsAppPhoneUseCase(db),
      setDocument,
      createCustomer: new CreateCustomerUseCase(customerDependencies),
      updateCustomer: new UpdateCustomerUseCase(customerDependencies),
      findByDocument: new FindByDocumentUseCase(documentDependencies),
      addAddress: new AddAddressUseCase({ db }),
      updateAddress: new UpdateAddressUseCase({ db }),
      removeAddress: new RemoveAddressUseCase({ db }),
      getSettings: new GetSettingsUseCase(settings),
      updateSettings: new UpdateSettingsUseCase({
        repository: settings,
        encryptedDocuments,
        ...(params.fieldIndexQueue ? { indexQueue: params.fieldIndexQueue } : {}),
        ...(params.logger ? { logger: params.logger } : {}),
      }),
    },
  } as const
}
