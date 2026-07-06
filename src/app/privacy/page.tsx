import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Login
      </Link>

      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: July 2026</p>

      <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
        <p>
          At {APP_NAME}, we respect the privacy of our users. This Privacy Policy explains how we collect, store, and process your personal and business data.
        </p>

        <h2 className="font-semibold text-foreground mt-4">1. Data Collected</h2>
        <p>
          We store document files uploaded to checklist items (such as NA Orders, Land Records, blueprints), project assignments, usernames, email addresses, and phone numbers.
        </p>

        <h2 className="font-semibold text-foreground mt-4">2. DPDP Act 2023</h2>
        <p>
          We comply fully with the Digital Personal Data Protection Act (DPDP Act) of India. We support client rights to access their data via "Export Profile" and permanently request deletion via "Erase Profile".
        </p>

        <h2 className="font-semibold text-foreground mt-4">3. Data Location</h2>
        <p>
          All databases and storage are hosted locally in secure cloud servers located within the territory of India to satisfy sovereign localization regulations.
        </p>
      </div>
    </div>
  );
}
