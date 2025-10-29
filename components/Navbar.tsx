"use client";
import { NAV_LINKS } from "@/constants";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import dynamic from "next/dynamic";
const FirebaseAuthButtons = dynamic(() => import("@/components/FirebaseAuthButtons"), { ssr: false });
const LoginRoleButtons = dynamic(() => import("@/components/LoginRoleButtons"), { ssr: false });
const RoleSwitcher = dynamic(() => import("@/components/RoleSwitcher"), { ssr: false });
import { useState } from "react";
// Clerk removed; using Firebase buttons

const Navbar = () => {
  const [open, setOpen] = useState(false);

  // removed Clerk auth controls; Firebase buttons are used below
  return (
    <nav className="z-50 fixed w-full bg-transparent py-2">
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
          <LoginRoleButtons />
          <RoleSwitcher />
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
        className={`lg:hidden absolute left-0 right-0 top-full bg-white shadow-md transition-max-h duration-300 overflow-hidden ${
          open ? "max-h-[420px]" : "max-h-0"
        }`}
      >
        <div className="container mx-auto px-4 py-4">
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
              <FirebaseAuthButtons />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
