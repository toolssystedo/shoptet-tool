import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "./invite-user-form";
import { InvitationActions } from "./invitation-actions";

export default async function InvitationsPage() {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Check for expired invitations and update status
  const now = new Date();
  for (const invitation of invitations) {
    if (invitation.status === "PENDING" && invitation.expiresAt < now) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
  }

  // Refetch after update
  const updatedInvitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invitations</h1>
        <p className="text-muted-foreground">
          Invite new users to join the application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite New User</CardTitle>
          <CardDescription>
            Send an invitation email to add a new user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            All sent invitations and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updatedInvitations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No invitations sent yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updatedInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invitation.status === "PENDING"
                            ? "default"
                            : invitation.status === "ACCEPTED"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invitation.expiresAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {invitation.createdAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <InvitationActions
                        invitationId={invitation.id}
                        status={invitation.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
