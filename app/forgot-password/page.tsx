import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),_transparent_35%)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-400">Enter your email and we will guide you through the recovery process.</p>

        <div className="mt-6">
          <label className="mb-2 block text-sm text-slate-300">Email</label>
          <input className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white" placeholder="you@example.com" />
        </div>

        <button type="button" className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
          Send reset link
        </button>

        <p className="mt-4 text-sm text-slate-400">
          <Link href="/login" className="text-cyan-300 hover:text-cyan-200">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
