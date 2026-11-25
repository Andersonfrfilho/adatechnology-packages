/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * AST do Markdown aceito no corpo do post. É fechado de propósito: não existe nó de HTML cru, então
 * nenhum renderizador (string no servidor, React no navegador) tem como emitir marcação digitada
 * pelo autor — `<script>` no corpo vira texto, não tag.
 */

export type MarkdownInline =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'strong'; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'emphasis'; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'strikethrough'; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'inlineCode'; readonly value: string }
  /** `href` já passou por `sanitizeLinkUrl`: link inseguro nem vira nó de link. */
  | {
      readonly type: 'link'
      readonly href: string
      readonly title?: string
      readonly children: readonly MarkdownInline[]
    }
  /** `src` já passou por `sanitizeImageUrl`: imagem insegura vira texto com o `alt`. */
  | { readonly type: 'image'; readonly src: string; readonly alt: string; readonly title?: string }
  | { readonly type: 'break' }

export type MarkdownBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'paragraph'; readonly children: readonly MarkdownInline[] }
  | {
      readonly type: 'list'
      readonly ordered: boolean
      readonly start?: number
      /** Lista sem linha em branco entre itens: o item é renderizado sem `<p>` em volta. */
      readonly tight: boolean
      readonly items: readonly (readonly MarkdownBlock[])[]
    }
  | { readonly type: 'blockquote'; readonly children: readonly MarkdownBlock[] }
  /** `language` restrita a `[a-z0-9+#-]` — vira classe CSS, e classe não carrega aspas nem espaço. */
  | { readonly type: 'codeBlock'; readonly language?: string; readonly value: string }
  | { readonly type: 'thematicBreak' }

export type MarkdownDocument = {
  readonly type: 'root'
  readonly children: readonly MarkdownBlock[]
}
