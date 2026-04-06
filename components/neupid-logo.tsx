
import Link from 'next/link';
import Image from 'next/image';

const LogoIcon = () => (
    <Image
        src="https://neupgroup.com/assets/branding/neup.group/logo.svg"
        alt="Neup Group Logo"
        width={24}
        height={24}
        className="text-primary"
    />
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
