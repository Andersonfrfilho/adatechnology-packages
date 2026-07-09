import {
  createLogger,
  runWithContext,
  createContext,
  pushToTraceStack,
  popFromTraceStack,
  traceMethod,
} from '@adatechnology/logger';
import { Cache } from '@adatechnology/cache';
import { HttpClient, HttpError } from '@adatechnology/http-client';
import {
  verifyToken,
  createKeycloakMiddleware,
} from '@adatechnology/auth-keycloak';

const logger = createLogger({
  projectName: 'bun-app',
  version: '0.0.1',
  pretty: true,
});
const cache = new Cache<string>({ ttlMs: 30_000 });

function getUser(id: string): string {
  const cached = cache.get(id);
  if (cached) {
    logger.info(`Cache hit for user ${id}`);
    return cached;
  }
  const user = `User-${id}-${Date.now()}`;
  cache.set(id, user);
  logger.info(`Cache miss — created user ${id}`);
  return user;
}

const tracedGetUser = traceMethod('UserService.getUser', getUser);

async function main() {
  const ctx = createContext({ requestId: 'req-integrated-001' });

  await runWithContext(ctx, async () => {
    logger.info('Starting integrated demo');

    logger.info('--- Cache ---');
    pushToTraceStack('cache.demos');
    console.log('  getUser(a):', tracedGetUser('a'));
    console.log('  getUser(a) cached:', tracedGetUser('a'));
    console.log('  Cache size:', cache.size());
    popFromTraceStack();

    logger.info('--- HTTP Client ---');
    pushToTraceStack('http.demos');
    const client = new HttpClient({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeoutMs: 5000,
    });
    try {
      const res = await client.get('/posts/1');
      logger.info('GET /posts/1', {
        status: res.status,
        title: (res.data as { title: string }).title.slice(0, 30),
      });
    } catch (err) {
      logger.error('HTTP request failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    popFromTraceStack();

    logger.info('--- Auth ---');
    pushToTraceStack('auth.demos');
    const result = await verifyToken('invalid.token.here', {
      realm: 'demo',
      authServerUrl: 'http://localhost:8080/auth',
      clientId: 'demo-app',
    });
    logger.info('Token verification attempt', {
      valid: result.valid,
      error: result.error?.slice(0, 40),
    });
    popFromTraceStack();

    logger.info('--- Middleware ---');
    const middleware = createKeycloakMiddleware({
      realm: 'demo',
      authServerUrl: 'http://localhost:8080/auth',
      clientId: 'demo-app',
    });
    const req = new Request('http://localhost/api/protected', {
      headers: { authorization: 'Bearer bad.token' },
    });
    const mwRes = await middleware.handler(req);
    logger.info('Middleware result', {
      blocked: mwRes !== null,
      status: mwRes?.status,
    });

    logger.info('Integrated demo complete');
  });
}

main().catch(console.error);
