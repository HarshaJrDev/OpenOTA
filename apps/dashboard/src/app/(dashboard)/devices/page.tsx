"use client";

import { Smartphone } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { EmptyState } from "@/components/empty-state";

const COLUMNS = ["Device", "Version", "Runtime", "Platform", "Last Seen", "Bundle", "Status"];

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">Devices that have checked in for updates.</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="p-0">
                <EmptyState
                  icon={Smartphone}
                  title="Device tracking isn't available yet"
                  description="OpenOTA's server currently exposes package storage and check/download/rollback endpoints only — there's no device check-in registry to report from. This table is wired and ready for when that API ships; it will never show fabricated data in the meantime."
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
