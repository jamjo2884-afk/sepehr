import type { SocialPlatform } from '@/types/domain';
import type { SocialPlatformConnector } from './types';
import { TelegramConnector } from './telegram';

/**
 * Central connector registry: platform id → connector implementation.
 *
 * The UI and sync service resolve connectors through this registry and
 * never import a concrete connector directly — so adding a platform is
 * just registering a new connector here (plus its env credential).
 */
const registry = new Map<SocialPlatform, SocialPlatformConnector>();

function register(connector: SocialPlatformConnector): void {
  registry.set(connector.platform, connector);
}

// Register the first real connector (official Bot API, no OAuth needed).
register(new TelegramConnector());

/** Resolve the connector for a platform, or null when not registered. */
export function resolveConnector(
  platform: SocialPlatform,
): SocialPlatformConnector | null {
  return registry.get(platform) ?? null;
}

/** All registered connectors (for capability lists / admin UI). */
export function registeredConnectors(): SocialPlatformConnector[] {
  return [...registry.values()];
}

/** Platforms that have a connector registered. */
export function registeredPlatforms(): SocialPlatform[] {
  return [...registry.keys()];
}
