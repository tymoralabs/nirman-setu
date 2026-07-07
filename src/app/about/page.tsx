import Link from "next/link";
import { ArrowLeft, Landmark, FileCheck2, ShieldAlert, HeartHandshake } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between max-w-7xl w-full mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg hover:opacity-90">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            N
          </div>
          <span>{APP_NAME}</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/95"
        >
          Sign In
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" /> Back to Home
        </Link>

        {/* Hero title */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950">
            About {APP_NAME}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl">
            A specialized B2B document coordination platform designed to simplify, automate, and secure the municipal clearance process for Indian construction projects.
          </p>
        </div>

        <hr className="border-slate-200" />

        {/* The Problem & Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <Landmark className="size-5 text-primary" /> The Liaison Challenge
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Securing building sanctions from local municipal corporations (like BMC, PMC, or local town planning departments) is a major bottleneck in Indian real estate. Liaison consultants must compile dozens of complex documents (zoning permits, Non-Agricultural orders, title certificates, and blueprints). 
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Historically, this meant hundreds of unorganized emails, mismatched blueprints over WhatsApp, lost files, and constant back-and-forth phone calls with clients.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" /> The {APP_NAME} Solution
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {APP_NAME} provides a structured workspace where the liaison firm acts as the reviewer and the client acts as the provider. Firms set up checklists, while clients upload documents via a simple, mobile-friendly portal.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              By replacing chaotic communication channels with transparent approval tracking, real-time feedback, and automated reminders, {APP_NAME} reduces the document gathering phase by up to 60%.
            </p>
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Core Pillars */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-950">Key Platform Strengths</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-950 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" /> Bilingual & Mobile-First
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Supports English and Hindi localizations to accommodate developers and property owners of all backgrounds. Features progressive photo scanning and automatic server-side PDF generation.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-950 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" /> DPDP Compliance Built-In
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fully compliant with India&apos;s Digital Personal Data Protection (DPDP) Act 2023. Allows clients to download a complete export of their documents or request permanent data erasure.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-950 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" /> Secure Watermarking
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Protects sensitive blueprints and certificates by automatically embedding custom dynamic watermarks containing the project ID and download timestamp on every document retrieve.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-950 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" /> Billing & GST Support
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Calculates precise CGST/SGST/IGST tax breakdowns for Indian firms (based on regional state laws) and generates fully compliant Tax Invoices dynamically.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground p-8 rounded-2xl text-center space-y-6 shadow-lg shadow-primary/10">
          <h2 className="text-2xl font-bold">Ready to streamline your approval workflows?</h2>
          <p className="text-sm opacity-90 max-w-xl mx-auto">
            Join firms using {APP_NAME} to track clearances, coordinate with clients, and push projects through municipal gates faster.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-8 text-sm font-bold text-primary shadow hover:bg-slate-50 transition-colors"
            >
              Start Your Free Trial
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-semibold text-slate-900">{APP_NAME}</span>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-primary transition-colors">Refunds & Cancellation</Link>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
