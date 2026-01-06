"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { getUserPermissions, updateUserPermissions } from "./actions";
import { toast } from "sonner";
import { Block } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UserPermissionsDialogProps {
  userId: string;
  userName: string | null;
}

const ALL_BLOCKS: { value: Block; label: string }[] = [
  { value: "DASHBOARD", label: "Dashboard" },
  { value: "PROFILE", label: "Profile" },
  { value: "SETTINGS", label: "Settings" },
  { value: "USER_MANAGEMENT", label: "User Management" },
  { value: "INVITATIONS", label: "Invitations" },
];

export function UserPermissionsDialog({
  userId,
  userName,
}: UserPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<Block[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
    }
  }, [isOpen]);

  async function loadPermissions() {
    try {
      const permissions = await getUserPermissions(userId);
      setSelectedBlocks(permissions);
    } catch (error) {
      toast.error("Failed to load permissions");
    }
  }

  function toggleBlock(block: Block) {
    setSelectedBlocks((prev) =>
      prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]
    );
  }

  async function handleSave() {
    setIsLoading(true);
    try {
      await updateUserPermissions(userId, selectedBlocks);
      toast.success("Permissions updated successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to update permissions");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Permissions</DialogTitle>
          <DialogDescription>
            Select which blocks {userName || "this user"} can access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {ALL_BLOCKS.map((block) => (
            <div key={block.value} className="flex items-center space-x-2">
              <Checkbox
                id={block.value}
                checked={selectedBlocks.includes(block.value)}
                onCheckedChange={() => toggleBlock(block.value)}
              />
              <Label htmlFor={block.value} className="cursor-pointer">
                {block.label}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
