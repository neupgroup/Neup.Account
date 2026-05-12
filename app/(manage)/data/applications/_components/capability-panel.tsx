'use client';

import { useState } from 'react';
import { useToast } from '@/core/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [scope, setScope] = useState('');
  const [pending, setPending] = useState(false);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
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
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            Define the individual permissions this application can assign. Each capability represents one action or access right.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilities.length > 0 ? (
            <div className="space-y-2">
              {capabilities.map((cap) => (
                <div key={cap.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{cap.name}</p>
                    {cap.description && (
                      <p className="text-xs text-muted-foreground truncate">{cap.description}</p>
                    )}
                    {cap.scope && (
                      <Badge variant="outline" className="mt-1 text-xs">{cap.scope}</Badge>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(cap.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No capabilities yet.</p>
          )}

          <div className="rounded-md border p-4 space-y-3">
            <p className="text-sm font-medium">Add capability</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. orders.read" />
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope (optional), e.g. portfolio" />
            <div className="flex justify-end">
              <Button type="button" onClick={handleAdd} disabled={pending || !name.trim()}>
                {pending ? 'Adding...' : 'Add Capability'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
