import { NextResponse } from "next/server";
import { OPS_REGION_CODE, getOpsRegionDisplayName } from "@/lib/regions";

export async function GET() {
  return NextResponse.json([
    {
      code: OPS_REGION_CODE,
      name: getOpsRegionDisplayName(),
    },
  ]);
}
