"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { InteractiveGrid } from "@/app/auth/_components/interactive-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { projectScopedPath } from "@/lib/giaphu-erp/project-routes";

import { todayIso } from "../_lib/date-utils";
import { runGiaPhuAction } from "../_lib/giaphu-erp-api";
import { collectFormPayload } from "./action-dialog";
import { DatePickerField } from "./date-picker-field";

export function ProjectOnboarding() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = collectFormPayload(event.currentTarget);
    const projectCode = String(payload.code ?? "").trim();

    startTransition(async () => {
      try {
        const result = await runGiaPhuAction("saveProject", payload);
        const createdProject = result.data?.projects.find((project) => project.code === projectCode);
        toast.success("Đã tạo công trình.");
        router.replace(projectScopedPath(createdProject?.id ?? projectCode, "/overview"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="grid min-h-dvh bg-background xl:grid-cols-[1.1fr_0.9fr]">
        <section
          aria-hidden="true"
          className="relative hidden overflow-hidden border-r bg-sidebar p-10 text-sidebar-foreground xl:flex xl:flex-col"
        >
          <InteractiveGrid className="mask-[radial-gradient(560px_circle_at_center,white,transparent)] inset-0 h-full skew-y-6" />
        </section>

        <section className="flex items-center justify-center p-4 md:p-8 xl:p-12">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-3 text-center xl:text-left">
              <h1 className="font-semibold text-3xl tracking-tight">Tạo công trình</h1>
            </div>

            <Form onSubmit={submit} className="space-y-6">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="code">Mã công trình</FieldLabel>
                  <Input id="code" name="code" placeholder="VD: CT-001" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="status">Trạng thái</FieldLabel>
                  <Input id="status" name="status" defaultValue="Đang thi công" />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="name">Tên công trình</FieldLabel>
                  <Input id="name" name="name" placeholder="Nhà phố Quận 7, Villa Riverside..." required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="owner">Chủ đầu tư</FieldLabel>
                  <Input id="owner" name="owner" placeholder="Tên chủ đầu tư" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact">Liên hệ</FieldLabel>
                  <Input id="contact" name="contact" placeholder="Số điện thoại hoặc email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="referrer">Người giới thiệu</FieldLabel>
                  <Input id="referrer" name="referrer" placeholder="Nguồn khách hàng" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="startDate">Ngày bắt đầu</FieldLabel>
                  <DatePickerField name="startDate" value={todayIso()} />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="failureReason">Ghi chú</FieldLabel>
                  <Textarea
                    id="failureReason"
                    name="failureReason"
                    placeholder="Ghi chú khởi tạo, tình trạng hiện tại hoặc thông tin cần lưu ý..."
                  />
                </Field>
              </FieldGroup>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">Tạo xong sẽ mở màn tổng quan của công trình.</p>
                <Button type="submit" size="lg" disabled={pending} className="min-w-44">
                  {pending ? "Đang tạo..." : "Tạo công trình"}
                </Button>
              </div>
            </Form>
          </div>
        </section>
      </div>
    </main>
  );
}
