/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Post, PostEventType } from '@adatechnology/content-contracts'

import type { ContentDependencies } from '../use-cases/contentModule.types'

/**
 * O gancho do host roda depois da escrita, e falha nele não desfaz o que já foi gravado: o post
 * publicado continua publicado mesmo que a purga de cache do host caia. Por isso o catch local.
 */
export async function notifyPostChanged(
  dependencies: ContentDependencies,
  type: PostEventType,
  post: Post,
): Promise<void> {
  const hook = dependencies.hooks?.onPostChanged
  if (!hook) return
  try {
    await hook({ type, post })
  } catch (error) {
    dependencies.logger?.error('content-module: hook onPostChanged falhou', {
      postId: post.id,
      type,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
