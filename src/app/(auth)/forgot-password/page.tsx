"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await forgotPasswordAction({ email });
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot password</CardTitle>
          <CardDescription>
            For architect and staff accounts. Clients sign in with phone + OTP
            — no password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm">
                If an account exists for <strong>{email}</strong>, we emailed a
                reset link. It expires in 1 hour.
              </p>
              <Link href="/login" className="text-sm text-primary underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
