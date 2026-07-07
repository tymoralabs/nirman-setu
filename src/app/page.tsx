import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Languages, FolderSync, Receipt } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            N
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">NirmanSetu</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            About
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/95"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col justify-center items-center text-center px-6 py-20 max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
          <ShieldCheck className="size-3.5" /> DPDP Compliant B2B SaaS
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-950 leading-tight">
          The Collaborative Bridge for <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
            Architectural Liaisoning
          </span>
        </h1>

        <p className="max-w-2xl text-lg text-slate-600 leading-relaxed">
          NirmanSetu bridges the gap between liaison consultants, architects, and land developers. Collect, verify, and track municipal clearance documents with structured checklists and bilingual client portals.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/95 hover:translate-y-[-1px]"
          >
            Start 30-Day Free Trial
            <ArrowRight className="ml-2 size-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-8 text-base font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:translate-y-[-1px]"
          >
            Learn More
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 w-full text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FolderSync className="size-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-950">Structured Checklists</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Define document milestones (NA orders, Zoning reports, fire NOCs). Approve, reject with notes, or waive requirements dynamically.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Languages className="size-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-950">Bilingual Client Portal</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mobile-first web portal in English and Hindi. Clients upload blueprints, reply to comments, or take multi-photo document scans.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="size-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-950">DPDP Compliance</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Respect client rights with local data sovereignty in India, complete data export archives, and secure erasure options.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              N
            </div>
            <span className="font-semibold text-slate-900">NirmanSetu</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
            <Link href="/about" className="hover:text-primary transition-colors">About</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-primary transition-colors">Refunds & Cancellation</Link>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} NirmanSetu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
