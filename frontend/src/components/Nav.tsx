"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, LayoutDashboard, CreditCard, LogOut, Menu, X } from "lucide-react";

export default function Nav() {
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => { setToken(localStorage.getItem("token")); }, []);

  const logout = () => { localStorage.removeItem("token"); setToken(null); router.push("/"); };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Mic className="w-5 h-5 text-blue-600" /> Meetily
        </Link>
        <div className="hidden sm:flex items-center gap-4">
          {token ? (
            <>
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"><LayoutDashboard className="w-4 h-4" /> Dashboard</Link>
              <Link href="/pricing" className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Plan</Link>
              <button onClick={logout} className="text-sm text-gray-600 hover:text-red-600 flex items-center gap-1"><LogOut className="w-4 h-4" /> Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600">Login</Link>
              <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">Sign Up</Link>
            </>
          )}
        </div>
        <button className="sm:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-3">
          {token ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              <Link href="/pricing" onClick={() => setOpen(false)}>Plan</Link>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
              <Link href="/register" onClick={() => setOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
