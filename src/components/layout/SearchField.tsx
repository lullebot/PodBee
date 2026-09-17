"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/ui/Cover";
import {
  episodeHref,
  episodeSearchSubtitle,
  personTypeaheadMeta,
  type EpisodeSearchHit,
  type PersonSearchHit,
  type TypeaheadHit,
} from "@/lib/search-hits";

export function SearchField({
  defaultValue = "",
  autoFocus = false,
  placeholder = "Search podcasts, people & episodes",
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
  const [people, setPeople] = useState<PersonSearchHit[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeSearchHit[]>([]);
  const [active, setActive] = useState(0);

  const items: TypeaheadHit[] = [...episodes, ...people];

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setPeople([]);
      setEpisodes([]);
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
        const data = (await res.json()) as {
          people?: PersonSearchHit[];
          episodes?: EpisodeSearchHit[];
        };
        const nextPeople = data.people ?? [];
        const nextEpisodes = data.episodes ?? [];
        setPeople(nextPeople);
        setEpisodes(nextEpisodes);
        setActive(0);
        setOpen(nextPeople.length > 0 || nextEpisodes.length > 0);
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

  function goHit(hit: TypeaheadHit) {
    setOpen(false);
    router.push(hit.kind === "person" ? `/people/${hit.slug}` : episodeHref(hit));
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
          if (items.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + items.length) % items.length);
          } else if (e.key === "Enter" && items[active]) {
            e.preventDefault();
            goHit(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && items.length > 0 ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[16px] border border-white/15 bg-[#0F2033] shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          <ul id={listId} role="listbox">
            {episodes.length > 0 ? (
              <li
                role="presentation"
                className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-white/40"
              >
                Episodes
              </li>
            ) : null}
            {episodes.map((hit, i) => {
              const meta = episodeSearchSubtitle(hit);
              return (
                <li key={hit.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goHit(hit)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                      i === active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <Cover src={hit.cover_image_url} alt={hit.episode_title} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold tracking-tight">
                        {hit.episode_title}
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
            {people.length > 0 ? (
              <li
                role="presentation"
                className={`px-3.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-white/40 ${
                  episodes.length > 0 ? "pt-2" : "pt-2.5"
                }`}
              >
                People
              </li>
            ) : null}
            {people.map((hit, i) => {
              const index = episodes.length + i;
              const meta = personTypeaheadMeta(hit);
              return (
                <li key={hit.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => goHit(hit)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                      index === active ? "bg-white/10" : "hover:bg-white/5"
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
        </div>
      ) : null}
    </div>
  );
}
