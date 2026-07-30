import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as projectsApi from "./api";

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjects() {
  return useQuery({ queryKey: projectKeys.list(), queryFn: projectsApi.listProjects });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => projectsApi.createProject(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      projectsApi.renameProject(projectId, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.deleteProject(projectId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
