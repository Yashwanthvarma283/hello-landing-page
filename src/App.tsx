import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { UserProvider } from "@/lib/user-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ActiveEffectsProvider } from "@/lib/active-effects";
import Index from "./pages/Index";
import StudyAnalytics from "./pages/StudyAnalytics";
import ProblemGenerator from "./pages/ProblemGenerator";
import StriverRoadmap from "./pages/StriverRoadmap";
import NeetCodeRoadmap from "./pages/NeetCodeRoadmap";
import LeetCodeTop150Roadmap from "./pages/LeetCodeTop150Roadmap";
import ModuleSelector from "./pages/ModuleSelector";
import ContestMode from "./pages/ContestMode";
import SpacedRepetition from "./pages/SpacedRepetition";
import PatternsLibrary from "./pages/PatternsLibrary";
import Leaderboard from "./pages/Leaderboard";
import ProblemWorkspace from "./pages/ProblemWorkspace";
import ResetPassword from "./pages/ResetPassword";
import Achievements from "./pages/Achievements";
import InterviewSimulator from "./pages/InterviewSimulator";
import CustomProblemCreator from "./pages/CustomProblemCreator";
import CommunitySolutions from "./pages/CommunitySolutions";
import Flashcards from "./pages/Flashcards";
import CompanyTags from "./pages/CompanyTags";
import WeeklyGoals from "./pages/WeeklyGoals";
import PomodoroTimer from "./pages/PomodoroTimer";
import Bookmarks from "./pages/Bookmarks";
import CheatSheet from "./pages/CheatSheet";
import CodePlayground from "./pages/CodePlayground";
import ProgressExport from "./pages/ProgressExport";
import LearningMode from "./pages/LearningMode";
import StudyPlanner from "./pages/StudyPlanner";
import WeakTopicAnalyzer from "./pages/WeakTopicAnalyzer";
import ComplexityTracker from "./pages/ComplexityTracker";
import NotFound from "./pages/NotFound";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import AdaptiveLearningPath from "./pages/AdaptiveLearningPath";
import CodeReview from "./pages/CodeReview";
import DiscussionForum from "./pages/DiscussionForum";
import TodayReview from "./pages/TodayReview";
import GlobalSearch from "./pages/GlobalSearch";
import StreakCalendar from "./pages/StreakCalendar";
import BigOVisualizer from "./pages/BigOVisualizer";
import UserProfile from "./pages/UserProfile";
import SubmissionHistory from "./pages/SubmissionHistory";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSignup from "./pages/AdminSignup";
import AdminAgentDashboard from "./pages/AdminAgentDashboard";
import QuickPractice from "./pages/QuickPractice";
import DailyQuestion from "./pages/DailyQuestion";
import Store from "./pages/Store";
import AdminCoins from "./pages/AdminCoins";
import CodeVisualizer from "./pages/CodeVisualizer";

import Mailbox from "./pages/Mailbox";
import Lobby from "./pages/Lobby";
import Settings from "./pages/Settings";
import AppShell from "./components/AppShell";
import UpdatePrompt from "./components/UpdatePrompt";
import OfflineIndicator from "./components/OfflineIndicator";

const queryClient = new QueryClient();
const shell = (element: ReactNode, title?: string, subtitle?: string) => (
  <AppShell title={title} subtitle={subtitle}>
    {element}
  </AppShell>
);
const bareShell = (element: ReactNode, hideMobileNav = false) => <AppShell bare hideMobileNav={hideMobileNav}>{element}</AppShell>;

