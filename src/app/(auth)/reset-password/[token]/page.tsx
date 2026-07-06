import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isResetTokenValid } from "@/services/users.service";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        {valid ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Reset password</CardTitle>
              <CardDescription>
                Choose a new password (minimum 10 characters).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm token={token} />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">Link not valid</CardTitle>
              <CardDescription>
                This reset link is invalid, already used, or has expired (links
                last 1 hour). Request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-x-4">
              <Link
                href="/forgot-password"
                className="text-sm text-primary underline"
              >
                Request new link
              </Link>
              <Link
                href="/login"
                className="text-sm text-muted-foreground underline"
              >
                Sign in
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
