import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("course launcher", () => {
  it("checks the workspace-level Next dependency before installing", () => {
    const script = readFileSync(resolve(process.cwd(), "../../run.bat"), "utf8");

    expect(script).toContain('if not exist "node_modules\\next\\package.json"');
    expect(script).not.toContain('if not exist "app\\node_modules\\next\\package.json"');
  });
});
