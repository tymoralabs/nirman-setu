"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ClientStep = "phone" | "code" | "picker";

interface Account {
  userId: string;
  firmName: string;
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export default function LoginPage() {
  const router = useRouter();

  // staff state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);

  // client state
  const [step, setStep] = useState<ClientStep>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clientError, setClientError] = useState("");
  const [clientBusy, setClientBusy] = useState(false);

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setStaffError("");
    setStaffBusy(true);
    const res = await signIn("staff", { email, password, redirect: false });
    setStaffBusy(false);
    if (res?.error) {
      setStaffError("Incorrect email or password.");
      return;
    }
    router.push("/after-login");
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setClientError("");
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setClientError("Enter a valid 10-digit mobile number.");
      return;
    }
    setClientBusy(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    });
    setClientBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setClientError(
        data.error === "cooldown"
          ? "Please wait 30 seconds before requesting another code."
          : data.error === "rate_limited"
            ? "Too many attempts. Try again in 15 minutes."
            : "Could not send the code. Check the number and try again."
      );
      return;
    }
    setPhone(normalized);
    setStep("code");
  }

  async function completeLogin(chosenTicket: string, userId: string) {
    const res = await signIn("client-otp", {
      ticket: chosenTicket,
      userId,
      redirect: false,
    });
    if (res?.error) {
      setClientError("Login failed. Please try again.");
      setStep("phone");
      return;
    }
    router.push("/after-login");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setClientError("");
    setClientBusy(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json().catch(() => ({}));
    setClientBusy(false);

    if (!res.ok) {
      setClientError(
        data.error === "no_account"
          ? "No account found for this number. Ask your architect to add you."
          : data.error === "too_many_attempts"
            ? "Too many wrong attempts. Request a new code."
            : data.error === "expired"
              ? "Code expired. Request a new one."
              : "Incorrect code. Please try again."
      );
      return;
    }

    if (data.accounts.length === 1) {
      setClientBusy(true);
      await completeLogin(data.ticket, data.accounts[0].userId);
      setClientBusy(false);
    } else {
      setTicket(data.ticket);
      setAccounts(data.accounts);
      setStep("picker");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Document collection portal for architecture firms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="client">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="staff">Architect / Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="mt-4 space-y-4">
              {step === "phone" && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Mobile number</Label>
                    <div className="flex gap-2">
                      <span className="flex h-12 items-center rounded-md border px-3 text-sm text-muted-foreground">
                        +91
                      </span>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="98765 43210"
                        className="h-12 text-lg"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="h-12 w-full text-base" disabled={clientBusy}>
                    {clientBusy ? "Sending…" : "Send OTP"}
                  </Button>
                </form>
              )}

              {step === "code" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to {phone}
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    className="h-12 text-center text-2xl tracking-[0.5em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                  <Button type="submit" className="h-12 w-full text-base" disabled={clientBusy || code.length !== 6}>
                    {clientBusy ? "Verifying…" : "Verify & Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setClientError("");
                    }}
                  >
                    Change number / resend
                  </Button>
                </form>
              )}

              {step === "picker" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your number is registered with more than one firm. Choose
                    which account to open:
                  </p>
                  {accounts.map((a) => (
                    <Button
                      key={a.userId}
                      variant="outline"
                      className="h-12 w-full justify-start text-base"
                      disabled={clientBusy}
                      onClick={async () => {
                        setClientBusy(true);
                        await completeLogin(ticket, a.userId);
                        setClientBusy(false);
                      }}
                    >
                      Continue as client of {a.firmName}
                    </Button>
                  ))}
                </div>
              )}

              {clientError && (
                <p className="text-sm text-destructive">{clientError}</p>
              )}
            </TabsContent>

            <TabsContent value="staff" className="mt-4">
              <form onSubmit={handleStaffLogin} className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {staffError && (
                  <p className="text-sm text-destructive">{staffError}</p>
                )}
                <Button type="submit" className="w-full" disabled={staffBusy}>
                  {staffBusy ? "Signing in…" : "Sign in"}
                </Button>
                <a
                  href="/forgot-password"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </a>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
