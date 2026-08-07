'use client';

import { useState } from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials } from '@/components/landing/Testimonials';
import { DataVisualizationPreview } from '@/components/landing/DataVisualizationPreview';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { AuthModal } from '@/components/auth/AuthModal';
import { FloatingParticles } from '@/components/effects/FloatingParticles';
import { WaveDivider } from '@/components/effects/WaveDivider';

export default function LandingPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-emerald-500/[0.04] to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-indigo-500/[0.03] to-transparent rounded-full blur-3xl" />
      </div>
      
      <LandingHeader onOpenAuth={() => setIsAuthOpen(true)} />
      
      <div className="relative">
        <FloatingParticles count={40} className="z-0" />
        <HeroSection onOpenAuth={() => setIsAuthOpen(true)} />
      </div>
      
      <WaveDivider fill="var(--bg-elevated)" />
      <FeatureGrid />
      
      <WaveDivider fill="var(--bg-surface)" />
      <HowItWorks />
      
      <WaveDivider fill="var(--bg-elevated)" flip />
      <DataVisualizationPreview />
      
      <WaveDivider fill="var(--bg-surface)" />
      <Testimonials />
      
      <WaveDivider fill="var(--bg-inset)" flip />
      <CTASection onOpenAuth={() => setIsAuthOpen(true)} />
      
      <Footer />
      
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
