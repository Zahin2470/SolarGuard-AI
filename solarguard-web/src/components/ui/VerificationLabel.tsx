import type { VerificationStatus } from "@/lib/domain";
import { ImpactStatusLabel } from "./ImpactStatusLabel";

/** One place that maps a case's verification status to its evidence label. */
export function VerificationLabel({ status }: { status: VerificationStatus }) {
  switch (status) {
    case "verified":
      return <ImpactStatusLabel level="verified" />;
    case "inconclusive":
      return <ImpactStatusLabel level="inconclusive" label="Outcome inconclusive" />;
    case "not_verifiable":
      return <ImpactStatusLabel level="inconclusive" label="Not verifiable yet" />;
    default:
      return <ImpactStatusLabel level="not_verified" label="Outcome not yet verified" />;
  }
}
