---
"@adatechnology/conversations-ui": minor
---

Emoji sai da interface do pacote e entra `lucide-react`, com os tamanhos centralizados em
`icon.constant.ts`.

Emoji renderiza diferente em cada sistema operacional, não herda `currentColor` — então não acompanha
hover, `disabled` nem variante destrutiva — e não escala com o token de tipografia. Era o que fazia a
mesma barra parecer outra no Windows e no macOS.

`ConversationHeaderUtility.icon` passa de `string` para `ReactNode`, para o host mandar
`<Play size={16} />`. Uma string continua sendo `ReactNode` válido, então quem ainda passa emoji
compila igual — mas o pacote não desenha mais nenhum.
