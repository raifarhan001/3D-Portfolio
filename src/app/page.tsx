import { preload } from 'react-dom';
import { WELCOME_CONFIG } from '@/config/welcomeConfig';
import { getWelcomeGitHubSummary } from '@/utils/githubProjects';
import PortfolioEntry from '@/components/PortfolioEntry';

export default function Home() {
  preload(WELCOME_CONFIG.cinema.scenes[0].src, {
    as: 'image',
    fetchPriority: 'high',
  });

  const githubSummary = getWelcomeGitHubSummary();

  return <PortfolioEntry githubSummary={githubSummary} />;
}
