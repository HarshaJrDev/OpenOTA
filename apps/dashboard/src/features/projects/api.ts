import { apiRequest } from "@/lib/api-client";

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export function listProjects(): Promise<Project[]> {
  return apiRequest("/projects");
}

export function createProject(name: string): Promise<Project> {
  return apiRequest("/projects", { method: "POST", body: { name } });
}

export function getProject(projectId: string): Promise<Project> {
  return apiRequest(`/projects/${projectId}`);
}
