"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Building2 } from "lucide-react";

import { InteractiveGrid } from "@/app/auth/_components/interactive-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { todayIso } from "../_lib/date-utils";
import { collectFormPayload } from "./action-dialog";
import { DatePickerField } from "./date-picker-field";

export function ProjectOnboarding() {
  const router = useRouter();
  const { data, runAction } = useGiaPhuErp();
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (data.projects.length > 0) {
      router.replace("/dashboard/giaphu-erp/overview");
    }
  }, [data.projects.length, router]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = collectFormPayload(event.currentTarget);

    startTransition(async () => {
      await runAction("saveProject", payload);
    });
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="grid min-h-dvh bg-background xl:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden border-r bg-sidebar p-10 text-sidebar-foreground xl:flex xl:flex-col">
          <InteractiveGrid className="inset-0 h-full skew-y-6 mask-[radial-gradient(560px_circle_at_center,white,transparent)]" />

          <div className="relative z-10 my-auto space-y-6">
            <Badge className="rounded-full px-3 py-1 text-xs" variant="secondary">
              Khởi tạo công trình đầu tiên
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-xl font-semibold text-4xl leading-tight tracking-tight">
                Bắt đầu bằng một công trình thay vì một tổ chức trống.
              </h1>
              <p className="max-w-xl text-sidebar-foreground/75 text-base leading-7">
                Sau khi tạo công trình đầu tiên, bạn có thể theo dõi CRM, hợp đồng, vật tư, nhân công, thầu phụ, hồ sơ
                và báo cáo ngay trên cùng một dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-4 md:p-8 xl:p-12">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-3 text-center xl:text-left">
              <div className="space-y-2">
                <h2 className="font-semibold text-3xl tracking-tight">Tạo công trình đầu tiên</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Hệ thống sẽ dùng công trình này làm điểm bắt đầu cho CRM, vật tư, nhân công, hồ sơ và báo cáo.
                </p>
              </div>
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
                <p className="text-muted-foreground text-sm">
                  Sau khi tạo xong, hệ thống sẽ chuyển bạn vào màn tổng quan của công trình.
                </p>
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
