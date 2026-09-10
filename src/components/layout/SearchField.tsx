"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/ui/Cover";
import {
  personTypeaheadMeta,
  type PersonSearchHit,
} from "@/lib/search-hits";

export function SearchField({
  defaultValue = "",
  autoFocus = false,
  placeholder = "Search podcasts & people",
  variant = "header",
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
  variant?: "header" | "page";
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<PersonSearchHit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { people?: PersonSearchHit[] };
        const people = data.people ?? [];
        setHits(people);
        setActive(0);
        setOpen(people.length > 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goPerson(hit: PersonSearchHit) {
    setOpen(false);
    router.push(`/people/${hit.slug}`);
  }

  const inputClass =
    variant === "header"
      ? "w-full rounded-full bg-white/5 border border-white/15 px-4 py-2 text-[14px] text-white placeholder:text-white/35 outline-none focus:border-[#007AFF]"
      : "w-full rounded-[16px] bg-white/5 border border-white/15 px-5 py-3.5 text-[16px] text-white placeholder:text-white/35 outline-none focus:border-[#007AFF]";

  return (
    <div ref={rootRef} className="relative">
      <input
        type="search"
        name="q"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        className={inputClass}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (hits.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            goPerson(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && hits.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-[16px] border border-white/10 bg-[#12253A] shadow-lg"
        >
          {hits.map((hit, i) => {
            const meta = personTypeaheadMeta(hit);
            return (
              <li key={hit.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goPerson(hit)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                    i === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <Cover
                    src={hit.image_url}
                    alt={hit.display_name}
                    size="xs"
                    rounded="full"
                    monogram
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold tracking-tight">
                      {hit.display_name}
                    </span>
                    {meta ? (
                      <span className="mt-0.5 block truncate text-[12px] text-white/45">
                        {meta}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
