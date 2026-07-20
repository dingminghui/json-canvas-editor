import { TooltipProvider } from "@/components/ui/tooltip";
import { Home } from "@/pages/Home";

export function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Home />
    </TooltipProvider>
  );
}
