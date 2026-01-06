"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendInvitation } from "./actions";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Role } from "@prisma/client";

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    setIsLoading(true);
    try {
      await sendInvitation(email, role);
      toast.success("Invitation sent successfully");
      setEmail("");
      setRole("USER");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        placeholder="Enter email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="max-w-sm"
      />
      <Select value={role} onValueChange={(value: Role) => setRole(value)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USER">User</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isLoading}>
        <Mail className="mr-2 h-4 w-4" />
        {isLoading ? "Sending..." : "Send Invitation"}
      </Button>
    </form>
  );
}
