'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { OS_CONFIG } from '@/config/osConfig';
import { ROOM_CONTENT_CONFIG, type CertificateEntry } from '@/config/roomContent';
import type { OSProject, ParsedProfileInfo, WelcomeGitHubSummary } from '@/utils/githubProjects';
import {
  AchievementMiniBadge,
  ArrowRightSvgIcon,
  SocialSvgIcon,
} from '@/components/welcome/WelcomeIcons';

interface QuickViewClientProps {
  summary: WelcomeGitHubSummary;
  profile: ParsedProfileInfo;
  projects: OSProject[];
  certificates: ReadonlyArray<CertificateEntry>;
}

type ProjectCategory = 'all' | 'vision' | 'intelligence' | 'web';

// Curated high-impact descriptions for Rai's flagship projects
const CURATED_PROJECT_SUMMARIES: Record<string, string> = {
  'Detect-Deepfakes-from-Facial-Blood-Flow':
    'Biometric deepfake detection engine extracting photoplethysmography (PPG) pulse signals from facial blood flow variations using advanced computer vision.',
  'VoicePulse-AI':
    'Neural voice intelligence platform engineered for sub-second, multi-dialect conversational audio generation and speech synthesis.',
  'DocuPulse-AI':
    'Intelligent document analysis & RAG architecture powered by dense vector embeddings and multimodal LLM question-answering.',
  'DataPulse-AI':
    'Automated exploratory data analysis, dynamic feature engineering, and predictive machine learning pipeline with interactive reporting.',
  'SignAi':
    'Real-time sign language interpreter translating spatial hand gestures and landmarks into natural language via MediaPipe & computer vision.',
  'Email-Assistant':
    'Autonomous contextual email drafting and thread summarization system designed to streamline communication workflows.',
  'Text-to-Hand-Written':
    'Generative synthesis tool converting digital typographic text into realistic, organic human handwriting with customized pen physics.',
  'NightCast':
    'Cinematic streaming discovery and media curation web application featuring fluid micro-interactions and dark-mode aesthetics.',
};

/**
 * Interactive Spotlight Card (Linear/Vercel craft)
 * Calculates cursor coordinates on mousemove and casts an ultra-subtle radial highlight
 */
