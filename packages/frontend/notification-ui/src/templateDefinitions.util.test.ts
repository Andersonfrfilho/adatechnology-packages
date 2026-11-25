import { describe, expect, it } from 'bun:test'
import type { TemplateEditorItem } from '@adatechnology/notification-contracts'

import {
  groupTemplateEditorItems,
  insertVariable,
  isDraftDirty,
  renderDefinitionPreview,
  resolveEditorBody,
  templateEditorItemId,
} from './templateDefinitions.util'

function item(key: string, overrides: Partial<TemplateEditorItem> = {}): TemplateEditorItem {
  return {
    key,
    channel: 'whatsapp',
    locale: 'pt-BR',
    label: key,
    variables: [{ name: 'name', description: 'Nome', example: 'Maria', required: true }],
    defaultBody: 'Olá {{name}}',
    isCustomized: false,
    ...overrides,
  }
}

describe('groupTemplateEditorItems', () => {
  it('agrupa pela categoria da chave mantendo a ordem declarada', () => {
    const groups = groupTemplateEditorItems([item('a.one'), item('b.one'), item('a.two'), item('solo')])
    expect(groups.map((group) => group.category)).toEqual(['a', 'b', 'solo'])
    expect(groups[0]?.items.map((each) => each.key)).toEqual(['a.one', 'a.two'])
  })
})

describe('resolveEditorBody / isDraftDirty', () => {
  it('prefere rascunho, depois versão ativa, depois o padrão', () => {
    const base = item('a')
    expect(resolveEditorBody(base, undefined)).toBe('Olá {{name}}')
    const saved = item('a', { current: { body: 'Oi' } as never })
    expect(resolveEditorBody(saved, undefined)).toBe('Oi')
    expect(resolveEditorBody(saved, 'rascunho')).toBe('rascunho')
    expect(isDraftDirty(saved, 'Oi')).toBe(false)
    expect(isDraftDirty(saved, 'x')).toBe(true)
    expect(isDraftDirty(saved, undefined)).toBe(false)
  })
})

describe('insertVariable', () => {
  it('insere {{nome}} no cursor e devolve a nova posição', () => {
    expect(insertVariable({ body: 'Olá !', variableName: 'name', selectionStart: 4, selectionEnd: 4 })).toEqual({
      text: 'Olá {{name}}!',
      cursor: 12,
    })
  })
})

describe('renderDefinitionPreview', () => {
  it('renderiza com os exemplos declarados', () => {
    expect(renderDefinitionPreview(item('a'), 'Olá {{name}}').body).toBe('Olá Maria')
  })
})

describe('templateEditorItemId', () => {
  it('é a identidade key+canal+locale', () => {
    expect(templateEditorItemId(item('a'))).toBe('a|whatsapp|pt-BR')
  })
})
