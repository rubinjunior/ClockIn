import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/shared/error-state";

describe("ErrorState", () => {
  it("explains that data was not deleted and lets the user retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<ErrorState error={Object.assign(new Error("report_data_load_failed"), { digest: "abc123" })} reset={reset} />);

    expect(screen.getByRole("heading", { name: "לא הצלחנו לטעון את הנתונים" })).toBeVisible();
    expect(screen.getByText(/המידע שלך לא נמחק/)).toBeVisible();
    expect(screen.getByText("abc123")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /ניסיון נוסף/ }));
    expect(reset).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
