import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDataSource } from "@/lib/database/data-source";
import { User } from "./database/entities/User";
import bcrypt from "bcryptjs";


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        // Ensure DB initialized
        const db = await getDataSource();
        const userRepo = db.getRepository(User);
        const user = await userRepo.findOne({
          where: { username: credentials.username as string },
          relations: ["role", "role.permissions"],
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(credentials.password as string, user.password as string);
        if (!passwordMatch) return null;

        // Get user permissions
        let permissions: string[] = [];
        if (user.role) {
          if (user.role.name === "super_admin") {
            // Super admin has all permissions
            permissions = [
              "rabbitmq",
              "check-sync",
              "numbers-not-in-bifrost",
              "numbers-not-in-cache",
              "generate-signed-url",
              "call-details",
              "list-practices",
              "simwood",
            ];
          } else {
            // Regular users get permissions from their role
            permissions = user.role.permissions
              ?.filter((p) => p.isActive)
              .map((p) => p.name) || [];
          }
        }

        return {
          id: user.uuid,
          name: user.username,
          username: user.username,
          email: user.email,
          role: user.role?.name || null,
          permissions: permissions,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 day in seconds (86400)
    updateAge: 24 * 60 * 60, // Update session token every 1 day
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = (user as any).username;
        token.email = user.email;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        (session.user as any).username = token.username as string;
        session.user.email = token.email as string;
        (session.user as any).role = token.role as string | null;
        (session.user as any).permissions = (token.permissions as string[]) || [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production",
});

