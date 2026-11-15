/**
 * The one list of casino referral links.
 *
 * The /go/<slug> function only ever redirects to a URL in this table. Taking the
 * destination from the request instead would turn darrellnicholas.com into an
 * open redirect that anyone could dress up a phishing link with.
 *
 * To add a casino: add a line here, add its card to casinos/index.html with
 * href="/go/<slug>", and deploy.
 */
export const CASINOS = {
  "american-luck": { name: "American Luck", url: "https://americanluck.com/signup/072ea924-183d-45fe-9178-3d00169f71de" },
  "bink": { name: "Bink", url: "https://bink.bet/darrellnicholas" },
  "coinsback": { name: "CoinsBack", url: "https://www.coinsbackcasino.com/invite/1536118?utm_source=copy&utm_medium=referral&utm_campaign=member-referral" },
  "duel": { name: "Duel", url: "https://duel.com/r/PridishFool" },
  "fortune-wins": { name: "Fortune Wins", url: "https://fortunewins.com/signup/b8c79966-acf2-4d2e-b4be-82d36c4087d9" },
  "kingprize": { name: "KingPrize", url: "https://kingprize.com/?ref=8368" },
  "lone-star": { name: "Lone Star Casino", url: "https://lonestarcasino.com/refer/3421279" },
  "luck-party": { name: "Luck Party", url: "https://luckparty.com/signup/7ffb14e8-febd-404e-b949-045fb17f2b2a" },
  "modo": { name: "Modo", url: "https://modo.us/?referralCode=NYHQS6" },
  "pulsz": { name: "Pulsz", url: "https://www.pulsz.com/?invited_by=d9gzj9" },
  "pulsz-bingo": { name: "Pulsz Bingo", url: "https://www.pulszbingo.com/?invited_by=9w55s3" },
  "realprize": { name: "RealPrize", url: "https://realprize.com/refer/543117" },
  "reel-zappy": { name: "Reel Zappy", url: "https://reelzappy.com/signup/8d979501-ffd8-424f-9661-0ced3961ae08" },
  "rolla": { name: "Rolla", url: "https://www.rolla.com/?raf=1358371" },
  "spinquest": { name: "SpinQuest", url: "https://spinquest.com/?u=FSEVHDO" },
  "win-bonanza": { name: "Win Bonanza", url: "https://winbonanza.com/register/40eee8ce-4d2e-4085-924e-976e9b2152a7" },
  "yay": { name: "Yay Casino", url: "https://www.yaycasino.com/signup/4a2879f3-e953-489f-b178-cb95f0f9c146" },
  "zula": { name: "Zula Casino", url: "https://www.zulacasino.com/signup/6b82cbcb-34d8-41bd-b7af-9af18d23f228" },
};

/**
 * Non-casino links that go through the same /go/ counter. Kept apart so the
 * casino stats don't mix them in.
 */
export const SUPPORT = {
  "kofi": { name: "Ko-fi", url: "https://ko-fi.com/darrellnicholas" },
};
