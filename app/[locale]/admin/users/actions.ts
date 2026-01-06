"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Block, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, newRole: Role) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent deleting yourself
  if (session.user.id === userId) {
    throw new Error("Cannot delete your own account");
  }

  // Delete user (cascade will handle accounts, sessions, permissions)
  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/admin/users");
}

export async function getUserPermissions(userId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const permissions = await prisma.userPermission.findMany({
    where: { userId },
    select: { block: true },
  });

  return permissions.map((p) => p.block);
}

export async function updateUserPermissions(userId: string, blocks: Block[]) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Delete all existing permissions for user
  await prisma.userPermission.deleteMany({
    where: { userId },
  });

  // Create new permissions
  if (blocks.length > 0) {
    await prisma.userPermission.createMany({
      data: blocks.map((block) => ({
        userId,
        block,
      })),
    });
  }

  revalidatePath("/admin/users");
}