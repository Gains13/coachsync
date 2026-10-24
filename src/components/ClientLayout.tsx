import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ChartNoAxesColumn,
  ClipboardList,
  Clock,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type ClientMenuItem = {
  to: string;
  title: string;
  shortTitle: string;
  icon: LucideIcon;
};

type ClientLayoutProps = {
  children: ReactNode;
  unreadMessages?: number;
};

type ProfileSummary = {
  full_name: string;
  avatar_url?: string | null;
};

const primaryItems: ClientMenuItem[] = [
  { to: "/client", title: "Today", shortTitle: "Today", icon: House },
  { to: "/client-plan", title: "My plan", shortTitle: "Plan", icon: ClipboardList },
  {
    to: "/client-past-workouts",
    title: "Past workouts",
    shortTitle: "History",
    icon: Clock,
  },
  {
    to: "/client-progress",
    title: "Progress",
    shortTitle: "Progress",
    icon: ChartNoAxesColumn,
  },
  {
    to: "/client-messages",
    title: "Messages",
    shortTitle: "Messages",
    icon: MessageCircle,
  },
];

const secondaryItems: ClientMenuItem[] = [
  { to: "/client-log-activity", title: "Log activity", shortTitle: "Log", icon: Plus },
  { to: "/client-goals", title: "Goals", shortTitle: "Goals", icon: Target },
  {
    to: "/client-assessment",
    title: "Assessment",
    shortTitle: "Assessment",
    icon: Activity,
  },
  { to: "/client-settings", title: "Settings", shortTitle: "Settings", icon: Settings },
];

// Shared across page navigations so the sidebar doesn't refetch on every route.
let cachedProfile: ProfileSummary | null = null;

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ClientLayout({
  children,
  unreadMessages = 0,
}: ClientLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(cachedProfile);

  useEffect(() => {
    if (cachedProfile) return;

    let cancelled = false;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (data && !cancelled) {
        cachedProfile = data as ProfileSummary;
        setProfile(cachedProfile);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    cachedProfile = null;
    localStorage.removeItem("coachsync-user-role");
    localStorage.removeItem("coachsync-client-id");
    navigate("/");
  }

  const isToday = location.pathname === "/client";

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

            <ClientSidebar
              profile={profile}
              unreadMessages={unreadMessages}
              closeMenu={() => setMobileMenuOpen(false)}
              handleLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:block">
        <ClientSidebar
          profile={profile}
          unreadMessages={unreadMessages}
          handleLogout={handleLogout}
        />
      </aside>

      {/* The Today screen has its own header on mobile; other pages get a slim bar. */}
      {!isToday && (
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/client" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-base font-bold">CoachSync</span>
          </Link>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-xl border border-line bg-white p-2 text-ink"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-7">
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

function ClientSidebar({
  profile,
  unreadMessages,
  closeMenu,
  handleLogout,
}: {
  profile: ProfileSummary | null;
  unreadMessages: number;
  closeMenu?: () => void;
  handleLogout: () => void;
}) {
  const location = useLocation();
  const name = profile?.full_name || "Your profile";

  function renderItem(item: ClientMenuItem) {
    const isActive = location.pathname === item.to;
    const Icon = item.icon;
    const badge = item.to === "/client-messages" ? unreadMessages : 0;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={closeMenu}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
          isActive
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
        to="/client"
        onClick={closeMenu}
        className="mb-6 flex items-center gap-3 px-1.5"
      >
        <LogoMark />
        <span className="font-display text-[17px] font-bold">CoachSync</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {primaryItems.map(renderItem)}

        <p className="px-3 pb-1 pt-6 text-xs font-medium uppercase tracking-wide text-muted/70">
          More
        </p>
        {secondaryItems.map(renderItem)}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-canvas p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-xs font-bold text-white">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(profile?.full_name || "")
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <Link
            to="/client-settings"
            onClick={closeMenu}
            className="text-xs font-medium text-accent hover:underline"
          >
            Edit profile
          </Link>
        </div>

        <button
          type="button"
          onClick={handleLogout}
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
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          const badge = item.to === "/client-messages" ? unreadMessages : 0;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${
                isActive ? "text-accent" : "text-ink/75"
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
