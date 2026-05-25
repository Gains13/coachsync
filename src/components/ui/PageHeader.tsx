import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  stats?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  stats,
}: PageHeaderProps) {
  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
      <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
              {eyebrow}
            </p>

            <h1 className="mt-3 break-words text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              {title}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">
              {description}
            </p>
          </div>

          {actions && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:p-8">
          {stats}
        </div>
      )}
    </div>
  );
}