import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ClipboardPen,
  Clock,
  Dumbbell,
  House,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutUser } from "../lib/authHelpers";

type TrainerMenuItem = {
  to: string;
  title: string;
  shortTitle: string;
  icon: LucideIcon;
  // Extra path prefixes that should also highlight this item.
  matches?: string[];
};

type TrainerLayoutProps = {
  children: ReactNode;
  unreadMessages?: number;
};

const primaryItems: TrainerMenuItem[] = [
  { to: "/trainer", title: "Dashboard", shortTitle: "Home", icon: House },
  {
    to: "/clients",
    title: "Clients",
    shortTitle: "Clients",
    icon: Users,
    matches: ["/clients/", "/trainer/client-preview/"],
  },
  {
    to: "/sessions",
    title: "Sessions",
    shortTitle: "Sessions",
    icon: ClipboardPen,
    matches: ["/sessions/"],
  },
  {
    to: "/create-program",
    title: "Create program",
    shortTitle: "Program",
    icon: Layers,
    matches: ["/edit-workout/"],
  },
  {
    to: "/messages",
    title: "Messages",
    shortTitle: "Messages",
    icon: MessageCircle,
  },
];

const toolItems: TrainerMenuItem[] = [
  { to: "/training-plans", title: "Training plans", shortTitle: "Plans", icon: CalendarDays },
  { to: "/create-client", title: "Add client", shortTitle: "Add", icon: Plus },
  { to: "/import-program", title: "Import notes", shortTitle: "Import", icon: Upload },
  { to: "/workout-tracker", title: "Workout tracker", shortTitle: "Tracker", icon: Dumbbell },
  {
    to: "/workout-history",
    title: "Workout history",
    shortTitle: "History",
    icon: Clock,
    matches: ["/workout-history/"],
  },
  { to: "/program", title: "Templates", shortTitle: "Templates", icon: BookOpen },
];

function isActive(item: TrainerMenuItem, pathname: string) {
  if (pathname === item.to) return true;
  return (item.matches || []).some((prefix) => pathname.startsWith(prefix));
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "TR";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function TrainerLayout({
  children,
  unreadMessages = 0,
}: TrainerLayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDashboard = location.pathname === "/trainer";

  return (
    <main className="min-h-screen bg-canvas font-sans text-ink">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-72 max-w-[86vw] flex-col bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-5 rounded-lg p-2 text-muted hover:bg-canvas"
            >
              <X className="h-5 w-5" />
            </button>

            <TrainerSidebar
              unreadMessages={unreadMessages}
              closeMenu={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block">
        <TrainerSidebar unreadMessages={unreadMessages} />
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/trainer" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-base font-bold">CoachSync</span>
        </Link>

        <div className="flex items-center gap-2">
          {isDashboard && (
            <button
              type="button"
              aria-label="Log out"
              onClick={logoutUser}
              className="rounded-xl border border-line bg-white p-2 text-muted"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-xl border border-line bg-white p-2 text-ink"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-7">
          {children}
        </div>
      </div>

      <MobileTabBar unreadMessages={unreadMessages} />
    </main>
  );
}

function LogoMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-display text-lg font-extrabold text-white">
      C
    </div>
  );
}

function TrainerSidebar({
  unreadMessages,
  closeMenu,
}: {
  unreadMessages: number;
  closeMenu?: () => void;
}) {
  const location = useLocation();
  const displayName =
    localStorage.getItem("coachsync-display-name") || "Trainer";

  function renderItem(item: TrainerMenuItem) {
    const active = isActive(item, location.pathname);
    const Icon = item.icon;
    const badge = item.to === "/messages" ? unreadMessages : 0;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={closeMenu}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
          active
            ? "bg-accent-soft text-accent"
            : "text-ink/80 hover:bg-canvas hover:text-ink"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate">{item.title}</span>

        {badge > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="flex h-full flex-col px-3.5 py-5">
      <Link
        to="/trainer"
        onClick={closeMenu}
        className="mb-6 flex items-center gap-3 px-1.5"
      >
        <LogoMark />
        <span className="flex flex-col">
          <span className="font-display text-[17px] font-bold">CoachSync</span>
          <span className="text-xs text-muted">Trainer</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {primaryItems.map(renderItem)}

        <p className="px-3 pb-1 pt-6 text-xs font-medium uppercase tracking-wide text-muted">
          Tools
        </p>
        {toolItems.map(renderItem)}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-canvas p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {getInitials(displayName)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted">Trainer account</p>
        </div>

        <button
          type="button"
          onClick={logoutUser}
          aria-label="Log out"
          title="Log out"
          className="rounded-lg p-2 text-muted transition hover:bg-white hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MobileTabBar({ unreadMessages }: { unreadMessages: number }) {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 rounded-3xl border border-line bg-white px-1 py-2 shadow-[0_8px_30px_rgba(15,20,25,0.08)]">
        {primaryItems.map((item) => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;
          const badge = item.to === "/messages" ? unreadMessages : 0;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${
                active ? "text-accent" : "text-ink/75"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {item.shortTitle}

              {badge > 0 && (
                <span className="absolute right-[18%] top-0 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
