import { describe, it, expect, vi, afterEach } from "vitest";
import { PROVIDERS, isProviderId, type Env } from "./auth";

function makeEnv(values: Record<string, string> = {}): Env {
  return {
    get: (key: string) => values[key],
  } as Env;
}

const githubEnv = makeEnv({
  GITHUB_CLIENT_ID: "gh-client",
  GITHUB_CLIENT_SECRET: "gh-secret",
  OAUTH_REDIRECT_URI: "https://parking.test/api/auth/callback",
});

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 404) {
  return { ok, status, json: async () => body } as Response;
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isProviderId", () => {
  it("accepts known providers", () => {
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("github")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isProviderId("facebook")).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
    expect(isProviderId(null)).toBe(false);
  });
});

describe("isConfigured", () => {
  it("is true only when both the client id and the secret are set", () => {
    expect(PROVIDERS.github.isConfigured(githubEnv)).toBe(true);
    expect(
      PROVIDERS.github.isConfigured(makeEnv({ GITHUB_CLIENT_ID: "gh-client" })),
    ).toBe(false);
    expect(PROVIDERS.github.isConfigured(makeEnv())).toBe(false);

    expect(
      PROVIDERS.google.isConfigured(
        makeEnv({
          GOOGLE_CLIENT_ID: "g-client",
          GOOGLE_CLIENT_SECRET: "g-secret",
        }),
      ),
    ).toBe(true);
    expect(PROVIDERS.google.isConfigured(makeEnv())).toBe(false);
  });
});

describe("google.getAuthUrl", () => {
  it("targets Google with the profile scope and the state", () => {
    const url = new URL(
      PROVIDERS.google.getAuthUrl(
        makeEnv({ GOOGLE_CLIENT_ID: "g-client" }),
        "nonce-1",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("g-client");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/userinfo.profile",
    );
    expect(url.searchParams.get("state")).toBe("nonce-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/callback",
    );
  });
});

describe("github.getAuthUrl", () => {
  it("targets GitHub with the read:user scope and the state", () => {
    const url = new URL(PROVIDERS.github.getAuthUrl(githubEnv, "nonce-2"));

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("gh-client");
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBe("nonce-2");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://parking.test/api/auth/callback",
    );
  });
});

describe("github.getTokensFromCode", () => {
  it("asks for a JSON response and returns the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "gho_token" }));
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await PROVIDERS.github.getTokensFromCode(
      githubEnv,
      "code-1",
    );

    expect(tokens).toEqual({ access_token: "gho_token" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(init.headers.Accept).toBe("application/json");
    expect(String(init.body)).toContain("code=code-1");
  });

  it("returns no token when GitHub answers with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: "bad_verification_code" })),
    );

    const tokens = await PROVIDERS.github.getTokensFromCode(
      githubEnv,
      "code-1",
    );

    expect(tokens.access_token).toBeUndefined();
  });
});

describe("github.getUserInfo", () => {
  it("returns the profile name and avatar", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        name: "Martin Kolaci",
        login: "kolaczek",
        avatar_url: "https://avatars.test/1",
      }),
    );

    const user = await PROVIDERS.github.getUserInfo(githubEnv, "gho_token");

    expect(user).toEqual({
      name: "Martin Kolaci",
      picture: "https://avatars.test/1",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/user");
    expect(fetchMock.mock.calls[0][1].headers["User-Agent"]).toBeTruthy();
  });

  it("falls back to the login when the profile name is not set", async () => {
    mockFetch(
      jsonResponse({ name: null, login: "kolaczek", avatar_url: null }),
    );

    const user = await PROVIDERS.github.getUserInfo(githubEnv, "gho_token");

    expect(user).toEqual({ name: "kolaczek", picture: "" });
  });

  it("throws when the profile call fails", async () => {
    mockFetch(jsonResponse({ message: "Bad credentials" }, false, 401));

    await expect(
      PROVIDERS.github.getUserInfo(githubEnv, "gho_token"),
    ).rejects.toThrow("GitHub profile request failed with 401");
  });
});

describe("google.getUserInfo", () => {
  it("returns the profile name and picture", async () => {
    mockFetch(
      jsonResponse({ name: "Matej Simek", picture: "https://pics.test/1" }),
    );

    const user = await PROVIDERS.google.getUserInfo(makeEnv(), "ya29_token");

    expect(user).toEqual({
      name: "Matej Simek",
      picture: "https://pics.test/1",
    });
  });

  it("throws instead of returning an Unknown user when Google fails", async () => {
    mockFetch(jsonResponse({ error: "invalid_credentials" }, false, 401));

    await expect(
      PROVIDERS.google.getUserInfo(makeEnv(), "ya29_token"),
    ).rejects.toThrow("Google profile request failed with 401");
  });
});

describe("the redirect uri", () => {
  it("is shared by both providers", () => {
    const env = makeEnv({
      OAUTH_REDIRECT_URI: "https://parking.test/api/auth/callback",
    });

    for (const provider of [PROVIDERS.google, PROVIDERS.github]) {
      expect(
        new URL(provider.getAuthUrl(env, "nonce")).searchParams.get(
          "redirect_uri",
        ),
      ).toBe("https://parking.test/api/auth/callback");
    }
  });

  it("still honours the pre-collapse GOOGLE_REDIRECT_URI", () => {
    const env = makeEnv({
      GOOGLE_REDIRECT_URI: "https://legacy.test/api/auth/callback",
    });

    expect(
      new URL(PROVIDERS.github.getAuthUrl(env, "nonce")).searchParams.get(
        "redirect_uri",
      ),
    ).toBe("https://legacy.test/api/auth/callback");
  });

  it("falls back to localhost for local development", () => {
    expect(
      new URL(PROVIDERS.google.getAuthUrl(makeEnv(), "nonce")).searchParams.get(
        "redirect_uri",
      ),
    ).toBe("http://localhost:5173/api/auth/callback");
  });
});
