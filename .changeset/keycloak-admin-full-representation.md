---
'@adatechnology/keycloak-admin': patch
---

`updateAttributes` e `setProfilePicture` leem a conta e regravam a representação completa. No Keycloak 26 com perfil de usuário declarativo, `PUT { attributes }` respondia 400 "User name is missing", e `PUT { username, attributes }` apagava e-mail e nome.
