import { TooltipProvider } from "@/components/ui/tooltip";
import { AiPptCanvasPage } from "@/pages/AiPptCanvasPage";
import { AiPptOutlinePage } from "@/pages/AiPptOutlinePage";
import { CreateAiPptPage } from "@/pages/CreateAiPptPage";
import { Home } from "@/pages/Home";
import { JsonStructurePage } from "@/pages/JsonStructurePage";
import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<CreateAiPptPage />} path="/ai-ppt/new" />
        <Route element={<AiPptCanvasPage />} path="/ai-ppt/:projectId/editor" />
        <Route element={<AiPptOutlinePage />} path="/ai-ppt/:projectId" />
        <Route element={<JsonStructurePage />} path="/json-structure" />
      </Routes>
    </TooltipProvider>
  );
}
