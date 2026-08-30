export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type KeycloakAdminConfig = {
  readonly baseUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly realm: string
}

export type KeycloakUserAttributes = Readonly<Record<string, string | readonly string[]>>

export type KeycloakUser = {
  readonly attributes?: KeycloakUserAttributes
  readonly email?: string
  readonly emailVerified?: boolean
  readonly enabled?: boolean
  readonly firstName?: string
  readonly id: string
  readonly lastName?: string
  readonly username?: string
}

export type KeycloakPassword = {
  readonly temporary: boolean
  readonly value: string
}

export type CreateUserParams = {
  readonly attributes?: KeycloakUserAttributes
  readonly email: string
  readonly emailVerified?: boolean
  readonly enabled?: boolean
  readonly firstName?: string
  readonly lastName?: string
  readonly password?: KeycloakPassword
  readonly username: string
}

export type CreateUserResult = {
  readonly id: string
}

export type FindUserByEmailParams = {
  readonly email: string
}

/**
 * O realm não devolve página infinita: `first`/`max` são o recorte que o Keycloak entende, e quem
 * chama precisa saber se ainda há mais — daí `hasMore`, derivado de pedir um a mais que o limite.
 */
export type ListUsersParams = {
  readonly first?: number
  readonly limit?: number
  readonly search?: string
}

export type ListUsersResult = {
  readonly hasMore: boolean
  readonly users: readonly KeycloakUser[]
}

export type UpdateUserParams = {
  readonly user: Readonly<
    Partial<Pick<KeycloakUser, 'email' | 'emailVerified' | 'firstName' | 'lastName' | 'username'>>
  >
  readonly userId: string
}

export type SetEnabledParams = {
  readonly enabled: boolean
  readonly userId: string
}

export type UpdateAttributesParams = {
  readonly attributes: KeycloakUserAttributes
  readonly userId: string
}

export type DeleteUserParams = {
  readonly userId: string
}

export type SetPasswordParams = {
  readonly password: string
  readonly temporary: boolean
  readonly userId: string
}

export type SetTemporaryPasswordParams = {
  readonly password: string
  readonly userId: string
}

/**
 * O grupo do realm. O Keycloak aceita hierarquia (`subGroups`), e este cliente trata só o primeiro
 * nível de propósito: grupo aninhado muda o significado de "pertencer" — quem está no filho herda o
 * pai —, e um produto que não modela hierarquia não deve criá-la por acidente.
 */
export type KeycloakGroup = {
  readonly attributes?: KeycloakUserAttributes
  readonly id: string
  readonly name: string
  readonly path?: string
}

export type CreateGroupParams = {
  readonly attributes?: KeycloakUserAttributes
  readonly name: string
}

export type CreateGroupResult = {
  readonly id: string
}

export type UpdateGroupParams = {
  readonly groupId: string
  readonly group: Readonly<Partial<Pick<KeycloakGroup, 'attributes' | 'name'>>>
}

export type DeleteGroupParams = {
  readonly groupId: string
}

export type ListGroupsParams = {
  readonly first?: number
  readonly limit?: number
  readonly search?: string
}

export type ListGroupsResult = {
  readonly groups: readonly KeycloakGroup[]
  readonly hasMore: boolean
}

export type GroupMembershipParams = {
  readonly groupId: string
  readonly userId: string
}

export type KeycloakAdminClient = {
  addUserToGroup(params: GroupMembershipParams): Promise<void>
  createGroup(params: CreateGroupParams): Promise<CreateGroupResult>
  deleteGroup(params: DeleteGroupParams): Promise<void>
  listGroups(params?: ListGroupsParams): Promise<ListGroupsResult>
  removeUserFromGroup(params: GroupMembershipParams): Promise<void>
  updateGroup(params: UpdateGroupParams): Promise<void>
  createUser(params: CreateUserParams): Promise<CreateUserResult>
  deleteUser(params: DeleteUserParams): Promise<void>
  findUserByEmail(params: FindUserByEmailParams): Promise<KeycloakUser | undefined>
  listUsers(params?: ListUsersParams): Promise<ListUsersResult>
  setEnabled(params: SetEnabledParams): Promise<void>
  setPassword(params: SetPasswordParams): Promise<void>
  setTemporaryPassword(params: SetTemporaryPasswordParams): Promise<void>
  updateAttributes(params: UpdateAttributesParams): Promise<void>
  updateUser(params: UpdateUserParams): Promise<void>
}

export type CreateKeycloakAdminClientParams = {
  readonly config: KeycloakAdminConfig
  readonly fetch?: FetchLike
  readonly now?: () => number
}
