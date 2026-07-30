import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"));
const root = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"));

describe("single host dependency contract", () => {
  it("pins the approved React and Next patch versions", () => {
    expect(app.dependencies).toMatchObject({
      next: "16.2.12",
      react: "19.2.8",
      "react-dom": "19.2.8",
    });
  });

  it("exposes only shared runtime workspaces", () => {
    expect(root.workspaces).toEqual(["app", "case-runtime", "design-system"]);
  });
});
