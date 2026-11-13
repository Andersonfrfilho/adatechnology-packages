/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { COST_PRODUCTION_FILL } from '../constants/infraStyle.constant'
import { COST_KIND, COST_STAGING_PATTERN_ID, type CostKind } from '../constants/infraUi.constant'

type CostSwatchProps = {
  readonly kind: CostKind
}

/** Amostra de cor da legenda. Homologacao e listrada, producao e lisa: a diferenca nao depende so do matiz. */
export function CostSwatch({ kind }: CostSwatchProps) {
  const isStaging = kind === COST_KIND.STAGING

  return (
    <svg aria-hidden="true" className="inline-block size-3.5 shrink-0 rounded-sm" height="14" width="14">
      {isStaging ? (
        <rect fill={`url(#${COST_STAGING_PATTERN_ID})`} height="14" width="14" />
      ) : (
        <rect className={COST_PRODUCTION_FILL} height="14" width="14" />
      )}
    </svg>
  )
}
