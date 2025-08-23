
import Link from 'next/link';

const LogoIcon = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary"
    >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 12L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.364 18.364L5.63604 5.63604" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.364 5.63604L5.63604 18.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


type NeupIdLogoProps = {
  iconHref: string;
  textHref: string;
};

export function NeupIdLogo({ iconHref, textHref }: NeupIdLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <a href={iconHref} target="_blank" rel="noopener noreferrer">
        <span className="sr-only">Company Homepage</span>
        <LogoIcon />
      </a>
      <Link href={textHref}>
        <span className="text-lg font-semibold tracking-tight font-headline">
          Neup.Account
        </span>
      </Link>
    </div>
  );
}
