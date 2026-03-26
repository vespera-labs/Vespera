'use client';

import Image from 'next/image';
import { FaArrowRightFromBracket } from 'react-icons/fa6';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import { useAuth } from '@/store/authStore';
import { getAdminNavItems } from './navigation';
import Link from 'next/link';

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems = getAdminNavItems(user?.role);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <aside className="hidden md:flex md:flex-col md:w-20 lg:w-56 h-screen backdrop-blur-xl bg-slate-900/50 border-r border-white/10">
      <Logo
        size="lg"
        href="/"
        className="justify-center lg:justify-start"
        textClassName="hidden lg:block text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent"
      />

      <nav className="flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex gap-3 items-center px-6 py-3 cursor-pointer transition-all duration-200
                ${
                  isActive
                    ? 'bg-white/10 text-white lg:border-l-4 lg:border-blue-500 shadow-lg'
                    : 'text-blue-200/60 hover:bg-white/5 hover:text-white'
                }
                md:flex-col gap-3 md:py-4 lg:flex-row lg:items-center lg:px-6
              `}
            >
              <item.icon className="w-5 h-5 md:w-6 md:h-6 mx-auto md:mx-0" />
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          );
        })}
        {navItems.length === 0 && (
          <p className="px-6 py-4 text-xs text-blue-200/60">
            No admin pages are available for your role.
          </p>
        )}
      </nav>

      <div className="hidden lg:block p-4 border-t border-white/10">
        <button className="group flex items-center gap-3 rounded-xl px-4 py-2.5 hover:bg-white/10 transition-colors cursor-pointer w-full text-left">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20">
            <Image
              src="/avatar.png"
              alt="User Avatar"
              width={100}
              height={100}
              sizes="40px"
              className="rounded-full"
            />
          </div>

          <div className="flex flex-col items-start overflow-hidden">
            <span className="text-sm font-semibold text-white truncate w-full">
              {fullName || user?.email || 'Admin User'}
            </span>
            <span className="text-xs text-blue-300/60 capitalize">
              {user?.role || 'admin'}
            </span>
          </div>

          <FaArrowRightFromBracket className="h-5 w-5 text-blue-300/40 group-hover:text-blue-300 transition-colors ml-auto" />
        </button>
      </div>
    </aside>
  );
}
