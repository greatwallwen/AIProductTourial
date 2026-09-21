import { describe, expect, it } from "vitest";
import { GET } from "../src/app/case-assets/[...path]/route";

const read = (path: string[]) => GET(new Request("http://localhost/case-assets/"), { params: Promise.resolve({ path }) });
describe("migrated case assets", () => {
  it("serves an existing case image through its stable public URL", async () => {
    const response = await read(["case-14", "scene.png"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 8)).toEqual(new Uint8Array([137,80,78,71,13,10,26,10]));
  });
  it("rejects traversal, unsupported files and missing cases", async () => {
    for (const path of [["case-14", "..", "..", "README.md"], ["case-14", "receipt.json"], ["case-99", "scene.png"], ["vendor", "scene.png"]]) {
      expect((await read(path)).status).toBe(404);
    }
  });
});
