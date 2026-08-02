"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@openota/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openota/ui/dropdown-menu";
import { Input } from "@openota/ui/input";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { NextStepCard } from "@/components/next-step-card";
import type { Project } from "@/features/projects/api";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { useCreateProject, useDeleteProject, useProjects, useRenameProject } from "@/features/projects/hooks";

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const renameProject = useRenameProject();
  const deleteProject = useDeleteProject();
  const { currentProjectId, setCurrentProjectId } = useCurrentProject();

  const [name, setName] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<Project | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Project | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const project = await createProject.mutateAsync(name.trim());
    setName("");
    setCurrentProjectId(project.id);
  }

  function openProject(projectId: string) {
    setCurrentProjectId(projectId);
    router.push("/");
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    await renameProject.mutateAsync({ projectId: renameTarget.id, name: renameValue.trim() });
    toast.success("Project renamed");
    setRenameTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    await deleteProject.mutateAsync(deletedId);
    toast.success(`Deleted "${deleteTarget.name}"`);
    // If the deleted project was the active one, clear the selection so scoped pages don't 404.
    if (currentProjectId === deletedId) setCurrentProjectId(null);
    setDeleteTarget(null);
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
          <Card key={project.id} className="transition-colors hover:border-primary">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openProject(project.id)}>
                <CardTitle className="truncate text-base">{project.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <p className="truncate font-mono text-xs text-muted-foreground">{project.id}</p>
                  <span onClick={(e) => e.stopPropagation()}>
                    <CopyButton value={project.id} label="Project ID" className="h-5 w-5" />
                  </span>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Project actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameTarget(project);
                      setRenameValue(project.name);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteTarget(project)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
          </Card>
        ))}
      </div>

      {projects && projects.length > 0 && (
        <NextStepCard
          accomplished={projects.length === 1 ? "You've created your first project." : `You have ${projects.length} projects.`}
          next="Open a project to get its Server URL, Project ID, and an API key."
          actionLabel="Connect a project"
          onAction={() => openProject(projects[0]!.id)}
        />
      )}

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={renameProject.isPending || !renameValue.trim()}>
              {renameProject.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the project and all its API keys and releases. Devices can no longer fetch updates for it. This cannot be undone."
        confirmLabel="Delete project"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
