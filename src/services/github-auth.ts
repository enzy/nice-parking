import type { RequestEventBase } from "@builder.io/qwik-city";

/**
 * Build the GitHub OAuth authorization URL.
 */
export function getGithubAuthUrl(env: RequestEventBase["env"], state?: string): string {
  const clientId = env.get("GITHUB_CLIENT_ID");
  const redirectUri =
    env.get("GITHUB_REDIRECT_URI") || "http://localhost:5173/api/auth/github/callback";

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    scope: "read:user",
  });

  if (state) {
    params.set("state", state);
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens using the GitHub OAuth token endpoint.
 */
export async function getGithubTokensFromCode(
  env: RequestEventBase["env"],
  code: string,
): Promise<{ access_token?: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: env.get("GITHUB_CLIENT_ID")!,
      client_secret: env.get("GITHUB_CLIENT_SECRET")!,
      redirect_uri:
        env.get("GITHUB_REDIRECT_URI") ||
        "http://localhost:5173/api/auth/github/callback",
    }),
  });

  const data = await res.json();
  return { access_token: data.access_token };
}

/**
 * Fetch user profile info from GitHub.
 */
export async function getGithubUserInfo(accessToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "parking-app",
    },
  });
  const data = await res.json();
  return {
    name: ((data.name || data.login) as string) || "Unknown",
  };
}
