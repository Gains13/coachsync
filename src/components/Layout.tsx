import { Link, NavLink } from 'react-router'
import {
  Dumbbell,
  Home,
  MessageCircle,
  ShoppingBag,
  ClipboardList,
  BarChart3,
  UserCog,
} from 'lucide-react'

type LayoutProps = {
  children: React.ReactNode
}

const navItems = [
  { to: '/client', label: 'Dashboard', icon: Home },
  { to: '/program', label: 'My Program', icon: ClipboardList },
  { to: '/tracker', label: 'Tracker', icon: Dumbbell },
  { to: '/history', label: 'History', icon: BarChart3 },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/store', label: 'Programs', icon: ShoppingBag },
  { to: '/trainer', label: 'Trainer', icon: UserCog },
]

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Dumbbell size={22} />
            </div>
            <div>
              <p className="font-bold text-slate-900">CoachSync</p>
              <p className="text-xs text-slate-500">Training Portal</p>
            </div>
          </Link>

          <nav className="hidden gap-2 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex flex-col items-center gap-1 px-2 py-2 text-xs ${
                  isActive ? 'text-emerald-700' : 'text-slate-500'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}