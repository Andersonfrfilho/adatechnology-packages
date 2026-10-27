/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

type InfraPageHeaderProps = {
  readonly title: string
  readonly subtitle: string
}

export function InfraPageHeader({ title, subtitle }: InfraPageHeaderProps) {
  return (
    <header className="mb-4 space-y-0.5">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </header>
  )
}
