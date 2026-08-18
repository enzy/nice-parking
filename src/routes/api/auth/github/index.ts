import type { RequestHandler } from "@builder.io/qwik-city";
import { getGithubAuthUrl } from "~/services/github-auth";

export const onGet: RequestHandler = async ({ redirect, env, cookie }) => {
  const state = crypto.randomUUID();
  cookie.set("github_oauth_state", state, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
  });
  throw redirect(302, getGithubAuthUrl(env, state));
};
