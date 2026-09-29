import { redirect } from 'next/navigation';

/**
 * /campaigns was a duplicate of the campaigns UI in /finance/campaigns
 * (both consume the same /api/finance/campaigns data). Consolidated
 * 2026-09-28: this route now redirects there.
 */
export default function CampaignsPage() {
  redirect('/finance/campaigns');
}
