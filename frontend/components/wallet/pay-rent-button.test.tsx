import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/stellar", () => ({
  isRentPaymentConfigured: vi.fn(() => true),
  signRentPayment: vi.fn(),
}));

import { PayRentButton } from "./pay-rent-button";

describe("PayRentButton", () => {
  it("shows a frozen state when rent payments are disabled", () => {
    render(
      <PayRentButton
        propertyId="p2"
        amount={180}
        disabled
        disabledReason="Payment actions are disabled while the agreement is disputed."
      />,
    );

    expect(
      screen.getByRole("button", { name: "Payments frozen" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Payment actions are disabled while the agreement is disputed.",
      ),
    ).toBeInTheDocument();
  });
});
