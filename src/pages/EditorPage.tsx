import { JsonCanvasEditor } from "@/editor/JsonCanvasEditor";
import { TEMPLATE_META } from "@/editor/template-meta";
import { EDITOR_TEMPLATES } from "@/editor/templates";
import { useNavigate, useParams } from "react-router-dom";

export function EditorPage() {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchedMeta = TEMPLATE_META.find((template) => template.id === templateId);
  const document = EDITOR_TEMPLATES.find((template) => template.id === templateId);

  if (!matchedMeta || !document) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-muted-foreground">未找到模板：{templateId}</p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("/")}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full">
      <JsonCanvasEditor defaultValue={[document]} initialDocumentId={document.id} />
    </div>
  );
}
