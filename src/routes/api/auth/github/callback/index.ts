import type { RequestHandler } from "@builder.io/qwik-city";
import { getGithubTokensFromCode, getGithubUserInfo } from "~/services/github-auth";

export const onGet: RequestHandler = async ({
  query,
  cookie,
  redirect,
  env,
}) => {
  const code = query.get("code");
  const stateParam = query.get("state");
  const stateCookie = cookie.get("github_oauth_state")?.value;

  cookie.delete("github_oauth_state", { path: "/" });

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    throw redirect(302, "/");
  }

  const tokens = await getGithubTokensFromCode(env, code);

  if (tokens.access_token) {
    const user = await getGithubUserInfo(tokens.access_token);
    cookie.set("user_name", encodeURIComponent(user.name), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  throw redirect(302, "/");
};
