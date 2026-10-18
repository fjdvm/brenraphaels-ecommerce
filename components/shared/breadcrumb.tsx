import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

type Crumb = { label: string; href?: string };

/** Home › … › current page; the last crumb is the page itself and is not a link. */
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs tracking-wide">
      {crumbs.map((crumb, index) => {
        const current = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.label}>
            {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-muted" />}
            {crumb.href && !current ? (
              <Link href={crumb.href} className="text-muted hover:text-primary hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={current ? "page" : undefined} className={current ? "text-primary" : "text-muted"}>
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
