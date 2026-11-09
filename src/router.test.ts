import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout } from "./auth";
import router from "./router";

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

describe("authentication route guard", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
  });

  it("restores a direct login-page visit but does not restore after logout", async () => {
    let sessionRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/api/auth/session")) {
          sessionRequests += 1;
          return response({
            accessToken: "short-lived-access-token",
            user: { id: "user-1", email: "student@example.com" },
          });
        }
        return response(null, 204);
      }),
    );

    await router.push("/login");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("overview");
    expect(currentUser.value?.email).toBe("student@example.com");

    await logout();
    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("login");
    expect(sessionRequests).toBe(1);
  });
});
