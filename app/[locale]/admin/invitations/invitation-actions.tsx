"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { resendInvitation, deleteInvitation } from "./actions";
import { toast } from "sonner";
import { InvitationStatus } from "@prisma/client";

interface InvitationActionsProps {
  invitationId: string;
  status: InvitationStatus;
}

export function InvitationActions({
  invitationId,
  status,
}: InvitationActionsProps) {
  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleResend() {
    setIsResending(true);
    try {
      await resendInvitation(invitationId);
      toast.success("Invitation resent successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend invitation"
      );
    } finally {
      setIsResending(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteInvitation(invitationId);
      toast.success("Invitation deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete invitation"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status !== "ACCEPTED" && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleResend}
          disabled={isResending}
          title="Resend invitation"
        >
          <RefreshCw
            className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`}
          />
        </Button>
      )}
      <Button
        variant="destructive"
        size="icon"
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete invitation"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
