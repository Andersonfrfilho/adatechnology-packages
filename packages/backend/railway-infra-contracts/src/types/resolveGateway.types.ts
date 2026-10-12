/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RailwayGatewayInterface } from './railwayGateway.interface'

export type ResolveGateway = () => Promise<RailwayGatewayInterface | undefined>
