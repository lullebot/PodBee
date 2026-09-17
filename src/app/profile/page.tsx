import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { getCurrentUser } from "@/lib/auth";
import { getMyRatedEpisodes, getMyRatedPodcasts } from "@/lib/ratings";
import { getMyListenListEpisodes, getMyListenListShows } from "@/lib/listen-list";

export default async function ProfilePage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }

  const [ratedPodcasts, ratedEpisodes, listenListShows, listenListEpisodes] =
    await Promise.all([
      getMyRatedPodcasts(current.id),
      getMyRatedEpisodes(current.id),
      getMyListenListShows(current.id),
      getMyListenListEpisodes(current.id),
    ]);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white">
        <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
          <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
            Profile
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            {current.profile?.display_name?.trim() ||
              current.profile?.username ||
              "Your account"}
          </h1>
          {current.profile?.username ? (
            <p className="mt-3 text-lg text-white/55 leading-snug">
              @{current.profile.username}
            </p>
          ) : null}

          <ProfileTabs
            ratedPodcasts={ratedPodcasts}
            ratedEpisodes={ratedEpisodes}
            listenListShows={listenListShows}
            listenListEpisodes={listenListEpisodes}
          />
        </div>
      </main>
    </>
  );
}
