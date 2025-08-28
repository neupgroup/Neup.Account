

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Users, Instagram, Linkedin, Twitter, Facebook, Bot, Link as LinkIcon } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { hasActiveSessionCookies } from '@/lib/auth-actions';
import { NeupIdLogo } from '@/components/neupid-logo';
import { getSocialLinks } from '@/actions/root/site/socials';
import type { SocialLink } from '@/types';

const socialIcons: Record<SocialLink['type'], React.ElementType> = {
    instagram: Instagram,
    linkedin: Linkedin,
    twitter: Twitter,
    facebook: Facebook,
    whatsapp: Bot,
    other: LinkIcon,
};

export default async function LandingPage() {
  const isLoggedIn = await hasActiveSessionCookies();
  const socialLinks = await getSocialLinks();
  const visibleSocialLinks = socialLinks.filter(link => link.isVisible);

  const CtaButton = () => (
    <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
      {isLoggedIn ? (
        <Link href="/manage">Continue to Account</Link>
      ) : (
        <Link href="/auth/start">Get Started</Link>
      )}
    </Button>
  );
  
  const HeaderButton = () => (
    <Button asChild>
       {isLoggedIn ? (
        <Link href="/manage">Continue to Account</Link>
      ) : (
        <Link href="/auth/start">Get Started</Link>
      )}
    </Button>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex h-16 w-full items-center bg-background shadow">
        <div className="mx-auto flex w-full max-w-[1368px] items-center px-4 lg:px-6">
          <NeupIdLogo iconHref={process.env.NEXT_PUBLIC_COMPANY_URL || "/"} textHref="/" />
          <nav className="ml-auto">
            <HeaderButton />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="mx-auto w-full max-w-[1368px] px-4 md:px-6">
            <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                    Your Secure, Unified Digital Identity
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    One ID to access all your favorite services seamlessly and
                    securely. Take control of your digital life with Neup.Account.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <CtaButton />
                </div>
              </div>
              <Image
                alt="Hero"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full"
                data-ai-hint="abstract security"
                height="310"
                src="https://placehold.co/550x310.png"
                width="550"
              />
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-card/50">
          <div className="mx-auto w-full max-w-[1368px] px-4 md:px-6">
            <div className="flex flex-col items-start space-y-4 text-left">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">
                  Key Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Built for Security and Simplicity
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl">
                  We provide the tools to keep your identity safe while making
                  your online experience smoother.
                </p>
              </div>
            </div>
            <div className="mx-auto grid items-stretch gap-8 pt-12 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="h-full transition-shadow duration-300 hover:shadow-lg hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-background">
                <CardContent className="grid gap-4 pt-6 text-left">
                  <Shield className="h-12 w-12 text-primary" />
                  <div className="grid gap-2">
                    <h3 className="text-xl font-bold">Bank-Grade Security</h3>
                    <p className="text-muted-foreground">
                      Your data is protected with end-to-end encryption and
                      multi-factor authentication options.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full transition-shadow duration-300 hover:shadow-lg hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-background">
                <CardContent className="grid gap-4 pt-6 text-left">
                  <Lock className="h-12 w-12 text-primary" />
                  <div className="grid gap-2">
                    <h3 className="text-xl font-bold">Single Sign-On</h3>
                    <p className="text-muted-foreground">
                      Access a growing ecosystem of products and services with a
                      single, secure login. No more password fatigue.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full transition-shadow duration-300 hover:shadow-lg hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-background">
                <CardContent className="grid gap-4 pt-6 text-left">
                  <Users className="h-12 w-12 text-primary" />
                  <div className="grid gap-2">
                    <h3 className="text-xl font-bold">Account Management</h3>
                    <p className="text-muted-foreground">
                      Easily manage multiple accounts and switch between them without compromising security.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="mx-auto w-full max-w-[1368px] px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Your journey starts here.</h2>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Create your secure digital identity today and unlock a world of seamless access.
                </p>
              </div>
              <CtaButton />
            </div>
          </div>
        </section>
      </main>
      <footer className="flex w-full shrink-0 flex-col items-center gap-4 border-t bg-card py-6 md:flex-row">
        <div className="mx-auto flex w-full max-w-[1368px] flex-col items-center gap-4 px-4 sm:flex-row md:px-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Neup.Account. All rights reserved.
          </p>
           {visibleSocialLinks.length > 0 && (
            <div className="flex items-center gap-4 sm:ml-auto">
              {visibleSocialLinks.map((link) => {
                const Icon = socialIcons[link.type];
                return (
                  <Link
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={link.type}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>
          )}
          <nav className="flex gap-4 sm:ml-4">
            <Link href="/manage/policies" className="text-xs hover:underline underline-offset-4">
              Terms of Service
            </Link>
            <Link href="/manage/policies" className="text-xs hover:underline underline-offset-4">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
