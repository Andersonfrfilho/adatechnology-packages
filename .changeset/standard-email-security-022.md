---
'@adatechnology/notification-contracts': patch
'@adatechnology/notification-module': patch
---

fix(notification-contracts): `placeholder_in_tag` também pega `{{` logo depois do `<` (`<{{x}}>`, `< {{x}}>`, `<?{{x}}>`, `<%{{x}}>`), que deixava o valor virar tag. fix(notification-module): `ensureTemplate` reconhece o 23505 do driver do Bun (SQLSTATE em `errno`), também em `cause`.
