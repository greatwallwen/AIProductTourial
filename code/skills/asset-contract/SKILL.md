---
name: asset-contract
description: Create a text-to-3D asset request contract, inspect local glTF 2.0 or GLB files, and build a Three.js viewer without claiming unverified provider generation. Use for web-preview 3D assets that need format, scale, budget, provenance, and provider-status gates.
---

# 3D asset contract

1. Create the request contract before calling any generation provider.
2. Keep Provider generation `blocked-not-verified` unless a real receipt and downloaded artifact exist.
3. Inspect local `.gltf` or `.glb` files with `scripts/inspect_gltf.py`; reject remote buffers and invalid references.
4. Build the Three.js viewer from the inspected local artifact and retain its SHA-256.

```powershell
python -B scripts/create_asset_contract.py --input examples/triangle.request.json --output examples/asset-contract.json
python -B scripts/inspect_gltf.py --input examples/minimal-triangle/model.glb --allowed-root examples
python -B scripts/build_viewer.py --model examples/minimal-triangle/model.glb --allowed-model-root examples --output examples/three-viewer --allowed-output-root examples
```

The deterministic triangle is a local course fixture, not a text-to-3D Provider result.
