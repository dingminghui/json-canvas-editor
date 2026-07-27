import { JsonCanvasEditor } from "@/editor/JsonCanvasEditor";
import { EDITOR_TEMPLATES } from "@/editor/templates";
import type { CanvasDocument } from "@/editor/types";
import { useEffect, useState } from "react";

const BASIC_DOCUMENT = EDITOR_TEMPLATES[0];

function ExampleFrame({ children }: { children: React.ReactNode }) {
  return <div className="h-[720px] min-w-[1024px]">{children}</div>;
}

export function BasicEditorExample() {
  return (
    <ExampleFrame>
      <JsonCanvasEditor defaultValue={[BASIC_DOCUMENT]} />
    </ExampleFrame>
  );
}

export function InitialDocumentExample() {
  return (
    <ExampleFrame>
      <JsonCanvasEditor
        defaultValue={EDITOR_TEMPLATES}
        initialDocumentId="ppt-template-2-medical-brief"
        onActiveDocumentChange={(documentId) => {
          globalThis.console.info("active document", documentId);
        }}
      />
    </ExampleFrame>
  );
}

export function ControlledEditorExample() {
  const [documents, setDocuments] = useState<CanvasDocument[]>(() =>
    structuredClone(EDITOR_TEMPLATES),
  );

  return (
    <ExampleFrame>
      <JsonCanvasEditor value={documents} onChange={setDocuments} />
    </ExampleFrame>
  );
}

export function ReadOnlyEditorExample() {
  return (
    <ExampleFrame>
      <JsonCanvasEditor defaultValue={EDITOR_TEMPLATES} readOnly />
    </ExampleFrame>
  );
}

export function CustomExportExample() {
  return (
    <ExampleFrame>
      <JsonCanvasEditor
        defaultValue={[BASIC_DOCUMENT]}
        onExport={async (document) => {
          await fetch("/api/canvas/export", {
            body: JSON.stringify(document),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
        }}
      />
    </ExampleFrame>
  );
}

export function AsyncDocumentsExample({
  loadDocuments,
}: {
  loadDocuments: () => Promise<CanvasDocument[]>;
}) {
  const [documents, setDocuments] = useState<CanvasDocument[] | null>(null);

  useEffect(() => {
    let ignore = false;

    void loadDocuments().then((nextDocuments) => {
      if (!ignore) setDocuments(nextDocuments);
    });

    return () => {
      ignore = true;
    };
  }, [loadDocuments]);

  if (!documents) return <div>Loading...</div>;

  return (
    <ExampleFrame>
      <JsonCanvasEditor defaultValue={documents} />
    </ExampleFrame>
  );
}
