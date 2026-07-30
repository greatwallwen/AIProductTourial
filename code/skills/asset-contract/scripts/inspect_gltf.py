from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path
from typing import Any


COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _parse_glb(data: bytes) -> tuple[dict[str, Any], list[bytes]]:
    if len(data) < 20:
        raise ValueError("glb_too_short")
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("invalid_glb_magic")
    if version != 2:
        raise ValueError("unsupported_glb_version")
    if declared_length != len(data):
        raise ValueError("glb_length_mismatch")
    offset = 12
    json_document: dict[str, Any] | None = None
    binary_chunks: list[bytes] = []
    chunk_index = 0
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("truncated_glb_chunk_header")
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        end = offset + chunk_length
        if end > len(data):
            raise ValueError("truncated_glb_chunk")
        chunk = data[offset:end]
        offset = end
        if chunk_index == 0 and chunk_type != JSON_CHUNK:
            raise ValueError("first_glb_chunk_must_be_json")
        if chunk_type == JSON_CHUNK:
            if json_document is not None:
                raise ValueError("multiple_json_chunks")
            json_document = json.loads(chunk.rstrip(b" \x00").decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            binary_chunks.append(chunk)
        chunk_index += 1
    if json_document is None:
        raise ValueError("missing_glb_json_chunk")
    return json_document, binary_chunks


def _load_document(path: Path) -> tuple[dict[str, Any], list[bytes], list[str]]:
    external_buffers: list[str] = []
    if path.suffix.lower() == ".glb":
        document, chunks = _parse_glb(path.read_bytes())
        return document, chunks, external_buffers
    if path.suffix.lower() != ".gltf":
        raise ValueError("input_must_be_gltf_or_glb")
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    buffers: list[bytes] = []
    for buffer in document.get("buffers", []):
        uri = buffer.get("uri")
        if not isinstance(uri, str) or uri.startswith(("http:", "https:", "data:")):
            raise ValueError("gltf_buffer_must_be_local_relative_file")
        candidate = (path.parent / uri).resolve()
        if not _inside(candidate, path.parent.resolve()):
            raise ValueError("gltf_buffer_outside_asset_directory")
        if not candidate.is_file():
            raise ValueError("gltf_buffer_missing:" + uri)
        buffers.append(candidate.read_bytes())
        external_buffers.append(uri)
    return document, buffers, external_buffers


def inspect_asset(input_path: str | Path, allowed_root: str | Path) -> dict[str, Any]:
    root = Path(allowed_root).resolve()
    path = Path(input_path).resolve()
    if not _inside(path, root):
        raise ValueError("input_outside_allowed_root")
    if not path.is_file():
        raise ValueError("input_missing")
    document, loaded_buffers, external_buffers = _load_document(path)
    if document.get("asset", {}).get("version") != "2.0":
        raise ValueError("asset_version_must_be_2_0")

    buffers = document.get("buffers", [])
    if len(loaded_buffers) < len(buffers):
        if path.suffix.lower() != ".glb" or not loaded_buffers:
            raise ValueError("missing_binary_buffer")
    for index, buffer in enumerate(buffers):
        if index >= len(loaded_buffers):
            raise ValueError(f"buffer_missing:{index}")
        declared = int(buffer.get("byteLength", -1))
        if declared < 0 or declared > len(loaded_buffers[index]):
            raise ValueError(f"buffer_length_out_of_bounds:{index}")

    views = document.get("bufferViews", [])
    for index, view in enumerate(views):
        buffer_index = int(view.get("buffer", -1))
        if not 0 <= buffer_index < len(loaded_buffers):
            raise ValueError(f"buffer_view_invalid_buffer:{index}")
        offset = int(view.get("byteOffset", 0))
        length = int(view.get("byteLength", -1))
        if offset < 0 or length < 0 or offset + length > len(loaded_buffers[buffer_index]):
            raise ValueError(f"buffer_view_out_of_bounds:{index}")

    accessors = document.get("accessors", [])
    for index, accessor in enumerate(accessors):
        view_index = int(accessor.get("bufferView", -1))
        if not 0 <= view_index < len(views):
            raise ValueError(f"accessor_invalid_buffer_view:{index}")
        component_bytes = COMPONENT_BYTES.get(int(accessor.get("componentType", -1)))
        components = TYPE_COMPONENTS.get(str(accessor.get("type", "")))
        count = int(accessor.get("count", -1))
        if component_bytes is None or components is None or count < 0:
            raise ValueError(f"accessor_invalid_shape:{index}")
        view = views[view_index]
        stride = int(view.get("byteStride", component_bytes * components))
        byte_offset = int(accessor.get("byteOffset", 0))
        required = 0 if count == 0 else (count - 1) * stride + component_bytes * components
        if byte_offset < 0 or byte_offset + required > int(view["byteLength"]):
            raise ValueError(f"accessor_out_of_bounds:{index}")

    scenes = document.get("scenes", [])
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    default_scene = int(document.get("scene", 0))
    if scenes and not 0 <= default_scene < len(scenes):
        raise ValueError("invalid_default_scene")
    for scene_index, scene in enumerate(scenes):
        if any(not 0 <= int(node) < len(nodes) for node in scene.get("nodes", [])):
            raise ValueError(f"scene_invalid_node:{scene_index}")
    for node_index, node in enumerate(nodes):
        if "mesh" in node and not 0 <= int(node["mesh"]) < len(meshes):
            raise ValueError(f"node_invalid_mesh:{node_index}")

    primitive_count = 0
    vertex_count = 0
    index_count = 0
    bounds = None
    for mesh_index, mesh in enumerate(meshes):
        for primitive in mesh.get("primitives", []):
            primitive_count += 1
            position_index = primitive.get("attributes", {}).get("POSITION")
            if position_index is None or not 0 <= int(position_index) < len(accessors):
                raise ValueError(f"primitive_missing_position:{mesh_index}")
            position_accessor = accessors[int(position_index)]
            vertex_count += int(position_accessor["count"])
            if bounds is None and "min" in position_accessor and "max" in position_accessor:
                bounds = {"min": position_accessor["min"], "max": position_accessor["max"]}
            if "indices" in primitive:
                accessor_index = int(primitive["indices"])
                if not 0 <= accessor_index < len(accessors):
                    raise ValueError(f"primitive_invalid_indices:{mesh_index}")
                index_count += int(accessors[accessor_index]["count"])

    return {
        "status": "passed",
        "format": path.suffix.lower().lstrip("."),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "byte_length": path.stat().st_size,
        "asset_version": "2.0",
        "scenes": len(scenes),
        "nodes": len(nodes),
        "meshes": len(meshes),
        "primitives": primitive_count,
        "vertices": vertex_count,
        "indices": index_count,
        "bounds": bounds,
        "external_buffers": external_buffers,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a local glTF 2.0 or GLB asset deterministically.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()
    try:
        result = inspect_asset(args.input, args.allowed_root)
    except (OSError, ValueError, KeyError, json.JSONDecodeError, struct.error) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
