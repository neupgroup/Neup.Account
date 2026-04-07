
import Link from 'next/link';

const DEFAULT_LOGO_URL = 'https://neupgroup.com/assets/branding/neup.group/logo.svg';


type NeupIdLogoProps = {
  iconHref: string;
  textHref: string;
  logoUrl?: string;
};

export function NeupIdLogo({ iconHref, textHref, logoUrl }: NeupIdLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <a href={iconHref} target="_blank" rel="noopener noreferrer">
        <span className="sr-only">Company Homepage</span>
        <img
          src={logoUrl || DEFAULT_LOGO_URL}
          alt="Neup Group Logo"
          width={24}
          height={24}
          className="h-6 w-6"
          loading="eager"
        />
      </a>
      <Link href={textHref}>
        <span className="text-lg font-semibold tracking-tight font-headline">
          Neup.Account
        </span>
      </Link>
    </div>
  );
}
