"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/onboarding");
  }

  async function handleOAuth(providerName: "google" | "apple") {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerName,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-pine text-sm font-bold text-white">
          B
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Join BridgeLink</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The verified network of the US–Nepal corridor.
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-mist"
        >
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth("apple")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-mist"
        >
          Continue with Apple
        </button>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">Email or phone</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>
        {error ? <p className="text-sm text-rhodo">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-pine hover:text-pine-ink">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-soft">
        You can browse right away. Posting and messaging unlock once you verify your
        profile.
      </p>
    </div>
  );
}
