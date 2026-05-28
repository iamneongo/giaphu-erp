import { NextResponse } from "next/server";

import { createGiaPhuSchema, saveDocument } from "@/lib/giaphu-erp/db";

export const runtime = "nodejs";

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    await createGiaPhuSchema();

    const formData = await request.formData();
    const file = formData.get("file");
    const id = Number(formText(formData, "id") || 0);
    const hasFile = file instanceof File && file.size > 0;

    if (id <= 0 && !hasFile) {
      return NextResponse.json({ status: "error", message: "Vui lòng chọn tệp hồ sơ." }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      id,
      projectCode: formText(formData, "projectCode"),
      docType: formText(formData, "docType"),
      fileName: formText(formData, "fileName"),
      note: formText(formData, "note"),
      previewText: formText(formData, "previewText"),
    };

    if (hasFile) {
      if (file.size > MAX_DOCUMENT_SIZE) {
        return NextResponse.json({ status: "error", message: "Tệp hồ sơ không được vượt quá 10MB." }, { status: 400 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      payload.fileName = formText(formData, "fileName") || file.name;
      payload.mimeType = file.type || "application/octet-stream";
      payload.fileSize = file.size;
      payload.fileId = `${Date.now()}-${file.name}`;
      payload.fileData = bytes.toString("base64");
    }

    const documentId = await saveDocument(payload);

    return NextResponse.json({ status: "success", documentId });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
