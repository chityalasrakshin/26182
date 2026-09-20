import React from 'react';
import { Metadata } from 'next';
import { ForensicsDashboard } from '../../components/forensics/ForensicsDashboard';

export const metadata: Metadata = {
  title: 'Reactor Forensics — Cyber-Forensics Workstation',
  description:
    'High-density law-enforcement blockchain intelligence, multi-hop peeling analysis, animated fund flows, and statutory Section 91 CrPC SAHYOG routing.',
};

export default function ForensicsRoutePage() {
  return (
    <main className="w-full h-screen bg-slate-950 overflow-hidden select-none">
      <ForensicsDashboard />
    </main>
  );
}
