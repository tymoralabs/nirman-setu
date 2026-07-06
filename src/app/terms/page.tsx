import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to Login
      </Link>

      <h1 className="text-2xl font-bold">Terms and Conditions</h1>
      <p className="text-xs text-muted-foreground">Last updated: July 2026</p>

      <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
        <p>
          Welcome to ALDMS (Architect Liaison Document Management System). By accessing or using our software, you agree to comply with and be bound by these Terms and Conditions.
        </p>

        <h2 className="font-semibold text-foreground mt-4">1. Use of License</h2>
        <p>
          We grant you a non-exclusive, non-transferable, revocable license to access our platform solely for your business operational needs in managing building approvals and client document checklists.
        </p>

        <h2 className="font-semibold text-foreground mt-4">2. Account and Security</h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials. You must immediately notify the platform administrators of any unauthorized use of your account.
        </p>

        <h2 className="font-semibold text-foreground mt-4">3. DPDP Compliance</h2>
        <p>
          As a firm, you are the Data Fiduciary under the Indian DPDP Act 2023. You agree to obtain valid consent from your clients (Data Principals) before uploading any personal documents.
        </p>

        <h2 className="font-semibold text-foreground mt-4">4. Governing Law</h2>
        <p>
          These terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Maharashtra.
        </p>
      </div>
    </div>
  );
}
