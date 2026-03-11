import type { RequestHandler } from "@builder.io/qwik-city";
import { getTokensFromCode, getUserInfo } from "~/services/auth";

export const onGet: RequestHandler = async ({
  query,
  cookie,
  redirect,
  env,
}) => {
  const code = query.get("code");
  if (!code) {
    throw redirect(302, "/");
  }

  const tokens = await getTokensFromCode(env, code);

  if (tokens.access_token) {
    cookie.set("access_token", tokens.access_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 3600,
    });
  }

  if (tokens.refresh_token) {
    cookie.set("refresh_token", tokens.refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  // Get user info and store name
  if (tokens.access_token) {
    const user = await getUserInfo(tokens.access_token);
    cookie.set("user_name", encodeURIComponent(user.name), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookie.set("user_email", encodeURIComponent(user.email), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  throw redirect(302, "/");
};
