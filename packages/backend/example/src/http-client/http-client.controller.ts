import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Head,
  Options,
  Body,
  Param,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Inject } from '@nestjs/common';
import {
  LOGGER_PROVIDER,
  LoggerProviderInterface,
} from '@adatechnology/logger';
import { HttpMethod, UseHttpRequestId } from '@adatechnology/http-client';
import type { HttpProviderInterface } from '@adatechnology/http-client';
import { HTTP_REDIS, HTTP_LOCAL } from '../constants';

let lastRequestInterceptorId: number | null = null;
let lastResponseInterceptorId: number | null = null;
let lastErrorInterceptorId: number | null = null;

@Controller('http-client')
@UseHttpRequestId()
export class HttpClientController {
  constructor(
    @Inject(HTTP_REDIS) private readonly httpRedis: HttpProviderInterface,
    @Inject(HTTP_LOCAL) private readonly httpLocal: HttpProviderInterface,
    @Inject(LOGGER_PROVIDER) private readonly logger?: LoggerProviderInterface,
  ) {}

  @Get('multi-cache-demo')
  async multiCacheDemo() {
    // Chamada 1: Usando Redis (ex.: PokeAPI)
    const redisRes = await this.httpRedis.get({ url: '/pokemon/1' });

    // Chamada 2: Usando Local (ex.: JSONPlaceholder)
    const localRes = await this.httpLocal.get({ url: '/users/1' });

    return {
      redisSource: 'PokeAPI via Redis Cache',
      redisData: redisRes.data,
      localSource: 'JSONPlaceholder via Local Cache',
      localData: localRes.data,
    };
  }

  @Get('pokemon')
  async listPokemon() {
    const url = '/pokemon?limit=20';
    const logContext = {
      className: HttpClientController.name,
      methodName: this.listPokemon.name,
    };

    // log start
    const startTime = Date.now();
    this.logger?.info({
      message: 'HTTP CALL START',
      meta: { method: 'GET', url, logContext },
      context: 'HttpClientController',
    });

    const res = await this.httpRedis.get({
      url,
      config: {
        logContext,
      },
    });

    // log end
    const durationMs = Date.now() - startTime;
    this.logger?.info({
      message: 'HTTP CALL END',
      meta: {
        method: 'GET',
        url,
        status: res?.status,
        durationMs,
        logContext,
      },
      context: 'HttpClientController',
    });

    return res.data;
  }

  @Get('pokemon/:id')
  async getOne(@Param('id') id: string) {
    const res = await this.httpRedis.get({
      url: `/pokemon/${id}`,
      config: {
        logContext: {
          className: HttpClientController.name,
          methodName: this.getOne.name,
        },
      },
    });
    return res.data;
  }

