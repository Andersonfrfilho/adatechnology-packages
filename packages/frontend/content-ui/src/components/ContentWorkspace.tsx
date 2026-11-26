/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela composta do painel: lista ↔ editor, com recarga da lista depois de salvar. É o padrão de
 * consumo — o host usa esta tela inteira e customiza por `messages` e callbacks.
 */

import type { Post } from '@adatechnology/content-contracts'
import { useState } from 'react'

import type { PostDraft } from '../lib/postDraft'
import type { RenderDateTimeInput } from '../providers/types'
import { PostEditor } from './PostEditor'
import { PostList } from './PostList'

type WorkspaceView = { readonly kind: 'list' } | { readonly kind: 'editor'; readonly postId?: string }

export type ContentWorkspaceProps = {
  readonly pageSize?: number
  /** Valores iniciais do post novo (ex.: autor logado). */
  readonly newPostDefaults?: Partial<PostDraft>
  readonly onPostSaved?: (post: Post) => void
  readonly showFormattingToolbar?: boolean
  readonly renderDateTimeInput?: RenderDateTimeInput
}

export function ContentWorkspace({
  pageSize,
  newPostDefaults,
  onPostSaved,
  showFormattingToolbar,
  renderDateTimeInput,
}: ContentWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>({ kind: 'list' })
  const [reloadKey, setReloadKey] = useState(0)

  function handleSaved(post: Post): void {
    setReloadKey((value) => value + 1)
    // Post novo salvo passa a ser edição dele: um segundo "salvar" não cria outro.
    setView({ kind: 'editor', postId: post.id })
    onPostSaved?.(post)
  }

  if (view.kind === 'editor') {
    return (
      <PostEditor
        key={view.postId ?? 'new'}
        {...(view.postId ? { postId: view.postId } : {})}
        {...(newPostDefaults ? { defaults: newPostDefaults } : {})}
        {...(showFormattingToolbar === undefined ? {} : { showFormattingToolbar })}
        {...(renderDateTimeInput ? { renderDateTimeInput } : {})}
        onSaved={handleSaved}
        onArchived={() => {
          setReloadKey((value) => value + 1)
          setView({ kind: 'list' })
        }}
        onClose={() => setView({ kind: 'list' })}
      />
    )
  }

  return (
    <PostList
      reloadKey={reloadKey}
      {...(pageSize ? { pageSize } : {})}
      onSelect={(post) => setView({ kind: 'editor', postId: post.id })}
      onCreate={() => setView({ kind: 'editor' })}
    />
  )
}
