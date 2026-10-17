"use server";

import { revalidatePath } from "next/cache";
import type { UploadState } from "@/lib/action-state";
import { text, toErrorState } from "@/lib/api/action-helpers";
import { createSite, uploadTelemetry } from "@/lib/api/live";

const SITE_ID = /^[A-Za-z0-9_.-]{1,64}$/;
const TZ = /^[A-Za-z0-9_+\-/]{1,64}$/;

export async function uploadAction(_prev: UploadState, form: FormData): Promise<UploadState> {
  const mode = text(form, "mode");
  const file = form.get("file");
  const timezone = text(form, "timezone") || "UTC";

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a non-empty CSV file." };
  }
  if (!/\.csv$/i.test(file.name)) {
    return { status: "error", message: "The file must be a .csv file." };
  }
  if (!TZ.test(timezone)) {
    return { status: "error", message: "Time zone must look like UTC or Asia/Dhaka." };
  }

  let siteId = text(form, "site_id");
  let siteCreated = false;

  if (mode === "new") {
    const name = text(form, "name");
    const location = text(form, "location");
    const capacity = Number(text(form, "capacity_kwp"));
    siteId = text(form, "new_site_id");
    if (!SITE_ID.test(siteId)) {
      return { status: "error", message: "Site ID may use letters, digits, dot, dash and underscore (max 64)." };
    }
    if (!name) return { status: "error", message: "Enter a site name." };
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return { status: "error", message: "Capacity (kWp) must be a number above 0." };
    }
    try {
      await createSite({ id: siteId, name, location: location || undefined, capacity_kwp: capacity });
      siteCreated = true;
      revalidatePath("/upload"); // so the new site appears in the "Existing site" list
    } catch (err) {
      return toErrorState(err) as UploadState;
    }
  } else if (!siteId) {
    return { status: "error", message: "Choose a site, or register a new one." };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  body.append("timezone", timezone);

  try {
    const result = await uploadTelemetry(siteId, body);
    revalidatePath("/recovery-cases");
    return { status: "ok", siteId, siteCreated, report: result.ingest, alerts: result.alerts };
  } catch (err) {
    const base = toErrorState(err);
    const message =
      base.status === "error" && siteCreated
        ? `${base.message} The site ${siteId} was registered; pick it from the list to retry the upload.`
        : base.status === "error"
          ? base.message
          : "Upload failed.";
    return { status: "error", message };
  }
}
