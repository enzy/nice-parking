import { component$, Slot } from "@builder.io/qwik";
import {
  routeLoader$,
  type RequestHandler,
} from "@builder.io/qwik-city";
import { refreshAccessToken, getUserInfo } from "~/services/auth";

export interface UserSession {
  isLoggedIn: boolean;
  name: string;
  email: string;
}

export const onRequest: RequestHandler = async ({ cookie, env, url }) => {
  // Skip auth check for auth routes
  if (url.pathname.startsWith("/api/auth")) return;

  const accessToken = cookie.get("access_token")?.value;
  const refreshToken = cookie.get("refresh_token")?.value;

  // Try to refresh if we have a refresh token but no access token
  if (!accessToken && refreshToken) {
    try {
      const newToken = await refreshAccessToken(env, refreshToken);
      if (newToken) {
        cookie.set("access_token", newToken, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 3600,
        });
        // Also refresh user info
        const user = await getUserInfo(newToken);
        cookie.set("user_name", encodeURIComponent(user.name), {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    } catch {
      // Refresh failed, user will need to re-authenticate
    }
  }
};

export const useSession = routeLoader$<UserSession>(async ({ cookie }) => {
  const accessToken = cookie.get("access_token")?.value;
  const rawName = cookie.get("user_name")?.value;
  const rawEmail = cookie.get("user_email")?.value;

  return {
    isLoggedIn: !!accessToken,
    name: rawName ? decodeURIComponent(rawName) : "",
    email: rawEmail ? decodeURIComponent(rawEmail) : "",
  };
});

export default component$(() => {
  const session = useSession();

  return (
    <div class="app">
      <header class="app-header">
        <div class="header-content">
          <a href="/" class="logo">
            Parking
          </a>
          <nav class="nav">
            <a href="/" class="nav-link">
              Today
            </a>
            <a href="/future" class="nav-link">
              Upcoming
            </a>
          </nav>
          <div class="user-section">
            {session.value.isLoggedIn ? (
              <div class="user-info">
                <span class="user-name">{session.value.name}</span>
                <a href="/api/auth/logout" class="btn btn-small btn-outline">
                  Sign out
                </a>
              </div>
            ) : (
              <a href="/api/auth" class="btn btn-small btn-primary">
                Sign in with Google
              </a>
            )}
          </div>
        </div>
      </header>
      <main class="main-content">
        <Slot />
      </main>
    </div>
  );
});
