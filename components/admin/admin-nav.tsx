import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { id: "products", href: "/admin/products", label: "Products" },
  { id: "prices", href: "/admin/prices", label: "Prices" },
  { id: "service-requests", href: "/admin/service-requests", label: "Service Requests" },
] as const;

type AdminNavProps = {
  current: (typeof items)[number]["id"];
};

export function AdminNav({ current }: AdminNavProps) {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            buttonVariants({ variant: item.id === current ? "primary" : "secondary", size: "sm" }),
            "rounded-full",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
