import { Renderer, marked, type Tokens } from "marked";

function htmlTokenToText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }

  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  return parsedDocument.body.textContent ?? "";
}

const materialEvidenceRenderer = new Renderer();

materialEvidenceRenderer.space = () => "\n";
materialEvidenceRenderer.code = ({ text }) => `${text}\n`;
materialEvidenceRenderer.blockquote = function ({ tokens }) {
  return `${this.parser.parse(tokens)}\n`;
};
materialEvidenceRenderer.html = ({ text, block }) => `${htmlTokenToText(text)}${block ? "\n" : ""}`;
materialEvidenceRenderer.heading = function ({ tokens }) {
  return `${this.parser.parseInline(tokens)}\n`;
};
materialEvidenceRenderer.hr = () => "\n";
materialEvidenceRenderer.list = function ({ items }) {
  return `${items.map((item) => this.listitem(item)).join("")}\n`;
};
materialEvidenceRenderer.listitem = function ({ tokens }) {
  return `${this.parser.parse(tokens).trim()}\n`;
};
materialEvidenceRenderer.checkbox = ({ checked }) => (checked ? "已完成 " : "未完成 ");
materialEvidenceRenderer.paragraph = function ({ tokens }) {
  return `${this.parser.parseInline(tokens)}\n`;
};
materialEvidenceRenderer.table = function ({ header, rows }) {
  const renderRow = (cells: Tokens.TableCell[]) =>
    cells.map((cell) => this.parser.parseInline(cell.tokens)).join(" | ");
  return `${[renderRow(header), ...rows.map(renderRow)].join("\n")}\n`;
};
materialEvidenceRenderer.tablerow = ({ text }) => `${text}\n`;
materialEvidenceRenderer.tablecell = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
materialEvidenceRenderer.strong = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
materialEvidenceRenderer.em = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
materialEvidenceRenderer.codespan = ({ text }) => text;
materialEvidenceRenderer.br = () => "\n";
materialEvidenceRenderer.del = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
materialEvidenceRenderer.link = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
materialEvidenceRenderer.image = ({ text }) => text;
materialEvidenceRenderer.text = function (token) {
  return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : token.text;
};

export function createMaterialEvidenceText(markdown: string): string {
  return marked
    .parse(markdown, {
      async: false,
      breaks: true,
      gfm: true,
      renderer: materialEvidenceRenderer,
    })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeMaterialEvidenceText(value: string): string {
  return createMaterialEvidenceText(value).replace(/\s+/g, " ").trim();
}
