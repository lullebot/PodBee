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

/** Pipeline org list + known company-as-person leaks (Higher Ground, …). */
const ORG_EXACT = new Set([
  "npr",
  "bbc",
  "wnyc",
  "wbez",
  "nyt",
  "nbc",
  "wsj",
  "iheart",
  "spotify",
  "wondery",
  "gimlet",
  "earwolf",
  "audiochuck",
  "team coco",
  "team coco & earwolf",
  "exactly right",
  "serial productions",
  "serial productions & the new york times",
  "the new york times",
  "new york times",
  "wnyc studios",
  "nbc news",
  "vox media",
  "crooked media",
  "iheartpodcasts",
  "iheart podcasts",
  "this american life",
  "serial",
  "the daily",
  "npr news now",
  "audacy",
  "stitcher",
  "audioboom",
  "megaphone",
  "acast",
  "simplecast",
  "wbez chicago",
  "hidden brain media",
  "casefile presents",
  "freakonomics radio",
  "the moth",
  "pod save america",
  "higher ground",
  "siriusxm",
  "sirius xm",
  "maximum fun",
  "cooler heads",
  "bryan broadcasting",
  "new york post",
]);

const ORG_FRAGMENTS = [
  "podcast",
  "studios",
  "network",
  "productions",
  "presents",
  "llc",
  "inc.",
  "incorporated",
  "media",
  "radio hour",
  "news now",
  "broadcasting",
  "commission",
];

const ORG_LAST_WORDS = new Set([
  "radio",
  "media",
  "presents",
  "network",
  "studios",
  "productions",
  "show",
  "hour",
  "commissions",
  "commission",
  "broadcasting",
  "producer",
  "producers",
  "company",
]);

/** First+last (or Conan / J.R.) — pipeline looks_like_person. */
const PERSON_NAME =
  /^(?:[A-Z]\.|[A-Z][A-Za-z'’-]+)(?:\s+(?:[A-Z]\.|[A-Z][A-Za-z'’-]+)){0,3}$/;

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

function foldName(name: string): string {
  let n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n.startsWith("the ")) n = n.slice(4);
  return n;
}

function slugKey(name: string): string {
  return foldName(name)
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function companyKeySet(companyNames: Iterable<string>): Set<string> {
  const keys = new Set<string>();
  for (const company of companyNames) {
    const folded = foldName(company);
    if (folded) keys.add(folded);
    const slug = slugKey(company);
    if (slug) keys.add(slug);
  }
  return keys;
}

/** Skip company names credited as people (table match, either name or slug). */
export function isCompanyName(
  name: string,
  companyNames: Iterable<string>
): boolean {
  const n = foldName(name);
  if (!n) return true;
  const keys = companyKeySet(companyNames);
  return keys.has(n) || keys.has(slugKey(name));
}

/** Pipeline looks_like_org — works even if companies rows are not loaded yet. */
export function looksLikeOrg(name: string): boolean {
  const n = foldName(name);
  if (!n) return true;
  if (ORG_EXACT.has(n)) return true;
  if (ORG_FRAGMENTS.some((frag) => n.includes(frag))) return true;
  const parts = n.split(" ");
  const last = parts[parts.length - 1];
  if (last && ORG_LAST_WORDS.has(last)) return true;
  if (/^w[a-z]{2,3}\b/.test(n) && parts.length <= 3) return true;
  const raw = name.trim();
  if (!raw.includes(" ") && raw === raw.toUpperCase() && raw.length >= 2 && raw.length <= 6) {
    return true;
  }
  return false;
}

export function looksLikePerson(name: string): boolean {
  const cleaned = name.trim().replace(/\u2019/g, "'").replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "");
  if (!cleaned || looksLikeOrg(cleaned)) return false;
  if (/\d/.test(cleaned)) return false;
  return PERSON_NAME.test(cleaned);
}

/**
 * Hide non-people either way: companies table match OR org/person heuristics.
 * Strict — company-as-person leaks (Higher Ground) stay hidden until SQL cleanup.
 */
export function isNonPersonName(
  name: string,
  companyNames: Iterable<string> = []
): boolean {
  if (!name.trim()) return true;
  if (isCompanyName(name, companyNames)) return true;
  if (looksLikeOrg(name)) return true;
  if (!looksLikePerson(name)) return true;
  return false;
}

/**
 * One row per person. Hosts first, then guests by appearance count.
 */
export function buildTitleCast(
  credits: TitleCastCredit[],
  companyNames: Iterable<string> = []
): TitleCastMember[] {
  const byPerson = new Map<string, TitleCastCredit[]>();
  for (const c of credits) {
    if (!c.person?.id) continue;
    if (isNonPersonName(c.person.display_name, companyNames)) continue;
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
