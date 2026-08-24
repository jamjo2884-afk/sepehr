// Mock data cleared — all data now comes from the database.
// Re-run `node scripts/convert-report.js [your-excel.xlsx]` to regenerate.
export interface SocialMonthlyPoint { month: string; value: number; }
export interface SocialAccountSeries { handle: string | null; series: SocialMonthlyPoint[]; }
export interface SocialBrandPlatform { [handleKey: string]: SocialAccountSeries; }
export interface SocialBrandNode {
  name: string;
  platforms: Partial<Record<string, SocialBrandPlatform>>;
}
export const socialBrandData: SocialBrandNode[] = [];
