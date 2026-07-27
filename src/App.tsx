import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorPage } from "@/pages/EditorPage";
import { Home } from "@/pages/Home";
import { JsonStructurePage } from "@/pages/JsonStructurePage";
import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<JsonStructurePage />} path="/json-structure" />
        <Route element={<EditorPage />} path="/:id" />
      </Routes>
    </TooltipProvider>
  );
}
