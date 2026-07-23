import { TooltipProvider } from "@/components/ui/tooltip";
import { Home } from "@/pages/Home";
import { EditorPage } from "@/pages/EditorPage";
import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <TooltipProvider delayDuration={350}>
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<EditorPage />} path="/:id" />
      </Routes>
    </TooltipProvider>
  );
}
