import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrementUsesAtomically, requireEntitlement } from "@/lib/entitlements";
import { maxUploadBytes, isAllowedFileType } from "@/lib/security";
import { parseValidatorInput } from "@/lib/validator";
import { VALIDATION_PROFILES } from "@/lib/zokorp-validator-engine";

export const runtime = "nodejs";

const formSchema = z.object({
  validationProfile: z.enum(VALIDATION_PROFILES),
  additionalContext: z.string().max(1200).optional(),
});

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
    const parsedForm = formSchema.safeParse({
      validationProfile: formData.get("validationProfile"),
      additionalContext: formData.get("additionalContext"),
    });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!parsedForm.success) {
      return NextResponse.json(
        { error: "Validation profile is required." },
        { status: 400 },
      );
    }

    const maxBytes = maxUploadBytes(Number(process.env.UPLOAD_MAX_MB ?? "10"));
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max allowed is ${process.env.UPLOAD_MAX_MB ?? 10}MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!isAllowedFileType(file.name, file.type, buffer)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload a PDF or Excel file (.xlsx/.xls).",
        },
        { status: 400 },
      );
    }

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
      profile: parsedForm.data.validationProfile,
      additionalContext: parsedForm.data.additionalContext,
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
          profile: parsedForm.data.validationProfile,
        },
      },
    });

    return NextResponse.json({
      output: result.output,
      meta: result.meta,
      report: result.report,
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
