
import Link from 'next/link';
import React from 'react';
import { ChevronRight } from '@/components/icons';
import type { LucideIcon } from 'lucide-react';

type ListItemProps = {
  href: string;
  title: string;
  description?: string;
  icon: LucideIcon | React.ElementType;
  isExternal?: boolean;
};

export const ListItem = ({
  href,
  title,
  description,
  icon: Icon,
  isExternal = false,
}: ListItemProps) => (
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
    <ChevronRight className="h-5 w-5 text-muted-foreground" />
  </Link>
);
