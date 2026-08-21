import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the Auth.js config — no Credentials provider (which
 * needs Prisma/bcrypt, both Node-only) so this can be imported from
 * middleware, which runs on the Edge runtime. The full config in auth.ts
 * extends this with the actual provider for use in API routes and server
 * components (Node runtime).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
