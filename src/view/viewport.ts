import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Shape, ShapeKind } from '../core/document';
import type { CameraControl, Editor } from '../core/editor';
import type { ViewName } from '../core/parser';

const WORKPLANE_SIZE = 200; // mm
const HOME_TARGET = new THREE.Vector3(0, 0, 0);

/** Géométries unitaires (1 mm, centrées) mises à l'échelle par forme. */
const UNIT_GEOMETRIES: Record<ShapeKind, THREE.BufferGeometry> = {
  boite: new THREE.BoxGeometry(1, 1, 1),
  cylindre: new THREE.CylinderGeometry(0.5, 0.5, 1, 48).rotateX(Math.PI / 2),
  sphere: new THREE.SphereGeometry(0.5, 48, 24),
};
const UNIT_EDGES: Record<ShapeKind, THREE.BufferGeometry> = {
  boite: new THREE.EdgesGeometry(UNIT_GEOMETRIES.boite),
  cylindre: new THREE.EdgesGeometry(UNIT_GEOMETRIES.cylindre, 30),
  sphere: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), // cadre autour de la sphère
};

const VIEW_DIRECTIONS: Record<ViewName, THREE.Vector3> = {
  dessus: new THREE.Vector3(0, -0.001, 1),
  dessous: new THREE.Vector3(0, -0.001, -1),
  face: new THREE.Vector3(0, -1, 0),
  arriere: new THREE.Vector3(0, 1, 0),
  gauche: new THREE.Vector3(-1, 0, 0),
  droite: new THREE.Vector3(1, 0, 0),
  iso: new THREE.Vector3(1, -1.4, 1.1),
};

interface ShapeView {
  group: THREE.Group;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  label: CSS2DObject;
}

export class Viewport implements CameraControl {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
  private readonly controls: OrbitControls;
  private readonly views = new Map<number, ShapeView>();
  private readonly raycaster = new THREE.Raycaster();
  private pointerDown: { x: number; y: number } | null = null;

  /**
   * @param onPick appelé quand l'utilisateur vise une forme (ou le vide, avec null).
   *   `additive` vaut true avec Maj ou Ctrl enfoncé.
   */
  constructor(
    private readonly container: HTMLElement,
    private readonly editor: Editor,
    private readonly onPick: (id: number | null, additive: boolean) => void,
  ) {
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.labels.domElement.className = 'labels-layer';
    container.appendChild(this.labels.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.copy(HOME_TARGET);

    this.buildEnvironment();
    this.setView('iso');

    editor.doc.onChange(() => this.syncShapes());
    editor.onSelectionChange(() => this.syncSelection());
    editor.camera = this;

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.pointerDown = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => this.handleClick(e));

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    });
  }

  setView(view: ViewName): void {
    const distance = Math.max(this.camera.position.distanceTo(this.controls.target), 150);
    const direction = VIEW_DIRECTIONS[view].clone().normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(direction, view === 'iso' ? 200 : distance);
    this.controls.update();
  }

  zoom(direction: 'in' | 'out'): void {
    const factor = direction === 'in' ? 0.7 : 1 / 0.7;
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    const length = THREE.MathUtils.clamp(offset.length(), 20, 3000);
    this.camera.position.copy(this.controls.target).add(offset.setLength(length));
    this.controls.update();
  }

  private buildEnvironment(): void {
    this.scene.background = new THREE.Color('#dfe6ee');

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(WORKPLANE_SIZE, WORKPLANE_SIZE),
      new THREE.MeshBasicMaterial({ color: '#2b74c9', transparent: true, opacity: 0.12, depthWrite: false }),
    );
    plane.renderOrder = -1;
    this.scene.add(plane);

    const fine = new THREE.GridHelper(WORKPLANE_SIZE, WORKPLANE_SIZE / 5, '#9db3cc', '#9db3cc');
    const coarse = new THREE.GridHelper(WORKPLANE_SIZE, WORKPLANE_SIZE / 50, '#4a6c93', '#4a6c93');
    for (const grid of [fine, coarse]) {
      grid.rotateX(Math.PI / 2); // GridHelper est horizontal en Y-up ; on le couche sur XY
      this.scene.add(grid);
    }

    const axes = new THREE.AxesHelper(30);
    axes.position.z = 0.05;
    this.scene.add(axes);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a96a8', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(80, -120, 200);
    this.scene.add(sun);
  }

  private syncShapes(): void {
    const shapes = this.editor.doc.all();
    const alive = new Set(shapes.map((s) => s.id));
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        view.label.element.remove();
        this.scene.remove(view.group);
        (view.mesh.material as THREE.Material).dispose();
        this.views.delete(id);
      }
    }
    for (const shape of shapes) {
      const view = this.views.get(shape.id) ?? this.createView(shape);
      this.applyShape(view, shape);
    }
    this.syncSelection();
  }

  private createView(shape: Shape): ShapeView {
    const mesh = new THREE.Mesh(UNIT_GEOMETRIES[shape.kind], new THREE.MeshStandardMaterial({ roughness: 0.55 }));
    mesh.userData.shapeId = shape.id;
    const edges = new THREE.LineSegments(UNIT_EDGES[shape.kind], new THREE.LineBasicMaterial({ color: '#0b2c5c' }));

    // Grosse étiquette numérotée, cliquable : cible facile au regard et nom pour la voix.
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'shape-badge';
    badge.textContent = String(shape.id);
    badge.setAttribute('aria-label', `Forme ${shape.id}`);
    badge.addEventListener('click', (e) => this.onPick(shape.id, e.shiftKey || e.ctrlKey));
    const label = new CSS2DObject(badge);

    const group = new THREE.Group();
    group.add(mesh, edges, label);
    this.scene.add(group);
    const view = { group, mesh, edges, label };
    this.views.set(shape.id, view);
    return view;
  }

  private applyShape(view: ShapeView, shape: Shape): void {
    const { x, y, z } = shape.size;
    view.group.position.set(shape.position.x, shape.position.y, shape.position.z + z / 2);
    view.mesh.scale.set(x, y, z);
    view.edges.scale.set(x, y, z);
    view.label.position.set(0, 0, z / 2 + 4);
    const material = view.mesh.material as THREE.MeshStandardMaterial;
    material.color.set(shape.hole ? '#9aa4b1' : shape.color);
    material.transparent = shape.hole;
    material.opacity = shape.hole ? 0.45 : 1;
  }

  private syncSelection(): void {
    for (const [id, view] of this.views) {
      const selected = this.editor.isSelected(id);
      view.edges.visible = selected;
      (view.mesh.material as THREE.MeshStandardMaterial).emissive.set(selected ? '#1f4f8f' : '#000000');
      view.label.element.classList.toggle('selected', selected);
    }
  }

  private handleClick(event: PointerEvent): void {
    const start = this.pointerDown;
    this.pointerDown = null;
    // Un glissé fait tourner la caméra : ce n'est pas un clic de sélection.
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const meshes = [...this.views.values()].map((v) => v.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const id = hit?.object.userData.shapeId as number | undefined;
    this.onPick(id ?? null, event.shiftKey || event.ctrlKey);
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labels.setSize(width, height);
  }
}
