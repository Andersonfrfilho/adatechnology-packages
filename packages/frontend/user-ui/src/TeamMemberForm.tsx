/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O formulário de nova pessoa. Separado do workspace pelo mesmo motivo dos outros forms do pacote:
 * quem quiser a listagem sem o cadastro compõe só o que precisa.
 */

import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { CreateTeamMemberInput } from './providers/types'
import type { UserLabels } from './workspace/labels'

/** O mesmo mínimo do `localCredentialsSchema`: recusar aqui poupa uma ida para descobrir o óbvio. */
export const TEAM_PASSWORD_MIN_LENGTH = 12

export type TeamMemberFormProps = {
  readonly labels: UserLabels
  readonly saving: boolean
  readonly onSubmit: (input: CreateTeamMemberInput) => void
  readonly onCancel: () => void
}

/** Altura fixa, e nao `py-2`: e o que faz o select terminar na mesma linha que os inputs ao lado. */
const FIELD =
  'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none' +
  ' focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20' +
  ' dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

/**
 * `appearance-none` apaga a seta do sistema — que e o que fazia o campo destoar: cada SO desenha a
 * sua, em tamanho e cor proprios, e nenhuma acompanha o tema escuro. A nossa vem abaixo, em SVG,
 * herdando `currentColor`.
 *
 * `pr-9` reserva a faixa da seta para o texto nao passar por baixo dela.
 */
const SELECT_FIELD = `${FIELD} cursor-pointer appearance-none pr-9`
const LABEL = 'mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100'

export function TeamMemberForm({ labels, saving, onSubmit, onCancel }: TeamMemberFormProps) {
  const [role, setRole] = useState('member')

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    onSubmit({
      email: String(form.get('email') ?? ''),
      name: String(form.get('name') ?? ''),
      password: String(form.get('password') ?? ''),
      role,
    })
  }

  return (
    <form className="grid gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2 dark:border-gray-700" onSubmit={handleSubmit}>
      <div>
        <label className={LABEL} htmlFor="team-name">
          {labels.name}
        </label>
        <input className={FIELD} id="team-name" name="name" required type="text" />
      </div>

      <div>
        <label className={LABEL} htmlFor="team-email">
          {labels.email}
        </label>
        <input autoComplete="off" className={FIELD} id="team-email" name="email" required type="email" />
      </div>

      <div>
        <label className={LABEL} htmlFor="team-password">
          {labels.teamInitialPassword}
        </label>
        {/*
          `new-password` e não `off`: com `off`, o gerenciador oferece a senha de QUEM ESTÁ logado —
          e ela viraria a senha da pessoa nova, sem ninguém perceber.
        */}
        <input
          autoComplete="new-password"
          className={FIELD}
          id="team-password"
          minLength={TEAM_PASSWORD_MIN_LENGTH}
          name="password"
          required
          type="password"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{labels.teamInitialPasswordHint}</p>
      </div>

      <div>
        <label className={LABEL} htmlFor="team-role">
          {labels.teamRole}
        </label>
        <div className="relative">
          <select
            className={SELECT_FIELD}
            id="team-role"
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            <option value="member">{labels.teamRoleMember}</option>
            <option value="admin">{labels.teamRoleAdmin}</option>
          </select>
          {/* Decorativa: o `select` ao lado ja anuncia o papel de combobox ao leitor de tela. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          <UserPlus aria-hidden="true" className="size-4" />
          {saving ? labels.teamCreating : labels.teamCreateSubmit}
        </button>
        <button className="text-sm text-gray-600 dark:text-gray-300" onClick={onCancel} type="button">
          {labels.teamCancel}
        </button>
      </div>
    </form>
  )
}