function SpotlightCard({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setCoords(null);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Dynamic Cursor Spotlight Beam */}
      {coords && (
        <div
          className="pointer-events-none absolute -inset-px opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(255,255,255,0.06), transparent 80%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Animated Number Counter for stats
 */
function AnimatedMetric({
  target,
  prefix = '',
  suffix = '',
  delay = 200,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let animId: number;
    let startTime: number | null = null;
    const duration = 1200;

    const timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setVal(Math.floor(ease * target));
        if (progress < 1) {
          animId = requestAnimationFrame(animate);
        }
      };
      animId = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, delay]);

  return (
    <span>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

export default function QuickViewClient({
  summary,
  profile,
  projects,
  certificates,
}: QuickViewClientProps) {
  // State
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLightboxCert, setActiveLightboxCert] = useState<CertificateEntry | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Enable native scrolling on Quick View page while restoring room overflow on unmount
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Keyboard shortcut to close lightbox modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLightboxCert) {
        setActiveLightboxCert(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxCert]);

  const handleCopyEmail = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(OS_CONFIG.contact.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2400);
    }
  }, []);

  // Categorize projects for filter tabs
  const categorizedProjects = useMemo(() => {
    return projects.map((p) => {
      const lower = (p.name + ' ' + p.description + ' ' + p.topics.join(' ')).toLowerCase();
      let category: ProjectCategory = 'web';
      if (
        lower.includes('deepfake') ||
        lower.includes('blood') ||
        lower.includes('sign') ||
        lower.includes('vision') ||
        lower.includes('hand-written') ||
        lower.includes('opencv')
      ) {
        category = 'vision';
      } else if (
        lower.includes('pulse') ||
        lower.includes('voice') ||
        lower.includes('docu') ||
        lower.includes('email') ||
        lower.includes('data') ||
        lower.includes('ai')
      ) {
        category = 'intelligence';
      }
      return {
        ...p,
        category,
        curatedDesc: CURATED_PROJECT_SUMMARIES[p.name] || p.description,
      };
    });
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return categorizedProjects.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.curatedDesc.toLowerCase().includes(q) ||
        p.topics.some((t) => t.toLowerCase().includes(q)) ||
        (p.primaryLanguage && p.primaryLanguage.toLowerCase().includes(q))
      );
    });
  }, [categorizedProjects, selectedCategory, searchQuery]);

  return (
    <div className="relative min-h-screen w-full bg-[#08090C] text-[#F3F4F6] selection:bg-white/20 selection:text-white overflow-y-auto overflow-x-hidden font-sans">
      {/* ============================================================ */}
      {/* DYNAMIC AMBIENT BACKDROP WITH SUBTLE DRIFT MOTION */}
      {/* ============================================================ */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Breathing Indigo Orb */}
        <div className="animate-quick-orb-1 absolute -top-[15%] left-1/2 -translate-x-1/2 h-[650px] w-[1100px] rounded-full bg-indigo-600/[0.045] blur-[170px]" />
        {/* Breathing Blue Orb */}
        <div className="animate-quick-orb-2 absolute top-[40%] -right-[15%] h-[550px] w-[650px] rounded-full bg-blue-600/[0.035] blur-[180px]" />
        {/* Subtle Warm Amber Ground Glow */}
        <div className="animate-quick-orb-1 absolute bottom-[5%] -left-[10%] h-[500px] w-[600px] rounded-full bg-amber-500/[0.025] blur-[170px]" />
        {/* Precision Micro Grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ============================================================ */}
      {/* 1. MINIMALIST EDITORIAL HEADER (Animated Slide-Down) */}
      {/* ============================================================ */}
      <header className="animate-quick-fade-in sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090C]/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          {/* Brand Identity */}
          <div className="flex items-center gap-8">
            <Link
              href="/quick"
              className="group flex items-center gap-3 text-sm tracking-tight text-white focus-visible:outline-none"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white font-mono text-xs font-semibold shadow-inner group-hover:border-white/30 group-hover:scale-105 transition-all">
                RF
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-zinc-100 group-hover:text-white transition-colors">
                  {summary.displayName}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono tracking-tight">
                  Portfolio & Dossier
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav
              aria-label="Section navigation"
              className="hidden md:flex items-center gap-6 text-[13px] font-medium text-zinc-400"
            >
              <a href="#overview" className="hover:text-white transition-colors">
                Overview
              </a>
              <a href="#expertise" className="hover:text-white transition-colors">
                Expertise
              </a>
              <a href="#projects" className="hover:text-white transition-colors">
                Systems & Code
              </a>
              <a href="#credentials" className="hover:text-white transition-colors">
                Certifications
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Contact
              </a>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href={OS_CONFIG.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-200 hover:border-white/25 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
            >
              <SocialSvgIcon kind="resume" />
              <span>Resume PDF</span>
            </a>

            <Link
              href="/"
              className="relative group inline-flex h-9 items-center gap-2 overflow-hidden rounded-lg bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-zinc-100 transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              {/* Subtle Shimmer Sheen */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="animate-quick-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              </div>
              <span className="relative z-10">Enter 3D Room</span>
              <ArrowRightSvgIcon className="relative z-10 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN CONTAINER */}
      {/* ============================================================ */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 py-12 sm:py-20 space-y-32">
        {/* ============================================================ */}
        {/* HERO SECTION (Staggered Animation Entries) */}
        {/* ============================================================ */}
        <section id="overview" className="space-y-10">
          {/* Availability Status Badge */}
          <div
            className="animate-quick-fade-up inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-mono text-zinc-300"
            style={{ animationDelay: '100ms' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Applied AI & Computer Vision Engineer</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">Available for select roles & contracts</span>
          </div>

          {/* Typography Masthead */}
          <div className="space-y-6 max-w-4xl">
            <h1
              className="animate-quick-fade-up text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08]"
              style={{ animationDelay: '200ms' }}
            >
              Engineering intelligent systems,{' '}
              <span className="font-serif italic font-normal text-zinc-300">
                computer vision
              </span>
              , and real-time graphics.
            </h1>

            <p
              className="animate-quick-fade-up text-lg sm:text-xl font-normal text-zinc-400 leading-relaxed max-w-3xl"
              style={{ animationDelay: '300ms' }}
            >
              I am <span className="font-medium text-zinc-200">{summary.displayName}</span>. I design
              biometric forensics models, autonomous multi-agent systems, and production-grade full-stack
              applications with high-performance 3D spatial computing.
            </p>
          </div>

          {/* Action Row */}
          <div
            className="animate-quick-fade-up flex flex-wrap items-center gap-3.5 pt-2"
            style={{ animationDelay: '400ms' }}
          >
            <Link
              href="/"
              className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-lg bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-all cursor-pointer shadow-sm"
            >
              {/* Shimmer Sheen */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="animate-quick-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              </div>
              <span className="relative z-10">Explore Interactive 3D Room</span>
              <ArrowRightSvgIcon className="relative z-10 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href={OS_CONFIG.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 hover:border-white/20 hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <SocialSvgIcon kind="resume" />
              <span>Download CV (PDF)</span>
            </a>

            <button
              type="button"
              onClick={handleCopyEmail}
              className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all cursor-pointer ${
                copiedEmail
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <SocialSvgIcon kind="email" />
              <span>{copiedEmail ? 'Email Copied! ✓' : 'Copy Email'}</span>
            </button>

            {/* Social Links */}
            <div className="flex items-center gap-2 pl-1">
              <a
                href={OS_CONFIG.contact.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Profile"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white hover:scale-105 transition-all"
              >
                <SocialSvgIcon kind="github" />
              </a>
              <a
                href={OS_CONFIG.contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn Profile"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white hover:scale-105 transition-all"
              >
                <SocialSvgIcon kind="linkedin" />
              </a>
              <a
                href={OS_CONFIG.contact.fiverr}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Fiverr Freelance"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white hover:scale-105 transition-all"
              >
                <SocialSvgIcon kind="fiverr" />
              </a>
            </div>
          </div>

          {/* Key Metrics Strip (Animated Number Counters) */}
          <div
            className="animate-quick-fade-up grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6"
            style={{ animationDelay: '500ms' }}
          >
            {[
              {
                metricElement: <AnimatedMetric target={8} suffix="+" delay={200} />,
                label: 'Flagship Systems',
                detail: 'Vision, Audio, RAG & Web',
              },
              {
                metricElement: <AnimatedMetric target={3} suffix="x" delay={300} />,
                label: 'Industry Certifications',
                detail: 'Anthropic & AWS Certified',
              },
              {
                metricElement: <AnimatedMetric target={2} suffix="x" delay={400} />,
                label: 'GitHub Honors',
                detail: 'Pull Shark & Pair Contributor',
              },
              {
                metricElement: <AnimatedMetric target={60} suffix=" FPS" delay={500} />,
                label: 'Spatial 3D Engine',
                detail: 'Three.js & WebGL Architecture',
              },
            ].map((stat, i) => (
              <SpotlightCard key={i} className="p-5">
                <div className="font-mono text-3xl font-bold tracking-tight text-white mb-1">
                  {stat.metricElement}
                </div>
                <div className="text-sm font-medium text-zinc-200">{stat.label}</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{stat.detail}</div>
              </SpotlightCard>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. CORE EXPERTISE & TECHNICAL MATRIX */}
        {/* ============================================================ */}
        <section id="expertise" className="space-y-8">
          <div className="border-b border-white/[0.08] pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              01 / Architecture & Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              Core Technical Disciplines
            </h2>
          </div>

          {/* Interactive Spotlight Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Discipline 1 */}
            <SpotlightCard className="p-6 space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 group-hover:scale-110 group-hover:border-white/20 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-zinc-100 transition-colors">
                Biometric Vision & Forensics
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Extracting remote photoplethysmography (rPPG) pulse signals from facial blood flow variations to detect synthetic media and deepfakes. Real-time landmark tracking via MediaPipe.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-300">
                {['PyTorch', 'OpenCV', 'MediaPipe', 'ONNX', 'TFLite'].map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 group-hover:border-white/15 transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </SpotlightCard>

            {/* Discipline 2 */}
            <SpotlightCard className="p-6 space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 group-hover:scale-110 group-hover:border-white/20 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-zinc-100 transition-colors">
                Neural Intelligence & RAG
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Autonomous agent orchestration, sub-second speech synthesis, conversational voice intelligence, and dense vector embedding pipelines for enterprise question-answering.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-300">
                {['LLM Agents', 'FastAPI', 'RAG', 'Vector Search', 'TTS Models'].map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 group-hover:border-white/15 transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </SpotlightCard>

            {/* Discipline 3 */}
            <SpotlightCard className="p-6 space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 group-hover:scale-110 group-hover:border-white/20 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="m9 8 6 4-6 4Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-zinc-100 transition-colors">
                Spatial Web & Full-Stack
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Building immersive 3D WebGL experiences with custom GLSL shaders, React Three Fiber, Next.js App Router, and responsive full-stack cloud backends.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-300">
                {['Next.js', 'React', 'Three.js / R3F', 'GLSL', 'Docker'].map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 group-hover:border-white/15 transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </SpotlightCard>
          </div>

          {/* Full Tech Stack Categorized */}
          <SpotlightCard className="p-6 sm:p-8 space-y-6">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Technical Stack Matrix
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
              <div>
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                  Languages
                </div>
                <div className="flex flex-wrap gap-2">
                  {OS_CONFIG.skills.languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:border-white/20 hover:scale-105 transition-all"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                  AI & Machine Learning
                </div>
                <div className="flex flex-wrap gap-2">
                  {OS_CONFIG.skills.aiMl.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:border-white/20 hover:scale-105 transition-all"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                  Systems, Web & Tools
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...OS_CONFIG.skills.appEng, 'Three.js', 'WebGL', 'Tailwind'].map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:border-white/20 hover:scale-105 transition-all"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Philosophy quote */}
            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-sm font-light text-zinc-400 italic">
                &ldquo;{profile.mindset}&rdquo;
              </p>
            </div>
          </SpotlightCard>
        </section>

        {/* ============================================================ */}
        {/* 3. FLAGSHIP PROJECTS SHOWCASE */}
        {/* ============================================================ */}
        <section id="projects" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                02 / Selected Works
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Featured Engineering Systems
              </h2>
            </div>

            {/* Category Segmented Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
              {[
                { id: 'all', label: `All (${categorizedProjects.length})` },
                { id: 'vision', label: 'Computer Vision' },
                { id: 'intelligence', label: 'Neural AI & RAG' },
                { id: 'web', label: 'Full-Stack' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id as ProjectCategory)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    selectedCategory === tab.id
                      ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Filter by keyword, topic, or technology..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 pl-9 text-xs text-zinc-100 placeholder-zinc-500 focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/25 transition-all"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Projects Cards Grid with Spotlight */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((proj) => {
              const hasLive = Boolean(proj.liveUrl);
              const hasCode = Boolean(proj.htmlUrl);

              return (
                <SpotlightCard
                  key={proj.id}
                  className="flex flex-col justify-between p-5"
                >
                  <div className="space-y-3.5">
                    {/* Header meta */}
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      {proj.primaryLanguage ? (
                        <span className="inline-flex items-center gap-1.5 text-zinc-300 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                          {proj.primaryLanguage}
                        </span>
                      ) : (
                        <span className="text-zinc-500">System</span>
                      )}

                      {proj.isExtra ? (
                        <span className="relative overflow-hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 font-mono font-medium">
                          <span className="animate-quick-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
                          FLAGSHIP
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">
                          ★ {proj.stars}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-white group-hover:text-zinc-200 transition-colors">
                      {proj.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {proj.curatedDesc}
                    </p>

                    {/* Tags */}
                    {proj.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.topics.slice(0, 4).map((topic) => (
                          <span
                            key={topic}
                            className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 group-hover:border-white/10 transition-colors"
                          >
                            #{topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {hasCode && (
                        <a
                          href={proj.htmlUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer"
                        >
                          <SocialSvgIcon kind="github" />
                          <span>Code</span>
                        </a>
                      )}
                      {hasLive && (
                        <a
                          href={proj.liveUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/btn inline-flex h-7 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
                        >
                          <span>Live</span>
                          <ArrowRightSvgIcon className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                        </a>
                      )}
                    </div>

                    {proj.updatedAt && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(proj.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>

          {filteredProjects.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-12 text-center text-xs font-mono text-zinc-400">
              No projects matching &ldquo;{searchQuery}&rdquo; in category &ldquo;{selectedCategory}&rdquo;.
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* 4. VERIFIED CREDENTIALS & ACHIEVEMENTS */}
        {/* ============================================================ */}
        <section id="credentials" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                03 / Verified Credentials
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Certifications & GitHub Honors
              </h2>
            </div>

            {/* Achievement Mini Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {ROOM_CONTENT_CONFIG.achievements.map((ach) => (
                <AchievementMiniBadge key={ach.id} achievement={ach} />
              ))}
            </div>
          </div>

          {/* Certificate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {certificates.map((cert) => {
              return (
                <SpotlightCard
                  key={cert.id}
                  className="flex flex-col justify-between p-5"
                >
                  <div>
                    {/* Thumbnail Preview */}
                    {cert.imageUrl && (
                      <div
                        onClick={() => setActiveLightboxCert(cert)}
                        className="group/img relative mb-4 aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/40"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cert.imageUrl}
                          alt={cert.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-mono text-zinc-200">
                            Inspect Full View
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Issuer & Date */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1">
                      <span className="font-medium text-zinc-300">{cert.issuer}</span>
                      <span>{cert.date}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-white">
                      {cert.title}
                    </h3>

                    {/* Description */}
                    {cert.description && (
                      <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2">
                        {cert.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                    {cert.pdfUrl ? (
                      <>
                        <a
                          href={cert.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer"
                        >
                          View PDF
                        </a>
                        <a
                          href={cert.pdfUrl}
                          download
                          className="flex-1 text-center py-1.5 rounded-md bg-white text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer"
                        >
                          Download
                        </a>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveLightboxCert(cert)}
                        className="w-full text-center py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer"
                      >
                        Inspect Document
                      </button>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. DIRECT COLLABORATION LOUNGE */}
        {/* ============================================================ */}
        <SpotlightCard className="p-8 sm:p-12">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                Direct Contact
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Let&apos;s build something remarkable.
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Available for applied AI engineering roles, technical advisory, or spatial WebGL projects.
              </p>
              <div className="font-mono text-xs text-zinc-400 pt-1">
                Direct email:{' '}
                <a
                  href={`mailto:${OS_CONFIG.contact.email}`}
                  className="text-white hover:underline font-medium"
                >
                  {OS_CONFIG.contact.email}
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={`mailto:${OS_CONFIG.contact.email}`}
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
              >
                <SocialSvgIcon kind="email" />
                <span>Send Email</span>
              </a>

              <Link
                href="/"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 text-xs font-medium text-zinc-200 hover:border-white/20 hover:text-white transition-all cursor-pointer"
              >
                <span>Enter 3D Room</span>
                <ArrowRightSvgIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </SpotlightCard>
      </main>

      {/* ============================================================ */}
      {/* FOOTER */}
      {/* ============================================================ */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#08090C] py-8 mt-24">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-8 text-xs font-mono text-zinc-500">
          <div>
            © 2026 {summary.displayName}. All rights reserved.
          </div>

          <div className="flex items-center gap-5">
            <a
              href={OS_CONFIG.contact.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href={OS_CONFIG.contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              LinkedIn
            </a>
            <a
              href={OS_CONFIG.contact.fiverr}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Fiverr
            </a>
            <Link href="/" className="text-zinc-300 hover:text-white transition-colors">
              Interactive 3D Room ↗
            </Link>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* LIGHTBOX MODAL FOR CERTIFICATE PREVIEWS */}
      {/* ============================================================ */}
      {activeLightboxCert && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveLightboxCert(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-3xl w-full overflow-hidden rounded-xl border border-white/10 bg-[#0E1015] p-5 shadow-2xl flex flex-col justify-between"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] text-xs">
              <div>
                <span className="font-mono text-zinc-400 uppercase">{activeLightboxCert.issuer}</span>
                <h3 className="text-base font-semibold text-white mt-0.5">{activeLightboxCert.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLightboxCert(null)}
                className="h-8 w-8 rounded-md border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {activeLightboxCert.imageUrl && (
              <div className="my-4 max-h-[60vh] overflow-hidden rounded-lg border border-white/10 bg-black flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightboxCert.imageUrl}
                  alt={activeLightboxCert.title}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs">
              <span className="font-mono text-zinc-500">Date: {activeLightboxCert.date}</span>
              <div className="flex items-center gap-2">
                {activeLightboxCert.pdfUrl && (
                  <a
                    href={activeLightboxCert.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-md bg-white font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
                  >
                    Open PDF File
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveLightboxCert(null)}
                  className="px-3 py-1.5 rounded-md border border-white/10 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
