import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    access_token?: string;
    expires_at?: number;
    refresh_token?: string;
    error?: "RefreshTokenError";
  }
}

function isAllowed(email?: string | null) {
  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return !!email && list.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${CALENDAR_SCOPE} ${CALENDAR_LIST_SCOPE}`,
          access_type: "offline", // agar dapat refresh token
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  pages: { signIn: "/", error: "/" },
  callbacks: {
    signIn({ user }) {
      return isAllowed(user.email);
    },
    async jwt({ token, account }) {
      // Login pertama: simpan token dari Google
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        };
      }
      // Token masih berlaku (beri jeda 60 detik)
      if (token.expires_at && Date.now() < (token.expires_at - 60) * 1000) {
        return token;
      }
      // Token kedaluwarsa: perbarui pakai refresh token
      if (!token.refresh_token) {
        return { ...token, error: "RefreshTokenError" as const };
      }
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refresh_token,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw data;
        return {
          ...token,
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
          refresh_token: data.refresh_token ?? token.refresh_token,
          error: undefined,
        };
      } catch (err) {
        console.error("Gagal refresh token Google", err);
        return { ...token, error: "RefreshTokenError" as const };
      }
    },
    session({ session, token }) {
      session.accessToken = token.access_token;
      session.error = token.error;
      return session;
    },
  },
});
