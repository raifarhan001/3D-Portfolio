import type { Metadata } from 'next';
import { ROOM_CONTENT_CONFIG } from '@/config/roomContent';
import { WELCOME_CONFIG } from '@/config/welcomeConfig';
import {
  getOSProjects,
  getParsedProfile,
  getWelcomeGitHubSummary,
} from '@/utils/githubProjects';
import QuickViewClient from '@/components/quick/QuickViewClient';

const summary = getWelcomeGitHubSummary();

export const metadata: Metadata = {
  title: `${WELCOME_CONFIG.seo.quickTitle} · Systems & Architecture Dossier`,
  description: summary.profileTagline || WELCOME_CONFIG.tagline,
  alternates: {
    canonical: '/quick',
  },
  openGraph: {
    title: `${WELCOME_CONFIG.seo.quickTitle} · Systems & Architecture Dossier`,
    description: summary.profileTagline || WELCOME_CONFIG.tagline,
    url: `${WELCOME_CONFIG.siteUrl.replace(/\/$/, '')}/quick`,
    type: 'website',
    images: [
      {
        url: WELCOME_CONFIG.seo.ogImageUrl,
        width: WELCOME_CONFIG.seo.ogWidth,
        height: WELCOME_CONFIG.seo.ogHeight,
        alt: WELCOME_CONFIG.seo.ogAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${WELCOME_CONFIG.seo.quickTitle} · Systems & Architecture Dossier`,
    description: summary.profileTagline || WELCOME_CONFIG.tagline,
    images: [WELCOME_CONFIG.seo.ogImageUrl],
  },
};

export default function QuickViewPage() {
  const profile = getParsedProfile();
  const projects = getOSProjects();
  const certificates = ROOM_CONTENT_CONFIG.certificates;

  return (
    <QuickViewClient
      summary={summary}
      profile={profile}
      projects={projects}
      certificates={certificates}
    />
  );
}
