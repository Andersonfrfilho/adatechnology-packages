/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { applyIcon } from './widget.icon'
import { formatSlotDate, formatSlotTime, toShortTimezoneLabel } from './widget.timezone'
import { WIDGET_STEP } from './widget.constant'
import type { WidgetResource, WidgetService, WidgetSlot, WidgetState } from './types/widget.types'

type LocaleStrings = Readonly<Record<string, unknown>>

export type WidgetViewHandlers = {
  readonly onToggle: () => void
  readonly onBack: () => void
  readonly onSelectService: (service: WidgetService) => void
  readonly onSelectResource: (resource: WidgetResource) => void
  readonly onSelectSlot: (slot: WidgetSlot) => void
  readonly onSubmitDetails: (params: { readonly name: string; readonly contact: string }) => void
  readonly onClose: () => void
}

function readLocale(locale: LocaleStrings, path: string): string {
  const value = path.split('.').reduce<unknown>((node, key) => {
    return typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined
  }, locale)

  return typeof value === 'string' ? value : path
}

function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** Constrói o DOM do shadow root uma vez; `render` só troca conteúdo, nunca reanexa os nós base. */
export class WidgetView {
  readonly #root: ShadowRoot
  readonly #locale: LocaleStrings
  readonly #handlers: WidgetViewHandlers

  #launcher!: HTMLButtonElement
  #panel!: HTMLElement
  #backButton!: HTMLButtonElement
  #headerTitle!: HTMLElement
  #body!: HTMLElement

  constructor(root: ShadowRoot, locale: LocaleStrings, handlers: WidgetViewHandlers) {
    this.#root = root
    this.#locale = locale
    this.#handlers = handlers
    this.#buildShell()
  }

