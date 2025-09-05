

'use client';

import Link from 'next/link';
import React, { useTransition } from 'react';
import { ChevronRight, X, type LucideIcon } from '@/components/icons';
import { Button } from './button';
import { useToast } from '@/hooks/use-toast';
import { markNotificationAsRead, type Notification } from '@/actions/notifications';

type ListItemProps = {
  href: string;
  title: string;
  description?: string;
  icon: LucideIcon | React.ElementType;
  isExternal?: boolean;
  notification?: Notification;
};

export const ListItem = ({
  href,
  title,
  description,
  icon: Icon,
  isExternal = false,
  notification,
}: ListItemProps) => {
    const [isPending, startTransition] = useTransition();
    const [isDismissed, setIsDismissed] = React.useState(false);
    const { toast } = useToast();

    const handleDismiss = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!notification) return;

        startTransition(async () => {
            const result = await markNotificationAsRead(notification.id);
            if(result.success) {
                toast({ title: 'Notification dismissed' });
                setIsDismissed(true);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not dismiss notification.' });
            }
        })
    }

    if (isDismissed) {
        return null;
    }

    const isDismissible = notification && !notification.action.includes('request') && notification.persistence === 'dismissable';


  return (
    <Link
      href={href}
      className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50"
      target={isExternal ? '_blank' : '_self'}
      rel={isExternal ? 'noopener noreferrer' : ''}
    >
      <Icon className="h-6 w-6 text-muted-foreground" />
      <div className="flex-grow">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {isDismissible ? (
         <Button onClick={handleDismiss} variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" disabled={isPending}>
            <X className="h-5 w-5" />
        </Button>
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </Link>
  );
};
