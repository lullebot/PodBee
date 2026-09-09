/**
 * PodBee (cast.fm) — locked API / DB types v0
 * Source of truth: 001_core_schema.sql
 * Contract for Next.js App Router + Supabase client (no GraphQL, no player).
 * Mirrored from PodBee Database Lead 2026-09-09.
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
  created_at: ISODateTime;
  updated_at: ISODateTime;
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
    | { kind: "podcast"; podcast: Pick<Podcast, "id" | "slug" | "title" | "cover_image_url"> }
    | {
        kind: "episode";
        episode: Pick<Episode, "id" | "slug" | "title" | "cover_image_url" | "published_at">;
        podcast: Pick<Podcast, "id" | "slug" | "title" | "cover_image_url">;
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

export interface PodcastDetail {
  podcast: Podcast;
  primary_company: Company | null;
  companies: Array<Company & { role: PodcastCompanyRole }>;
  seasons: Season[];
  episode_cards: EpisodeCard[];
  credits: PersonCreditRef[];
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
