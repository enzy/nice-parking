import type { RequestHandler } from "@builder.io/qwik-city";
import { PROVIDERS, type OAuthUser } from "~/services/auth";
import { parseState, STATE_COOKIE_NAME } from "~/services/oauth-state";

export const onGet: RequestHandler = async ({
  query,
  cookie,
  redirect,
  env,
}) => {
  const stateCookie = cookie.get(STATE_COOKIE_NAME)?.value;
  cookie.delete(STATE_COOKIE_NAME, { path: "/" });

  const providerId = parseState(stateCookie, query.get("state"));
  if (!providerId) {
    throw redirect(302, "/?error=invalid_state");
  }

  const code = query.get("code");
  if (!code) {
    throw redirect(302, "/?error=auth_failed");
  }

  const provider = PROVIDERS[providerId];

  let user: OAuthUser;
  try {
    const { access_token: accessToken } = await provider.getTokensFromCode(
      env,
      code,
    );
    if (!accessToken) {
      throw new Error("provider returned no access token");
    }
    user = await provider.getUserInfo(env, accessToken);
  } catch {
    throw redirect(302, "/?error=auth_failed");
  }

  // Store name (long-lived, used to identify reservations)
  cookie.set("user_name", encodeURIComponent(user.name), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  throw redirect(302, "/");
};
