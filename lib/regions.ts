export interface RegionConfig {
  code: string;
  name: string;
}

/**
 * Single ops region (no multi-region UI).
 * Server: OPS_REGION. Client (bundled): NEXT_PUBLIC_OPS_REGION.
 */
export const OPS_REGION_CODE =
  process.env.OPS_REGION ||
  process.env.NEXT_PUBLIC_OPS_REGION ||
  "AU-VOICESTACK";

const DISPLAY_NAMES: Record<string, string> = {
  "AU-VOICESTACK": "AU Voicestack",
  "US-VOICESTACK": "US Voicestack",
  "US-CSIQ": "US CSIQ",
  "UK-VOICESTACK": "UK Voicestack",
  "UK-CSIQ": "UK CSIQ",
};

export function getOpsRegionDisplayName(code: string = OPS_REGION_CODE): string {
  return DISPLAY_NAMES[code] || code;
}

export function getRegionConfig(code: string): RegionConfig | undefined {
  if (code !== OPS_REGION_CODE) return undefined;
  return { code: OPS_REGION_CODE, name: getOpsRegionDisplayName() };
}

export function isValidRegion(code: string): boolean {
  return code === OPS_REGION_CODE;
}
