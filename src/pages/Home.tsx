import { TEMPLATE_META } from "@/editor/template-meta";
import { useNavigate } from "react-router-dom";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-8">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {TEMPLATE_META.map((template) => (
          <button
            key={template.id}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => navigate(`/${template.id}`)}
          >
            <h2 className="text-base font-medium leading-snug group-hover:text-primary transition-colors">
              {template.name}
            </h2>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {template.description}
            </p>
            <div className="pt-1">
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {template.documentType === "pptx" ? "演示文稿" : "长图模板"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
