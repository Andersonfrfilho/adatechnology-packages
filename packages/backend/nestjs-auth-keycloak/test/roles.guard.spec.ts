import { RolesGuard } from "../src/roles.guard";

describe("RolesGuard", () => {
  it("allows request when token contains required realm role", async () => {
    const mockReflector: any = {
      get: jest
        .fn()
        .mockReturnValue({ roles: ["admin"], mode: "any", type: "realm" }),
    };

    const config = { credentials: { clientId: "example-client" } } as any;

    const guard = new RolesGuard(mockReflector, config);

    const payload = { realm_access: { roles: ["admin"] } };
    const token = `h.${Buffer.from(JSON.stringify(payload)).toString("base64")}.s`;

    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
      }),
    };

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
  });
});
