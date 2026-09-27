import type { InputHTMLAttributes } from "react";

export function AuthField({
  label,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-white/65">
      {label}
      <input
        {...input}
        className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#007AFF]"
      />
    </label>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-wide text-white/35">
      <span className="h-px flex-1 bg-white/10" />
      or
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export function AuthNotice({ error, message }: { error?: string; message?: string }) {
  return (
    <>
      {message ? (
        <p className="mt-5 rounded-xl bg-[#007AFF]/10 px-4 py-3 text-[13px] text-[#007AFF]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
