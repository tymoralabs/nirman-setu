import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInviteByToken } from "@/services/users.service";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        {invite ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Welcome, {invite.name}</CardTitle>
              <CardDescription>
                Set a password for {invite.email} to activate your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptInviteForm token={token} />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Invite not valid</CardTitle>
              <CardDescription>
                This invite link is invalid, already used, or has expired
                (links last 24 hours). Ask your firm admin to send a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login" className="text-sm text-primary underline">
                Go to sign in
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