  @Get('pokemon/:id/with-request-id')
  async getOneWithRequestId(@Param('id') id: string) {
    try {
      const res = await this.httpRedis.get({
        url: `/pokemon/${id}`,
        config: {
          logContext: {
            className: HttpClientController.name,
            methodName: 'getOneWithRequestId',
            // O requestId será injetado automaticamente pelo @UseHttpRequestId() do Controller
          },
        },
      });
      return res.data;
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Erro no cliente HTTP',
        error?.status || 500,
      );
    }
  }

  // PokeAPI is read-only; keep create/modify/delete endpoints as examples
  @Post('post')
  async create(@Body() body: any) {
    const res = await this.httpRedis
      .post({ url: '/pokemon', data: body })
      .catch((e) => e);
    return { status: res?.status ?? 500, data: res?.data };
  }

  @Put('put/:id')
  async replace(@Param('id') id: string, @Body() body: any) {
    const res = await this.httpRedis
      .put({ url: `/pokemon/${id}`, data: body })
      .catch((e) => e);
    return { status: res?.status ?? 500, data: res?.data };
  }

  @Patch('patch/:id')
  async modify(@Param('id') id: string, @Body() body: any) {
    const res = await this.httpRedis
      .patch({ url: `/pokemon/${id}`, data: body })
      .catch((e) => e);
    return { status: res?.status ?? 500, data: res?.data };
  }

  @Delete('delete/:id')
  async remove(@Param('id') id: string) {
    const res = await this.httpRedis
      .delete({ url: `/pokemon/${id}` })
      .catch((e) => e);
    return { status: res?.status ?? 500 };
  }

  @Head('head')
  async headReq(): Promise<{ status: number; headers: Record<string, any> }> {
    const res = await this.httpRedis.head({ url: '/pokemon' });
    return {
      status: res.status,
      headers: res.headers as unknown as Record<string, any>,
    };
  }

  @Options('options')
  async optionsReq() {
    const res = await this.httpRedis.options({ url: '/pokemon' });
    return { status: res.status };
  }

  // Observable example
  @Get('get-observable')
  getObservable(): Observable<any> {
    return this.httpRedis.get$({ url: '/pokemon' });
  }

  @Get('request-generic')
  async requestGeneric() {
    const res = await this.httpRedis.request({
      method: HttpMethod.GET,
      url: '/pokemon',
      params: { limit: 5 },
      logContext: {
        className: HttpClientController.name,
        methodName: this.requestGeneric.name,
      },
    });
    return res.data;
  }

  @Get('request-observable')
  requestObservable(): Observable<any> {
    return this.httpRedis.request$({
      method: HttpMethod.GET,
      url: '/pokemon',
      params: { limit: 5 },
      logContext: {
        className: HttpClientController.name,
        methodName: this.requestObservable.name,
      },
    });
  }

  @Get('demo/decorator-controller')
  async demoDecoratorController() {
    const res = await this.httpRedis.get({ url: '/pokemon/1' });
    return {
      decoratorScope: 'controller',
      pokemon: res.data,
    };
  }

  @Get('demo/decorator-method')
  @UseHttpRequestId({ headerName: 'x-request-id', autoGenerateIfMissing: true })
  async demoDecoratorMethod() {
    const res = await this.httpRedis.get({ url: '/pokemon/2' });
    return {
      decoratorScope: 'method',
      pokemon: res.data,
    };
  }

  @Post('set-base-url')
  async setBaseUrl(@Body() body: { baseURL: string }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'setBaseUrl',
    };
    this.logger?.info({
      message: 'SET BASE URL START',
      meta: { body, logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.setBaseUrl(body.baseURL);

    this.logger?.info({
      message: 'SET BASE URL END',
      meta: { baseURL: body.baseURL, logContext },
      context: 'HttpClientController',
    });
    return { baseURL: body.baseURL };
  }

  @Get('get-base-url')
  getBaseUrl() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'getBaseUrl',
    };
    const baseURL = this.httpRedis.getBaseUrl();
    this.logger?.info({
      message: 'GET BASE URL',
      meta: { baseURL, logContext },
      context: 'HttpClientController',
    });
    return { baseURL };
  }

  @Post('set-timeout')
  setTimeout(@Body() body: { timeout: number }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'setTimeout',
    };
    this.logger?.info({
      message: 'SET TIMEOUT START',
      meta: { body, logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.setDefaultTimeout(body.timeout);

    this.logger?.info({
      message: 'SET TIMEOUT END',
      meta: { timeout: body.timeout, logContext },
      context: 'HttpClientController',
    });
    return { timeout: body.timeout };
  }

  @Post('set-global-header')
  setGlobalHeader(@Body() body: { key: string; value: string }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'setGlobalHeader',
    };
    this.logger?.info({
      message: 'SET GLOBAL HEADER START',
      meta: { body, logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.setGlobalHeader({ key: body.key, value: body.value });

    this.logger?.info({
      message: 'SET GLOBAL HEADER END',
      meta: { key: body.key, logContext },
      context: 'HttpClientController',
    });
    return { key: body.key, value: body.value };
  }

  @Post('remove-global-header')
  removeGlobalHeader(@Body() body: { key: string }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'removeGlobalHeader',
    };
    this.logger?.info({
      message: 'REMOVE GLOBAL HEADER START',
      meta: { body, logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.removeGlobalHeader(body.key);

    this.logger?.info({
      message: 'REMOVE GLOBAL HEADER END',
      meta: { key: body.key, logContext },
      context: 'HttpClientController',
    });
    return { removed: body.key };
  }

  @Get('global-headers')
  getGlobalHeaders() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'getGlobalHeaders',
    };
    const headers = this.httpRedis.getGlobalHeaders();
    this.logger?.info({
      message: 'GET GLOBAL HEADERS',
      meta: { headers, logContext },
      context: 'HttpClientController',
    });
    return headers;
  }

  @Post('set-token')
  async setToken(@Body() body: { token: string; type?: string }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'setToken',
    };
    const type = body.type ?? 'Bearer';
    this.logger?.info({
      message: 'SET AUTH TOKEN START',
      meta: { type, logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.setAuthToken({ token: body.token, type });

    this.logger?.info({
      message: 'SET AUTH TOKEN END',
      meta: { type, logContext },
      context: 'HttpClientController',
    });
    return { auth: `${type} ${body.token}` };
  }

  @Post('clear-token')
  async clearToken() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'clearToken',
    };
    this.logger?.info({
      message: 'CLEAR AUTH TOKEN',
      meta: { logContext },
      context: 'HttpClientController',
    });
    this.httpRedis.clearAuthToken();
    return { ok: true };
  }

  @Post('add-interceptors')
  addInterceptors() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'addInterceptors',
    };
    this.logger?.info({
      message: 'ADD INTERCEPTORS START',
      meta: { logContext },
      context: 'HttpClientController',
    });

    lastRequestInterceptorId = this.httpRedis.addRequestInterceptor(
      (cfg: any) => {
        cfg.headers = cfg.headers || {};
        cfg.headers['X-Example-Request'] = '1';
        return cfg;
      },
    );

    lastResponseInterceptorId = this.httpRedis.addResponseInterceptor(
      (res: any) => {
        res.config = res.config || {};
        res.config.__receivedAt = Date.now();
        return res;
      },
    );

    this.logger?.info({
      message: 'ADD INTERCEPTORS END',
      meta: {
        requestIdx: lastRequestInterceptorId,
        responseIdx: lastResponseInterceptorId,
        logContext,
      },
      context: 'HttpClientController',
    });

    return {
      requestId: lastRequestInterceptorId,
      responseId: lastResponseInterceptorId,
    };
  }

  @Post('remove-interceptors')
  removeInterceptors() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'removeInterceptors',
    };
    this.logger?.info({
      message: 'REMOVE INTERCEPTORS START',
      meta: { logContext },
      context: 'HttpClientController',
    });

    if (lastRequestInterceptorId != null)
      this.httpRedis.removeRequestInterceptor(lastRequestInterceptorId);
    if (lastResponseInterceptorId != null)
      this.httpRedis.removeResponseInterceptor(lastResponseInterceptorId);

    const removedIds = {
      request: lastRequestInterceptorId,
      response: lastResponseInterceptorId,
    };
    lastRequestInterceptorId = null;
    lastResponseInterceptorId = null;

    this.logger?.info({
      message: 'REMOVE INTERCEPTORS END',
      meta: { removedIds, logContext },
      context: 'HttpClientController',
    });
    return { removed: true };
  }

  @Post('add-error-interceptor')
  addErrorInterceptor() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'addErrorInterceptor',
    };
    this.logger?.info({
      message: 'ADD ERROR INTERCEPTOR START',
      meta: { logContext },
      context: 'HttpClientController',
    });

    lastErrorInterceptorId = this.httpRedis.addErrorInterceptor(
      (error: any) => {
        if (error && typeof error === 'object') {
          error.__handledByExample = true;
        }
        return error;
      },
    );

    this.logger?.info({
      message: 'ADD ERROR INTERCEPTOR END',
      meta: { id: lastErrorInterceptorId, logContext },
      context: 'HttpClientController',
    });
    return { errorInterceptorId: lastErrorInterceptorId };
  }

  @Post('remove-error-interceptor')
  removeErrorInterceptor() {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'removeErrorInterceptor',
    };
    this.logger?.info({
      message: 'REMOVE ERROR INTERCEPTOR START',
      meta: { logContext },
      context: 'HttpClientController',
    });

    if (lastErrorInterceptorId != null) {
      this.httpRedis.removeErrorInterceptor(lastErrorInterceptorId);
      const removedId = lastErrorInterceptorId;
      lastErrorInterceptorId = null;
      this.logger?.info({
        message: 'REMOVE ERROR INTERCEPTOR END',
        meta: { removedId, logContext },
        context: 'HttpClientController',
      });
      return { removed: true, errorInterceptorId: removedId };
    }

    this.logger?.info({
      message: 'REMOVE ERROR INTERCEPTOR SKIP (not found)',
      meta: { logContext },
      context: 'HttpClientController',
    });
    return { removed: false };
  }

  @Post('clear-cache')
  clearCache(@Body() body?: { key?: string }) {
    const logContext = {
      className: HttpClientController.name,
      methodName: 'clearCache',
    };
    this.logger?.info({
      message: 'CLEAR CACHE START',
      meta: { key: body?.key || 'all', logContext },
      context: 'HttpClientController',
    });

    this.httpRedis.clearCache(body?.key);

    this.logger?.info({
      message: 'CLEAR CACHE END',
      meta: { cleared: body?.key ?? 'all', logContext },
      context: 'HttpClientController',
    });
    return { cleared: body?.key ?? 'all' };
  }

  @Get('cache-demo')
  async cacheDemo() {
    const first = await this.httpRedis.get({
      url: '/pokemon/1',
      config: {
        cache: true,
        cacheTtl: 10000,
        logContext: {
          className: HttpClientController.name,
          methodName: this.cacheDemo.name,
        },
      },
    });

    const second = await this.httpRedis.get({
      url: '/pokemon/1',
      config: {
        cache: true,
        cacheTtl: 10000,
        logContext: {
          className: HttpClientController.name,
          methodName: this.cacheDemo.name,
        },
      },
    });

    return {
      firstStatus: first.status,
      secondStatus: second.status,
      samePayload: JSON.stringify(first.data) === JSON.stringify(second.data),
    };
  }

  @Get('code-samples')
  codeSamples() {
    return {
      forRoot: `import { HttpModule } from '@adatechnology/http-client';\\n\\nimports: [HttpModule.forRoot(\\n  { baseURL: 'https://pokeapi.co/api/v2' },\\n  {\\n    logging: {\\n      enabled: true,\\n      environments: ['development', 'test'],\\n      types: ['request', 'response', 'error'],\\n      includeHeaders: true,\\n      includeBody: false,\\n      context: 'HttpClientExample',\\n    },\\n  },\\n)]`,
      explicit: `import { HttpImplementationAxiosModule } from '@adatechnology/http-client';\\n\\nimports: [HttpImplementationAxiosModule.forRoot({ baseURL: 'https://pokeapi.co/api/v2' }), HttpModule.forRoot()]`,
      logContext: `await httpProvider.get('/pokemon/1', {\\n  logContext: {\\n    className: 'PokemonService',\\n    methodName: 'findOne',\\n    requestId: 'req-123',\\n  },\\n});`,
      interceptors: `const id = httpProvider.addRequestInterceptor(config => { config.headers['X-Id']='1'; return config; }); httpProvider.removeRequestInterceptor(id);`,
      genericRequest: `await httpProvider.request({ method: 'GET', url: '/pokemon', params: { limit: 5 } });`,
      globalHeader: `httpProvider.setGlobalHeader('X-Tenant-Id', 'tenant-01');\\nconst headers = httpProvider.getGlobalHeaders();\\nhttpProvider.removeGlobalHeader('X-Tenant-Id');`,
      errorInterceptor: `const id = httpProvider.addErrorInterceptor(err => { err.__handledByExample = true; return err; });\\nhttpProvider.removeErrorInterceptor(id);`,
      cache: `await httpProvider.get('/pokemon/1', { cache: true, cacheTtl: 10000 });\\nhttpProvider.clearCache();`,
    };
  }
}
