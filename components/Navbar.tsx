"use client";
import { NAV_LINKS } from "@/constants";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import dynamic from "next/dynamic";
const LoginRoleButtons = dynamic(() => import("@/components/LoginRoleButtons"), { ssr: false });
const RoleSwitcher = dynamic(() => import("@/components/RoleSwitcher"), { ssr: false });
const UserAvatar = dynamic(() => import("@/components/UserAvatar"), { ssr: false });
import { useState } from "react";
import { useUserProfileContext } from "@/contexts/UserProfileProvider";
import { signOutUser } from "@/lib/auth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, userLoading } = useUserProfileContext();

  return (
    <nav className="z-50 fixed w-full bg-white py-2 border-b border-gray-200">
      <div className="container mx-auto flex items-center justify-between py-5 px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-green-600">
            Guar
            <span className="text-2xl font-bold text-black">dio.</span>
          </span>
        </Link>

        {/* desktop links */}
        <ul className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.key}>
              <Link
                href={link.href}
                className="regular-16 text-black flexCenter cursor-pointer pb-1.5 transition-colors hover:text-green-600"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {!userLoading && (
            user ? (
              // Logged in: Show user profile and role switcher
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size={32} />
                <span className="text-sm hidden sm:block">
                  {user.displayName ?? user.email}
                </span>
                <RoleSwitcher />
                <button
                  onClick={() => signOutUser()}
                  className="inline-flex items-center rounded-md border px-3 py-2 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            ) : (
              // Not logged in: Show login buttons
              <LoginRoleButtons />
            )
          )}
        </div>

        {/* mobile controls */}
        <div className="lg:hidden">
          <button
            onClick={() => setOpen((s) => !s)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex items-center justify-center rounded p-2"
          >
            <Image src="/menu.svg" alt="menu" width={28} height={28} />
          </button>
        </div>
      </div>

      {/* mobile menu overlay */}
      <div
        className={`lg:hidden absolute left-0 right-0 top-full bg-white shadow-md transition-max-h duration-300 overflow-hidden border-b border-gray-200 ${
          open ? "max-h-[500px]" : "max-h-0"
        }`}
      >
        <div className="container mx-auto px-4 py-3">
          <ul className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <li key={`mobile-${link.key}`}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 px-3 rounded text-black hover:bg-gray-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="flex flex-col gap-2">
              {!userLoading && (
                user ? (
                  // Mobile: Logged in user
                  <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={user} size={28} />
                      <span className="text-xs truncate">
                        {user.displayName ?? user.email}
                      </span>
                    </div>
                    <RoleSwitcher isMobile={true} />
                    <button
                      onClick={() => signOutUser()}
                      className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  // Mobile: Not logged in
                  <div className="p-3">
                    <LoginRoleButtons isMobile={true} />
                  </div>
                )
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