const ProblemWorkspaceLoader = () => {
  const { key } = useParams();
  return bareShell(<ProblemWorkspace key={key} />, true);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <ThemeProvider>
        <ActiveEffectsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <UpdatePrompt />
          <OfflineIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/modules" element={<ModuleSelector />} />
              <Route path="/striver" element={<StriverRoadmap />} />
              <Route path="/neetcode" element={<NeetCodeRoadmap />} />
              <Route path="/leetcode150" element={<LeetCodeTop150Roadmap />} />
              <Route
                path="/contest"
                element={bareShell(<ContestMode />)}
              />
              <Route
                path="/review"
                element={shell(
                  <SpacedRepetition />,
                  "Spaced Repetition",
                  "Review problems at the right interval",
                )}
              />
              <Route
                path="/spaced-repetition"
                element={bareShell(<SpacedRepetition />)}
              />
              <Route
                path="/patterns"
                element={bareShell(<PatternsLibrary />)}
              />
              <Route
                path="/leaderboard"
                element={<Leaderboard />}
              />
              <Route path="/problem/:key" element={<ProblemWorkspaceLoader />} />
              <Route
                path="/analytics"
                element={shell(
                  <StudyAnalytics />,
                  "Study Analytics",
                  "Practice insights and learning trends",
                )}
              />
              <Route
                path="/generate"
                element={bareShell(<ProblemGenerator />)}
              />
              <Route
                path="/generator"
                element={bareShell(<ProblemGenerator />)}
              />
              <Route
                path="/achievements"
                element={shell(
                  <Achievements />,
                  "Achievements",
                  "Milestones and unlocks",
                )}
              />
              <Route
                path="/interview"
                element={bareShell(<InterviewSimulator />)}
              />
              <Route
                path="/create"
                element={bareShell(<CustomProblemCreator />)}
              />
              <Route
                path="/custom-problems"
                element={bareShell(<CustomProblemCreator />)}
              />
              <Route
                path="/community"
                element={shell(
                  <CommunitySolutions />,
                  "Community",
                  "Shared Java solutions",
                )}
              />
              <Route
                path="/flashcards"
                element={bareShell(<Flashcards />)}
              />
              <Route
                path="/companies"
                element={shell(
                  <CompanyTags />,
                  "Companies",
                  "Practice by company tags",
                )}
              />
              <Route
                path="/company-tags"
                element={bareShell(<CompanyTags />)}
              />
              <Route
                path="/goals"
                element={shell(
                  <WeeklyGoals />,
                  "Weekly Goals",
                  "Plan your practice cadence",
                )}
              />
              <Route
                path="/pomodoro"
                element={shell(
                  <PomodoroTimer />,
                  "Pomodoro",
                  "Focused study sessions",
                )}
              />
              <Route
                path="/bookmarks"
                element={shell(<Bookmarks />, "Bookmarks", "Saved problems")}
              />
              <Route
                path="/cheatsheet"
                element={bareShell(<CheatSheet />)}
              />
              <Route
                path="/playground"
                element={bareShell(<CodePlayground />)}
              />
              <Route
                path="/export"
                element={shell(
                  <ProgressExport />,
                  "Export",
                  "Download progress reports",
                )}
              />
              <Route
                path="/learning"
                element={bareShell(<LearningMode />)}
              />
              <Route
                path="/study-planner"
                element={shell(
                  <StudyPlanner />,
                  "Study Planner",
                  "Schedule your roadmap",
                )}
              />
              <Route
                path="/weak-topics"
                element={shell(
                  <WeakTopicAnalyzer />,
                  "Weak Topics",
                  "Find and fix gaps",
                )}
              />
              <Route
                path="/complexity"
                element={shell(
                  <ComplexityTracker />,
                  "Complexity",
                  "Track time and space complexity",
                )}
              />
              <Route
                path="/reset-password"
                element={shell(<ResetPassword />, "Reset Password")}
              />
              <Route path="/dashboard" element={<PerformanceDashboard />} />
              <Route
                path="/learning-path"
                element={shell(
                  <AdaptiveLearningPath />,
                  "Adaptive Path",
                  "Personalized Java DSA roadmap",
                )}
              />
              <Route
                path="/code-review"
                element={bareShell(<CodeReview />)}
              />
              <Route
                path="/discuss"
                element={shell(
                  <DiscussionForum />,
                  "Discussion",
                  "Problem conversations",
                )}
              />
              <Route
                path="/today-review"
                element={bareShell(<TodayReview />)}
              />
              <Route
                path="/search"
                element={shell(
                  <GlobalSearch />,
                  "Search",
                  "Find problems, topics, and tools",
                )}
              />
              <Route
                path="/streak-calendar"
                element={shell(
                  <StreakCalendar />,
                  "Activity Calendar",
                  "Consistency and streaks",
                )}
              />
              <Route
                path="/bigo"
                element={bareShell(<BigOVisualizer />)}
              />
              <Route path="/profile" element={<UserProfile />} />
              <Route
                path="/submissions"
                element={shell(
                  <SubmissionHistory />,
                  "Submissions",
                  "Recent runs and attempts",
                )}
              />
              <Route
                path="/admin-login"
                element={shell(<AdminLogin />, "Admin Login")}
              />
              <Route
                path="/admin/signup"
                element={shell(<AdminSignup />, "Admin Signup")}
              />
              <Route
                path="/admin"
                element={shell(
                  <AdminDashboard />,
                  "Admin",
                  "Moderation and user approvals",
                )}
              />
              <Route path="/admin/agent" element={<AdminAgentDashboard />} />
              <Route path="/admin/coins" element={shell(<AdminCoins />, "Coins Admin", "Manage user balances, rewards, and store")} />
              <Route path="/store" element={shell(<Store />, "Store", "Spend coins on themes, boosts, and cosmetics")} />
              <Route path="/quick-practice" element={bareShell(<QuickPractice />)} />
              <Route path="/leetcode/daily-question" element={bareShell(<DailyQuestion />, true)} />
              <Route path="/mailbox" element={shell(<Mailbox />, "Mailbox", "Your reports, messages and support tickets")} />
              <Route path="/settings" element={<Settings />}/>

              <Route path="/lobby/:code" element={<Lobby />} />
              <Route path="*" element={shell(<NotFound />, "Not Found")} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ActiveEffectsProvider>
      </ThemeProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
