"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

export async function sendInvitation(email: string, role: Role = "USER") {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Check if invitation already exists
  const existingInvitation = await prisma.invitation.findUnique({
    where: { email },
  });

  if (existingInvitation) {
    if (existingInvitation.status === "PENDING") {
      throw new Error("Invitation already sent to this email");
    }
    // Delete old invitation if expired or accepted
    await prisma.invitation.delete({
      where: { id: existingInvitation.id },
    });
  }

  // Create invitation (expires in 7 days)
  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Send email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${invitation.token}`;

  await sendInvitationEmail({
    email,
    inviterName: session.user.name || "Admin",
    inviteLink,
  });

  revalidatePath("/admin/invitations");

  return { success: true };
}

export async function resendInvitation(invitationId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  // Update expiration
  const updatedInvitation = await prisma.invitation.update({
    where: { id: invitationId },
    data: {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "PENDING",
    },
  });

  // Send email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${updatedInvitation.token}`;

  await sendInvitationEmail({
    email: invitation.email,
    inviterName: session.user.name || "Admin",
    inviteLink,
  });

  revalidatePath("/admin/invitations");

  return { success: true };
}

export async function deleteInvitation(invitationId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.invitation.delete({
    where: { id: invitationId },
  });

  revalidatePath("/admin/invitations");
}
