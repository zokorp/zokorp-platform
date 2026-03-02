import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrementUsesAtomically, requireEntitlement } from "@/lib/entitlements";
import { maxUploadBytes, isAllowedFileType } from "@/lib/security";
import { parseValidatorInput } from "@/lib/validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    await requireEntitlement({
      userId: user.id,
      productSlug: "zokorp-validator",
      minUses: 1,
    });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!isAllowedFileType(file.name, file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload a PDF or Excel file (.xlsx/.xls).",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const maxBytes = maxUploadBytes(Number(process.env.UPLOAD_MAX_MB ?? "10"));

    if (buffer.length > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max allowed is ${process.env.UPLOAD_MAX_MB ?? 10}MB.` },
        { status: 413 },
      );
    }

    const result = await parseValidatorInput({
      filename: file.name,
      mimeType: file.type,
      buffer,
    });

    await decrementUsesAtomically({
      userId: user.id,
      productSlug: "zokorp-validator",
      uses: 1,
    });

    const entitlement = await db.entitlement.findFirst({
      where: {
        userId: user.id,
        product: { slug: "zokorp-validator" },
      },
      select: {
        remainingUses: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "tool.zokorp_validator_run",
        metadataJson: {
          filename: file.name,
          mimeType: file.type,
          bytes: buffer.length,
        },
      },
    });

    return NextResponse.json({
      output: result.output,
      meta: result.meta,
      remainingUses: entitlement?.remainingUses ?? 0,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (error.message === "ENTITLEMENT_REQUIRED" || error.message === "INSUFFICIENT_USES") {
        return NextResponse.json({ error: "Purchase required before running this tool." }, { status: 402 });
      }
    }

    console.error(error);
    return NextResponse.json({ error: "Tool execution failed" }, { status: 500 });
  }
}
