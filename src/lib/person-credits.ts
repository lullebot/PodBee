import type { CreditOnWork, CreditRoleId, Podcast } from "@/lib/types";

/** Group long filmography lists once they hit this many episode rows. */
export const LONG_EPISODE_LIST = 8;

export const ROLE_SORT: Record<CreditRoleId, number> = {
  host: 10,
  co_host: 20,
  guest: 30,
  correspondent: 40,
  producer: 50,
  executive_producer: 60,
  writer: 70,
  editor: 80,
  narrator: 90,
};

export const ROLE_CHIPS: Array<{
  id: string;
  label: string;
  roles: CreditRoleId[] | null;
}> = [
  { id: "all", label: "All", roles: null },
  { id: "host", label: "Host", roles: ["host", "co_host"] },
  { id: "guest", label: "Guest", roles: ["guest"] },
  { id: "correspondent", label: "Correspondent", roles: ["correspondent"] },
  { id: "producer", label: "Producer", roles: ["producer", "executive_producer"] },
  { id: "writer", label: "Writer", roles: ["writer"] },
  { id: "editor", label: "Editor", roles: ["editor"] },
  { id: "narrator", label: "Narrator", roles: ["narrator"] },
];

type PodcastRef = Pick<
  Podcast,
  "id" | "slug" | "title" | "cover_image_url" | "published_at"
> & { rating_average?: number | null; rating_count?: number | null };

export type ShowFilmographyRow = {
  podcast: PodcastRef;
  role_id: CreditRoleId;
  role_label: string;
  character_name: string | null;
  episode_count: number;
  role_ids: CreditRoleId[];
};

export type EpisodeShowGroup = {
  podcast: PodcastRef;
  credits: CreditOnWork[];
};

export function creditTime(c: CreditOnWork): number | null {
  const iso =
    c.work.kind === "episode"
      ? c.work.episode.published_at
      : c.work.podcast.published_at;
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function newestFirst(credits: CreditOnWork[]): CreditOnWork[] {
  return credits.slice().sort((a, b) => {
    const ta = creditTime(a);
    const tb = creditTime(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  });
}

export function roleLine(c: {
  role_label: string;
  character_name: string | null;
}): string {
  return c.character_name
    ? `${c.role_label} · as ${c.character_name}`
    : c.role_label;
}

function roleRank(id: CreditRoleId): number {
  return ROLE_SORT[id] ?? 100;
}

function uniqueRoleLabels(credits: CreditOnWork[]): string {
  const seen = new Map<CreditRoleId, string>();
  for (const c of credits) {
    if (!seen.has(c.role_id)) seen.set(c.role_id, c.role_label);
  }
  return [...seen.entries()]
    .sort((a, b) => roleRank(a[0]) - roleRank(b[0]))
    .map(([, label]) => label)
    .join(", ");
}

/** IMDb-style profession line from credited roles. */
export function professionFromRoles(credits: CreditOnWork[]): string | null {
  const label = uniqueRoleLabels(credits);
  return label.length > 0 ? label : null;
}

/** Distinct podcasts across show-level and episode credits. */
export function uniqueShowCount(credits: CreditOnWork[]): number {
  return new Set(credits.map((c) => c.work.podcast.id)).size;
}

export function countEpisodeCredits(credits: CreditOnWork[]): number {
  return credits.filter((c) => c.work.kind === "episode").length;
}

function pickPrimaryRole(credits: CreditOnWork[]): CreditOnWork {
  const showLevel = credits.filter((c) => c.work.kind === "podcast");
  const pool = showLevel.length > 0 ? showLevel : credits;
  const [primary] = pool.slice().sort((a, b) => {
    const rank = roleRank(a.role_id) - roleRank(b.role_id);
    if (rank !== 0) return rank;
    return a.billing_order - b.billing_order;
  });
  if (!primary) {
    throw new Error("pickPrimaryRole requires at least one credit");
  }
  return primary;
}

/**
 * Shows-with-N-eps: one row per podcast, N = episode_credits for that
 * person+podcast. Podcast-only credits still appear (N = 0 omitted in UI).
 * Sorted by most episode credits first.
 */
export function buildShowFilmography(
  credits: CreditOnWork[]
): ShowFilmographyRow[] {
  const byPodcast = new Map<string, CreditOnWork[]>();
  for (const c of credits) {
    const id = c.work.podcast.id;
    const list = byPodcast.get(id);
    if (list) list.push(c);
    else byPodcast.set(id, [c]);
  }

  const rows: ShowFilmographyRow[] = [];
  for (const group of byPodcast.values()) {
    const first = group[0];
    if (!first) continue;
    const primary = pickPrimaryRole(group);
    const showLevel = group.filter((c) => c.work.kind === "podcast");
    rows.push({
      podcast: first.work.podcast,
      role_id: primary.role_id,
      role_label: uniqueRoleLabels(
        showLevel.length > 0 ? showLevel : group
      ),
      character_name: primary.character_name,
      episode_count: group.filter((c) => c.work.kind === "episode").length,
      role_ids: [...new Set(group.map((c) => c.role_id))],
    });
  }

  return rows.sort((a, b) => {
    if (b.episode_count !== a.episode_count) {
      return b.episode_count - a.episode_count;
    }
    return a.podcast.title.localeCompare(b.podcast.title);
  });
}

/** Episode credits grouped under shows, most-credited show first. */
export function groupEpisodeCreditsByShow(
  episodeCredits: CreditOnWork[]
): EpisodeShowGroup[] {
  const byPodcast = new Map<string, EpisodeShowGroup>();
  for (const c of episodeCredits) {
    if (c.work.kind !== "episode") continue;
    const id = c.work.podcast.id;
    const existing = byPodcast.get(id);
    if (existing) existing.credits.push(c);
    else {
      byPodcast.set(id, { podcast: c.work.podcast, credits: [c] });
    }
  }

  return [...byPodcast.values()].sort((a, b) => {
    if (b.credits.length !== a.credits.length) {
      return b.credits.length - a.credits.length;
    }
    return a.podcast.title.localeCompare(b.podcast.title);
  });
}

export function matchesRoleFilter(
  roleId: CreditRoleId,
  filter: string
): boolean {
  if (filter === "all") return true;
  const chip = ROLE_CHIPS.find((x) => x.id === filter);
  return chip?.roles?.includes(roleId) ?? false;
}

export function chipsForCredits(credits: CreditOnWork[]) {
  return ROLE_CHIPS.filter((chip) => {
    if (chip.roles == null) return true;
    return credits.some((c) => chip.roles!.includes(c.role_id));
  });
}
