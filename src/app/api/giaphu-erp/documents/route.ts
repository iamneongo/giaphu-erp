import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { canAccessErpPermission, ERP_PERMISSIONS, getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import { createGiaPhuSchema, saveDocument } from "@/lib/giaphu-erp/db";

export const runtime = "nodejs";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function positiveHeaderNumber(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function decodeDocumentMeta(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    await createGiaPhuSchema();
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }
    if (!session.orgId) {
      return NextResponse.json(
        { status: "error", message: "Vui lòng chọn tổ chức trước khi dùng ERP." },
        { status: 403 },
      );
    }

    const permissionKeys = await getEffectiveErpPermissions(session);
    if (
      !canAccessErpPermission(session, ERP_PERMISSIONS.documentsManage, permissionKeys) &&
      !canAccessErpPermission(session, ERP_PERMISSIONS.crmManage, permissionKeys) &&
      !canAccessErpPermission(session, ERP_PERMISSIONS.subcontractorsManage, permissionKeys)
    ) {
      return NextResponse.json({ status: "error", message: "Bạn không có quyền quản lý hồ sơ." }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    const id = Number(request.headers.get("x-document-id") || 0);
    const expectedFileSize = positiveHeaderNumber(request.headers.get("x-upload-file-size"));
    const meta = decodeDocumentMeta(request.headers.get("x-document-meta") || "");
    const projectCodeHeader = typeof meta?.projectCode === "string" ? meta.projectCode : "";
    const docTypeHeader = typeof meta?.docType === "string" ? meta.docType : "";
    const fileNameHeader = typeof meta?.fileName === "string" ? meta.fileName : "";
    const noteHeader = typeof meta?.note === "string" ? meta.note : "";
    const previewTextHeader = typeof meta?.previewText === "string" ? meta.previewText : "";

    let hasFile = false;
    let projectCode = projectCodeHeader;
    let docType = docTypeHeader;
    let fileName = fileNameHeader;
    let note = noteHeader;
    let previewText = previewTextHeader;
    let payloadFileData = "";
    let payloadFileSize = 0;
    let payloadMimeType = "application/octet-stream";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const formFile = formData.get("file");
      const file = formFile instanceof File ? formFile : null;
      hasFile = Boolean(file && file.size > 0);
      projectCode = formText(formData, "projectCode");
      docType = formText(formData, "docType");
      fileName = formText(formData, "fileName");
      note = formText(formData, "note");
      previewText = formText(formData, "previewText");
      if (file) {
        const bytes = Buffer.from(await file.arrayBuffer());
        payloadFileData = bytes.toString("base64");
        payloadFileSize = bytes.length;
        payloadMimeType = file.type || "application/octet-stream";
      }
    } else {
      const bytes = Buffer.from(await request.arrayBuffer());
      if (bytes.length > 0) {
        hasFile = true;
        const inferredMimeType = request.headers.get("content-type") || "application/octet-stream";
        payloadFileData = bytes.toString("base64");
        payloadFileSize = bytes.length;
        payloadMimeType = inferredMimeType;
      }
    }

    if (id <= 0 && !hasFile) {
      return NextResponse.json({ status: "error", message: "Vui lòng chọn tệp hồ sơ." }, { status: 400 });
    }

    if (hasFile && expectedFileSize > 0 && payloadFileSize !== expectedFileSize) {
      return NextResponse.json(
        {
          status: "error",
          message: "Tệp tải lên chưa nhận đủ dữ liệu, có thể đã bị giới hạn hoặc mất kết nối. Vui lòng tải lại tệp.",
        },
        { status: 413 },
      );
    }

    const payload: Record<string, unknown> = {
      id,
      organizationId: session.orgId,
      projectCode,
      docType,
      fileName,
      note,
      previewText,
    };

    if (hasFile) {
      payload.fileName = fileName || fileNameHeader || `upload-${Date.now()}`;
      payload.mimeType = payloadMimeType;
      payload.fileSize = payloadFileSize;
      payload.fileId = `${Date.now()}-${payload.fileName}`;
      payload.fileData = payloadFileData;
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
