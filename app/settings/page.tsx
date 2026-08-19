'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard?openSettings=true');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <p className="text-slate-400 text-sm select-none">Opening Settings...</p>
    </div>
  );
}
