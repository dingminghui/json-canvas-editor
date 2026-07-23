import { type TemplateMeta, TEMPLATE_META } from "@/editor/template-meta";
import { Link } from "react-router-dom";

const DOCUMENT_TYPE_LABEL: Record<TemplateMeta["documentType"], string> = {
  longform: "长图模板",
  pptx: "演示文稿",
};

function TemplateCard({ template }: { template: TemplateMeta }) {
  return (
    <Link
      className="group flex flex-col gap-2 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      to={`/${template.id}`}
      target="_blank"
    >
      <h2 className="text-base font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
        {template.name}
      </h2>
      <p className="line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
      <span className="mt-auto inline-block w-fit rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
        {DOCUMENT_TYPE_LABEL[template.documentType]}
      </span>
    </Link>
  );
}

export function Home() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-8">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {TEMPLATE_META.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
