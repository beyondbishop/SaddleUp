'use client';
import { useState } from 'react';

/** Admin-only switches for a user's access. The server re-checks that the caller is an admin. */
export default function UserRoleControls({ userId, isAdmin, isImporter, isSelf }: {
  userId: string; isAdmin: boolean; isImporter: boolean; isSelf: boolean;
}) {
  const [roles, setRoles] = useState({ isAdmin, isImporter });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(patch: Partial<typeof roles>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_admin: patch.isAdmin, is_importer: patch.isImporter })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not change access.');
    setRoles({ isAdmin: data.is_admin, isImporter: data.is_importer });
  }

  return (
    <div className="space-y-1 min-w-[9rem]">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={roles.isImporter || roles.isAdmin} disabled={busy || roles.isAdmin}
          onChange={(e) => change({ isImporter: e.target.checked })} />
        Can import
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={roles.isAdmin} disabled={busy || isSelf}
          onChange={(e) => change({ isAdmin: e.target.checked },
            e.target.checked
              ? 'Make this person an admin? Admins can approve and remove any listing and see every user.'
              : 'Remove admin access from this person?')} />
        Admin{isSelf ? ' (you)' : ''}
      </label>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
