"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await resetPasswordAction({ token, password });
      if (res.ok) {
        toast.success("Password updated. Sign in with your new password.");
        router.push("/login");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
