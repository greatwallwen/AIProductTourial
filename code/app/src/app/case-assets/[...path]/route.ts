import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const assetRoot = resolve(process.cwd(), "../../assets/cases");
const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = resolve(assetRoot, ...path);
  if (!target.startsWith(`${assetRoot}${sep}`)) {
    return new Response("Not found", { status: 404 });
  }
  const contentType = contentTypes[extname(target).toLowerCase()];
  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(target);
    return new Response(bytes, {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
