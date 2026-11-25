# @adatechnology/products-ui

Telas de produto e catálogo (lista, formulário, importação, workspace), parametrizadas por um
`ProductsApi` injetado. Campos que só existem em algumas verticais são ligados em
`ProductsConfig.fields`.

## Campos opcionais gerais

```tsx
import { PRODUCT_OPTIONAL_FIELD, ProductsProvider } from '@adatechnology/products-ui'

<ProductsProvider
  api={api}
  config={{
    fields: [
      PRODUCT_OPTIONAL_FIELD.PRICE_ON_REQUEST,      // interruptor "Preço sob consulta" -> priceInCents: null
      PRODUCT_OPTIONAL_FIELD.AVAILABILITY_SCHEDULE, // chips de dia da semana + intervalo de horário (+ fuso)
      PRODUCT_OPTIONAL_FIELD.ATTRIBUTES,            // editor chave/valor -> attributes
    ],
    priceOnRequestLabel: 'Sob consulta', // texto na lista quando o preço é null
  }}
>
```

- A lista mostra `priceOnRequestLabel` quando `priceInCents === null`, com ou sem o campo ligado.
- Ao editar, desligar a agenda envia `availabilitySchedule: null`; `attributes` é enviado inteiro
  (o backend substitui o objeto). Valores que não são texto (número, lista) voltam intactos se não
  forem editados.
- `AvailabilityScheduleEditor` e `AttributesEditor` também são exportados para telas próprias.
