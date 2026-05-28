import { NextResponse } from "next/server";

import { createGiaPhuSchema, getDocumentFile } from "@/lib/giaphu-erp/db";

export const runtime = "nodejs";

function encodeFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, "%2A");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await createGiaPhuSchema();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const document = await getDocumentFile({ id });
    const bytes = Buffer.from(document.fileData, "base64");
    const dispositionType = searchParams.get("download") === "1" ? "attachment" : "inline";
    const encodedFileName = encodeFileName(document.fileName);

    return new Response(bytes, {
      headers: {
        "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": String(bytes.length),
        "Content-Type": document.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    );
  }
}
