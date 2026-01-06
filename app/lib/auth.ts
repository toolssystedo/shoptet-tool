import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";

import GoogleProvider from "next-auth/providers/google";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Check if user already exists (returning user)
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
      });

      if (existingUser) {
        return true; // Allow existing users to sign in
      }

      // For new users, check if they have a valid invitation
      const invitation = await prisma.invitation.findUnique({
        where: { email: user.email! },
      });

      if (!invitation) {
        return false; // No invitation found
      }

      if (invitation.status !== "PENDING") {
        return false; // Invitation already used or expired
      }

      if (invitation.expiresAt < new Date()) {
        // Mark invitation as expired
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        return false;
      }

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      return true;
    },
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string | null;
        session.user.role = token.role as Role;
      }

      return session;
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.role = dbUser.role;
        }
      }

      // Update token if user data changes
      if (trigger === "update" && session) {
        token.name = session.user.name;
        token.email = session.user.email;
        token.picture = session.user.image;
      }

      return token;
    },
  },
  events: {
    async createUser({ user }) {
      // When a new user is created, check if they have an invitation with a specific role
      if (user.email) {
        const invitation = await prisma.invitation.findUnique({
          where: { email: user.email },
        });

        const invitationWithRole = invitation as unknown as { role?: Role };
        if (invitationWithRole.role) {
          // Update the user's role based on the invitation
          await prisma.user.update({
            where: { id: user.id },
            data: { role: invitationWithRole.role },
          });
        }
      }
    },
  },
});
