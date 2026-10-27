/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraGatewayInterface } from './infraGateway.interface'

export type ResolveGateway = () => Promise<InfraGatewayInterface | undefined>
