import type { ProviderGroup } from '@/lib/providerAnalysis';
import { normalizeProviderName } from '@/lib/providerAnalysis';

/** URL-safe slug from provider display name. */
export function toProviderSlug(name: string): string {
  return encodeURIComponent(
    normalizeProviderName(name).replace(/\s+/g, '-'),
  );
}

export function providerDetailHref(name: string, projectId?: number): string {
  const base = `/providers/${toProviderSlug(name)}`;
  return projectId ? `${base}?projectId=${projectId}` : base;
}

export function findProviderBySlug(
  providers: ProviderGroup[],
  slug: string,
): ProviderGroup | undefined {
  const decoded = decodeURIComponent(slug).toLowerCase().replace(/-/g, ' ').trim();
  return providers.find((p) => normalizeProviderName(p.name) === decoded);
}
