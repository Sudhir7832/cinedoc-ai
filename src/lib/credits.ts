export const SCENES_PER_MINUTE = 10;

export function creditsForMinutes(minutes: number, creditsPerScene = 1): number {
  return Math.max(0, Math.ceil(minutes * SCENES_PER_MINUTE * creditsPerScene));
}

export function minutesForCredits(credits: number, creditsPerScene = 1): number {
  const creditsPerMinute = SCENES_PER_MINUTE * Math.max(creditsPerScene, 1);
  return Math.max(0, Math.floor(credits / creditsPerMinute));
}
