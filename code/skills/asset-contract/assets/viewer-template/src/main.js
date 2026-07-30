import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./style.css";

const host = document.querySelector("#viewer");
const status = document.querySelector("#load-status");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1723);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(2.4, 1.8, 2.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0.5, 0.5, 0);
scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x17202a, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(3, 4, 2);
scene.add(keyLight);
scene.add(new THREE.GridHelper(6, 12, 0x44708b, 0x203b4c));

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const loader = new GLTFLoader();
loader.load(
  "/model.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) child.material = new THREE.MeshStandardMaterial({ color: 0x35d0ba, metalness: 0.08, roughness: 0.52, side: THREE.DoubleSide });
    });
    model.rotation.x = -Math.PI / 2;
    model.position.set(-0.5, 0.02, 0.5);
    scene.add(model);
    status.textContent = "本地 GLB 已加载；可拖动旋转并滚轮缩放。";
  },
  undefined,
  (error) => {
    status.textContent = `加载失败：${error.message}`;
    status.dataset.state = "error";
  },
);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener("pagehide", () => {
  renderer.setAnimationLoop(null);
  controls.dispose();
  renderer.dispose();
}, { once: true });
