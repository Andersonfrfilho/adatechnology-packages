---
'@adatechnology/content-ui': minor
'@adatechnology/products-ui': minor
'@adatechnology/conversations-ui': minor
---

content-ui: formatting toolbar for the post body (bold, italic, headings, lists, quote, link, image, emoji; Ctrl/Cmd+B/I/K) that still stores Markdown, inline image upload through the same `uploadCoverImage` API, a styled file picker with pt-BR labels, `showFormattingToolbar` and `renderDateTimeInput` props. products-ui: `renderTimeInput` on `ProductForm`/`AvailabilityScheduleEditor`. conversations-ui: `renderDateInput` on `DocumentsWorkspace`. All opt-in; defaults keep the native inputs.
