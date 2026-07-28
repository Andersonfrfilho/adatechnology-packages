# @adatechnology/text-moderation

Offensive language detection for pt-BR conversational products, extensible by the host.

## Contract

- word-boundary matching with unicode support — `Paulo`, `Paula`, `Ana Cunha`, `Marcus`
  and `Rolando` are never flagged, and `desgraça`/`otário` are;
- curated pt-BR core list, not a third-party translated dictionary;
- host extends with `extraTerms` and rescues false positives with `allowedTerms`;
- `isEnabled: false` returns a clean verdict for every input and leaves text untouched;
- channel-agnostic: the boundary takes a string and knows nothing about WhatsApp, web
  chat or e-mail;
- no logging, no environment reads, no I/O.

```ts
import { createTextModerator, parseTermList } from '@adatechnology/text-moderation'

const moderator = createTextModerator({
  isEnabled: environment.MODERATION_ENABLED,
  extraTerms: parseTermList(environment.MODERATION_EXTRA_TERMS),
  allowedTerms: parseTermList(environment.MODERATION_ALLOWED_TERMS),
})

moderator.inspect('seu babaca')
// { isOffensive: true, matchedTerms: ['babaca'] }

moderator.inspect('coloca 2kg de arroz no carrinho')
// { isOffensive: false, matchedTerms: [] }

moderator.censor('seu babaca')
// 'seu @#$%&!'  — display only, never stored in place of the original
```

`parseTermList` exists so products don't reimplement the comma-split; reading
`process.env` stays in each product's validated config module.

## Why not the library's `pt` dictionary

The engine is `@2toad/profanity`, but only the engine. Its `pt` dictionary (322 terms in
v3.3.0) is a machine translation of an English list and is unusable: it contains `no`,
`o quê`, `boa sorte`, `amigos`, `bolo`, `osso` and `sangrento` as profanity, and omits
`cu`. Measured against ordinary e-commerce sentences, 4 of 5 were flagged — including
"coloca no carrinho por favor". It is loaded and immediately dropped with `removeWords`,
and only the curated list applies.

What the library does provide, and why it is still here: `wholeWord` plus
`unicodeWordBoundaries`. A hand-rolled blocklist reaches for `includes`, and substring
matching rejects legitimate customers — `pau` inside `Paulo`, `cu` inside `Cunha` and
`Marcus`, `rola` inside `Rolando`.

## Deliberate omissions

Terms that are legitimate words in commerce are **not** in the core list: `pau` (pau de
canela), `rola` (verb), `pinto` (poultry), `piranha` (fish) and `bunda`. A product that
wants them blocked adds them through `extraTerms`, accepting the false positives in its
own catalogue.

Evasion is not covered — `p0rra`, `porrrra` and `m e r d a` pass. For a name field this
rarely matters, since a letters-only charset rule and a minimum word length already reject
them. For free-form message moderation, an engine with leet/stretched/spaced transformers
(such as `obscenity`) is the answer; the dictionary would still be ours, so the swap does
not change this package's API.
