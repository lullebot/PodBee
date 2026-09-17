"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export function ListenListButton({
  action,
  initialInList,
  signedIn,
  label = "Listen List",
}: {
  action: (wasInList: boolean) => Promise<void>;
  initialInList: boolean;
  signedIn: boolean;
  label?: string;
}) {
  const [inList, setInList] = useState(initialInList);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:border-[#007AFF] hover:text-white"
      >
        + Add to {label}
      </Link>
    );
  }

  function handleClick() {
    const wasInList = inList;
    setInList(!wasInList);
    setError(null);
    startTransition(async () => {
      try {
        await action(wasInList);
      } catch (e) {
        setInList(wasInList);
        setError(e instanceof Error ? e.message : "Could not update your Listen List.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
          inList
            ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
            : "border-white/15 text-white/70 hover:border-[#007AFF] hover:text-white"
        }`}
      >
        {inList ? `✓ In ${label}` : `+ Add to ${label}`}
      </button>
      {error ? <p className="mt-1 text-[12px] text-red-400">{error}</p> : null}
    </div>
  );
}
