/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { WidgetApi } from './widget.api'
import { applyWidgetStyle } from './widget.style'
import { WidgetView } from './widget.view'
import { applyThemeTokens, parseThemeTokens } from './widget.theme'
import { WidgetRequestError } from './widget.error'
import { API_BASE_ATTRIBUTE, AVAILABILITY_WINDOW_DAYS, THEME_ATTRIBUTE, WIDGET_STEP } from './widget.constant'
import localeStrings from './widget.locale.json'
import type { WidgetResource, WidgetService, WidgetSlot, WidgetState, WidgetStep } from './types/widget.types'
import type { WidgetViewHandlers } from './widget.view'

function initialState(): WidgetState {
  return {
    step: WIDGET_STEP.SERVICE,
    isBusy: false,
    isOpen: false,
    errorMessage: '',
    services: [],
    resources: [],
    slots: [],
    selectedService: undefined,
    selectedResource: undefined,
    selectedSlot: undefined,
    confirmedBookingId: '',
  }
}

/**
 * Web Component sem framework, no molde do `web-chat-widget`: o produto hospedeiro fornece a
 * origem via `api-base`, e o widget nunca fala com `scheduling-module` diretamente (spec Q2) —
 * só com as rotas `/v1/booking-widget/*` que o produto decide expor, autenticar e limitar.
 */
export class AdaBookingWidget extends HTMLElement {
  #api: WidgetApi | undefined
  #view: WidgetView | undefined
  #state: WidgetState = initialState()

  connectedCallback(): void {
    const apiBase = this.getAttribute(API_BASE_ATTRIBUTE)
    if (!apiBase) {
      throw new Error(`ada-booking-widget requires the "${API_BASE_ATTRIBUTE}" attribute`)
    }

    this.#api = new WidgetApi({ baseUrl: apiBase })

    const root = this.attachShadow({ mode: 'open' })
    applyWidgetStyle(root)
    applyThemeTokens(this, parseThemeTokens(this.getAttribute(THEME_ATTRIBUTE)))

    const handlers: WidgetViewHandlers = {
      onToggle: () => this.#toggle(),
      onBack: () => this.#back(),
      onSelectService: (service) => this.#selectService(service),
      onSelectResource: (resource) => this.#selectResource(resource),
      onSelectSlot: (slot) => this.#selectSlot(slot),
      onSubmitDetails: (params) => void this.#submitDetails(params),
      onClose: () => this.#close(),
    }

    this.#view = new WidgetView(root, localeStrings, handlers)
    this.#render()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === THEME_ATTRIBUTE) {
      applyThemeTokens(this, parseThemeTokens(newValue))
    }
  }

  static get observedAttributes(): readonly string[] {
    return [THEME_ATTRIBUTE]
  }

  #render(): void {
    this.#view?.render(this.#state)
  }

  #setState(patch: Partial<WidgetState>): void {
    this.#state = { ...this.#state, ...patch }
    this.#render()
  }

  #toggle(): void {
    if (this.#state.isOpen) {
      this.#close()
      return
    }

    this.#setState({ isOpen: true })
    void this.#loadServices()
  }

  #close(): void {
    this.#state = initialState()
    this.#render()
  }

  #back(): void {
    const previousStep = this.#previousStep()
    if (!previousStep) return

    this.#setState({ step: previousStep, errorMessage: '' })

    if (previousStep === WIDGET_STEP.SERVICE) void this.#loadServices()
    if (previousStep === WIDGET_STEP.RESOURCE && this.#state.selectedService)
      void this.#loadResources(this.#state.selectedService)
  }

  #previousStep(): WidgetStep | undefined {
    switch (this.#state.step) {
      case WIDGET_STEP.RESOURCE:
        return WIDGET_STEP.SERVICE
      case WIDGET_STEP.SLOT:
        return WIDGET_STEP.RESOURCE
      case WIDGET_STEP.DETAILS:
        return WIDGET_STEP.SLOT
      default:
        return undefined
    }
  }

  async #loadServices(): Promise<void> {
    if (!this.#api) return

    this.#setState({ isBusy: true, errorMessage: '' })
    try {
      const services = await this.#api.listServices()
      this.#setState({ isBusy: false, services, step: WIDGET_STEP.SERVICE })
    } catch (error) {
      this.#setState({ isBusy: false, errorMessage: this.#toErrorMessage(error) })
    }
  }

  #selectService(service: WidgetService): void {
    this.#setState({ selectedService: service, step: WIDGET_STEP.RESOURCE })
    void this.#loadResources(service)
  }

  async #loadResources(service: WidgetService): Promise<void> {
    if (!this.#api) return

    this.#setState({ isBusy: true, errorMessage: '' })
    try {
      const resources = await this.#api.listResources({ serviceId: service.id })
      this.#setState({ isBusy: false, resources })
    } catch (error) {
      this.#setState({ isBusy: false, errorMessage: this.#toErrorMessage(error) })
    }
  }

  #selectResource(resource: WidgetResource): void {
    this.#setState({ selectedResource: resource, step: WIDGET_STEP.SLOT })
    void this.#loadAvailability(resource)
  }

  async #loadAvailability(resource: WidgetResource): Promise<void> {
    if (!this.#api || !this.#state.selectedService) return

    this.#setState({ isBusy: true, errorMessage: '' })
    try {
      const from = new Date()
      const to = new Date(from.getTime() + AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const slots = await this.#api.listAvailability({
        serviceId: this.#state.selectedService.id,
        resourceId: resource.id,
        from: from.toISOString(),
        to: to.toISOString(),
      })
      this.#setState({ isBusy: false, slots })
    } catch (error) {
      this.#setState({ isBusy: false, errorMessage: this.#toErrorMessage(error) })
    }
  }

  #selectSlot(slot: WidgetSlot): void {
    this.#setState({ selectedSlot: slot, step: WIDGET_STEP.DETAILS })
  }

  async #submitDetails(params: { readonly name: string; readonly contact: string }): Promise<void> {
    const { selectedService, selectedResource, selectedSlot } = this.#state
    if (!this.#api || !selectedService || !selectedResource || !selectedSlot) return

    this.#setState({ isBusy: true, errorMessage: '' })
    try {
      const result = await this.#api.requestBooking({
        serviceId: selectedService.id,
        resourceId: selectedResource.id,
        slot: selectedSlot,
        customerName: params.name,
        customerContact: params.contact,
      })
      this.#setState({ isBusy: false, step: WIDGET_STEP.CONFIRMED, confirmedBookingId: result.bookingId })
    } catch (error) {
      this.#setState({ isBusy: false, errorMessage: this.#toErrorMessage(error) })
    }
  }

  #toErrorMessage(error: unknown): string {
    const base =
      this.#state.step === WIDGET_STEP.DETAILS ? localeStrings.status.submitFailed : localeStrings.status.loadFailed
    const code = error instanceof WidgetRequestError ? error.code : ''
    return code ? `${base} (${code})` : base
  }
}
