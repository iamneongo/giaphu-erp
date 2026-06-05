"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { writeActiveProjectCode } from "@/lib/giaphu-erp/project-context";
import type { ProjectRow } from "@/lib/giaphu-erp/types";

import { runGiaPhuAction } from "../_lib/giaphu-erp-api";

type ProjectPinTarget = Pick<ProjectRow, "id" | "code" | "name">;

async function verifyProjectPin(project: ProjectPinTarget, pin: string) {
  const result = await runGiaPhuAction("verifyProjectPin", { projectId: project.id, pin });
  return result.project ?? project;
}

function ProjectPinForm({
  project,
  submitLabel = "Mở công trình",
  onUnlocked,
}: {
  project: ProjectPinTarget;
  submitLabel?: string;
  onUnlocked: (project: ProjectPinTarget) => void;
}) {
  const [pin, setPin] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPin = pin.trim();
    if (!normalizedPin) {
      toast.error("Vui lòng nhập mã PIN công trình.");
      return;
    }

    startTransition(async () => {
      try {
        const unlockedProject = await verifyProjectPin(project, normalizedPin);
        toast.success("Đã mở khóa công trình.");
        onUnlocked(unlockedProject);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <Form className="space-y-4" onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="project-pin">Mã PIN</FieldLabel>
          <Input
            id="project-pin"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="off"
            autoFocus
            inputMode="numeric"
            placeholder="Nhập mã PIN công trình"
            type="password"
          />
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <RefreshCw className="animate-spin" /> : <LockKeyhole />}
        {pending ? "Đang kiểm tra..." : submitLabel}
      </Button>
    </Form>
  );
}

export function ProjectPinUnlockDialog({
  project,
  open,
  onOpenChange,
  onUnlocked,
}: {
  project: ProjectPinTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (project: ProjectPinTarget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mở khóa công trình</DialogTitle>
        </DialogHeader>
        {project ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium">{project.name}</p>
              <p className="text-muted-foreground text-xs">{project.code}</p>
            </div>
            <ProjectPinForm
              project={project}
              onUnlocked={(unlockedProject) => {
                onOpenChange(false);
                onUnlocked(unlockedProject);
              }}
            />
          </div>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function ProjectPinGate({ project }: { project: ProjectPinTarget }) {
  const router = useRouter();

  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-background">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle>Mở khóa công trình</CardTitle>
          <CardDescription>Nhập mã PIN để xem dữ liệu của {project.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectPinForm
            project={project}
            onUnlocked={(unlockedProject) => {
              writeActiveProjectCode(unlockedProject.code, unlockedProject.id);
              router.refresh();
            }}
          />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-muted-foreground text-xs">Mã PIN được đặt khi tạo hoặc chỉnh sửa công trình.</p>
        </CardFooter>
      </Card>
    </main>
  );
}
