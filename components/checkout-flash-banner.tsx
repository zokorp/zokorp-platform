"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type CheckoutFlashBannerProps = {
  state: "success" | "cancelled" | null;
};

export function CheckoutFlashBanner({ state }: CheckoutFlashBannerProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!state) {
      return;
    }

    router.replace(pathname, { scroll: false });
  }, [state, pathname, router]);

  if (state === "success") {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Checkout completed. If this was your first purchase, your entitlement may take a few seconds
        to appear.
      </div>
    );
  }

  if (state === "cancelled") {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Checkout was canceled. You can restart checkout whenever you&apos;re ready.
      </div>
    );
  }

  return null;
}
