import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvitationEmail({
  email,
  inviterName,
  inviteLink,
}: {
  email: string;
  inviterName: string;
  inviteLink: string;
}) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Shoptet Tool <onboarding@resend.dev>",
    to: email,
    subject: "You've been invited to Shoptet Tool",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p>${inviterName} has invited you to join Shoptet Tool.</p>
        <p>Click the button below to accept the invitation and create your account:</p>
        <a href="${inviteLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px;">
          This invitation will expire in 7 days.
        </p>
        <p style="color: #666; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
