import React from 'react';
import Link from 'next/link';
import {
    KeyRound,
    ShieldCheck,
    FileLock2,
    Users,
    Smartphone,
    Mail,
    Laptop,
    Globe,
    UserCircle,
    FileText,
    HeartHandshake,
    AtSign,
    Contact,
    Building,
    Bot,
    UserPlus,
    History,
    Trash2,
    PowerOff,
    CalendarClock,
    AppWindow,
    Share2,
    BarChart,
    MailQuestion,
    UserX,
    CreditCard,
    Wallet,
    Gem,
    ChevronRight,
    List,
    AlertTriangle,
    Bug,
    Bell,
    Handshake,
    MessageSquareWarning,
} from '@/components/icons';


// Icon mapping object
const iconMap: { [key: string]: React.ElementType } = {
  KeyRound,
  ShieldCheck,
  FileLock2,
  Users,
  Smartphone,
  Mail,
  Laptop,
  Globe,
  UserCircle,
  FileText,
  HeartHandshake,
  AtSign,
  Contact,
  Building,
  Bot,
  UserPlus,
  History,
  Trash2,
  PowerOff,
  CalendarClock,
  AppWindow,
  Share2,
  BarChart,
  MailQuestion,
  UserX,
  CreditCard,
  Wallet,
  Gem,
  List,
  AlertTriangle,
  Bug,
  Bell,
  Handshake,
  MessageSquareWarning,
};

interface ListItemProps {
  icon?: React.ElementType;
  iconName?: string;
  title: string;
  description: string;
  href: string;
  isExternal?: boolean;
}

export function ListItem({ icon: Icon, iconName, title, description, href, isExternal = false }: ListItemProps) {
  const IconComponent = Icon || (iconName ? iconMap[iconName] : null);

  const linkContent = (
    <div className="flex items-center gap-4 py-4 px-4">
      {IconComponent && <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
      <div className="flex-grow">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
       <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/50 transition-colors">
        {linkContent}
      </a>
    );
  }

  return (
    <Link href={href} className="block hover:bg-muted/50 transition-colors">
      {linkContent}
    </Link>
  );
}
