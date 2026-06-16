import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnouncementBar } from "./AnnouncementBar";

describe("AnnouncementBar", () => {
	it("renders every message inside a labeled region", () => {
		render(
			<AnnouncementBar
				messages={["Free shipping over $99", "Up to 60% off"]}
			/>,
		);
		const region = screen.getByRole("region", { name: "Promotions" });
		expect(region).toHaveTextContent("Free shipping over $99");
		expect(region).toHaveTextContent("Up to 60% off");
	});

	it("uses the navy background by default", () => {
		render(<AnnouncementBar messages={["Hi"]} />);
		expect(screen.getByRole("region", { name: "Promotions" })).toHaveClass(
			"bg-ink",
		);
	});

	it("switches to the sale background when sale is set", () => {
		render(<AnnouncementBar sale messages={["Clearance"]} />);
		const region = screen.getByRole("region", { name: "Promotions" });
		expect(region).toHaveClass("bg-sale");
		expect(region).not.toHaveClass("bg-ink");
	});
});
