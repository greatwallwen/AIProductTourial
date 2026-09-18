from __future__ import annotations

import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path
from typing import Any, Iterable


CHINA_URL = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json"
ZHEJIANG_URL = "https://geo.datav.aliyun.com/areas_v3/bound/330000_full.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_if_different(source: Path, destination: Path) -> None:
    if source.resolve() == destination.resolve():
        return
    shutil.copy2(source, destination)


def positions(value: Any) -> Iterable[tuple[float, float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        yield float(value[0]), float(value[1])
    elif isinstance(value, list):
        for item in value:
            yield from positions(item)


def inspect_geojson(path: Path, expected_count: int, required_code: str) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
        raise ValueError(f"invalid_geojson:{path}")
    features = payload["features"]
    if len(features) != expected_count:
        raise ValueError(f"unexpected_feature_count:{path}:{len(features)}")
    codes = {
        str((feature.get("properties") or {}).get("adcode") or (feature.get("properties") or {}).get("code") or "")
        for feature in features
    }
    if required_code not in codes:
        raise ValueError(f"required_code_missing:{required_code}")
    coords = [coord for feature in features for coord in positions((feature.get("geometry") or {}).get("coordinates"))]
    if not coords:
        raise ValueError(f"coordinates_missing:{path}")
    xs = [item[0] for item in coords]
    ys = [item[1] for item in coords]
    return {
        "feature_count": len(features),
        "bbox": [min(xs), min(ys), max(xs), max(ys)],
        "sha256": sha256(path),
    }


def fake_page() -> str:
    return '''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>S11 A · CSS 伪 3D 地图</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:"Microsoft YaHei",sans-serif;letter-spacing:0;background:#f3f5f4;color:#19211f}
    body{display:grid;grid-template-rows:auto 1fr;min-height:100vh}.bar{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:14px 22px;border-bottom:1px solid #cfd7d4;background:#fff}.bar h1{margin:0;font-size:18px}.bar p{margin:3px 0 0;color:#68736f;font-size:12px}.flag{padding:6px 9px;border:1px solid #d48a3a;background:#fff5e8;color:#824d12;font-weight:700;font-size:12px}
    main{position:relative;display:grid;place-items:center;overflow:hidden;min-height:0;background:linear-gradient(#e8ecea,#f7f8f7)}.stage{width:min(78vw,900px);perspective:900px}.image-plane{position:relative;transform:rotateX(54deg) rotateZ(-3deg);transform-origin:center;box-shadow:0 52px 45px rgba(25,45,39,.28);border:1px solid #9aa8a3;background:#d8dfdc}.image-plane img{display:block;width:100%;height:auto;filter:saturate(.72) contrast(1.04)}.image-plane::after{content:"";position:absolute;inset:auto -1px -18px;height:18px;background:#6c7c76;transform:skewX(-18deg);transform-origin:top}
    .note{position:absolute;left:22px;bottom:20px;max-width:440px;padding:10px 12px;background:rgba(255,255,255,.94);border-left:4px solid #b36d1d;font-size:13px;line-height:1.55}@media(max-width:700px){.bar{align-items:flex-start;padding:12px 14px}.flag{max-width:132px}.stage{width:96vw}.note{left:14px;right:14px;bottom:14px}}
  </style>
</head>
<body>
  <header class="bar"><div><h1>A · JPG + CSS 透视</h1><p>静态图片看起来有厚度，但没有 GeoJSON、WebGL、hover 或下钻。</p></div><span class="flag">反例 · 非 Three.js</span></header>
  <main><div class="stage"><div class="image-plane"><img src="assets/china-topographic-map.jpg" alt="中国地形静态图片"></div></div><div class="note">这组只能证明 CSS 能制造“斜着看”的视觉效果，不能证明地图边界可计算，也不能把 B20 光伏数据虚构映射到省市。</div></main>
</body>
</html>
'''


def three_page() -> str:
    return '''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>S11 B · 手写 Three.js GeoJSON 地图</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07100e;color:#edf5f1;font-family:"Microsoft YaHei",sans-serif;letter-spacing:0}button{font:inherit}
    #stage{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}.hud{position:fixed;z-index:4;left:18px;right:18px;top:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;pointer-events:none}.title,.controls{pointer-events:auto;background:rgba(7,16,14,.86);border:1px solid rgba(123,178,155,.42);backdrop-filter:blur(8px)}.title{padding:11px 14px;max-width:500px}.title h1{margin:0;font-size:17px}.title p{margin:5px 0 0;color:#a9bcb4;font-size:12px}.controls{display:flex;align-items:center;gap:8px;padding:8px}.controls button{min-height:36px;padding:7px 10px;border:1px solid #608f7c;background:#10241e;color:#e7f5ef;cursor:pointer}.controls button:disabled{opacity:.42;cursor:not-allowed}.scope{padding:0 6px;color:#91d9bb;font-size:12px;white-space:nowrap}
    .tooltip{position:fixed;z-index:5;display:none;padding:7px 9px;background:#f5faf7;color:#17231f;border:1px solid #7eb69f;pointer-events:none;font-size:12px}.status{position:fixed;z-index:4;left:18px;bottom:16px;max-width:min(520px,calc(100vw - 36px));padding:9px 12px;background:rgba(7,16,14,.86);border-left:3px solid #67d2a5;color:#b8cbc3;font-size:12px;line-height:1.5}
    @media(max-width:680px){.hud{left:10px;right:10px;top:10px;display:grid}.title{max-width:none}.title p{display:none}.controls{justify-content:space-between;flex-wrap:wrap}.status{left:10px;bottom:10px;max-width:calc(100vw - 20px)}}
  </style>
</head>
<body>
  <div id="stage" aria-label="可交互的 Three.js 中国行政区地图"></div>
  <div class="hud"><div class="title"><h1>B · 普通 Prompt 手写 Three.js</h1><p>真实 GeoJSON 挤出几何；移动指针查看区域，点击浙江或使用按钮下钻。</p></div><div class="controls"><span class="scope" id="scope">全国 · 35</span><button id="drill" type="button">下钻浙江</button><button id="back" type="button" disabled>返回全国</button></div></div>
  <div class="tooltip" id="tooltip" role="status"></div><div class="status" id="status">GeoJSON 已加载；等待 WebGL 首帧。</div>
  <script type="module">
    import * as THREE from '../vendor/three.module.js';

    const stage=document.getElementById('stage');const scopeEl=document.getElementById('scope');const statusEl=document.getElementById('status');const tooltip=document.getElementById('tooltip');const drillButton=document.getElementById('drill');const backButton=document.getElementById('back');
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x07100e);scene.fog=new THREE.FogExp2(0x07100e,.0048);
    const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,500);camera.position.set(0,-102,116);camera.lookAt(0,0,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.dataset.s11='three-map';stage.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xb8ffe2,0x07100e,2.1));const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-30,-45,100);scene.add(sun);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(92,64),new THREE.MeshBasicMaterial({color:0x0c1c17,transparent:true,opacity:.6}));floor.position.z=-1.5;scene.add(floor);
    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let mapGroup=new THREE.Group();scene.add(mapGroup);let interactive=[];let hovered=null;let activeScope='country';let activeName='中国';let currentData=null;let chinaData=null;let zhejiangData=null;
    window.__S11_MAP_STATE__={scope:activeScope,region:activeName,featureCount:0,renderReady:false,hovered:'',lastAction:'boot'};

    function codeOf(feature){const p=feature.properties||{};return String(p.adcode||p.code||'')}
    function nameOf(feature){const p=feature.properties||{};return String(p.name||p.fullname||p.adcode||p.code||'未命名区域')}
    function walkCoords(value,out=[]){if(Array.isArray(value)&&value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'){out.push(value)}else if(Array.isArray(value)){value.forEach(item=>walkCoords(item,out))}return out}
    function polygonsOf(geometry){if(geometry.type==='Polygon')return [geometry.coordinates];if(geometry.type==='MultiPolygon')return geometry.coordinates;return []}
    function disposeMap(){mapGroup.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material){const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(item=>item.dispose())}});scene.remove(mapGroup);mapGroup=new THREE.Group();scene.add(mapGroup);interactive=[];hovered=null}
    function ringPoints(ring,project){const points=ring.slice(0,-1).map(project).map(([x,y])=>new THREE.Vector2(x,y));return points}
    function createShape(rings,project){const outer=ringPoints(rings[0],project);if(!THREE.ShapeUtils.isClockWise(outer))outer.reverse();const shape=new THREE.Shape(outer);for(const ring of rings.slice(1)){const points=ringPoints(ring,project);if(THREE.ShapeUtils.isClockWise(points))points.reverse();shape.holes.push(new THREE.Path(points))}return shape}
    function buildMap(data,scope,name){disposeMap();currentData=data;activeScope=scope;activeName=name;const all=walkCoords(data.features.map(feature=>feature.geometry.coordinates));const xs=all.map(p=>p[0]);const ys=all.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;const lonFactor=Math.cos(centerY*Math.PI/180);const scale=Math.min(92/((maxX-minX)*lonFactor),68/(maxY-minY));const project=([lon,lat])=>[(lon-centerX)*lonFactor*scale,(lat-centerY)*scale];
      for(const feature of data.features){const featureName=nameOf(feature);const featureCode=codeOf(feature);for(const polygon of polygonsOf(feature.geometry)){if(!polygon[0]||polygon[0].length<4)continue;const shape=createShape(polygon,project);const geometry=new THREE.ExtrudeGeometry(shape,{depth:scope==='country'?2.8:4,bevelEnabled:false,curveSegments:1});const top=new THREE.MeshStandardMaterial({color:0x254f42,roughness:.7,metalness:.08,emissive:0x07130f,emissiveIntensity:.7});const side=new THREE.MeshStandardMaterial({color:0x0e2b21,roughness:.82,metalness:.02});const mesh=new THREE.Mesh(geometry,[top,side]);mesh.userData={feature,featureName,featureCode,baseColor:0x254f42};mapGroup.add(mesh);interactive.push(mesh)}}
      mapGroup.rotation.z=scope==='country'?-0.08:0.04;scopeEl.textContent=`${name} · ${data.features.length}`;backButton.disabled=scope==='country';drillButton.disabled=scope!=='country';statusEl.textContent=scope==='country'?'全国省级 GeoJSON 已挤出；浙江数据已离线预载。':'浙江 11 个市级要素已挤出；本案例到市级为止。';Object.assign(window.__S11_MAP_STATE__,{scope,region:name,featureCount:data.features.length,hovered:'',lastAction:'render'});renderOnce()}
    function setHover(hit,event){if(hovered===hit)return;if(hovered)hovered.material[0].color.setHex(hovered.userData.baseColor);hovered=hit||null;if(!hovered){tooltip.style.display='none';window.__S11_MAP_STATE__.hovered='';return}hovered.material[0].color.setHex(0x62c99f);tooltip.textContent=`${hovered.userData.featureName} · ${hovered.userData.featureCode}`;tooltip.style.display='block';tooltip.style.left=`${Math.min(event.clientX+14,innerWidth-160)}px`;tooltip.style.top=`${Math.min(event.clientY+14,innerHeight-48)}px`;window.__S11_MAP_STATE__.hovered=hovered.userData.featureName}
    function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(interactive,false)[0]?.object||null}
    renderer.domElement.addEventListener('pointermove',event=>setHover(pick(event),event));renderer.domElement.addEventListener('pointerleave',event=>setHover(null,event));renderer.domElement.addEventListener('click',event=>{const hit=pick(event);if(!hit)return;if(activeScope==='country'&&hit.userData.featureCode==='330000')drillZhejiang();else statusEl.textContent=activeScope==='country'?'离线实验只预载浙江下一级数据；未虚构其他省市。':`${hit.userData.featureName} 为本案例终点，不继续请求区县数据。`});
    function drillZhejiang(){buildMap(zhejiangData,'province','浙江省');window.__S11_MAP_STATE__.lastAction='drill-zhejiang'}function backChina(){buildMap(chinaData,'country','中国');window.__S11_MAP_STATE__.lastAction='back-country'}drillButton.addEventListener('click',drillZhejiang);backButton.addEventListener('click',backChina);window.__S11_API__={drillZhejiang,backChina};
    function renderOnce(){renderer.render(scene,camera);requestAnimationFrame(()=>renderer.render(scene,camera))}function animate(){requestAnimationFrame(animate);mapGroup.rotation.x=Math.sin(performance.now()/5000)*.012;renderer.render(scene,camera)}
    addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
    try{[chinaData,zhejiangData]=await Promise.all([fetch('../data/china.json').then(r=>{if(!r.ok)throw new Error(`china ${r.status}`);return r.json()}),fetch('../data/zhejiang.json').then(r=>{if(!r.ok)throw new Error(`zhejiang ${r.status}`);return r.json()})]);buildMap(chinaData,'country','中国');animate();window.__S11_MAP_STATE__.renderReady=true;window.__S11_MAP_STATE__.lastAction='ready';statusEl.textContent='全国省级 GeoJSON 已挤出；移动指针查看，点击浙江下钻。'}catch(error){console.error(error);statusEl.textContent=`地图加载失败：${error.message}`;window.__S11_MAP_STATE__.lastAction='error'}
  </script>
</body>
</html>
'''


def comparison_index(c_ready: bool) -> str:
    c_status = "生产构建已完成" if c_ready else "等待模板构建验收"
    c_link = '<a href="C-skill/dist/index.html">打开 C 组</a>' if c_ready else '<a href="C-skill/dist/index.html" aria-disabled="true">C 组待构建</a>'
    template = '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>S11 Three.js 地图对比</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f4f2;color:#19211f;font:14px/1.55 "Microsoft YaHei",sans-serif;letter-spacing:0}header{padding:20px 24px;border-bottom:1px solid #ccd5d1;background:#fff}h1{margin:0;font-size:22px}header p{margin:6px 0 0;color:#64716c}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#ccd5d1;min-height:calc(100vh - 102px)}article{background:#fff;padding:24px;display:flex;flex-direction:column;gap:13px}article h2{margin:0;font-size:17px}article p{margin:0;color:#5f6c67}dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:7px 12px}dt{font-weight:700}dd{margin:0}a{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;background:#173e33;color:#fff;text-decoration:none}a[aria-disabled=true]{background:#c9cecc;color:#59625f;pointer-events:none}@media(max-width:760px){header{padding:16px}.grid{grid-template-columns:1fr}article{padding:18px;min-height:280px}}
</style></head><body><header><h1>S11 · 真实 GeoJSON Three.js 地图竞技场</h1><p>同一问题分成伪 3D、手写 Three.js 和固定 GitHub Skill 三条轨道。</p></header><main class="grid">
<article><h2>A · CSS 伪 3D</h2><p>JPG 倾斜和阴影能制造空间感，但没有几何、hover 或下钻。</p><dl><dt>Canvas</dt><dd>无</dd><dt>数据</dt><dd>静态图片</dd><dt>用途</dt><dd>反例</dd></dl><a href="A-css-fake/index.html">打开 A 组</a></article>
<article><h2>B · 手写 Three.js</h2><p>真实省级 GeoJSON 转为挤出几何，离线预载浙江市级数据。</p><dl><dt>Canvas</dt><dd>WebGL</dd><dt>交互</dt><dd>hover、下钻、返回</dd><dt>依赖</dt><dd>Three.js 0.178.0</dd></dl><a href="B-three/index.html">打开 B 组</a></article>
<article><h2>C · GitHub Skill</h2><p>`three-scope-map` 固定模板，包含 Earth 入口、材质、标签、飞线、追光与层级切换。</p><dl><dt>来源</dt><dd>固定 commit</dd><dt>许可证</dt><dd>GPL-3.0</dd><dt>状态</dt><dd>__C_STATUS__</dd></dl>__C_LINK__</article>
</main></body></html>'''
    return template.replace("__C_STATUS__", c_status).replace("__C_LINK__", c_link)


def prompts() -> dict[str, str]:
    return {
        "A-css-fake.txt": "把中国地形图片做成立体地图效果，可以使用 CSS 透视和阴影。\n",
        "B-ordinary-three.txt": "使用 Three.js 和真实中国省级 GeoJSON 做一个 3D 地图。支持鼠标 hover；点击浙江省下钻到市级，并能返回全国。不得把 B20 光伏数据映射到省市。\n",
        "C-three-scope-map-skill.txt": "使用 $three-scope-map 的一对一模板和真实 GeoJSON 生成中国 3D 地图，保留 Earth 入口、挤出侧壁、边界、标签、hover、飞线、追光、浙江下钻、返回上级、GPL-3.0 SPDX 与原作者署名；构建后必须做桌面和手机浏览器、canvas 非空像素、WebGL、hover、下钻、控制台和资源体积验收。\n",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the S11 CSS-vs-Three.js comparison.")
    parser.add_argument("--china", required=True)
    parser.add_argument("--zhejiang", required=True)
    parser.add_argument("--three-module", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        china = Path(args.china).resolve()
        zhejiang = Path(args.zhejiang).resolve()
        three_module = Path(args.three_module).resolve()
        three_core = three_module.with_name("three.core.js")
        image = Path(args.image).resolve()
        output = Path(args.output_dir).resolve()
        if not three_module.is_file() or three_module.name != "three.module.js":
            raise ValueError("three_module_missing")
        if not three_core.is_file():
            raise ValueError("three_core_missing")
        if not image.is_file() or image.suffix.lower() not in {".jpg", ".jpeg"}:
            raise ValueError("image_missing")
        china_info = inspect_geojson(china, 35, "330000")
        zhejiang_info = inspect_geojson(zhejiang, 11, "330100")
        fake_dir = output / "A-css-fake"
        basic_dir = output / "B-three"
        for directory in (fake_dir / "assets", basic_dir, output / "data", output / "vendor", output / "prompts"):
            directory.mkdir(parents=True, exist_ok=True)
        c_ready = (output / "C-skill/dist/index.html").is_file()
        (fake_dir / "index.html").write_text(fake_page(), encoding="utf-8")
        (basic_dir / "index.html").write_text(three_page(), encoding="utf-8")
        (output / "index.html").write_text(comparison_index(c_ready), encoding="utf-8")
        copy_if_different(image, fake_dir / "assets/china-topographic-map.jpg")
        copy_if_different(three_module, output / "vendor/three.module.js")
        copy_if_different(three_core, output / "vendor/three.core.js")
        copy_if_different(china, output / "data/china.json")
        copy_if_different(zhejiang, output / "data/zhejiang.json")
        for name, content in prompts().items():
            (output / "prompts" / name).write_text(content, encoding="utf-8")
        receipt = {
            "schema_version": "1.0",
            "status": "complete-local" if c_ready else "a-b-complete-c-pending",
            "data": {
                "china": {**china_info, "source_url": CHINA_URL},
                "zhejiang": {**zhejiang_info, "source_url": ZHEJIANG_URL},
            },
            "three": {
                "version": "0.178.0",
                "module_sha256": sha256(three_module),
                "core_sha256": sha256(three_core),
            },
            "skill": {
                "repository": "https://github.com/songsummer920-dazzle/three-scope-map-skill",
                "commit": "605867c0dc7f3a3b3ce601e76a695e4d9fe7a943",
                "license": "GPL-3.0-or-later",
                "verdict": "CAUTION",
                "attribution": "作者全平台ID：宋夏天Dazzle；公众号：送你整个夏天",
            },
            "claims": {"a_is_webgl": False, "b_is_webgl": True, "c_generated": c_ready},
            "external_business_data_used": False,
        }
        (output / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps({"status": "complete-local" if c_ready else "a-b-complete-c-pending", "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
