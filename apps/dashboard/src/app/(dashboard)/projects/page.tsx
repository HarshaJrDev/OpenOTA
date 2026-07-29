"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";

import { EmptyState } from "@/components/empty-state";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { useCreateProject, useProjects } from "@/features/projects/hooks";

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const { setCurrentProjectId } = useCurrentProject();
  const [name, setName] = React.useState("");

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const project = await createProject.mutateAsync(name.trim());
    setName("");
    setCurrentProjectId(project.id);
  }

  function openProject(projectId: string) {
    setCurrentProjectId(projectId);
    router.push("/api-keys");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Each project isolates its own releases, devices, and API keys.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a project</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleCreate}>
            <Input
              placeholder="e.g. PebloBuddy"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={createProject.isPending}
            />
            <Button type="submit" disabled={createProject.isPending || !name.trim()}>
              {createProject.isPending ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {!isLoading && projects?.length === 0 && (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project above to get a Project ID and API key." />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <Card key={project.id} className="cursor-pointer transition-colors hover:border-primary" onClick={() => openProject(project.id)}>
            <CardHeader>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="font-mono text-xs text-muted-foreground">{project.id}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
