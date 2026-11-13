/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_DATABASE_IMAGE_NAMES, INFRA_DATABASE_NAME_PATTERN } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

const DATABASE_IMAGE_NAMES: ReadonlySet<string> = new Set(INFRA_DATABASE_IMAGE_NAMES)

function extractImageName(sourceImage: string): string {
  const lastSegment = sourceImage.split('/').pop() ?? sourceImage
  return (lastSegment.split(/[:@]/)[0] ?? lastSegment).toLowerCase()
}

export function isDatabaseService(service: InfraServiceInstance): boolean {
  if (service.sourceImage === undefined || service.sourceImage === '') {
    return INFRA_DATABASE_NAME_PATTERN.test(service.serviceName)
  }
  const imageName = extractImageName(service.sourceImage)
  return DATABASE_IMAGE_NAMES.has(imageName)
}
