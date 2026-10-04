import { describe, expect, it } from 'vitest';

/**
 * Module permission engine tests (tests-as-contract).
 *
 * These pin the rules the Members UI and every gated route depend on:
 *  - levels are ordered (edit implies create implies view)
 *  - owner/admin bypass the matrix entirely
 *  - 'settings' is owner/admin-only, even if a member's matrix says otherwise
 *  - the jsonb column is untrusted shape and is sanitised fail-closed
 */

import {
  canCreate,
  canEdit,
  canView,
  isPrivilegedRole,
  moduleAccess,
  sanitizeMatrix,
} from '@/lib/permissions';

const member = (permissions: unknown) => ({ role: 'member', permissions });
const owner = { role: 'owner', permissions: {} };
const admin = { role: 'admin', permissions: {} };

describe('isPrivilegedRole', () => {
  it('treats only owner and admin as privileged', () => {
    expect(isPrivilegedRole('owner')).toBe(true);
    expect(isPrivilegedRole('admin')).toBe(true);
    for (const role of ['member', 'viewer', 'editor', 'writer']) {
      expect(isPrivilegedRole(role)).toBe(false);
    }
  });
});

describe('moduleAccess — owner/admin bypass', () => {
  it('gives owner and admin full access even with an empty matrix', () => {
    for (const ws of [owner, admin]) {
      expect(moduleAccess(ws, 'finance')).toBe('edit');
      expect(moduleAccess(ws, 'settings')).toBe('edit');
      expect(moduleAccess(ws, 'brands')).toBe('edit');
    }
  });

  it('ignores a matrix that tries to restrict an owner', () => {
    const restricted = { role: 'owner', permissions: { finance: 'none' } };
    expect(moduleAccess(restricted, 'finance')).toBe('edit');
  });
});

describe('moduleAccess — members use their stored matrix', () => {
  it('reads the stored level', () => {
    expect(moduleAccess(member({ finance: 'view' }), 'finance')).toBe('view');
    expect(moduleAccess(member({ brands: 'create' }), 'brands')).toBe('create');
    expect(moduleAccess(member({ social: 'edit' }), 'social')).toBe('edit');
  });

  it('defaults a missing key to none', () => {
    const ws = member({ finance: 'view' });
    expect(moduleAccess(ws, 'tasks')).toBe('none');
    expect(moduleAccess(ws, 'content')).toBe('none');
  });

  it('defaults an empty/absent matrix to none everywhere', () => {
    for (const input of [{}, undefined, null, 'garbage', []]) {
      const ws = member(input);
      expect(moduleAccess(ws, 'finance')).toBe('none');
      expect(moduleAccess(ws, 'brands')).toBe('none');
    }
  });
});

describe('settings is owner/admin-only', () => {
  it('forces none for members even when the matrix grants access', () => {
    // Defense in depth: even a corrupt row must not expose settings.
    const ws = member({ settings: 'edit' });
    expect(moduleAccess(ws, 'settings')).toBe('none');
    expect(canView(ws, 'settings')).toBe(false);
    expect(canCreate(ws, 'settings')).toBe(false);
    expect(canEdit(ws, 'settings')).toBe(false);
  });
});

describe('level hierarchy — edit implies create implies view', () => {
  it('grants view/create/edit cumulatively', () => {
    const view = member({ finance: 'view' });
    expect([canView(view, 'finance'), canCreate(view, 'finance'), canEdit(view, 'finance')])
      .toEqual([true, false, false]);

    const create = member({ finance: 'create' });
    expect([canView(create, 'finance'), canCreate(create, 'finance'), canEdit(create, 'finance')])
      .toEqual([true, true, false]);

    const edit = member({ finance: 'edit' });
    expect([canView(edit, 'finance'), canCreate(edit, 'finance'), canEdit(edit, 'finance')])
      .toEqual([true, true, true]);
  });

  it('grants nothing for none', () => {
    const ws = member({ finance: 'none' });
    expect([canView(ws, 'finance'), canCreate(ws, 'finance'), canEdit(ws, 'finance')])
      .toEqual([false, false, false]);
  });

  it('is per-module — access to one module never leaks to another', () => {
    const ws = member({ finance: 'edit' });
    expect(canEdit(ws, 'finance')).toBe(true);
    expect(canEdit(ws, 'brands')).toBe(false);
    expect(canView(ws, 'brands')).toBe(false);
  });
});

describe('sanitizeMatrix — fail closed on untrusted jsonb', () => {
  it('keeps only known module keys with known levels', () => {
    expect(
      sanitizeMatrix({
        brands: 'view',
        finance: 'edit',
        nope: 'edit', // unknown module
        social: 'superuser', // unknown level
        tasks: 123, // wrong type
      }),
    ).toEqual({ brands: 'view', finance: 'edit' });
  });

  it('returns an empty matrix for non-object input', () => {
    for (const input of [null, undefined, 'x', 42, ['brands'], true]) {
      expect(sanitizeMatrix(input)).toEqual({});
    }
  });

  it('preserves an explicit none (the UI shows it as a chosen level)', () => {
    expect(sanitizeMatrix({ brands: 'none' })).toEqual({ brands: 'none' });
  });
});
