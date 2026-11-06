export const SCENES_PER_MINUTE = 10;
export const BILLING_STAGE_WEIGHTS = {
  script: 0.10,
  images: 0.40,
  narration: 0.25,
  video: 0.25,
} as const;

export interface StageCreditAllocation {
  script: number;
  images: number;
  narration: number;
  video: number;
}

export function creditsForMinutes(minutes: number, creditsPerScene = 1): number {
  return Math.max(0, Math.ceil(minutes * SCENES_PER_MINUTE * creditsPerScene));
}

export function minutesForCredits(credits: number, creditsPerScene = 1): number {
  const creditsPerMinute = SCENES_PER_MINUTE * Math.max(creditsPerScene, 1);
  return Math.max(0, Math.floor(credits / creditsPerMinute));
}

export function allocateCreditsByStage(totalCredits: number): StageCreditAllocation {
  const total = Math.max(0, Math.floor(totalCredits));
  const script = Math.floor(total * BILLING_STAGE_WEIGHTS.script);
  const images = Math.floor(total * BILLING_STAGE_WEIGHTS.images);
  const narration = Math.floor(total * BILLING_STAGE_WEIGHTS.narration);
  return { script, images, narration, video: total - script - images - narration };
}

export function creditForScene(allocation: number, sceneNumber: number, sceneCount: number): number {
  if (!Number.isInteger(sceneNumber) || !Number.isInteger(sceneCount) || sceneNumber < 1 || sceneNumber > sceneCount) {
    throw new Error('Invalid scene allocation.');
  }
  const boundedAllocation = Math.max(0, Math.floor(allocation));
  return Math.floor((sceneNumber * boundedAllocation) / sceneCount)
    - Math.floor(((sceneNumber - 1) * boundedAllocation) / sceneCount);
}
