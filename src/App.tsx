import { TooltipProvider } from "@/components/ui/tooltip";
import { AiPptCanvasPage } from "@/pages/AiPptCanvasPage";
import { AiPptOutlinePage } from "@/pages/AiPptOutlinePage";
import { ContentEditorPage } from "@/pages/ContentEditorPage";
import { ContentMarkdownPage } from "@/pages/ContentMarkdownPage";
import { ContentStructurePage } from "@/pages/ContentStructurePage";
import { ContentVisualPage } from "@/pages/ContentVisualPage";
import { CreateContentProjectPage } from "@/pages/CreateContentProjectPage";
import { CreateAiPptPage } from "@/pages/CreateAiPptPage";
import { Home } from "@/pages/Home";
import { JsonStructurePage } from "@/pages/JsonStructurePage";
import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<CreateContentProjectPage />} path="/studio/new" />
        <Route element={<ContentMarkdownPage />} path="/studio/:projectId/content" />
        <Route element={<ContentStructurePage />} path="/studio/:projectId/structure" />
        <Route element={<ContentVisualPage />} path="/studio/:projectId/visual" />
        <Route element={<ContentEditorPage />} path="/studio/:projectId/editor" />
        <Route element={<CreateAiPptPage />} path="/ai-ppt/new" />
        <Route element={<AiPptCanvasPage />} path="/ai-ppt/:projectId/editor" />
        <Route element={<AiPptOutlinePage />} path="/ai-ppt/:projectId" />
        <Route element={<JsonStructurePage />} path="/json-structure" />
      </Routes>
    </TooltipProvider>
  );
}
