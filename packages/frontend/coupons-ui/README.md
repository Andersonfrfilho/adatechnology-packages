# @adatechnology/coupons-ui

Telas de cupons e promoções sobre o [`coupon-module`](../../backend/coupon-module): o painel inteiro
(`CampaignsWorkspace`) e as peças do site (`CouponField`, `LeadCaptureDialog`, `CampaignBanner`). O pacote não faz
`fetch`: o host injeta a API.

## Instalação

```bash
bun add @adatechnology/coupons-ui @adatechnology/coupon-contracts
```

```ts
import '@adatechnology/coupons-ui/styles.css'
```

## Painel

```tsx
<CouponsProvider adminApi={couponsAdminApi} renderSelect={DsSelect} renderDateTimeInput={DsDateTime}>
  <CampaignsWorkspace />
</CouponsProvider>
```

- Lista: busca (debounce 250 ms, no servidor) à esquerda, filtro de situação com seleção múltipla, total
  ("128 resultados"), exportar (página atual ou todos os resultados, CSV e XLSX) e "Nova campanha" à direita; colunas
  ordenáveis (asc/desc/neutro), seleção com ativar/desativar em lote, paginação no servidor, estado na URL
  (`campaigns.*`, sem apagar os parâmetros do host).
- Campanha: abas **Configuração** (editor), **Códigos** (gerar lote, desativar código vazado), **Contatos**, **Usos**,
  **Relatório**. Aba sem método na API não aparece (`listCoupons`, `listLeads`, `listRedemptions`, `getReport`).
- Editor valida com os mesmos schemas do servidor; a recusa lista todos os campos ("Confira: Nome, Código.") e cada
  nome rola até o campo e põe o foco. Moeda e inteiros com máscara durante a digitação.
- `exportRecords` ausente: só "página atual" (gerada no navegador com o mesmo gerador do servidor).

### Só leitura (recepção)

`<CampaignsWorkspace readOnly />` lista e abre campanhas direto nos contatos, sem criar, editar, excluir nem lote.
Combine com `config.leadReadScopes` no módulo e uma API injetada sem os métodos de escrita nem `exportRecords`.

### Contatos por período

A aba Contatos filtra por período (dias inteiros no fuso `timeZone`, último dia incluso) e exporta com o mesmo filtro.
O campo padrão são dois campos com máscara; `renderDateRangeInput` troca pelo intervalo do design system do host
(recebe e devolve `{ from, to }` em `YYYY-MM-DD`).

## Site

```tsx
<CouponsProvider publicApi={{ listOpenCampaigns, previewCoupon, captureLead }}>
  <CampaignBanner privacyNote={<a href="/privacidade">Política de privacidade</a>} />
  <CouponField id="coupon" value={code} onChange={setCode} items={cartItems} onResolved={setValidation} />
</CouponsProvider>
```

- `CampaignBanner` mostra a primeira campanha no ar (ou a que receber) e abre o `LeadCaptureDialog` quando a campanha
  capta contato e `captureLead` existe.
- `CouponField` aplica o código, mostra o desconto e **todos** os motivos de recusa. A prévia é conforto: o backend do
  host resgata e confere de novo.
- Camada headless: `useCouponPreview`, `useLeadCapture`, `useCampaignList`, `useCampaignEditor`, `useRecordList`.

## Controles

Sem controle nativo do navegador: seleção de até três opções vira grupo de botões; acima disso, lista suspensa
acessível (`listbox` com teclado), inclusive "itens por página"; data e hora em dois campos com máscara
(`DD/MM/AAAA` e `HH:MM`) com o fuso escrito embaixo; confirmação de exclusão em diálogo do pacote. Os slots
`renderSelect` e `renderDateTimeInput` continuam opcionais para o host usar os do design system dele.

Passe o fuso da empresa em `timeZone` (`<CouponsProvider timeZone="America/Sao_Paulo">`): as datas da campanha são
digitadas e mostradas nele, mesmo que quem edita esteja em outro fuso.

## Tema

Sem cor própria: custom properties com fallback neutro. Sobrescreva no escopo do host:

```css
.acp-root {
  --acp-accent: var(--brand-primary);
  --acp-surface: var(--surface);
  --acp-text: var(--text);
  --acp-radius-base: 12px;
  --acp-font-body: 'Inter', sans-serif;
}
```

## Textos

pt-BR por padrão, `en` incluso. Troque pontos com `messages` (slot de rótulos), sem fornecer o locale inteiro:

```tsx
<CouponsProvider messages={{ workspaceTitle: 'Promoções', newCampaign: 'Nova promoção' }} …>
```
