'use client';

import { useState } from 'react';
import { useToast } from '@/core/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronRight, ChevronDown } from '@/components/icons';
import {
  createAppCapability,
  deleteAppCapability,
  type AppCapability,
} from '@/services/applications/authz-manage';

type Props = {
  appId: string;
  initialCapabilities: AppCapability[];
};

export function CapabilityPanel({ appId, initialCapabilities }: Props) {
  const { toast } = useToast();
  const [capabilities, setCapabilities] = useState<AppCapability[]>(initialCapabilities);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [scope, setScope] = useState('');
  const [pending, setPending] = useState(false);

  const isValidName = (value: string) => /^[a-z0-9._-]+$/.test(value.trim());

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!isValidName(trimmed)) {
      toast({
        variant: 'destructive',
        title: 'Invalid name',
        description: 'Capability name may only contain lowercase letters, numbers, dots (.), underscores (_), and hyphens (-).',
      });
      return;
    }
    setPending(true);
    const result = await createAppCapability({
      appId,
      name: trimmed,
      description: desc || undefined,
      scope: scope || undefined,
    });
    setPending(false);
    if (!result.success || !result.capability) {
      toast({ variant: 'destructive', title: 'Failed', description: result.error || 'Could not create capability.' });
      return;
    }
    setCapabilities((prev) => [...prev, result.capability!]);
    setName('');
    setDesc('');
    setScope('');
    setExpanded(false);
    toast({ title: 'Capability created' });
  };

  const handleDelete = async (capabilityId: string) => {
    const result = await deleteAppCapability({ appId, capabilityId });
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Failed', description: result.error || 'Could not delete capability.' });
      return;
    }
    setCapabilities((prev) => prev.filter((c) => c.id !== capabilityId));
    toast({ title: 'Capability deleted' });
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Create row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center justify-between gap-4 border-b px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/20">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="truncate text-base font-medium leading-6 text-muted-foreground">
            New Permission
          </p>
        </div>
        {expanded
          ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        }
      </button>

      {/* Expanded create form */}
      {expanded && (
        <div className="border-b px-4 py-4 space-y-3 sm:px-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. orders.read"
          />
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
          />
          <Input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Scope (optional), e.g. portfolio"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setExpanded(false); setName(''); setDesc(''); setScope(''); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={pending || !name.trim() || !isValidName(name)}
            >
              {pending ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {/* Capability rows */}
      {capabilities.length > 0 ? (
        capabilities.map((cap) => (
          <div
            key={cap.id}
            className="flex items-center justify-between gap-4 border-b px-4 py-4 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-medium leading-6">{cap.name}</p>
              {cap.description && (
                <p className="truncate text-sm text-muted-foreground">{cap.description}</p>
              )}
              {cap.scope && (
                <Badge variant="outline" className="mt-1 text-xs">{cap.scope}</Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => handleDelete(cap.id)}
            >
              Remove
            </Button>
          </div>
        ))
      ) : (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          No permissions defined yet.
        </div>
      )}
    </div>
  );
}
