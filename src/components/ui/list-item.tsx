'use client';

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
  Gem
} from '@/components/icons';

// Icon mapping object
const iconMap = {
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
  Gem
};

interface ListItemProps {
  icon: string; // Now accepts string instead of component
  title: string;
  description: string;
  href: string;
}

export function ListItem({ icon, title, description, href }: ListItemProps) {
  // Get the icon component from the map
  const IconComponent = iconMap[icon as keyof typeof iconMap];

  return (
    <Link href={href} className="block p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        {IconComponent && (
          <div className="flex-shrink-0">
            <IconComponent className="w-5 h-5 text-gray-600" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <div className="flex-shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}