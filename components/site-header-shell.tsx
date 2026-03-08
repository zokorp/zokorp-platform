"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

type SiteHeaderShellProps = {
  primaryLinks: NavLink[];
  secondaryLinks: NavLink[];
  isAdmin: boolean;
  userEmail: string | null;
  authRuntimeReady: boolean;
};

export function SiteHeaderShell({
  primaryLinks,
  secondaryLinks,
  isAdmin,
  userEmail,
  authRuntimeReady,
}: SiteHeaderShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(!authRuntimeReady);
  const [resolvedIsAdmin, setResolvedIsAdmin] = useState(isAdmin);
  const [resolvedUserEmail, setResolvedUserEmail] = useState(userEmail);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenus = useCallback(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }

      if (
        mobileOpen &&
        !mobilePanelRef.current?.contains(event.target as Node) &&
        !mobileTriggerRef.current?.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (moreOpen) {
          setMoreOpen(false);
          window.requestAnimationFrame(() => moreTriggerRef.current?.focus());
        }

        if (mobileOpen) {
          setMobileOpen(false);
          window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
        }
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen, moreOpen]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      const firstFocusable = moreMenuRef.current?.querySelector<HTMLElement>("a, button");
      firstFocusable?.focus();
    });
  }, [moreOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      const firstFocusable = mobilePanelRef.current?.querySelector<HTMLElement>("a, button");
      firstFocusable?.focus();
    });
  }, [mobileOpen]);

  useEffect(() => {
    if (!authRuntimeReady) {
      setResolvedIsAdmin(false);
      setResolvedUserEmail(null);
      setSessionResolved(true);
      return;
    }

    let isMounted = true;

    async function syncSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          user?: { email?: string | null; role?: string | null };
        };

        if (!isMounted) {
          return;
        }

        setResolvedUserEmail(data.user?.email ?? null);
        setResolvedIsAdmin(data.user?.role === "ADMIN");
      } catch {
        if (!isMounted) {
          return;
        }

        setResolvedUserEmail(userEmail);
        setResolvedIsAdmin(isAdmin);
      } finally {
        if (isMounted) {
          setSessionResolved(true);
        }
      }
    }

    void syncSession();

    return () => {
      isMounted = false;
    };
  }, [authRuntimeReady, isAdmin, userEmail]);

  const navLinkClass = cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "rounded-full border-transparent px-3.5 text-foreground-muted hover:bg-white hover:text-foreground",
  );

  const authActions = !authRuntimeReady ? (
    <Badge variant="warning" className="normal-case tracking-normal">
      Auth setup pending
    </Badge>
  ) : !sessionResolved ? (
    <Badge variant="secondary" className="normal-case tracking-normal">
      Checking session
    </Badge>
  ) : resolvedUserEmail ? (
    <>
      <Badge variant="secondary" className="max-w-full normal-case tracking-normal">
        <span className="truncate">{resolvedUserEmail}</span>
      </Badge>
      <Link href="/api/auth/signout?callbackUrl=/" className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Sign out
      </Link>
    </>
  ) : (
    <>
      <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Sign in
      </Link>
      <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
        Create account
      </Link>
    </>
  );

  return (
    <div className="flex flex-1 items-center justify-end gap-3">
      <nav className="glass-surface hidden items-center gap-1.5 px-2 py-1.5 text-sm md:flex">
        {primaryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(navLinkClass, pathname === link.href && "bg-white text-foreground shadow-[var(--shadow-soft)]")}
            onClick={closeMenus}
          >
            {link.label}
          </Link>
        ))}

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="desktop-more-menu"
            ref={moreTriggerRef}
            className={navLinkClass}
            onClick={() => setMoreOpen((current) => !current)}
          >
            More
          </button>
          {moreOpen ? (
            <div
              id="desktop-more-menu"
              ref={moreMenuRef}
              aria-label="More pages"
              className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-white p-2 shadow-[var(--shadow-card-hover)]"
            >
              <div className="space-y-1">
                {secondaryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(navLinkClass, "w-full justify-start rounded-xl")}
                    onClick={closeMenus}
                  >
                    {link.label}
                  </Link>
                ))}
                {resolvedIsAdmin ? (
                  <Link
                    href="/admin/service-requests"
                    className={cn(buttonVariants({ variant: "outline", size: "sm", fullWidth: true }), "justify-start")}
                    onClick={closeMenus}
                  >
                    Admin
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="hidden items-center gap-2 md:flex">
        {resolvedIsAdmin ? (
          <Link
            href="/admin/service-requests"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            onClick={closeMenus}
          >
            Admin
          </Link>
        ) : null}
        {authActions}
      </div>

      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav-panel"
        ref={mobileTriggerRef}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "md:hidden")}
        onClick={() => setMobileOpen((current) => !current)}
      >
        <span className="inline-flex flex-col gap-1">
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
        </span>
        <span>Menu</span>
      </button>

      {mobileOpen ? (
        <div
          id="mobile-nav-panel"
          ref={mobilePanelRef}
          aria-label="Mobile navigation"
          className="absolute inset-x-4 top-[calc(100%-0.25rem)] z-40 rounded-[1.4rem] border border-border bg-white/95 p-4 shadow-[var(--shadow-card-hover)] backdrop-blur md:hidden"
        >
          <div className="space-y-2">
            {[...primaryLinks, ...secondaryLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(buttonVariants({ variant: "ghost", size: "md", fullWidth: true }), "justify-start")}
                onClick={closeMenus}
              >
                {link.label}
              </Link>
            ))}
            {resolvedIsAdmin ? (
              <Link
                href="/admin/service-requests"
                className={cn(buttonVariants({ variant: "outline", size: "md", fullWidth: true }), "justify-start")}
                onClick={closeMenus}
              >
                Admin
              </Link>
            ) : null}
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex flex-col gap-2">{authActions}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
