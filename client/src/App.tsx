import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimulationProvider } from "./context/SimulationContext";
import { getQueryFn } from "./lib/queryClient";
import { setSimulationContentSnapshot } from "./lib/runtime-content";
import NotFound from "@/pages/not-found";

const RoleSelectPage = lazy(() => import("@/pages/role-select"));
const StudentJoinPage = lazy(() => import("@/pages/student-join"));
const SimulationPage = lazy(() => import("@/pages/simulation"));
const ResultsPage = lazy(() => import("@/pages/results"));
const StaffLoginPage = lazy(() => import("@/pages/staff-login"));
const AdminPage = lazy(() => import("@/pages/admin"));
const EvaluatorPage = lazy(() => import("@/pages/evaluator"));

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={RoleSelectPage} />
      <Route path="/student" component={StudentJoinPage} />
      <Route path="/staff-login" component={StaffLoginPage} />
      <Route path="/assessor" component={EvaluatorPage} />
      <Route path="/evaluator" component={EvaluatorPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/simulation" component={SimulationPage} />
      <Route path="/results/:sessionId" component={ResultsPage} />
      <Route path="/results" component={ResultsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/simulation-content"],
    queryFn: getQueryFn<any>({ on401: "throw" }),
  });

  useEffect(() => {
    if (!data?.cases) {
      return;
    }

    setSimulationContentSnapshot({
      competencies: data.competencies || [],
      cases: data.cases || [],
      emailCases: data.emailCases || [],
      messengerCases: data.messengerCases || [],
      messengerChats: data.messengerChats || [],
      videoCases: data.videoCases || [],
      assets: data.assets || [],
    }, data.settings || null);
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
        Загрузка симуляции...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
        Не удалось загрузить контент симуляции
      </div>
    );
  }

  return (
    <SimulationProvider>
      <Router hook={useHashLocation}>
        <Suspense
          fallback={(
            <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
              Открываем экран...
            </div>
          )}
        >
          <AppRouter />
        </Suspense>
      </Router>
    </SimulationProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
