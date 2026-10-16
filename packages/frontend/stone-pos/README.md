# @adatechnology/stone-pos

Integração React Native (somente Android) com as maquininhas Stone pelos **deeplinks** dos apps da Stone:
pagamento (`payment-app://`), cancelamento (`cancel-app://`) e impressão (`printer-app://`).
Não usa as bibliotecas do SDK Stone: o app da Stone no aparelho faz o trabalho e devolve o resultado por um scheme
do app hospedeiro. Não há iOS.

O pacote traz um Turbo Module em Kotlin (`android/`), a API em TypeScript (`getStonePos()`), um mock para
desenvolvimento e os testes de ambos.

## Instalação

```bash
npm install @adatechnology/stone-pos zod
```

Peers: `react` ^19 e `react-native` >=0.80 (Nova Arquitetura). O autolinking do React Native registra o módulo
e roda o codegen (`NativeStonePosSpec`, pacote Java `br.com.adatechnology.stonepos`). O `AndroidManifest.xml` da
biblioteca já declara as `<queries>` dos três apps da Stone, que chegam ao app pelo manifest merge.

## Configuração no app

### 1. `MainApplication.kt`

O pacote é autolinked (não adicione `StonePosPackage` à mão). Só configure o runtime em `Application.onCreate`, antes de
qualquer `Activity`: um retorno da Stone pode reabrir o app com o processo morto e a `MainActivity` já precisa do scheme.

```kotlin
import br.com.adatechnology.stonepos.StonePosConfig
import br.com.adatechnology.stonepos.StonePosRuntime

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    StonePosRuntime.configure(StonePosConfig(returnScheme = "meuapp", buildEnvironment = BuildConfig.BUILD_ENVIRONMENT))
    loadReactNative(this)
  }
}
```

- `returnScheme`: scheme que a Stone usa para devolver o resultado. Tem de ser o mesmo do `intent-filter` abaixo.
- `buildEnvironment`: texto livre exposto ao JS por `getStonePosBuildEnvironment()` (ex.: `production`, `staging`).

### 2. `MainActivity.kt`

Encaminhe toda Uri recebida. `dispatch` devolve `false` quando o scheme não é o configurado.

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  if (savedInstanceState == null) intent?.data?.let { StoneReturnRouter.dispatch(applicationContext, it) }
}

override fun onNewIntent(intent: Intent) {
  super.onNewIntent(intent)
  setIntent(intent)
  intent.data?.let { StoneReturnRouter.dispatch(applicationContext, it) }
}
```

### 3. `AndroidManifest.xml` do app

A activity precisa de `launchMode="singleTask"` e do `intent-filter` do scheme de retorno. **Este filtro fica no app**
(a biblioteca não pode saber o scheme):

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:scheme="meuapp" />
</intent-filter>
```

## Uso

```ts
import { getStonePos, StonePosError } from '@adatechnology/stone-pos';

const pos = await getStonePos();

const payment = await pos.pay({ amountCents: 14300, method: 'CREDIT', installments: { kind: 'MERCHANT', count: 3 } });
if (payment.approved) {
  // payment.atk / payment.itk identificam a transação; guarde o atk para cancelar depois.
}

await pos.cancel({ atk: payment.atk!, amountCents: 14300 });
const status = await pos.print([{ type: 'line', content: 'RECIBO' }]);
```

- `getStonePos()` devolve o módulo real quando os apps da Stone respondem. Sem eles, em `__DEV__` devolve o **mock**
  (`createStonePosMock()`, aprova a partir de R$ 2,00 e recusa valores terminados em 13 centavos); em release lança erro.
  O mock também é exportado, para testes e telas de pré-visualização (`printedCopies()`, `subscribe()`).
- Erros do módulo chegam como `StonePosError` com `code` (`STONE_BUSY`, `STONE_UNAVAILABLE`, `STONE_INVALID_PARAMS`,
  `STONE_PARSE_ERROR`, `STONE_ABANDONED`, `STONE_PRINT_TIMEOUT`).
- Só uma operação por vez (`STONE_BUSY`). Retorno sem operação pendente nunca aprova nada: vira "órfão" e é entregue por
  `consumeOrphanReturns()` para conferência manual. Campos de cartão (`pan`, `cardholder_name`) nunca saem do Kotlin.
- Os tipos `PrintLine`, `PaymentRequest`, `PaymentResult` etc. são exportados pelo pacote.

## Ambientes

`getStonePosBuildEnvironment()` devolve o `buildEnvironment` passado ao `StonePosConfig` (ou `undefined` sem o módulo
nativo). O app decide o que fazer com ele (por exemplo, liberar pré-visualização de impressão fora de produção).

## Desenvolvimento

```bash
pnpm --filter @adatechnology/stone-pos run build   # tsup (esm + cjs + d.ts)
pnpm --filter @adatechnology/stone-pos run check   # tsc --noEmit
pnpm --filter @adatechnology/stone-pos run test    # bun test
```

O bundle inclui o mock; ele só é usado em `__DEV__`.

## Limites conhecidos

- **O Kotlin ainda não foi compilado nem executado** (sem JDK/Gradle no ambiente de extração). O JUnit
  (`android/src/test`) cobre só `StoneDeeplink` e também não rodou. Compilar no app antes de confiar.
- **Hosts de retorno a confirmar na POS:** o roteamento aceita `pay-response`/`payment-response`,
  `cancel-response` e `print-response`/`printer-response`; o host real devolvido pela Stone precisa ser confirmado.
- **Status de impressão a confirmar:** o parâmetro que carrega o status do `printer-app` não é documentado. O módulo
  procura o status em todos os valores, host e path; sem status e sem pista de erro, conta como impresso com o aviso
  `UNKNOWN_PRINT_STATUS`.
- O Gradle da biblioteca assume o `rootProject.ext` do React Native (com valores padrão de reserva) e o plugin
  `com.facebook.react`; não foi validado com um build real.
