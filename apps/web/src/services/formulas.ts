import type { HttpClient } from "@learnmath/api-client";
import { projectFormulaDetail, projectFormulaPage, projectFormulaPaths, requireAttemptId } from "../features/formula/formulaProjection";
import type { DrillType } from "../features/formula/formulaUi";
import { getAppHttp } from "./client";

export interface FormulaFilters {
  keyword: string;
  domain: number | null;
  tier: number | null;
  proofStatus: number | null;
  quality: number | null;
  page: number;
  size: number;
}

const WIRE_DRILL: Record<DrillType, "condition" | "variant" | "apply"> = {
  CONDITION_JUDGE: "condition",
  VARIANT_RECOGNIZE: "variant",
  APPLICATION_MATCH: "apply",
};

function validId(id: number): number {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("公式编号无效");
  return id;
}

/** 04 §4.14 public projections and authenticated standard-attempt creation. */
export function createFormulaApi(client: HttpClient = getAppHttp()) {
  return {
    async list(filters: FormulaFilters) {
      const data = await client.request<unknown>({
        method: "GET", path: "/api/app/v1/formulas",
        query: {
          keyword: filters.keyword || undefined,
          domain: filters.domain ?? undefined,
          tier: filters.tier ?? undefined,
          proof_status: filters.proofStatus ?? undefined,
          quality: filters.quality ?? undefined,
          page: filters.page,
          size: filters.size,
        },
      });
      return projectFormulaPage(data, filters.page, filters.size);
    },
    async detail(id: number) {
      const data = await client.request<unknown>({ method: "GET", path: `/api/app/v1/formulas/${validId(id)}` });
      return projectFormulaDetail(data);
    },
    async paths(id: number) {
      const data = await client.request<unknown>({ method: "GET", path: `/api/app/v1/formulas/${validId(id)}/paths` });
      return projectFormulaPaths(data);
    },
    async drill(id: number, type: DrillType) {
      const data = await client.request<unknown>({
        method: "POST", path: `/api/app/v1/formulas/${validId(id)}/drill`,
        body: { type: WIRE_DRILL[type], count: 1 },
      });
      return requireAttemptId(data);
    },
  };
}
