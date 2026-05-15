"use client";

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/core/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from '@/components/icons';
import { createAssetGroup } from '@/services/manage/access/assets';

export function CreateAssetGroupCard({ variant = 'card' }: { variant?: 'card' | 'row' }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await createAssetGroup({ name, details });

      if (!result.success || !result.id) {
        toast({
          variant: 'destructive',
          title: 'Create failed',
          description: result.error || 'Failed to create asset group.',
        });
        return;
      }

      setOpen(false);
      setName('');
      setDetails('');
      router.push(`/access?portfolio=${result.id}`);
      router.refresh();
    });
  };

  const trigger =
    variant === 'row' ? (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">Create a portfolio</p>
        </div>
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    ) : (
      <button type="button" className="w-full text-left">
        <Card className="transition-colors hover:bg-muted/30">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <p className="font-medium">Add Asset Group</p>
                <p className="text-sm text-muted-foreground">Create a new assets group for access and role management.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Portfolio</DialogTitle>
          <DialogDescription>
            Create a portfolio, then add members and assets for structured access management.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <Input
            placeholder="Portfolio name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isPending}
          />
          <Textarea
            placeholder="Description (optional)"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            disabled={isPending}
          />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Portfolio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
