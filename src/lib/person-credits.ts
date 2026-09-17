import type { CreditOnWork, CreditRoleId } from "@/lib/types";

/** Group long episode filmographies under show subheads at this size. */
export const LONG_EPISODE_LIST = 8;

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

const ROLE_SORT: Record<CreditRoleId, number> = {
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

export type CreditPodcast = Extract<
  CreditOnWork["work"],
  { kind: "podcast" }
>["podcast"];

export type PersonShowRow = {
  podcast: CreditPodcast;
  /** Preferred labels for the Shows row (show-level credits, else episode roles). */
  roles: Array<{ role_id: CreditRoleId; role_label: string }>;
  /** Every role on this show — used by role chips. */
  roleIds: CreditRoleId[];
  episodeCount: number;
};

export type EpisodeShowGroup = {
  podcast: CreditPodcast;
  credits: CreditOnWork[];
};

function sortRoles<T extends { role_id: CreditRoleId }>(roles: T[]): T[] {
  return roles.slice().sort(
    (a, b) => (ROLE_SORT[a.role_id] ?? 999) - (ROLE_SORT[b.role_id] ?? 999)
  );
}

function addUniqueRole(
  list: Array<{ role_id: CreditRoleId; role_label: string }>,
  role_id: CreditRoleId,
  role_label: string
) {
  if (!list.some((r) => r.role_id === role_id)) {
    list.push({ role_id, role_label });
  }
}

/** IMDb-style profession line from credited roles. */
export function professionFromRoles(credits: CreditOnWork[]): string | null {
  const byId = new Map<CreditRoleId, string>();
  for (const c of credits) {
    if (!byId.has(c.role_id)) byId.set(c.role_id, c.role_label);
  }
  if (byId.size === 0) return null;
  return [...byId.entries()]
    .sort((a, b) => (ROLE_SORT[a[0]] ?? 999) - (ROLE_SORT[b[0]] ?? 999))
    .map(([, label]) => label)
    .join(", ");
}

function creditTime(c: CreditOnWork): number | null {
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

/**
 * Unique shows this person is on, with episode_credits counted per podcast.
 * Sorted by most episode credits first.
 */
export function personShowRows(credits: CreditOnWork[]): PersonShowRow[] {
  const byId = new Map<
    string,
    PersonShowRow & {
      showRoles: Array<{ role_id: CreditRoleId; role_label: string }>;
      episodeRoles: Array<{ role_id: CreditRoleId; role_label: string }>;
    }
  >();

  const ensure = (podcast: CreditPodcast) => {
    let row = byId.get(podcast.id);
    if (!row) {
      row = {
        podcast,
        roles: [],
        roleIds: [],
        episodeCount: 0,
        showRoles: [],
        episodeRoles: [],
      };
      byId.set(podcast.id, row);
    } else if (!row.podcast.cover_image_url && podcast.cover_image_url) {
      row.podcast = { ...row.podcast, cover_image_url: podcast.cover_image_url };
    }
    return row;
  };

  for (const c of credits) {
    const row = ensure(c.work.podcast);
    if (!row.roleIds.includes(c.role_id)) row.roleIds.push(c.role_id);
    if (c.work.kind === "episode") {
      row.episodeCount += 1;
      addUniqueRole(row.episodeRoles, c.role_id, c.role_label);
    } else {
      addUniqueRole(row.showRoles, c.role_id, c.role_label);
    }
  }

  const rows: PersonShowRow[] = [];
  for (const row of byId.values()) {
    const display = row.showRoles.length > 0 ? row.showRoles : row.episodeRoles;
    rows.push({
      podcast: row.podcast,
      roles: sortRoles(display),
      roleIds: row.roleIds,
      episodeCount: row.episodeCount,
    });
  }

  return rows.sort((a, b) => {
    if (b.episodeCount !== a.episodeCount) return b.episodeCount - a.episodeCount;
    return a.podcast.title.localeCompare(b.podcast.title);
  });
}

export function showMatchesRoleFilter(
  row: PersonShowRow,
  filter: string
): boolean {
  if (filter === "all") return true;
  const chip = ROLE_CHIPS.find((x) => x.id === filter);
  if (!chip?.roles) return true;
  return row.roleIds.some((id) => chip.roles!.includes(id));
}

export function showRowMeta(row: PersonShowRow): string | null {
  const role = row.roles.map((r) => r.role_label).join(" · ");
  const eps =
    row.episodeCount > 0
      ? `${row.episodeCount} episode${row.episodeCount === 1 ? "" : "s"}`
      : null;
  const parts = [role || null, eps].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function roleLine(c: CreditOnWork): string {
  return c.character_name
    ? `${c.role_label} · as ${c.character_name}`
    : c.role_label;
}

export function matchesRoleFilter(
  credit: CreditOnWork,
  filter: string
): boolean {
  if (filter === "all") return true;
  const chip = ROLE_CHIPS.find((x) => x.id === filter);
  return chip?.roles?.includes(credit.role_id) ?? false;
}

/** Group episode credits under shows, most credits first; episodes newest first. */
export function groupEpisodesByShow(
  credits: CreditOnWork[]
): EpisodeShowGroup[] {
  const byId = new Map<string, EpisodeShowGroup>();
  for (const c of credits) {
    if (c.work.kind !== "episode") continue;
    const id = c.work.podcast.id;
    const existing = byId.get(id);
    if (existing) existing.credits.push(c);
    else {
      byId.set(id, { podcast: c.work.podcast, credits: [c] });
    }
  }
  return [...byId.values()]
    .map((g) => ({ ...g, credits: newestFirst(g.credits) }))
    .sort((a, b) => {
      if (b.credits.length !== a.credits.length) {
        return b.credits.length - a.credits.length;
      }
      return a.podcast.title.localeCompare(b.podcast.title);
    });
}

export function episodeCreditCount(credits: CreditOnWork[]): number {
  return credits.filter((c) => c.work.kind === "episode").length;
}

export function roleChipsFor(credits: CreditOnWork[]) {
  return ROLE_CHIPS.filter((chip) => {
    if (chip.roles == null) return true;
    return credits.some((c) => chip.roles!.includes(c.role_id));
  });
}
