import { PptProjectSchema, type PptProjectV1 } from "@/features/ai-ppt/schema";

export const PPT_PROJECT_STORAGE_KEY = "json-canvas-editor:ppt-projects:v1";

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listPptProjects(): PptProjectV1[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(PPT_PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value
      .map((project) => PptProjectSchema.safeParse(project))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export function getPptProject(projectId: string): PptProjectV1 | null {
  return listPptProjects().find((project) => project.id === projectId) ?? null;
}

function writeProjects(projects: readonly PptProjectV1[]): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(PPT_PROJECT_STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

export function savePptProject(project: PptProjectV1): boolean {
  const validatedProject = PptProjectSchema.safeParse(project);
  if (!validatedProject.success) return false;

  const currentProjects = listPptProjects();
  const nextProjects = [
    validatedProject.data,
    ...currentProjects.filter((current) => current.id !== project.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return writeProjects(nextProjects);
}

export function deletePptProject(projectId: string): boolean {
  return writeProjects(listPptProjects().filter((project) => project.id !== projectId));
}
