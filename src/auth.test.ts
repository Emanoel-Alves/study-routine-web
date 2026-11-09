import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUser, login, logout, requestApi, restoreSession } from "./auth";

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

describe("authentication", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("restores a session through the HttpOnly cookie without browser storage", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        if (String(input).endsWith("/api/auth/session")) {
          return response({
            accessToken: "short-lived-access-token",
            user: { id: "user-1", email: "student@example.com" },
          });
        }
        return response({ data: "private" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(restoreSession()).resolves.toBe(true);
    await expect(requestApi("/api/content")).resolves.toEqual({
      data: "private",
    });

    const sessionCall = fetchMock.mock.calls[0];
    expect(sessionCall?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: "include",
    });
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization"),
    ).toBe("Bearer short-lived-access-token");
    expect(localStorage.length).toBe(0);
    expect(currentUser.value?.email).toBe("student@example.com");
  });

  it("sends credentials when logging in and revokes the server session on logout", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        if (String(input).endsWith("/api/auth/logout")) {
          return response(null, 204);
        }
        return response({
          accessToken: "short-lived-access-token",
          user: { id: "user-1", email: "student@example.com" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await login("student@example.com", "password");
    await logout();

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/auth/logout");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(currentUser.value).toBeNull();
  });

  it("treats a rejected or expired session cookie as signed out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ error: "Sessão expirada." }, 401)),
    );

    await expect(restoreSession()).resolves.toBe(false);
    expect(currentUser.value).toBeNull();
  });
});
