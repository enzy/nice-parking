import type { RequestHandler } from "@builder.io/qwik-city";
import { getGithubAuthUrl } from "~/services/github-auth";

export const onGet: RequestHandler = async ({ redirect, env }) => {
  throw redirect(302, getGithubAuthUrl(env));
};
