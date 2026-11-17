import githubSnapshot from '@/data/github.json';

function resolveDisplayName(): string {
  const candidate = githubSnapshot?.user?.name;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return 'Rai Farhan';
}

const displayName = resolveDisplayName();
const firstName = displayName.split(/\s+/)[0] || displayName;

/**
 * Centralized portfolio owner identity configuration.
 * Shared across 3D room signage, desk nameplate, chair embroidery, doormat, phone, and Rai XP OS.
 */
export const IDENTITY_CONFIG = {
  displayName,
  firstName,
  displayRole: 'AI/ML Engineer',
  nameNeonColor: '#6C8CFF',
  nameNeonCoreColor: '#fff7eb',
  // North Wall right free segment directly facing spawn [0, 1.7, 4.0] yaw=0:
  // x in [2.98, 4.86] clears Certificates Shelf (2.55) by 0.43m & Wall B items (y<=1.53) by 0.44m
  nameSignPosition: [3.92, 2.15, -4.98] as [number, number, number],
  nameSignRotationY: 0,
  nameSignMaxWidth: 1.84,
  doormatText: 'WELCOME',
  doormatPosition: [0.0, 0.005, 3.25] as [number, number, number],
  embroideryText: firstName.toUpperCase(),
} as const;
