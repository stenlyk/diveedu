import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { useSettings, DISCLAIMER_VERSION } from '../db/settings';
import { Home } from '../features/Home';
import { Onboarding } from '../features/Onboarding';
import { AppShell } from './AppShell';
import { UpdatePrompt } from './UpdatePrompt';

// Stránky mimo úvodní obrazovku se načítají líně, aby první načtení zůstalo malé.
const Learn = lazy(() => import('../features/Learn').then((m) => ({ default: m.Learn })));
const Podcast = lazy(() => import('../features/Podcast').then((m) => ({ default: m.Podcast })));
const LessonPage = lazy(() => import('../features/LessonPage').then((m) => ({ default: m.LessonPage })));
const Train = lazy(() => import('../features/Train').then((m) => ({ default: m.Train })));
const QuickCheck = lazy(() => import('../features/Train').then((m) => ({ default: m.QuickCheck })));
const Review = lazy(() => import('../features/Train').then((m) => ({ default: m.Review })));
const Weaknesses = lazy(() => import('../features/Train').then((m) => ({ default: m.Weaknesses })));
const Topic = lazy(() => import('../features/Train').then((m) => ({ default: m.Topic })));
const Exam = lazy(() => import('../features/Train').then((m) => ({ default: m.Exam })));
const Scenarios = lazy(() => import('../features/Scenarios').then((m) => ({ default: m.Scenarios })));
const ScenarioPage = lazy(() => import('../features/Scenarios').then((m) => ({ default: m.ScenarioPage })));
const Mental = lazy(() => import('../features/Mental').then((m) => ({ default: m.Mental })));
const Dashboard = lazy(() => import('../features/Dashboard').then((m) => ({ default: m.Dashboard })));
const GraphPage = lazy(() => import('../features/GraphPage').then((m) => ({ default: m.GraphPage })));
const Tools = lazy(() => import('../features/Tools').then((m) => ({ default: m.Tools })));
const SimulatorPage = lazy(() => import('../features/Tools').then((m) => ({ default: m.SimulatorPage })));
const ToolPage = lazy(() => import('../features/Tools').then((m) => ({ default: m.ToolPage })));
const Cases = lazy(() => import('../features/Cases').then((m) => ({ default: m.Cases })));
const CasePage = lazy(() => import('../features/Cases').then((m) => ({ default: m.CasePage })));
const Settings = lazy(() => import('../features/Settings').then((m) => ({ default: m.Settings })));

export function App() {
  const { loaded, theme, disclaimerAccepted, load } = useSettings();

  useEffect(() => void load(), [load]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1418' : '#f4f8f9');
  }, [theme]);
  useEffect(() => {
    // Požádá prohlížeč, aby data nemazal při nedostatku místa (důležité hlavně na iOS).
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  if (!loaded) return null;
  if (disclaimerAccepted < DISCLAIMER_VERSION) return <Onboarding />;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<p className="p-6 text-muted">Načítám…</p>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="uceni" element={<Learn />} />
            <Route path="uceni/:lessonId" element={<LessonPage />} />
            <Route path="poslech" element={<Podcast />} />
            <Route path="trenink" element={<Train />} />
            <Route path="trenink/rychly-check" element={<QuickCheck />} />
            <Route path="trenink/opakovani" element={<Review />} />
            <Route path="trenink/slabiny" element={<Weaknesses />} />
            <Route path="trenink/tema" element={<Topic />} />
            <Route path="trenink/zkouska/:moduleId" element={<Exam />} />
            <Route path="trenink/z-hlavy" element={<Mental />} />
            <Route path="trenink/scenare" element={<Scenarios />} />
            <Route path="trenink/scenare/:scenarioId" element={<ScenarioPage />} />
            <Route path="prehled" element={<Dashboard />} />
            <Route path="graf" element={<GraphPage />} />
            <Route path="graf/:conceptId" element={<GraphPage />} />
            <Route path="nastroje" element={<Tools />} />
            <Route path="nastroje/simulator/:simId" element={<SimulatorPage />} />
            <Route path="nastroje/:toolId" element={<ToolPage />} />
            <Route path="pripady" element={<Cases />} />
            <Route path="pripady/:caseId" element={<CasePage />} />
            <Route path="nastaveni" element={<Settings />} />
            <Route path="*" element={<p>Stránka nenalezena.</p>} />
          </Route>
        </Routes>
      </Suspense>
      <UpdatePrompt />
    </BrowserRouter>
  );
}
