import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Card } from "@/components/ui/Card";
import { setMarketingOptIn } from "@/app/actions/community";
import { getCurrentUser } from "@/lib/auth";
import { getMyCommunityMembership } from "@/lib/community";
import { getMyRatedEpisodes, getMyRatedPodcasts } from "@/lib/ratings";
import { getMyListenListEpisodes, getMyListenListShows } from "@/lib/listen-list";

const SIGNUP_METHOD_LABEL: Record<string, string> = {
  email: "email",
  google: "Google",
  apple: "Apple",
};

export default async function ProfilePage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }

  const [membership, ratedPodcasts, ratedEpisodes, listenListShows, listenListEpisodes] =
    await Promise.all([
      getMyCommunityMembership(current.id),
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

          {membership ? (
            <Card className="mt-8 p-5 sm:p-6">
              <p className="text-[13px] text-white/45">Signed in as</p>
              <p className="mt-0.5 text-[15px] font-medium text-white break-all">
                {membership.email}
                <span className="font-normal text-white/45">
                  {" "}
                  · via {SIGNUP_METHOD_LABEL[membership.signup_method] ?? membership.signup_method}
                </span>
              </p>

              <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-medium text-white">PodBee news</p>
                  <p className="mt-0.5 text-[13px] text-white/55">
                    {membership.marketing_opt_in
                      ? "You're subscribed to occasional emails about new features and picks."
                      : "You're not subscribed to PodBee emails."}
                  </p>
                </div>
                <form action={setMarketingOptIn} className="shrink-0">
                  <input
                    type="hidden"
                    name="opt_in"
                    value={membership.marketing_opt_in ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={
                      membership.marketing_opt_in
                        ? "rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
                        : "rounded-full bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                    }
                  >
                    {membership.marketing_opt_in ? "Unsubscribe" : "Subscribe"}
                  </button>
                </form>
              </div>
            </Card>
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
