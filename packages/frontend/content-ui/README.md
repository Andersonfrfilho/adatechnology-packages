# @adatechnology/content-ui

Telas de **blog / novidades / notícias** para React 18+: painel (lista e editor com Markdown, prévia
ao vivo, capa, tags, SEO, agendamento) e site público (card, lista com paginação e filtro de tag,
página do post com compartilhamento). Pareado com `@adatechnology/content-module`, mas não faz
`fetch`: o host injeta a API.

## Instalação

```bash
bun add @adatechnology/content-ui @adatechnology/content-contracts
```

```ts
import '@adatechnology/content-ui/styles.css'
```

## Painel

```tsx
import { ContentProvider, ContentWorkspace, type ContentAdminApi } from '@adatechnology/content-ui'

const adminApi: ContentAdminApi = {
  listPosts: (params) => http.get('/v1/content/posts', { params }),          // → { data, pagination }
  getPost: (id) => http.get(`/v1/content/posts/${id}`).then((r) => r.data),
  createPost: (input) => http.post('/v1/content/posts', input).then((r) => r.data),
  updatePost: (id, input) => http.patch(`/v1/content/posts/${id}`, input).then((r) => r.data),
  publishPost: (id, input) => http.post(`/v1/content/posts/${id}/publish`, input).then((r) => r.data),
  unpublishPost: (id) => http.post(`/v1/content/posts/${id}/unpublish`).then((r) => r.data),
  archivePost: (id) => http.delete(`/v1/content/posts/${id}`),
  listTags: () => http.get('/v1/content/posts/tags').then((r) => r.data),                // opcional
  uploadCoverImage: (file) => http.post('/v1/content/posts/cover-images', file, {         // opcional
    headers: { 'Content-Type': file.type },
  }).then((r) => r.data),
}

<ContentProvider adminApi={adminApi} locale="pt-BR" messages={{ listTitle: 'Novidades' }}>
  <ContentWorkspace newPostDefaults={{ authorName: user.name }} />
</ContentProvider>
```

`ContentWorkspace` é a tela composta (lista ↔ editor). As peças também saem soltas:

| Componente | Props |
|---|---|
| `PostList` | `onSelect(post)`, `onCreate?()`, `pageSize?`, `reloadKey?` |
| `PostEditor` | `postId?`, `defaults?`, `onSaved?(post)`, `onArchived?(post)`, `onClose?()` |
| `StatusChip` | `status` |
| `TagsInput` | `value`, `onChange`, `suggestions?`, `label` |

### Abas, modelos, republicar e publicação automática

Tudo opt-in pela API injetada (sem o método, a peça não aparece): `countPosts` liga as abas
**Publicados / Agendados / Rascunhos / Modelos** com contagem; `saveAsTemplate` e `createFromTemplate`
ligam "Salvar como modelo" e "Novo a partir do modelo"; `republishPost` liga "Republicar" (nova data, mesmo
link); `listRecurrences`/`createRecurrence`/`updateRecurrence`/`removeRecurrence` ligam o painel de
publicação automática na aba Modelos. Estado é sempre ícone + palavra + cor, e a dica usa o `Tooltip` do
pacote (hover e foco, nunca `title`). Para o host manter os próprios controles, o `ContentWorkspace` aceita
`renderDateTimeInput` e `renderSelect`; sem eles os diálogos usam `datetime-local` e `<select>` nativos.

A lista segue a regra de listagens: **busca primeiro e à esquerda**, depois filtros (abas por situação e tags
multisseleção) e as ações à direita; cabeçalhos ordenáveis (`aria-sort`), caixas de marcar próprias com ações em
lote (publicar, despublicar, excluir), paginação do servidor com "x–y de total" e itens por página. Com
`syncUrl`, busca, aba, tags, página, tamanho e ordem vão para a query string (`?tab=&q=&tags=&page=&size=&sort=&order=`).

O editor protege alterações não salvas (aviso do navegador ao fechar a aba e confirmação no botão
Voltar), valida com o mesmo schema do servidor, gera o slug do título enquanto o autor não o edita
e esconde o upload quando a API não tem `uploadCoverImage`.

## Site público

```tsx
import { ContentProvider, PostListPage, PostPage, buildPostMeta, type ContentPublicApi } from '@adatechnology/content-ui'

const publicApi: ContentPublicApi = {
  listPublishedPosts: (params) => fetchJson('/v1/content/public/posts', params),
  getPublishedPost: (slug) => fetchJson(`/v1/content/public/posts/${slug}`).then((r) => r.data),
  listTags: () => fetchJson('/v1/content/public/tags').then((r) => r.data),                 // opcional
}

<ContentProvider publicApi={publicApi} renderLink={({ href, ...props }) => <Link to={href} {...props} />}>
  <PostListPage
    page={page}
    tag={tag}
    title="Novidades"
    getPostHref={(slug) => `/blog/${slug}`}
    getListHref={({ page, tag }) => `/blog?page=${page}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
  />
  <PostPage slug={slug} getTagHref={(tag) => `/blog?tag=${tag}`} onLoaded={(post) => setHead(buildPostMeta(post, { url }))} />
</ContentProvider>
```

| Componente | Props |
|---|---|
| `PostListPage` | `page?`, `tag?`, `pageSize?`, `getPostHref(slug)`, `getListHref({ page, tag? })`, `title?` |
| `PostPage` | `slug`, `shareUrl?`, `shareNetworks?`, `getTagHref?`, `onLoaded?(post)`, `renderNotFound?()` |
| `PostCard` | `post`, `href`, `headingLevel?` |
| `ShareButtons` | `url`, `title`, `networks?` (`whatsapp`, `facebook`, `x`, `linkedin`) |
| `MarkdownContent` | `markdown`, `headingLevelOffset?` |

O corpo é renderizado do AST do `content-contracts` direto em elementos React — **sem
`dangerouslySetInnerHTML`**. Compartilhar usa só URLs das redes (nenhum script de terceiro), mais
"Copiar link" e o Web Share nativo quando o navegador tem.

## Tema

Sem cor própria: sobrescreva as variáveis no escopo do host.

```css
:root {
  --adc-accent: #0f766e;
  --adc-surface: #ffffff;
  --adc-text: #0f172a;
  --adc-muted: #64748b;
  --adc-border: #e2e8f0;
  --adc-radius-base: 12px;
  --adc-font-title: 'Space Grotesk', system-ui;
}
```

Responsivo a partir de 375px (uma coluna; 2 em 640px; 3 e editor lado a lado em 1024px), áreas de
toque de 44px, `prefers-reduced-motion` respeitado.

## Textos

`pt-BR` (padrão) e `en`. `messages` sobrescreve chaves pontuais. Camada headless: `usePostEditor`,
`usePostList`, `useUnsavedChangesGuard`, mais os utilitários puros (`buildShareLinks`,
`buildPostMeta`, `draftToInput`, `validateDraft`, `buildPageItems`).
