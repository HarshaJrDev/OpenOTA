"use client";

import type { PackageMetadata } from "@openota/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Download, Eye, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openota/ui/dropdown-menu";

import { getPackageDownloadUrl } from "./api";

export interface PackageRowActions {
  onDelete: (pkg: PackageMetadata) => void;
  onRollback: (pkg: PackageMetadata) => void;
}

export function buildPackageColumns({ onDelete, onRollback }: PackageRowActions): ColumnDef<PackageMetadata>[] {
  return [
    {
      accessorKey: "platform",
      header: "Platform",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.original.platform}
        </Badge>
      ),
    },
    {
      accessorKey: "bundleVersion",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Version
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/packages/${row.original.platform}/${row.original.bundleVersion}`}
          className="font-medium hover:underline"
        >
          v{row.original.bundleVersion}
        </Link>
      ),
    },
    {
      accessorKey: "runtimeVersion",
      header: "Runtime",
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => `${(row.original.size / 1024).toFixed(1)} KB`,
    },
    {
      accessorKey: "sha256",
      header: "SHA256",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.sha256.slice(0, 12)}…</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Uploaded
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const pkg = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/packages/${pkg.platform}/${pkg.bundleVersion}`}>
                  <Eye className="mr-2 h-4 w-4" /> View Manifest
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={getPackageDownloadUrl(pkg.platform, pkg.bundleVersion)}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRollback(pkg)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Roll back to this version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDelete(pkg)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
