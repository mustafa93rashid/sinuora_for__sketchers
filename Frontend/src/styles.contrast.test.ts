import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// WCAG 2.1 relative luminance / contrast ratio - see
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
const relativeLuminance = (hex: string) => {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
    (part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    },
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (hexA: string, hexB: string) => {
  const [lighter, darker] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

describe("muted-foreground text color", () => {
  it("meets WCAG AA contrast (>=4.5:1) against the app background for normal text", () => {
    const css = readFileSync(
      fileURLToPath(new URL("./styles.css", import.meta.url)),
      "utf8",
    );
    const match = css.match(/--color-muted-foreground:\s*(#[0-9a-fA-F]{6})/);
    expect(match, "expected --color-muted-foreground to be defined").not.toBeNull();
    const mutedForeground = match![1];
    // Audit finding M-13: the previous value (#788789) measured ~3.73:1
    // against white, failing the 4.5:1 floor for normal-size text.
    expect(contrastRatio(mutedForeground, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
