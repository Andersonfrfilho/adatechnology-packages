# @adatechnology/user-ui

Account and team screens for `@adatechnology/user-module`, driven by an injected `UserApi`.
Capabilities are optional by absence: a method the host does not provide never draws its control.

- `signUp?` on `UserApi`: enables `SignUpScreen` / `SignUpForm` / `useSignUp`. The role is decided by
  the server configuration, never sent from the form.
- `listTeam?`, `createTeamMember?`, `updateTeamMember?` (name, role, e-mail), `setTeamMemberActive?`
  (activate / deactivate; the server revokes that user's sessions), `unlockTeamMember?` (clears a
  login lockout; a `Locked` badge shows while `UserProfile.lockedUntil` is set), `sendPasswordReset?`,
  `setTeamMemberAvatar?`, `setTeamMemberPassword?` (the admin types a new password for someone; the server
  revokes that person's sessions): enable the matching `TeamWorkspace` controls. `TeamMemberPasswordForm`
  is exported for custom layouts.

- `SignInScreen` / `SignInForm` `showRememberMe`: draws a "Lembrar de mim" checkbox (label key
  `signInRememberMe`) and sends `rememberMe` in `SignInParams`; your `UserApi.signIn` must forward it
  to `POST /auth/login`. Absent, the form is unchanged.

```tsx
<UserProvider api={api}>
  <SignUpScreen onSignedUp={goHome} onSignInInstead={goToSignIn} />
</UserProvider>
```

Map the admin actions to `PATCH /admin/users/:id` with `{ role }`, `{ isActive }` or `{ unlock: true }`.
