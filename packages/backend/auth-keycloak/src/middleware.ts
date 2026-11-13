import type { KeycloakConfig, KeycloakUser } from './types'
import { verifyToken } from './verify'

const userStore = new WeakMap<Request, KeycloakUser>()

export function createKeycloakMiddleware(config: KeycloakConfig) {
  return {
    handler: async (req: Request): Promise<Response | null> => {
      const auth = req.headers.get('authorization')
      if (!auth?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const token = auth.slice(7)
      const result = await verifyToken(token, config)
      if (!result.valid || !result.user) {
        return new Response(JSON.stringify({ error: result.error || 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      userStore.set(req, result.user)
      return null
    },
    getUser: (req: Request): KeycloakUser | undefined => userStore.get(req),
  }
}

export function getRequestUser(req: Request): KeycloakUser | undefined {
  return userStore.get(req)
}
