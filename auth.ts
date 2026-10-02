import "server-only";

import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/services/auth.service";
import { ApplicationError } from "@/lib/errors/application-error";

class InactiveAccountSignin extends CredentialsSignin {
  code = "INACTIVE_ACCOUNT";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  // Auth.js normalizes requests to the configured NEXTAUTH_URL origin.
  trustHost: Boolean(process.env.NEXTAUTH_URL),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      try { return await authenticateCredentials(credentials); }
      catch (error) {
        if (error instanceof ApplicationError && error.code === "INACTIVE_ACCOUNT") throw new InactiveAccountSignin();
        throw error;
      }
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Explicit allowlist: never spread the credentials record into a token.
        return { sub: user.id, name: user.name, email: user.email, role: user.role };
      }
      // Ignore client-requested session updates. These are identity snapshots;
      // protected operations re-read active status and role from the database.
      if (!token.sub || (token.role !== "ADMIN" && token.role !== "USER")) return null;
      return token;
    },
    session({ session, token }) {
      if (!token.sub || (token.role !== "ADMIN" && token.role !== "USER")) {
        throw new Error("Invalid session identity.");
      }
      return {
        expires: session.expires,
        user: {
          id: token.sub, name: token.name ?? "", email: token.email ?? "",
          role: token.role,
        },
      };
    },
  },
  logger: {
    error(error) {
      if (!(error instanceof AuthError && error.type === "CredentialsSignin")) console.error("Authentication request failed.");
    },
    warn() { console.warn("Authentication configuration warning."); },
    debug() {},
  },
});
