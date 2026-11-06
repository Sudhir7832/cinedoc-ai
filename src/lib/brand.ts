export const PRODUCT_NAME = 'KinesisFlow';

// RELEASE BLOCKER: Replace this marker with the verified legal operator before launch.
const configuredLegalOperator = process.env.LEGAL_OPERATOR_NAME?.trim();
export const LEGAL_OPERATOR = configuredLegalOperator || 'Legal operator name pending confirmation';
export const LEGAL_OPERATOR_RELEASE_BLOCKER = !configuredLegalOperator;

const LOCAL_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = configuredUrl || LOCAL_SITE_URL;

  try {
    const parsed = new URL(siteUrl);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return LOCAL_SITE_URL;
  }
}

export function assertLaunchConfiguration(): void {
  getSiteUrl();
}
