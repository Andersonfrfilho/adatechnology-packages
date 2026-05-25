import { BaseAppError } from "@adatechnology/shared";
import { BearerTokenGuard } from "../src/bearer-token.guard";

const makeCtx = (headers: Record<string, string>): any => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers }),
  }),
});

const makeClient = (result: boolean | "throw"): any => ({
  validateToken: jest.fn().mockImplementation(() =>
    result === "throw"
      ? Promise.reject(new Error("network error"))
      : Promise.resolve(result),
  ),
});

describe("BearerTokenGuard", () => {
  it("allows request when token is active", async () => {
    const client = makeClient(true);
    const guard = new BearerTokenGuard(client);

    await expect(
      guard.canActivate(makeCtx({ authorization: "Bearer valid-token" })),
    ).resolves.toBe(true);

    expect(client.validateToken).toHaveBeenCalledWith("valid-token");
  });

  it("throws UNAUTHORIZED_MISSING_TOKEN when Authorization header is absent", async () => {
    const guard = new BearerTokenGuard(makeClient(true));

    await expect(guard.canActivate(makeCtx({}))).rejects.toMatchObject({
      code: "UNAUTHORIZED_MISSING_TOKEN",
      status: 401,
    });
  });

  it("throws UNAUTHORIZED_MISSING_TOKEN when header has no Bearer scheme", async () => {
    const guard = new BearerTokenGuard(makeClient(true));

    await expect(
      guard.canActivate(makeCtx({ authorization: "Basic dXNlcjpwYXNz" })),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED_MISSING_TOKEN",
      status: 401,
    });
  });

  it("throws UNAUTHORIZED_INACTIVE_TOKEN when token is inactive", async () => {
    const guard = new BearerTokenGuard(makeClient(false));

    await expect(
      guard.canActivate(makeCtx({ authorization: "Bearer expired-token" })),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED_INACTIVE_TOKEN",
      status: 401,
    });
  });

  it("throws UNAUTHORIZED_TOKEN_VALIDATION_FAILED when validateToken throws", async () => {
    const guard = new BearerTokenGuard(makeClient("throw"));

    await expect(
      guard.canActivate(makeCtx({ authorization: "Bearer some-token" })),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED_TOKEN_VALIDATION_FAILED",
      status: 401,
    });
  });

  it("throws UNAUTHORIZED_KEYCLOAK_NOT_CONFIGURED when client is absent", async () => {
    const guard = new BearerTokenGuard(undefined);

    await expect(
      guard.canActivate(makeCtx({ authorization: "Bearer some-token" })),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED_KEYCLOAK_NOT_CONFIGURED",
      status: 401,
    });
  });

  it("errors are instances of BaseAppError", async () => {
    const guard = new BearerTokenGuard(makeClient(false));

    await expect(
      guard.canActivate(makeCtx({ authorization: "Bearer expired" })),
    ).rejects.toBeInstanceOf(BaseAppError);
  });
});
