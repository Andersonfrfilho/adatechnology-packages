---
'@adatechnology/keycloak-admin': minor
---

Expose realm group operations on the Keycloak admin client

O cliente sabia administrar usuário e não sabia nada de grupo. Todo produto que espelha os próprios
grupos no realm — o caminho normal quando o Keycloak é o provedor — ficava com os dois lados
divergindo no primeiro cadastro, e a sincronização virava trabalho manual no console.

Entram `createGroup`, `updateGroup`, `deleteGroup`, `listGroups`, `addUserToGroup` e
`removeUserFromGroup`. A listagem usa o mesmo recorte de `listUsers`: pede um registro a mais que o
limite para saber se há próxima página, sem uma segunda ida à rede.

⚠️ Só o primeiro nível de grupos. O Keycloak aceita hierarquia, e nela quem está no filho herda o
pai — um produto que não modela isso não deve criar hierarquia por acidente.

A filiação é endereçada pelo **usuário** (`PUT`/`DELETE` em `/users/{userId}/groups/{groupId}`), não
pelo grupo: trocar a ordem dos ids monta uma URL que o Keycloak aceita, liga outra pessoa a outro
grupo, responde 204 e não aparece em lugar nenhum. Há teste para as duas direções.
