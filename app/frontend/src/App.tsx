import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { ErrorLogPanel } from './components/ErrorLogPanel';
import { SearchOverlay } from './components/SearchOverlay';
import { KeyboardHelp } from './components/KeyboardHelp';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { UndoToast, getUndoTrigger } from './components/UndoToast';
import { SyncProgressOverlay } from './components/SyncProgressOverlay';
import { IssueDiscoveryOverlay, type DiscoveryPhase } from './components/IssueDiscoveryOverlay';
import { useSync, useSetupStatus } from './api/hooks';
import { BriefingPage } from './pages/BriefingPage';
import './styles/tufte.css';

// Lazy-loaded pages — each gets its own chunk
const NotePage = lazy(() => import('./pages/NotePage').then(m => ({ default: m.NotePage })));
const PersonPage = lazy(() => import('./pages/PersonPage').then(m => ({ default: m.PersonPage })));
const OrgTreePage = lazy(() => import('./pages/OrgTreePage').then(m => ({ default: m.OrgTreePage })));
const NewsPage = lazy(() => import('./pages/NewsPage').then(m => ({ default: m.NewsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ClaudePage = lazy(() => import('./pages/ClaudePage').then(m => ({ default: m.ClaudePage })));
const ThoughtsPage = lazy(() => import('./pages/ThoughtsPage').then(m => ({ default: m.ThoughtsPage })));
const GitHubPage = lazy(() => import('./pages/GitHubPage').then(m => ({ default: m.GitHubPage })));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const IssuesPage = lazy(() => import('./pages/IssuesPage').then(m => ({ default: m.IssuesPage })));
const LongformPage = lazy(() => import('./pages/LongformPage').then(m => ({ default: m.LongformPage })));
const PrioritiesPage = lazy(() => import('./pages/PrioritiesPage').then(m => ({ default: m.PrioritiesPage })));
const SlackPage = lazy(() => import('./pages/SlackPage').then(m => ({ default: m.SlackPage })));
const NotionPage = lazy(() => import('./pages/NotionPage').then(m => ({ default: m.NotionPage })));
const EmailPage = lazy(() => import('./pages/EmailPage').then(m => ({ default: m.EmailPage })));
const RampPage = lazy(() => import('./pages/RampPage').then(m => ({ default: m.RampPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const SetupPage = lazy(() => import('./pages/SetupPage').then(m => ({ default: m.SetupPage })));
const PersonasPage = lazy(() => import('./pages/PersonasPage').then(m => ({ default: m.PersonasPage })));
const DrivePage = lazy(() => import('./pages/DrivePage').then(m => ({ default: m.DrivePage })));
const PeoplePage = lazy(() => import('./pages/PeoplePage').then(m => ({ default: m.PeoplePage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RootRedirect() {
  const { data: setupStatus, isLoading } = useSetupStatus();
  if (isLoading) return null;
  if (setupStatus && !setupStatus.setup_complete) {
    return <Navigate to="/setup" replace />;
  }
  return <BriefingPage />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const sync = useSync();
  const isFetching = useIsFetching();
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discoveryPhase, setDiscoveryPhase] = useState<DiscoveryPhase>('hidden');
  const isClaudePage = location.pathname === '/claude';
  const isSetupPage = location.pathname === '/setup';

  useKeyboardShortcuts({
    navigate,
    onSearchOpen: () => setSearchOpen(prev => !prev),
    onHelpOpen: () => setHelpOpen(prev => !prev),
    onRefresh: () => queryClient.invalidateQueries(),
    onUndo: () => { getUndoTrigger()?.(); },
    onSync: () => sync.mutate(),
    onDiscoverIssues: () => {
      if (discoveryPhase === 'hidden') {
        setDiscoveryPhase('scanning');
      } else if (discoveryPhase === 'ready') {
        setDiscoveryPhase('reviewing');
      }
    },
    suppressWhen: searchOpen || helpOpen || discoveryPhase === 'reviewing',
  });

  // Setup page gets full-width layout without sidebar
  if (isSetupPage) {
    return (
      <main className="main" style={{ marginLeft: 0 }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/setup" element={<SetupPage />} />
          </Routes>
        </Suspense>
      </main>
    );
  }

  return (
    <>
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/help" element={<HelpPage />} />
              <Route path="/" element={<RootRedirect />} />
              <Route path="/priorities" element={<PrioritiesPage />} />
              <Route path="/notes" element={<NotePage />} />
              <Route path="/thoughts" element={<ThoughtsPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/longform" element={<LongformPage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/team" element={<OrgTreePage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/people/:id" element={<PersonPage />} />
              <Route path="/employees/:id" element={<PersonPage />} /> {/* backward compat redirect */}
              <Route path="/github" element={<GitHubPage />} />
              <Route path="/email" element={<EmailPage />} />
              <Route path="/slack" element={<SlackPage />} />
              <Route path="/notion" element={<NotionPage />} />
              <Route path="/drive" element={<DrivePage />} />
              <Route path="/ramp" element={<RampPage />} />
              <Route path="/ramp/bills" element={<RampPage />} />
              <Route path="/ramp/projects" element={<RampPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/personas" element={<PersonasPage />} />
              <Route path="/claude" element={null} />
            </Routes>
            <div style={{ display: isClaudePage ? 'contents' : 'none' }}>
              <ClaudePage visible={isClaudePage} overlayOpen={searchOpen || helpOpen} />
            </div>
          </Suspense>
        </main>
      </div>
      <SyncProgressOverlay />
      <IssueDiscoveryOverlay phase={discoveryPhase} onPhaseChange={setDiscoveryPhase} />
      <ErrorLogPanel />
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onHelpOpen={() => { setSearchOpen(false); setHelpOpen(true); }}
      />
      <KeyboardHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <UndoToast />
      {isFetching > 0 && (
        <div className="global-fetch-indicator" aria-label="Loading data">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 14" />
          </svg>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
