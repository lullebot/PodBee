/**
 * PodBee (cast.fm) — locked API / DB types v0
 * Source of truth: 001_core_schema.sql + live chart_rankings view
 * Contract for Next.js App Router + Supabase client (no GraphQL, no player).
 * Mirrored from PodBee Database Lead 2026-09-09; chart_rankings columns 2026-09-10.
 */

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // timestamptz

export type CompanyKind = "network" | "studio" | "publisher" | "brand" | "other";
export type PodcastStatus = "active" | "completed" | "hiatus" | "cancelled";
export type PodcastCompanyRole =
  | "network"
  | "studio"
  | "publisher"
  | "distributor"
  | "sponsor";
export type EpisodeType = "full" | "trailer" | "bonus";
export type CreditRoleId =
  | "host"
  | "co_host"
  | "guest"
  | "correspondent"
  | "producer"
  | "executive_producer"
  | "writer"
  | "editor"
  | "narrator";

export interface Company {
  id: UUID;
  slug: string;
  name: string;
  kind: CompanyKind;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Person {
  id: UUID;
  slug: string;
  display_name: string;
  sort_name: string | null;
  bio: string | null;
  image_url: string | null;
  website_url: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Podcast {
  id: UUID;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  explicit: boolean;
  status: PodcastStatus;
  cover_image_url: string | null;
  website_url: string | null;
  rss_url: string | null;
  primary_company_id: UUID | null;
  published_at: ISODate | null;
  rating_average: number | null;
  rating_count: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Genre {
  id: UUID;
  slug: string;
  name: string;
}

export interface Season {
  id: UUID;
  podcast_id: UUID;
  number: number;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  published_at: ISODate | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Episode {
  id: UUID;
  podcast_id: UUID;
  season_id: UUID | null;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  episode_number: number | null;
  episode_type: EpisodeType;
  duration_seconds: number | null;
  explicit: boolean;
  published_at: ISODateTime | null;
  audio_url: string | null;
  cover_image_url: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CreditRole {
  id: CreditRoleId;
  label: string;
  sort_order: number;
}

export interface PodcastCompany {
  podcast_id: UUID;
  company_id: UUID;
  role: PodcastCompanyRole;
}

export interface PodcastCredit {
  id: UUID;
  podcast_id: UUID;
  person_id: UUID;
  role_id: CreditRoleId;
  billing_order: number;
  character_name: string | null;
}

export interface EpisodeCredit {
  id: UUID;
  episode_id: UUID;
  person_id: UUID;
  role_id: CreditRoleId;
  billing_order: number;
  character_name: string | null;
}

export interface PersonCreditRef {
  person: Pick<Person, "id" | "slug" | "display_name" | "image_url">;
  role_id: CreditRoleId;
  role_label: string;
  billing_order: number;
  character_name: string | null;
}

export interface CreditOnWork {
  role_id: CreditRoleId;
  role_label: string;
  billing_order: number;
  character_name: string | null;
  work:
    | {
        kind: "podcast";
        podcast: Pick<
          Podcast,
          "id" | "slug" | "title" | "cover_image_url" | "published_at"
        > & { rating_average?: number | null; rating_count?: number | null };
      }
    | {
        kind: "episode";
        episode: Pick<Episode, "id" | "slug" | "title" | "cover_image_url" | "published_at">;
        podcast: Pick<
          Podcast,
          "id" | "slug" | "title" | "cover_image_url" | "published_at"
        > & { rating_average?: number | null; rating_count?: number | null };
      };
}

export interface EpisodeCard {
  id: UUID;
  episode_slug: string;
  episode_title: string;
  episode_number: number | null;
  episode_type: EpisodeType;
  duration_seconds: number | null;
  published_at: ISODateTime | null;
  episode_cover_url: string | null;
  podcast_id: UUID;
  podcast_slug: string;
  podcast_title: string;
  podcast_cover_url: string | null;
  season_number: number | null;
  season_title: string | null;
}

export interface SimilarPodcast {
  id: UUID;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  status: PodcastStatus;
  shared_genre_name?: string | null;
}

export interface ChartPlacement {
  chart_slug: string;
  chart_title: string;
  rank: number;
}

export interface PodcastDetail {
  podcast: Podcast;
  primary_company: Company | null;
  companies: Array<Company & { role: PodcastCompanyRole }>;
  genres: Genre[];
  chart_placements: ChartPlacement[];
  seasons: Season[];
  episode_cards: EpisodeCard[];
  episode_total: number;
  first_published_at: ISODateTime | null;
  latest_published_at: ISODateTime | null;
  credits: PersonCreditRef[];
  similar: SimilarPodcast[];
}

export interface EpisodeDetail {
  episode: Episode;
  podcast: Pick<
    Podcast,
    | "id"
    | "slug"
    | "title"
    | "subtitle"
    | "cover_image_url"
    | "explicit"
    | "language"
    | "status"
  >;
  season: Season | null;
  credits: PersonCreditRef[];
}

export interface PersonDetail {
  person: Person;
  credits: CreditOnWork[];
}

export interface CompanyDetail {
  company: Company;
  podcasts: Array<
    Pick<
      Podcast,
      "id" | "slug" | "title" | "cover_image_url" | "status" | "primary_company_id"
    > & { role: PodcastCompanyRole | "primary" }
  >;
}

/** Discovery charts (IMDb-style) — Sprint 1.1 */
export type ChartKind = "overall" | "genre" | "format";

export interface Chart {
  id: UUID;
  slug: string;
  title: string;
  kind: ChartKind;
  genre_slug: string | null;
  description: string | null;
}

/**
 * Live `chart_rankings` view row.
 * Score columns stay null until Pipeline backfill; company + episode_count
 * are denormalized on the view (no client-side join).
 */
export interface ChartRankingRow {
  chart_slug: string;
  chart_title: string;
  chart_type: ChartKind | string;
  genre_slug: string | null;
  genre_name: string | null;
  rank: number;
  score: number | null;
  snapshot_at: ISODateTime | null;
  podcast_id: UUID;
  podcast_slug: string;
  podcast_title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  status: PodcastStatus;
  primary_company_name: string | null;
  primary_company_slug: string | null;
  episode_count: number | null;
  podbee_score: number | null;
  trend_score: number | null;
  freshness_score: number | null;
  volume_score: number | null;
  score_updated_at: ISODateTime | null;
}

/** Exact UI copy for the catalog popularity score — never a user ★ rating. */
export const PODBEE_SCORE_LABEL = "PodBee Score (popularity + activity)";

export interface ChartPodcastSummary {
  id: UUID;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  status: PodcastStatus;
  primary_company_name: string | null;
  primary_company_slug: string | null;
  rating_average: number | null;
  rating_count: number | null;
  episode_count: number | null;
  podbee_score: number | null;
  trend_score: number | null;
  freshness_score: number | null;
  volume_score: number | null;
  score_updated_at: ISODateTime | null;
}

export interface ChartEntry {
  rank: number;
  podcast: ChartPodcastSummary;
}

export interface ChartBoard {
  chart: Chart;
  entries: ChartEntry[];
}
