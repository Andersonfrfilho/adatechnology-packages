# @adatechnology/image-editor-ui

Editor de foto para React 18+, no navegador, sem dependência além do React: **canvas** para desenhar e exportar.
Recorte por formato (capa 16:9, galeria 3:2, quadrado 1:1, livre), girar 90°, espelhar, zoom, brilho e contraste,
**ponto de foco** e **texto alternativo**. Devolve o `Blob` editado e os **metadados da edição**, para o host guardar uma
versão nova, manter a original e reabrir a edição depois.

Teclado completo (setas movem o quadro, `+`/`−` aproximam, `Alt` com setas muda o tamanho no recorte livre), toque
(arrastar, pinça, alças com área de 44 px), sem controle nativo (sem `<select>`, `<input type="range">` nem checkbox) e rótulos em pt-BR
substituíveis.

## Instalação

```bash
bun add @adatechnology/image-editor-ui
```

```ts
import '@adatechnology/image-editor-ui/styles.css'
```

## Uso

```tsx
import { ImageEditor, type ImageEditMetadata, type ImageEditResult } from '@adatechnology/image-editor-ui'

function EditPhoto({ photo }: { photo: { originalUrl: string; edit?: ImageEditMetadata } }) {
  async function handleSave(result: ImageEditResult) {
    // result.blob  -> imagem editada (JPEG, ou WebP se a origem não for JPEG)
    // result.metadata -> { crop, rotation, flips, adjustments, focalPoint, altText, ... }
    await api.saveVersion(result.blob, result.metadata) // o host guarda; a original continua intacta
  }
  return (
    <ImageEditor
      source={photo.originalUrl}          // Blob ou URL (precisa permitir fetch)
      initialEdit={photo.edit}            // reabre a edição anterior sobre a mesma original
      initialPresetId="gallery"
      maxOutputSide={2000}
      maxOutputBytes={2 * 1024 * 1024}    // reduz qualidade/tamanho até caber
      onSave={handleSave}
      onCancel={close}
      onRevertToOriginal={revert}         // opcional: mostra "Voltar ao original"
    />
  )
}
```

Sempre edite a partir da **original**: o recorte guardado em `metadata.crop` é relativo à imagem original já girada/espelhada.

### Ponto de foco no site

`metadata.focalPoint` é relativo ao resultado recortado (0 a 1). Para cortar a foto por `object-fit: cover` em qualquer
tela e manter o assunto à vista:

```tsx
import { focalPointToObjectPosition } from '@adatechnology/image-editor-ui'

<img src={url} alt={altText} style={{ objectFit: 'cover', objectPosition: focalPointToObjectPosition(focalPoint) }} />
```

## Props

| Prop | Tipo | Para quê |
|---|---|---|
| `source` | `Blob \| string` | imagem original |
| `presets` | `AspectPreset[]` | formatos oferecidos (`aspect` = largura/altura; `undefined` = livre). Padrão: capa, galeria, quadrado, livre |
| `initialPresetId` | `string` | formato inicial |
| `initialEdit` | `ImageEditMetadata` | reabre uma edição |
| `labels` | `Partial<ImageEditorLabels>` | textos; `imageEditorLabelsPtBr` (padrão) e `imageEditorLabelsEn` |
| `outputType` / `outputQuality` | | JPEG fica JPEG; o resto sai em WebP (guarda transparência) |
| `maxOutputSide` / `maxOutputBytes` | `number` | limites do resultado |
| `isSaving` | `boolean` | trava os botões enquanto o host grava |
| `onSave` / `onCancel` / `onRevertToOriginal` | | |

## Tema

Sem cor própria. O host define custom properties no escopo dele (hex só como reserva):

`--aie-surface`, `--aie-canvas`, `--aie-text`, `--aie-muted`, `--aie-accent`, `--aie-accent-strong`, `--aie-on-accent`,
`--aie-border`, `--aie-danger`, `--aie-scrim`, `--aie-radius-base`, `--aie-font-body`, `--aie-motion-fast`.

A tela é container-responsiva: duas colunas a partir de 720 px de largura do contêiner; abaixo disso a foto fica fixa no topo
enquanto os controles rolam. `prefers-reduced-motion` é respeitado.

## Decisões

- **Canvas, sem biblioteca.** Cortar/girar/espelhar/brilho/contraste cabem em ~300 linhas; bibliotecas de recorte trazem
  peso, estilo próprio (que briga com o tema do host) e interação de mouse que não cobre teclado e pinça.
- Brilho e contraste valem os mesmos números na prévia (filtro CSS) e na exportação (pixels): `fator = 1 + valor/200`.
- O espelhamento é guardado antes da rotação; a interface espelha sempre o eixo que a pessoa vê.

## Desenvolvimento

```bash
pnpm --filter @adatechnology/image-editor-ui check test build
```
