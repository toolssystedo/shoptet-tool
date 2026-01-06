"use client";

import { Role } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateUserRole } from "./actions";

interface UserRoleSelectProps {
  userId: string;
  currentRole: Role;
}

export function UserRoleSelect({ userId, currentRole }: UserRoleSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>(currentRole);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    startTransition(async () => {
      await updateUserRole(userId, newRole);
      router.refresh();
    });
  };

  return (
    <Select
      value={role}
      onValueChange={handleRoleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USER">User</SelectItem>
        <SelectItem value="ADMIN">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}