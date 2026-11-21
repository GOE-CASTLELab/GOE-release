import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardProvider } from "@/contexts/DashboardContext";
import SwipeableDashboardWrapper from "@/pages/SwipeableDashboardWrapper";
import { useReturnPattern } from "@/hooks/useReturnPattern";

function App() {
  useReturnPattern();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DashboardProvider>
          <Toaster />
          <SwipeableDashboardWrapper />
        </DashboardProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
