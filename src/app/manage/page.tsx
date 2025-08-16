import { MobileNav } from "@/components/mobile-nav";
import HomePage from "./home/page";

export default function ManagePage() {
  return (
    <>
      {/* Mobile-only Navigation View - Always render MobileNav for small screens */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Desktop View - Renders the home page content */}
      <div className="hidden md:block">
        <HomePage />
      </div>
    </>
  );
}
