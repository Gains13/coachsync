import { ReactNode, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientMenuItem = {
  to: string;
  title: string;
  icon: string;
  badge?: number;
};

type ClientLayoutProps = {
  children: ReactNode;
  unreadMessages?: number;
};

export default function ClientLayout({
  children,
  unreadMessages = 0,
}: ClientLayoutProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = useMemo<ClientMenuItem[]>(
    () => [
      {
        to: "/client",
        title: "Dashboard",
        icon: "🏠",
      },
      {
        to: "/client-plan",
        title: "My Plan",
        icon: "📋",
      },
      {
        to: "/client-messages",
        title: "Messages",
        icon: "💬",
        badge: unreadMessages,
      },
      {
        to: "/client-goals",
        title: "Goals",
        icon: "🎯",
      },
      {
        to: "/client-assessment",
        title: "Assessment",
        icon: "📊",
      },
      {
        to: "/client-past-workouts",
        title: "Past Workouts",
        icon: "🕓",
      },
      {
        to: "/client-progress",
        title: "Progress",
        icon: "📈",
      },
      {
        to: "/client-settings",
        title: "Settings",
        icon: "⚙️",
      },
    ],
    [unreadMessages]
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("coachsync-user-role");
    localStorage.removeItem("coachsync-client-id");
    navigate("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-80 max-w-[86vw] flex-col border-r border-sky-100 bg-white shadow-2xl">
            <ClientSidebar
              menuItems={menuItems}
              unreadMessages={unreadMessages}
              closeMenu={() => setMobileMenuOpen(false)}
              handleLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-sky-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-sm active:scale-[0.98]"
          >
            <span className="text-lg">☰</span>
            Menu
          </button>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-black text-slate-900">
              CoachSync
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              Client Portal
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm active:scale-[0.98]"
          >
            Logout
          </button>
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl gap-6 px-3 py-4 sm:px-6 sm:py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
            <ClientSidebar
              menuItems={menuItems}
              unreadMessages={unreadMessages}
              handleLogout={handleLogout}
            />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </section>
    </main>
  );
}

function ClientSidebar({
  menuItems,
  unreadMessages,
  closeMenu,
  handleLogout,
}: {
  menuItems: ClientMenuItem[];
  unreadMessages: number;
  closeMenu?: () => void;
  handleLogout: () => void;
}) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sky-100 p-4">
        <Link
          to="/client"
          onClick={closeMenu}
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
            C
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">
              CoachSync
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">
              Client Portal
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={`relative flex items-center gap-3 rounded-2xl border p-3 text-sm font-bold transition ${
                isActive
                  ? "border-blue-200 bg-blue-600 text-white shadow-sm"
                  : "border-transparent text-slate-700 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>

              {item.badge && item.badge > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black ${
                    isActive
                      ? "bg-white text-blue-700"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {unreadMessages > 0 && (
        <div className="mx-4 mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-sm font-black text-blue-900">
            {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            Check your latest trainer update.
          </p>
        </div>
      )}

      <div className="border-t border-sky-100 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-black text-red-700 transition hover:bg-red-100"
        >
          <span className="text-lg">🚪</span>
          Log out
        </button>
      </div>
    </div>
  );
}