/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela composta do painel: lista ↔ editor, com recarga da lista depois de salvar. É o padrão de
 * consumo — o host usa esta tela inteira e customiza por `messages` e callbacks.
 */

import type { Post } from '@adatechnology/content-contracts'
import { useState } from 'react'

import type { PostDraft } from '../lib/postDraft'
import type { RenderDateTimeInput, RenderSelect } from '../providers/types'
import { PostEditor } from './PostEditor'
import { PostList, type PostListProps } from './PostList'

type WorkspaceView = { readonly kind: 'list' } | { readonly kind: 'editor'; readonly postId?: string }

export type ContentWorkspaceProps = {
  /** Repassado à lista: botão de exportação do host (opt-in). */
  readonly renderExport?: PostListProps['renderExport']
  readonly pageSize?: number
  /** Valores iniciais do post novo (ex.: autor logado). */
  readonly newPostDefaults?: Partial<PostDraft>
  readonly onPostSaved?: (post: Post) => void
  /** Seletor de data e hora do host (padrão: `datetime-local` nativo). */
  readonly renderDateTimeInput?: RenderDateTimeInput
  /** Menu de seleção do host (padrão: `<select>` nativo). */
  readonly renderSelect?: RenderSelect
  /** Busca, aba, tags, página, tamanho e ordem da lista na URL (padrão: não). */
  readonly syncUrl?: boolean
  /** Barra de formatação do corpo do post (padrão: ligada). */
  readonly showFormattingToolbar?: boolean
}

export function ContentWorkspace({
  pageSize,
  newPostDefaults,
  onPostSaved,
  renderDateTimeInput,
  renderSelect,
  syncUrl,
  renderExport,
  showFormattingToolbar,
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
      {...(renderDateTimeInput ? { renderDateTimeInput } : {})}
      {...(renderSelect ? { renderSelect } : {})}
      {...(syncUrl ? { syncUrl } : {})}
      {...(pageSize ? { pageSize } : {})}
      onSelect={(post) => setView({ kind: 'editor', postId: post.id })}
      onCreate={() => setView({ kind: 'editor' })}
      {...(renderExport ? { renderExport } : {})}
    />
  )
}
