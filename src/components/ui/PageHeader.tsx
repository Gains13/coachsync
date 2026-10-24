import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backTo,
  backLabel,
}: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel || "Back"}
          </Link>
        )}

        {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}

        <h1 className="break-words font-display text-2xl font-bold leading-tight tracking-tight sm:text-[30px]">
          {title}
        </h1>

        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
