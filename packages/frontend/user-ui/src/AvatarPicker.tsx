/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Revisar a foto escolhida antes de enviar, com recorte de fundo opcional.
 *
 * Quem escolhe o arquivo é quem chama: numa tabela a escolha nasce na linha, e o painel de revisão
 * precisa aparecer com largura inteira, longe da célula de 36px onde o clique começou.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { BACKGROUND_FILL, useBackgroundRemoval, type BackgroundRemovalConfig } from '@adatechnology/image-cutout'

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type AvatarPickerProps = {
  readonly file: File
  readonly labels?: Partial<UserLabels>
  readonly busy?: boolean
  /** Ausente desliga o recorte — o botão não aparece, em vez de aparecer e falhar. */
  readonly backgroundRemoval?: BackgroundRemovalConfig
  readonly onConfirm: (file: File) => void
  readonly onCancel: () => void
  /** Cabeçalho do painel, normalmente dizendo de quem é a foto. */
  readonly title?: ReactNode
}

/**
 * O recorte **não é aplicado sozinho**, e a foto original nunca é descartada em silêncio.
 *
 * O U²-Net é treinado para achar o objeto saliente, não para retratos — a variante `u2net_portrait`,
 * que seria a certa aqui, tem dataset não-comercial e não pode entrar num painel proprietário. Numa
 * foto de pessoa o resultado é bom com frequência e come uma orelha ou um ombro de vez em quando, e
 * quem descobre isso não pode ser o colega vendo o avatar na lista.
 *
 * Por isso: recorta, mostra lado a lado, e só envia o que a pessoa escolheu.
 */
export function AvatarPicker({
  file,
  labels: overrides,
  busy = false,
  backgroundRemoval,
  onConfirm,
  onCancel,
  title,
}: AvatarPickerProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }

  /*
    A URL do original é criada uma vez por arquivo e revogada na troca e no desmonte. Recriá-la a
    cada render trocaria o `src` do `<img>` a cada clique de botão, e cada troca vazaria um blob.
  */
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setOriginalUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [file])

  const cutout = useBackgroundRemoval({
    file,
    ...(backgroundRemoval ? { config: backgroundRemoval } : {}),
  })

  if (!originalUrl) return null

  const chosen = cutout.result ?? file

  return (
    <div className="space-y-3 rounded border border-gray-200 p-4 dark:border-gray-700">
      {title && <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>}
      <div className="flex flex-wrap items-start gap-4">
        <Preview label={labels.avatarOriginal} selected={!cutout.result} url={originalUrl} />
        {cutout.previewUrl && (
          <Preview label={labels.avatarCutout} selected={Boolean(cutout.result)} url={cutout.previewUrl} />
        )}
      </div>

      {cutout.error && (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {cutout.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Sem `config` o recorte não existe: o botão some, em vez de existir e não fazer nada. */}
        {backgroundRemoval &&
          (cutout.result ? (
            <button className={SECONDARY} onClick={cutout.discard} type="button">
              {labels.avatarKeepOriginal}
            </button>
          ) : (
            <button className={SECONDARY} disabled={cutout.running} onClick={() => void cutout.run()} type="button">
              {cutout.running ? labels.avatarRemovingBackground : labels.avatarRemoveBackground}
            </button>
          ))}

        {cutout.result && (
          <button
            className={SECONDARY}
            disabled={cutout.running}
            onClick={() =>
              void cutout.run(
                cutout.fill === BACKGROUND_FILL.WHITE ? BACKGROUND_FILL.TRANSPARENT : BACKGROUND_FILL.WHITE,
              )
            }
            type="button"
          >
            {cutout.fill === BACKGROUND_FILL.WHITE ? labels.avatarMakeTransparent : labels.avatarWhiteBackground}
          </button>
        )}

        <button
          className="min-h-9 rounded bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || cutout.running}
          onClick={() => onConfirm(chosen)}
          type="button"
        >
          {labels.avatarConfirm}
        </button>

        <button className="text-sm text-gray-600 dark:text-gray-300" onClick={onCancel} type="button">
          {labels.teamCancel}
        </button>
      </div>
    </div>
  )
}

const SECONDARY =
  'min-h-9 rounded border border-gray-300 px-3 text-sm disabled:opacity-60 dark:border-gray-600'

type PreviewProps = {
  readonly url: string
  readonly label: string
  readonly selected: boolean
}

/**
 * O quadriculado atrás da imagem é o que revela transparência.
 *
 * Sem ele, um recorte transparente sobre fundo branco fica idêntico ao recorte com fundo branco — e
 * a escolha entre os dois botões viraria adivinhação.
 */
function Preview({ url, label, selected }: PreviewProps) {
  return (
    <figure className="space-y-1">
      <div
        className={`size-24 overflow-hidden rounded-full ring-2 ${selected ? 'ring-blue-600' : 'ring-transparent'}`}
        style={{
          backgroundImage:
            'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 6px 6px',
        }}
      >
        <img alt="" className="size-full object-cover" src={url} />
      </div>
      <figcaption className="text-center text-xs text-gray-600 dark:text-gray-300">{label}</figcaption>
    </figure>
  )
}
