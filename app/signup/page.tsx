'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { UnifiedAuth } from '../login/page';

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <UnifiedAuth initialToggled={true} />
    </Suspense>
  );
}
