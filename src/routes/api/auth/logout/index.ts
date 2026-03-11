import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ cookie, redirect }) => {
  cookie.delete("access_token", { path: "/" });
  cookie.delete("refresh_token", { path: "/" });
  cookie.delete("user_name", { path: "/" });
  cookie.delete("user_email", { path: "/" });
  throw redirect(302, "/");
};
