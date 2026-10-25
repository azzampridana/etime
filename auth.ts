import "server-only";

import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/services/auth.service";
import { ApplicationError } from "@/lib/errors/application-error";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function hasValidLoginTimestamp(value: unknown): value is number {
  const now = Date.now();
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    && value <= now && now - value < SESSION_MAX_AGE_SECONDS * 1000;
}

class InactiveAccountSignin extends CredentialsSignin {
  code = "INACTIVE_ACCOUNT";
}

const diagnosticNames = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "AggregateError",
  "AuthError", "CallbackRouteError", "CredentialsSignin", "AdapterError",
  "AccessDenied", "MissingSecret", "UntrustedHost", "InvalidCallbackUrl",
  "JWTSessionError", "SessionTokenError", "CallbackError", "Configuration",
  "PrismaClientInitializationError", "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError", "PrismaClientValidationError",
  "PrismaClientRustPanicError", "DriverAdapterError", "SqlError", "ApplicationError",
]);
const diagnosticCodes = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "EPIPE", "EACCES", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR",
  "ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR", "ER_GET_CONNECTION_TIMEOUT",
  "ER_CONNECTION_TIMEOUT", "ER_CON_COUNT_ERROR", "INACTIVE_ACCOUNT",
]);
const diagnosticAdapterKinds = new Set([
  "mysql", "UniqueConstraintViolation", "ForeignKeyConstraintViolation",
  "NullConstraintViolation", "ValueOutOfRange", "DatabaseDoesNotExist",
  "DatabaseAlreadyExists", "DatabaseAccessDenied", "AuthenticationFailed",
  "TableDoesNotExist", "ColumnNotFound", "LengthMismatch",
  "MissingFullTextSearchIndex", "TransactionWriteConflict", "TooManyConnections",
]);

function diagnosticNumericCode(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999999) return String(value);
  return typeof value === "string" && /^\d{1,6}$/.test(value) ? value : "Unknown";
}

// Read data properties only: never invoke error getters or serialize error objects.
function diagnosticProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function logAuthenticationDiagnostic(error: unknown): void {
  try {
    const queue: { value: unknown; depth: number }[] = [{ value: error, depth: 0 }];
    const seen = new Set<object>();
    const chain: {
      depth: number; name: string; type: string; code: string;
      adapter?: { kind: string; originalCode: string; code: string; state: string };
    }[] = [];
    for (let index = 0; index < queue.length && index < 8; index++) {
      const { value, depth } = queue[index];
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      const name = diagnosticProperty(value, "name");
      const type = diagnosticProperty(value, "type");
      const code = diagnosticProperty(value, "code") ?? diagnosticProperty(value, "errorCode");
      let adapter: (typeof chain)[number]["adapter"];
      if (name === "DriverAdapterError") {
        const cause = diagnosticProperty(value, "cause");
        if (cause !== null && typeof cause === "object") {
          const kind = diagnosticProperty(cause, "kind");
          const state = diagnosticProperty(cause, "state");
          adapter = {
            kind: typeof kind === "string" && diagnosticAdapterKinds.has(kind) ? kind : "Unknown",
            originalCode: diagnosticNumericCode(diagnosticProperty(cause, "originalCode")),
            code: diagnosticNumericCode(diagnosticProperty(cause, "code")),
            state: typeof state === "string" && /^[A-Z0-9]{5}$/.test(state) ? state : "Unknown",
          };
        }
      }
      chain.push({
        depth,
        name: typeof name === "string" && diagnosticNames.has(name) ? name : "Unknown",
        type: typeof type === "string" && diagnosticNames.has(type) ? type : "Unknown",
        code: typeof code === "string" && (diagnosticCodes.has(code) || /^P[12]\d{3}$/.test(code)) ? code : "Unknown",
        ...(adapter ? { adapter } : {}),
      });
      if (depth < 4) {
        // Auth.js wraps callback failures as cause: { err, ... }, not just Error.cause.
        for (const key of ["cause", "err"] as const) {
          if (queue.length < 8) queue.push({ value: diagnosticProperty(value, key), depth: depth + 1 });
        }
      }
    }
    console.error("[AUTH_DIAGNOSTIC]", JSON.stringify({ chain }));
  } catch {
    // Diagnostics must never affect authentication, including when logging fails.
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  // Auth.js normalizes requests to the configured NEXTAUTH_URL origin.
  trustHost: Boolean(process.env.NEXTAUTH_URL),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
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
        return { sub: user.id, name: user.name, email: user.email, role: user.role, loginAt: Date.now() };
      }
      // Ignore client-requested session updates. These are identity snapshots;
      // protected operations re-read active status and role from the database.
      if (!token.sub || (token.role !== "ADMIN" && token.role !== "USER")) return null;
      // Auth.js refreshes iat/exp on re-encoding. Only our original server login
      // timestamp defines the absolute limit; legacy tokens must sign in again.
      if (!hasValidLoginTimestamp(token.loginAt)) return null;
      return token;
    },
    session({ token }) {
      if (!token.sub || (token.role !== "ADMIN" && token.role !== "USER") || !hasValidLoginTimestamp(token.loginAt)) {
        throw new Error("Invalid session identity.");
      }
      return {
        expires: new Date(token.loginAt + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
        user: {
          id: token.sub, name: token.name ?? "", email: token.email ?? "",
          role: token.role,
        },
      };
    },
  },
  logger: {
    error(error) {
      try {
        if (!(error instanceof AuthError && error.type === "CredentialsSignin")) logAuthenticationDiagnostic(error);
      } catch {
        // Preserve authentication even for unusual error objects.
      }
    },
    warn() { console.warn("Authentication configuration warning."); },
    debug() {},
  },
});
