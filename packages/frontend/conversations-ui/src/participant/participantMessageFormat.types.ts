export type CopyableKind = 'phone' | 'email' | 'cpf' | 'cnpj' | 'accessKey'

export type InlineNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'strong' | 'em' | 'del'; readonly children: readonly InlineNode[] }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'link'; readonly href: string; readonly label: string }
  | { readonly kind: 'copyable'; readonly copyKind: CopyableKind; readonly value: string }

export type FormatBlock =
  | { readonly kind: 'paragraph'; readonly children: readonly InlineNode[] }
  | { readonly kind: 'pre'; readonly value: string }
  | { readonly kind: 'quote'; readonly children: readonly InlineNode[] }
  | {
      readonly kind: 'list'
      readonly ordered: boolean
      readonly start: number
      readonly items: readonly (readonly InlineNode[])[]
    }

/** A span of the line that is atomic: nothing inside it is formatted. */
export type InlineAtom = { readonly start: number; readonly end: number; readonly node: InlineNode }
