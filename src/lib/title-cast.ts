import type {
  CreditRoleId,
  PersonCreditRef,
  TitleCastMember,
} from "@/lib/types";
import { ROLE_SORT } from "@/lib/person-credits";

/** Title-page Top cast preview; remainder behind See all cast. */
export const TITLE_CAST_PREVIEW = 6;

/** Episode list initial rows; remainder behind Show more. */
export const TITLE_EPISODE_PREVIEW = 25;

export type TitleCastCredit = PersonCreditRef & {
  /** Set for episode_credits; null for show-level podcast_credits. */
  episode_id: string | null;
};

export type { TitleCastMember };

const HOST_ROLES = new Set<CreditRoleId>(["host", "co_host"]);

function roleRank(id: CreditRoleId): number {
  return ROLE_SORT[id] ?? 100;
}

function uniqueRoleLabels(credits: TitleCastCredit[]): string {
  const seen = new Map<CreditRoleId, string>();
  for (const c of credits) {
    if (!seen.has(c.role_id)) seen.set(c.role_id, c.role_label);
  }
  return [...seen.entries()]
    .sort((a, b) => roleRank(a[0]) - roleRank(b[0]))
    .map(([, label]) => label)
    .join(", ");
}

function pickPrimary(group: TitleCastCredit[]): TitleCastCredit {
  const [primary] = group.slice().sort((a, b) => {
    const hostDelta =
      (HOST_ROLES.has(b.role_id) ? 1 : 0) - (HOST_ROLES.has(a.role_id) ? 1 : 0);
    if (hostDelta !== 0) return hostDelta;
    const rank = roleRank(a.role_id) - roleRank(b.role_id);
    if (rank !== 0) return rank;
    return a.billing_order - b.billing_order;
  });
  if (!primary) {
    throw new Error("pickPrimary requires at least one credit");
  }
  return primary;
}

/** Skip company names credited as people (podcast_credits / episode_credits only). */
export function isCompanyName(
  name: string,
  companyNames: Iterable<string>
): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  for (const company of companyNames) {
    if (company.trim().toLowerCase() === n) return true;
  }
  return false;
}

/**
 * One row per person. Hosts (host / co_host) first by billing_order;
 * everyone else by episode appearance count, high to low.
 */
export function buildTitleCast(
  credits: TitleCastCredit[],
  companyNames: Iterable<string> = []
): TitleCastMember[] {
  const byPerson = new Map<string, TitleCastCredit[]>();
  for (const c of credits) {
    if (!c.person?.id) continue;
    if (isCompanyName(c.person.display_name, companyNames)) continue;
    const list = byPerson.get(c.person.id);
    if (list) list.push(c);
    else byPerson.set(c.person.id, [c]);
  }

  const members: TitleCastMember[] = [];
  for (const group of byPerson.values()) {
    const first = group[0];
    if (!first) continue;
    const episodeIds = new Set<string>();
    for (const c of group) {
      if (c.episode_id) episodeIds.add(c.episode_id);
    }
    const primary = pickPrimary(group);
    members.push({
      person: first.person,
      role_id: primary.role_id,
      role_label: uniqueRoleLabels(group),
      billing_order: Math.min(...group.map((c) => c.billing_order)),
      character_name: primary.character_name,
      episode_count: episodeIds.size,
      is_host: group.some((c) => HOST_ROLES.has(c.role_id)),
    });
  }

  return members.sort((a, b) => {
    if (a.is_host !== b.is_host) return a.is_host ? -1 : 1;
    if (b.episode_count !== a.episode_count) {
      return b.episode_count - a.episode_count;
    }
    if (a.billing_order !== b.billing_order) {
      return a.billing_order - b.billing_order;
    }
    return a.person.display_name.localeCompare(b.person.display_name);
  });
}

export function episodeCountLabel(count: number): string {
  return `${count.toLocaleString()} episode${count === 1 ? "" : "s"}`;
}
