# @adatechnology/secret-envelope

Versioned authenticated secret envelopes for Bun applications.

## Contract

- AES-256-GCM through Web Crypto;
- 32-byte keys and a 12-byte random nonce;
- mandatory additional authenticated data;
- authenticated framing uses the domain `adatechnology:secret-envelope` followed
  by length-prefixed version, algorithm, key ID, and caller AAD fields;
- canonical base64url envelope with an explicit version, algorithm, and key ID;
- ciphertext stores the Web Crypto result as `ciphertext || 16-byte tag`;
- plaintext is limited to 1 MiB and malformed/oversized envelopes fail closed;
- provider creation snapshots caller-owned key bytes;
- key rotation without fallback to unrelated keys;
- typed errors that never include keys, plaintext, AAD, or envelopes;
- no runtime dependencies or internal logging.

```ts
import { createSecretEnvelopeProvider } from '@adatechnology/secret-envelope'

const provider = createSecretEnvelopeProvider({
  activeKeyId: 'local-v1',
  keys: {
    'local-v1': crypto.getRandomValues(new Uint8Array(32)),
  },
})

const envelope = await provider.encrypt({
  plaintext: new TextEncoder().encode('secret'),
  additionalAuthenticatedData: new TextEncoder().encode('resource:v1'),
})
```

The caller owns key loading, AAD construction, storage, and secret lifecycle.