  #buildShell(): void {
    const launcher = document.createElement('button')
    launcher.className = 'launcher'
    launcher.type = 'button'
    const launcherIcon = document.createElement('span')
    applyIcon(launcherIcon, 'calendar')
    launcher.append(launcherIcon, document.createElement('span'))
    launcher.addEventListener('click', () => this.#handlers.onToggle())

    const panel = document.createElement('section')
    panel.className = 'panel'
    panel.hidden = true

    const header = document.createElement('header')
    header.className = 'header'

    const backButton = document.createElement('button')
    backButton.type = 'button'
    backButton.className = 'icon-button'
    applyIcon(backButton, 'chevronLeft')
    backButton.setAttribute('aria-label', readLocale(this.#locale, 'nav.back'))
    backButton.addEventListener('click', () => this.#handlers.onBack())

    const headerTitle = document.createElement('h2')
    headerTitle.className = 'header-title'

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'icon-button close'
    closeButton.textContent = '×'
    closeButton.setAttribute('aria-label', readLocale(this.#locale, 'launcher.close'))
    closeButton.addEventListener('click', () => this.#handlers.onClose())

    header.append(backButton, headerTitle, closeButton)

    const body = document.createElement('div')
    body.className = 'body'

    panel.append(header, body)
    this.#root.append(launcher, panel)

    this.#launcher = launcher
    this.#panel = panel
    this.#backButton = backButton
    this.#headerTitle = headerTitle
    this.#body = body
  }

  render(state: WidgetState): void {
    this.#launcher.hidden = state.isOpen
    this.#panel.hidden = !state.isOpen
    this.#backButton.hidden = state.step === WIDGET_STEP.SERVICE || state.step === WIDGET_STEP.CONFIRMED
    this.#headerTitle.textContent = readLocale(this.#locale, `step.${state.step}`)

    this.#body.replaceChildren()

    if (state.isBusy) {
      this.#body.append(this.#renderStatus(readLocale(this.#locale, 'status.loading'), false))
      return
    }

    if (state.errorMessage) {
      this.#body.append(this.#renderStatus(state.errorMessage, true))
      return
    }

    switch (state.step) {
      case WIDGET_STEP.SERVICE:
        this.#body.append(this.#renderServiceList(state.services))
        return
      case WIDGET_STEP.RESOURCE:
        this.#body.append(this.#renderResourceList(state.resources))
        return
      case WIDGET_STEP.SLOT:
        this.#body.append(this.#renderSlotList(state))
        return
      case WIDGET_STEP.DETAILS:
        this.#body.append(this.#renderDetails(state))
        return
      case WIDGET_STEP.CONFIRMED:
        this.#body.append(this.#renderConfirmed())
        return
    }
  }

  #renderStatus(message: string, isError: boolean): HTMLElement {
    const status = document.createElement('p')
    status.className = isError ? 'status status-error' : 'status'
    status.textContent = message
    return status
  }

  #renderServiceList(services: readonly WidgetService[]): HTMLElement {
    if (services.length === 0) return this.#renderEmpty(readLocale(this.#locale, 'service.empty'))

    const list = document.createElement('div')
    list.className = 'list'

    for (const service of services) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'item'

      const title = document.createElement('span')
      title.className = 'item-title'
      title.textContent = service.name
      item.append(title)

      if (service.description) {
        const subtitle = document.createElement('span')
        subtitle.className = 'item-subtitle'
        subtitle.textContent = service.description
        item.append(subtitle)
      }

      item.addEventListener('click', () => this.#handlers.onSelectService(service))
      list.append(item)
    }

    return list
  }

  #renderResourceList(resources: readonly WidgetResource[]): HTMLElement {
    if (resources.length === 0) return this.#renderEmpty(readLocale(this.#locale, 'resource.empty'))

    const list = document.createElement('div')
    list.className = 'list'

    for (const resource of resources) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'item'

      const title = document.createElement('span')
      title.className = 'item-title'
      title.textContent = resource.name
      item.append(title)

      item.addEventListener('click', () => this.#handlers.onSelectResource(resource))
      list.append(item)
    }

    return list
  }

  #renderSlotList(state: WidgetState): DocumentFragment {
    const fragment = document.createDocumentFragment()
    const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    const note = document.createElement('p')
    note.className = 'timezone-note'
    note.textContent = interpolate(readLocale(this.#locale, 'slot.visitorTimezoneNote'), {
      timezone: toShortTimezoneLabel(visitorTimezone),
    })
    fragment.append(note)

    if (state.slots.length === 0) {
      fragment.append(this.#renderEmpty(readLocale(this.#locale, 'slot.empty')))
      return fragment
    }

    const list = document.createElement('div')
    list.className = 'list'

    for (const slot of state.slots) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'item'

      const title = document.createElement('span')
      title.className = 'item-title'
      title.textContent = `${formatSlotDate(slot.startsAt, visitorTimezone)} · ${formatSlotTime(slot.startsAt, visitorTimezone)}`
      item.append(title)

      const resourceTimezone = state.selectedResource?.timezone
      if (resourceTimezone && resourceTimezone !== visitorTimezone) {
        const subtitle = document.createElement('span')
        subtitle.className = 'item-subtitle'
        subtitle.textContent = interpolate(readLocale(this.#locale, 'slot.resourceTimezoneNote'), {
          timezone: toShortTimezoneLabel(resourceTimezone),
          time: formatSlotTime(slot.startsAt, resourceTimezone),
        })
        item.append(subtitle)
      }

      item.addEventListener('click', () => this.#handlers.onSelectSlot(slot))
      list.append(item)
    }

    fragment.append(list)
    return fragment
  }

  #renderDetails(state: WidgetState): DocumentFragment {
    const fragment = document.createDocumentFragment()

    if (state.selectedService && state.selectedResource && state.selectedSlot) {
      const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const summary = document.createElement('p')
      summary.className = 'summary'
      summary.textContent = interpolate(readLocale(this.#locale, 'details.summary'), {
        service: state.selectedService.name,
        resource: state.selectedResource.name,
        date: formatSlotDate(state.selectedSlot.startsAt, visitorTimezone),
        time: formatSlotTime(state.selectedSlot.startsAt, visitorTimezone),
      })
      fragment.append(summary)
    }

    const form = document.createElement('form')
    form.className = 'field'

    const nameInput = document.createElement('input')
    nameInput.className = 'input'
    nameInput.type = 'text'
    nameInput.required = true
    nameInput.placeholder = readLocale(this.#locale, 'details.namePlaceholder')

    const contactInput = document.createElement('input')
    contactInput.className = 'input'
    contactInput.type = 'text'
    contactInput.required = true
    contactInput.placeholder = readLocale(this.#locale, 'details.contactPlaceholder')

    const submitButton = document.createElement('button')
    submitButton.type = 'submit'
    submitButton.className = 'primary-button'
    submitButton.textContent = readLocale(this.#locale, 'details.confirm')

    form.append(nameInput, contactInput, submitButton)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.#handlers.onSubmitDetails({ name: nameInput.value.trim(), contact: contactInput.value.trim() })
    })

    fragment.append(form)
    return fragment
  }

  #renderConfirmed(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'confirmed'

    const icon = document.createElement('span')
    applyIcon(icon, 'check')

    const message = document.createElement('p')
    message.textContent = readLocale(this.#locale, 'confirmed.message')

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'primary-button'
    closeButton.textContent = readLocale(this.#locale, 'confirmed.close')
    closeButton.addEventListener('click', () => this.#handlers.onClose())

    container.append(icon, message, closeButton)
    return container
  }

  #renderEmpty(message: string): HTMLElement {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = message
    return empty
  }
}
