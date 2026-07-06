import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function RefundsPage() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Login
      </Link>

      <h1 className="text-2xl font-bold">Refund and Cancellation Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: July 2026</p>

      <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
        <p>
          We want you to be satisfied with our software service. Please read our refund policy below:
        </p>

        <h2 className="font-semibold text-foreground mt-4">1. Subscription Cancellation</h2>
        <p>
          You can cancel your subscription plan at any time through the billing dashboard. Your active plan will remain functional until the end of the current billing cycle.
        </p>

        <h2 className="font-semibold text-foreground mt-4">2. Refund Eligibility</h2>
        <p>
          Since we offer a 30-day free trial on registration to let you evaluate the features fully, we generally do not offer refunds once a paid subscription begins. However, exceptions can be made for duplicate transactions.
        </p>

        <h2 className="font-semibold text-foreground mt-4">3. Contact Support</h2>
        <p>
          For billing questions, please reach out to our grievance officer via the email listed on your firm settings page.
        </p>
      </div>
    </div>
  );
}
