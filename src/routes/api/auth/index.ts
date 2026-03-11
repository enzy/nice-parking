import type { RequestHandler } from "@builder.io/qwik-city";
import { getAuthUrl } from "~/services/auth";

export const onGet: RequestHandler = async ({ redirect, env }) => {
  const authUrl = getAuthUrl(env);
  throw redirect(302, authUrl);
};
