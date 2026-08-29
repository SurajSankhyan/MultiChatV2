'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import '@/multichat/index.css';

const OverlayView = dynamic(
  () => import('@/multichat/components/OverlayView'),
  {
    ssr: false,
    loading: () => null
  }
);

export default function OverlayPage() {
  return <OverlayView />;
}
