import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { CONFIG } from "./config.js";

/** Renderer, camera, controls and bloom post-processing, attached to `container`. */
export class Viewer {
  constructor(container) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = CONFIG.exposure;
    container.appendChild(this.renderer.domElement);

    // HTML labels drawn over the canvas
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.className = "labels";
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, width / height, 0.1, 1000);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = CONFIG.autoRotateSpeed;

    const { strength, radius, threshold } = CONFIG.bloom;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold));
    this.composer.addPass(new OutputPass());

    this.clock = new THREE.Clock();
    window.addEventListener("resize", () => this.resize());
  }

  /** Points the camera at the origin from a distance suited to an object of the given radius. */
  frame(radius) {
    const { elevationDegrees, distance, minDistance, maxDistance } = CONFIG.camera;
    const elevation = THREE.MathUtils.degToRad(elevationDegrees);
    this.camera.position.set(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(radius * distance);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = radius * minDistance;
    this.controls.maxDistance = radius * maxDistance;
    this.controls.update();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  /** Starts the render loop, calling onFrame(elapsedSeconds) before each frame. */
  start(onFrame) {
    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      onFrame(this.clock.elapsedTime);
      this.controls.update(delta);
      this.composer.render();
      this.labelRenderer.render(this.scene, this.camera);
    });
  }
}
