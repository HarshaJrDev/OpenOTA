"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, FolderPlus, FolderKanban } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@openota/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@openota/ui/popover";

import { useCurrentProject } from "@/features/projects/current-project-context";
import { useProjects } from "@/features/projects/hooks";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const [open, setOpen] = React.useState(false);
  const { data: projects } = useProjects();
  const { currentProjectId, setCurrentProjectId } = useCurrentProject();

  const current = projects?.find((p) => p.id === currentProjectId);

  if (!projects || projects.length === 0) {
    return (
      <Button variant="outline" size="sm" className="justify-start text-muted-foreground" asChild>
        <Link href="/projects">
          <FolderPlus className="mr-2 h-4 w-4" />
          Create a project
        </Link>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-48 justify-between">
          <span className="flex min-w-0 items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{current ? current.name : "Select project"}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a project…" />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => {
                    setCurrentProjectId(project.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", project.id === currentProjectId ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
