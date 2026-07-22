import { describe, expect, it, vi } from "vitest";
import { requireSuccessfulQueries } from "@/lib/supabase/query-error";

describe("requireSuccessfulQueries", () => {
  it("allows successful query results", () => {
    expect(() => requireSuccessfulQueries("report", [{ error: null }, {}])).not.toThrow();
  });

  it("throws instead of turning a database failure into empty data", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => requireSuccessfulQueries("report", [{ error: { code: "PGRST500", message: "failed" } }])).toThrow("report_data_load_failed");
    expect(log).toHaveBeenCalledWith("[report] data query failed", { code: "PGRST500", message: "failed" });
    log.mockRestore();
  });
});
