import assert from "node:assert/strict";
import {
  buildTitleCast,
  isNonPersonName,
  looksLikeOrg,
  looksLikePerson,
  type TitleCastCredit,
} from "./title-cast";

function credit(
  name: string,
  role: TitleCastCredit["role_id"],
  extra: Partial<TitleCastCredit> = {}
): TitleCastCredit {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    person: { id: slug, slug, display_name: name, image_url: null },
    role_id: role,
    role_label: role,
    billing_order: 1,
    character_name: null,
    episode_id: extra.episode_id ?? null,
    ...extra,
  };
}

assert.equal(looksLikeOrg("Higher Ground"), true);
assert.equal(looksLikeOrg("SiriusXM"), true);
assert.equal(looksLikeOrg("Maximum Fun"), true);
assert.equal(looksLikeOrg("Humber Climate Commissions"), true);
assert.equal(looksLikeOrg("NPR"), true);
assert.equal(looksLikeOrg("Ashley Flowers"), false);
assert.equal(looksLikePerson("Michelle Obama"), true);
assert.equal(looksLikePerson("Conan O'Brien"), true);
assert.equal(looksLikePerson("Higher Ground"), false);
assert.equal(looksLikePerson("Niki Roach Executive Producer"), false);

assert.equal(isNonPersonName("Higher Ground", []), true);
assert.equal(isNonPersonName("Higher Ground", ["Some Other Co"]), true);
assert.equal(isNonPersonName("Mystery Network", []), true);
assert.equal(isNonPersonName("Ira Glass", []), false);
assert.equal(isNonPersonName("Brit Prawat", ["Higher Ground"]), false);
assert.equal(isNonPersonName("Planet Possible", ["Planet Possible"]), true);

const billed = buildTitleCast(
  [
    credit("Higher Ground", "host", { billing_order: 1, episode_id: "e1" }),
    credit("Michelle Obama", "host", { billing_order: 2, episode_id: "e1" }),
    credit("Craig Robinson", "co_host", { billing_order: 3, episode_id: "e1" }),
  ],
  []
);
assert.deepEqual(
  billed.map((m) => m.person.display_name),
  ["Michelle Obama", "Craig Robinson"]
);

console.log("title-cast filter ok");
