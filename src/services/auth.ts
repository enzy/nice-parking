import { google } from "googleapis";
import type { RequestEventBase } from "@builder.io/qwik-city";

export function getOAuth2Client(env: RequestEventBase["env"]) {
  return new google.auth.OAuth2(
    env.get("GOOGLE_CLIENT_ID"),
    env.get("GOOGLE_CLIENT_SECRET"),
    env.get("GOOGLE_REDIRECT_URI") || "http://localhost:5173/api/auth/callback"
  );
}

export function getAuthUrl(env: RequestEventBase["env"]): string {
  const client = getOAuth2Client(env);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

export async function getTokensFromCode(
  env: RequestEventBase["env"],
  code: string
) {
  const client = getOAuth2Client(env);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return {
    name: (data.name as string) || "Unknown",
    email: (data.email as string) || "",
    picture: (data.picture as string) || "",
  };
}

export async function refreshAccessToken(
  env: RequestEventBase["env"],
  refreshToken: string
): Promise<string | null> {
  const client = getOAuth2Client(env);
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials.access_token || null;
}
