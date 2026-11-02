export function withMediaVersion(url: string | undefined, version: string | undefined): string | undefined {
  if (!url || !version || !url.startsWith('/generated/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export function scenePreviewUrl(jobId: string, sceneNumber: number, version?: string): string {
  const params = new URLSearchParams({ sceneNumber: String(sceneNumber) });
  if (version) params.set('v', version);
  return `/api/jobs/${encodeURIComponent(jobId)}/scene-image?${params.toString()}`;
}
