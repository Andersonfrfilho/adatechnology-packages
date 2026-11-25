# @adatechnology/user-ui

Account and team screens for `@adatechnology/user-module`, driven by an injected `UserApi`.
Capabilities are optional by absence: a method the host does not provide never draws its control.

- `signUp?` on `UserApi`: enables `SignUpScreen` / `SignUpForm` / `useSignUp`. The role is decided by
  the server configuration, never sent from the form.
- `listTeam?`, `createTeamMember?`, `updateTeamMember?` (name, role, e-mail), `setTeamMemberActive?`
  (activate / deactivate; the server revokes that user's sessions), `unlockTeamMember?` (clears a
  login lockout; a `Locked` badge shows while `UserProfile.lockedUntil` is set), `sendPasswordReset?`,
  `setTeamMemberAvatar?`: enable the matching `TeamWorkspace` controls.

```tsx
<UserProvider api={api}>
  <SignUpScreen onSignedUp={goHome} onSignInInstead={goToSignIn} />
</UserProvider>
```

Map the admin actions to `PATCH /admin/users/:id` with `{ role }`, `{ isActive }` or `{ unlock: true }`.
