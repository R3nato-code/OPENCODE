import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SQUARE_SIZE = 1;
const BOARD_TOP = 0.22;

// enquadramento da câmera
const VIEW_CENTER = new THREE.Vector3(0, 1.0, 0);
const ELEVATION = THREE.MathUtils.degToRad(40);
const BOUND = { hx: 4.9, hy: 1.4, hz: 4.9 };

const COLORS = {
  whiteSquare: 0xe8d5b0,
  blackSquare: 0xa97c50,
  frame: 0x6b4e35,
  base: 0x2f2118,
  highlight: 0xe8a838,
  legalMove: 0xe8a838,
  capture: 0xd9534f,
  check: 0xff4444,
  lastMove: 0x88cc77
};

// ---------------------------------------------------------------- materiais
// caches compartilhados entre as peças; nunca descartados por partida
const materialCache = new Map();

function cachedMaterial(key, factory) {
  if (!materialCache.has(key)) materialCache.set(key, factory());
  return materialCache.get(key);
}

function pieceMaterials(color) {
  const isW = color === 'w';
  return {
    main: cachedMaterial('main-' + color, () => new THREE.MeshStandardMaterial({
      color: isW ? 0xf3ecdd : 0x232329,
      roughness: isW ? 0.42 : 0.38,
      metalness: isW ? 0.06 : 0.12
    })),
    dark: cachedMaterial('dark-' + color, () => new THREE.MeshStandardMaterial({
      color: isW ? 0xcfc3a8 : 0x111116,
      roughness: 0.5,
      metalness: 0.1
    })),
    gold: cachedMaterial('gold', () => new THREE.MeshStandardMaterial({
      color: 0xd4a531,
      roughness: 0.28,
      metalness: 0.85
    }))
  };
}

// ---------------------------------------------------------------- moldes
// cada tipo+cor é construído uma única vez e clonado nas jogadas
const templateCache = new Map();

function lathe(points, material, segments = 28) {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, segments), material);
}

function finishTemplate(group) {
  group.updateMatrixWorld(true);

  // funde as sub-malhas por material: uma peça vira 1-2 draw calls
  // em vez de até 11, mantendo exatamente a mesma geometria e material
  const byMaterial = new Map();
  group.traverse(child => {
    if (!child.isMesh) return;
    const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
    const list = byMaterial.get(child.material);
    if (list) list.push(geometry);
    else byMaterial.set(child.material, [geometry]);
  });

  const merged = new THREE.Group();
  for (const [material, geometries] of byMaterial) {
    const geometry = geometries.length === 1
      ? geometries[0]
      : mergeGeometries(geometries, false);
    if (!geometry) {
      geometries.forEach(g => g.dispose());
      group.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return group;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    merged.add(mesh);
  }
  return merged;
}

function buildPawn(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.33, 0], [0.35, 0.035], [0.33, 0.08], [0.25, 0.12],
    [0.16, 0.19], [0.13, 0.32], [0.14, 0.4],
    [0.185, 0.45], [0.155, 0.49],
    [0.2, 0.55], [0.23, 0.63], [0.2, 0.73], [0.13, 0.82], [0.05, 0.87], [0, 0.89]
  ], m.main));
  return g;
}

function buildRook(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.35, 0], [0.37, 0.04], [0.35, 0.09], [0.27, 0.14],
    [0.235, 0.2], [0.22, 0.6], [0.26, 0.68],
    [0.3, 0.72], [0.32, 0.8], [0.31, 0.92], [0.32, 0.95], [0.29, 0.97], [0, 0.97]
  ], m.main));
  const toothGeo = new THREE.BoxGeometry(0.11, 0.13, 0.09);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, m.main);
    tooth.position.set(Math.cos(a) * 0.225, 1.02, Math.sin(a) * 0.225);
    tooth.rotation.y = -a;
    g.add(tooth);
  }
  return g;
}

function buildKnight(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.35, 0], [0.37, 0.04], [0.35, 0.09], [0.27, 0.14],
    [0.225, 0.22], [0.2, 0.4], [0.21, 0.5]
  ], m.main));

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.52, 0.3), m.main);
  skull.position.set(0, 0.22, 0.02);
  skull.rotation.x = -0.3;
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.32), m.main);
  muzzle.position.set(0, 0, 0.2);
  muzzle.rotation.x = 0.4;
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), m.dark);
  nose.position.set(0, -0.02, 0.36);
  head.add(nose);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 6), m.main);
    ear.position.set(0.1 * s, 0.5, -0.04);
    ear.rotation.z = -0.3 * s;
    head.add(ear);
  }

  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.2), m.dark);
  mane.position.set(0, 0.2, -0.18);
  mane.rotation.x = -0.35;
  head.add(mane);

  head.position.y = 0.52;
  g.add(head);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), m.dark);
    eye.position.set(0.155 * s, 0.8, 0.14);
    g.add(eye);
  }

  if (color === 'w') g.rotation.y = Math.PI;
  return g;
}

function buildBishop(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.35, 0], [0.37, 0.04], [0.35, 0.09], [0.27, 0.14],
    [0.17, 0.27], [0.14, 0.46], [0.15, 0.56],
    [0.195, 0.61], [0.165, 0.65],
    [0.215, 0.72], [0.24, 0.84], [0.2, 0.98], [0.12, 1.1], [0.045, 1.16], [0, 1.18]
  ], m.main));

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), m.main);
  ball.position.y = 1.22;
  g.add(ball);

  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.2), m.dark);
  slit.position.set(0, 0.92, 0.14);
  slit.rotation.x = 0.4;
  g.add(slit);
  return g;
}

function buildQueen(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.36, 0], [0.38, 0.04], [0.36, 0.09], [0.28, 0.15],
    [0.185, 0.3], [0.15, 0.52], [0.16, 0.66],
    [0.22, 0.72], [0.19, 0.77],
    [0.24, 0.86], [0.28, 0.97], [0.295, 1.06], [0.255, 1.1],
    [0.19, 1.08], [0.1, 1.06], [0, 1.05]
  ], m.main));

  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 10, 32), m.gold);
  crownRing.position.y = 1.05;
  crownRing.rotation.x = Math.PI / 2;
  g.add(crownRing);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), m.gold);
    spike.position.set(Math.cos(a) * 0.245, 1.13, Math.sin(a) * 0.245);
    spike.rotation.x = Math.sin(a) * -0.25;
    spike.rotation.z = Math.cos(a) * 0.25;
    g.add(spike);
  }

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), m.gold);
  ball.position.y = 1.18;
  g.add(ball);
  return g;
}

function buildKing(color) {
  const m = pieceMaterials(color);
  const g = new THREE.Group();
  g.add(lathe([
    [0, 0], [0.37, 0], [0.39, 0.04], [0.37, 0.09], [0.29, 0.15],
    [0.195, 0.32], [0.16, 0.56], [0.17, 0.72],
    [0.235, 0.78], [0.205, 0.83],
    [0.26, 0.92], [0.3, 1.04], [0.31, 1.14], [0.27, 1.18],
    [0.2, 1.16], [0, 1.14]
  ], m.main));

  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 10, 32), m.gold);
  crownRing.position.y = 1.13;
  crownRing.rotation.x = Math.PI / 2;
  g.add(crownRing);

  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.26, 0.065), m.gold);
  crossV.position.y = 1.31;
  g.add(crossV);

  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.065), m.gold);
  crossH.position.y = 1.35;
  g.add(crossH);
  return g;
}

const PIECE_BUILDERS = {
  p: buildPawn,
  r: buildRook,
  n: buildKnight,
  b: buildBishop,
  q: buildQueen,
  k: buildKing
};

function getPieceTemplate(type, color) {
  const key = type + color;
  if (!templateCache.has(key)) {
    templateCache.set(key, finishTemplate(PIECE_BUILDERS[type](color)));
  }
  return templateCache.get(key);
}

// ---------------------------------------------------------------- glifos 2D
const PIECE_GLYPHS = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const glyphCache = new Map();
const glyphPlaneGeometry = new THREE.PlaneGeometry(0.86, 0.86);

function getGlyphMaterial(type, color) {
  const key = type + color;
  if (!glyphCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '96px "Segoe UI Symbol", "DejaVu Sans", "Arial Unicode MS", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color === 'w' ? '#16161f' : '#e8dcc2';
    ctx.fillStyle = color === 'w' ? '#faf6ec' : '#1b1b21';
    ctx.strokeText(PIECE_GLYPHS[type], 64, 66);
    ctx.fillText(PIECE_GLYPHS[type], 64, 66);

    const texture = new THREE.CanvasTexture(canvas);
    glyphCache.set(key, new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    }));
  }
  return glyphCache.get(key);
}

// ---------------------------------------------------------------- cena
export class ChessScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.pieces = new Map();
    this.highlights = [];
    this.selectedSquare = null;
    this.legalMoves = [];
    this.orientation = 'white';
    this.animationQueue = [];
    this.isAnimating = false;
    this.arrows = [];
    this.markers = new Map();
    this.viewMode = '3d';

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.hitPoint = new THREE.Vector3();
    this.boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);

    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || 600;
    const height = this.canvas.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // o mapa de sombras só é re-renderizado quando algo se move
    // (custo de uma cena extra a cada quadro é o maior do render)
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.updateCamera();

    this.createLights();
    this.createBoard();
    this.createCoordinates();
    this.createGroundShadow();

    this.animate();
  }

  invalidateShadow() {
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  createLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const hemi = new THREE.HemisphereLight(0xffffff, 0x404048, 0.45);
    this.scene.add(hemi);

    const mainLight = new THREE.DirectionalLight(0xffffee, 1.3);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -7;
    mainLight.shadow.camera.right = 7;
    mainLight.shadow.camera.top = 7;
    mainLight.shadow.camera.bottom = -7;
    mainLight.shadow.bias = -0.0008;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.35);
    fillLight.position.set(-5, 6, -4);
    this.scene.add(fillLight);
  }

  createBoard() {
    const boardGroup = new THREE.Group();

    // base escura (maciça, sem faces superiores coplanares com as casas)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(9.7, 0.26, 9.7),
      new THREE.MeshStandardMaterial({ color: COLORS.base, roughness: 0.8, metalness: 0.05 })
    );
    base.position.y = -0.13;
    base.receiveShadow = true;
    boardGroup.add(base);

    // moldura: bloco sólido por baixo das casas (topo em y=0.12)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9.15, 0.24, 9.15),
      new THREE.MeshStandardMaterial({ color: COLORS.frame, roughness: 0.5, metalness: 0.08 })
    );
    frame.position.y = 0;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // casas: topo em BOARD_TOP=0.22, assentadas sobre a moldura (sem z-fighting)
    // 32 casas claras + 32 escuras em 2 InstancedMesh = 2 draw calls (antes 64)
    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);
    const lightMat = new THREE.MeshStandardMaterial({
      color: COLORS.whiteSquare, roughness: 0.85, metalness: 0.03
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: COLORS.blackSquare, roughness: 0.85, metalness: 0.03
    });

    const lightSquares = new THREE.InstancedMesh(squareGeometry, lightMat, 32);
    const darkSquares = new THREE.InstancedMesh(squareGeometry, darkMat, 32);
    lightSquares.receiveShadow = true;
    darkSquares.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    let lightIndex = 0;
    let darkIndex = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (rank + file) % 2 === 0;
        matrix.setPosition(file - 3.5, BOARD_TOP - 0.05, rank - 3.5);
        if (isLight) lightSquares.setMatrixAt(lightIndex++, matrix);
        else darkSquares.setMatrixAt(darkIndex++, matrix);
      }
    }

    lightSquares.instanceMatrix.needsUpdate = true;
    darkSquares.instanceMatrix.needsUpdate = true;
    lightSquares.computeBoundingSphere();
    darkSquares.computeBoundingSphere();

    boardGroup.add(lightSquares);
    boardGroup.add(darkSquares);

    this.scene.add(boardGroup);
    this.boardGroup = boardGroup;
  }

  createGroundShadow() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.27;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  createCoordinates() {
    const files = 'abcdefgh';
    const ranks = '87654321';
    const FRAME_MID = 4.29;

    const createLabel = (text, position) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillStyle = '#efe4cb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 17);

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.LinearFilter;

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      }));
      sprite.position.copy(position);
      sprite.scale.set(0.55, 0.28, 1);
      return sprite;
    };

    // impressos sobre a moldura, como em um tabuleiro real:
    // dentro dos limites do tabuleiro, nunca cortados pela tela
    for (let i = 0; i < 8; i++) {
      const x = i - 3.5;

      this.scene.add(createLabel(files[i], new THREE.Vector3(x, 0.3, -FRAME_MID)));
      this.scene.add(createLabel(files[i], new THREE.Vector3(x, 0.3, FRAME_MID)));
      this.scene.add(createLabel(ranks[i], new THREE.Vector3(-FRAME_MID, 0.3, x)));
      this.scene.add(createLabel(ranks[i], new THREE.Vector3(FRAME_MID, 0.3, x)));
    }
  }

  updateCamera() {
    const w = this.canvas.clientWidth || 600;
    const h = this.canvas.clientHeight || 600;
    const aspect = w / h;

    // enquadramento responsivo: distância mínima para toda a caixa
    // delimitora (tabuleiro + peças levantadas) caber no campo de visão,
    // seja qual for a proporção do canvas
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;

    const is2d = this.viewMode === '2d';
    const elevation = is2d ? Math.PI / 2 : ELEVATION;
    const sinE = Math.sin(elevation);
    const cosE = Math.cos(elevation);

    const extentUp = BOUND.hy * cosE + BOUND.hz * sinE;
    const extentRight = BOUND.hx;

    const dist = Math.max(extentUp / tanV, extentRight / tanH) * 1.08;

    const zSign = this.orientation === 'white' ? 1 : -1;
    this.camera.position.set(
      VIEW_CENTER.x,
      VIEW_CENTER.y + dist * sinE,
      VIEW_CENTER.z + zSign * dist * cosE
    );
    // topo puro: "up" da câmera alinhado ao tabuleiro (senão lookAt degenera)
    if (is2d) {
      this.camera.up.set(0, 0, this.orientation === 'white' ? -1 : 1);
    } else {
      this.camera.up.set(0, 1, 0);
    }
    this.camera.lookAt(VIEW_CENTER);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setOrientation(orientation) {
    this.orientation = orientation;
    this.updateCamera();
    this.updatePiecePositions();
  }

  squareToCoords(file, rank) {
    return new THREE.Vector3(file - 3.5, BOARD_TOP, rank - 3.5);
  }

  coordsToSquare(x, z) {
    const file = Math.round(x + 3.5);
    const rank = Math.round(z + 3.5);
    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      return { file, rank };
    }
    return null;
  }

  getSquareName(file, rank) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    return files[file] + ranks[rank];
  }

  createPiece(piece, square) {
    const template = getPieceTemplate(piece.type, piece.color);
    if (!template) return null;

    // grupo com duas representações: 3D (volume) e 2D (glifo plano)
    const wrapper = new THREE.Group();
    const three = template.clone();
    const flat = new THREE.Mesh(glyphPlaneGeometry, getGlyphMaterial(piece.type, piece.color));
    flat.rotation.x = -Math.PI / 2;
    flat.position.y = 0.002;

    wrapper.add(three);
    wrapper.add(flat);
    wrapper.userData = { piece, square: { ...square }, parts: { three, flat } };
    three.visible = this.viewMode === '3d';
    flat.visible = this.viewMode === '2d';
    this.applyGlyphOrientation(wrapper);
    wrapper.position.copy(this.squareToCoords(square.file, square.rank));

    this.scene.add(wrapper);
    this.pieces.set(this.getSquareName(square.file, square.rank), wrapper);
    this.invalidateShadow();
    return wrapper;
  }

  applyGlyphOrientation(wrapper) {
    const parts = wrapper.userData.parts;
    if (!parts) return;
    // glifo deitado no chão, "para cima" apontando para o lado do jogador
    const lay = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    const spin = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.orientation === 'white' ? 0 : Math.PI
    );
    parts.flat.quaternion.copy(spin).multiply(lay);
  }

  setViewMode(mode) {
    this.viewMode = mode === '2d' ? '2d' : '3d';
    this.pieces.forEach(wrapper => {
      const parts = wrapper.userData.parts;
      if (parts) {
        parts.three.visible = this.viewMode === '3d';
        parts.flat.visible = this.viewMode === '2d';
      }
    });
    this.updateCamera();
    this.invalidateShadow();
  }

  setPieceTint(wrapper, red) {
    if (!wrapper) return;
    const tint = new THREE.Color(0xd9534f);
    wrapper.traverse(child => {
      if (child.isMesh && child.material && child.material.color) {
        if (!child.userData.baseColor) {
          child.material = child.material.clone();
          child.userData.baseColor = child.material.color.clone();
        }
        child.material.color.copy(child.userData.baseColor);
        if (red) child.material.color.lerp(tint, 0.65);
      }
    });
  }

  applyPreMoveVisual(fromSquare, toSquare) {
    const fromName = this.getSquareName(fromSquare.file, fromSquare.rank);
    const toName = this.getSquareName(toSquare.file, toSquare.rank);
    const wrapper = this.pieces.get(fromName);
    if (!wrapper) return false;

    const target = this.pieces.get(toName);
    if (target && target !== wrapper) {
      if (target.userData.piece.color !== wrapper.userData.piece.color) {
        this.removePiece(toName);
      } else {
        return false;
      }
    }

    this.animatePiece(wrapper, fromSquare, toSquare);
    this.pieces.delete(fromName);
    this.pieces.set(toName, wrapper);
    wrapper.userData.square = { ...toSquare };
    wrapper.userData.preMoved = true;
    this.setPieceTint(wrapper, true);
    return true;
  }

  removePiece(squareName) {
    const mesh = this.pieces.get(squareName);
    if (mesh) {
      this.scene.remove(mesh);
      this.pieces.delete(squareName);
      this.invalidateShadow();
    }
  }

  movePiece(fromSquare, toSquare, captured) {
    const fromName = this.getSquareName(fromSquare.file, fromSquare.rank);
    const toName = this.getSquareName(toSquare.file, toSquare.rank);

    const mesh = this.pieces.get(fromName);
    if (!mesh) return;

    if (captured) this.removePiece(toName);

    this.animatePiece(mesh, fromSquare, toSquare);
    this.pieces.delete(fromName);
    this.pieces.set(toName, mesh);
    mesh.userData.square = { ...toSquare };
  }

  animatePiece(mesh, fromSquare, toSquare) {
    const fromPos = this.squareToCoords(fromSquare.file, fromSquare.rank);
    const toPos = this.squareToCoords(toSquare.file, toSquare.rank);
    const midPos = fromPos.clone().lerp(toPos, 0.5);
    midPos.y = BOARD_TOP + 2;

    this.animationQueue.push({ mesh, fromPos, midPos, toPos });
    this.processAnimation();
  }

  processAnimation() {
    if (this.isAnimating || this.animationQueue.length === 0) return;

    this.isAnimating = true;
    const { mesh, fromPos, midPos, toPos } = this.animationQueue.shift();

    const duration = 300;
    const startTime = performance.now();

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeInOutCubic(progress);

      let currentPos;
      if (progress < 0.5) {
        currentPos = fromPos.clone().lerp(midPos, eased * 2);
      } else {
        currentPos = midPos.clone().lerp(toPos, (eased - 0.5) * 2);
      }

      mesh.position.copy(currentPos);
      this.invalidateShadow();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        mesh.position.copy(toPos);
        this.isAnimating = false;
        this.processAnimation();
      }
    };

    requestAnimationFrame(animate);
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  updatePiecePositions() {
    this.pieces.forEach((mesh, squareName) => {
      const file = squareName.charCodeAt(0) - 97;
      const rank = 8 - parseInt(squareName[1]);
      mesh.position.copy(this.squareToCoords(file, rank));
      this.applyGlyphOrientation(mesh);
    });
  }

  setPosition(board) {
    this.pieces.forEach(mesh => this.scene.remove(mesh));
    this.pieces.clear();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) this.createPiece(piece, { file, rank });
      }
    }
  }

  highlightSquare(file, rank, type = 'selected') {
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return;

    let color, opacity, geometry;

    switch (type) {
      case 'selected':
        color = COLORS.highlight;
        opacity = 0.55;
        geometry = new THREE.RingGeometry(0.38, 0.47, 32);
        break;
      case 'legal':
        color = COLORS.legalMove;
        opacity = 0.5;
        geometry = new THREE.CircleGeometry(0.13, 24);
        break;
      case 'capture':
        color = COLORS.capture;
        opacity = 0.55;
        geometry = new THREE.RingGeometry(0.36, 0.46, 32);
        break;
      case 'check':
        color = COLORS.check;
        opacity = 0.6;
        geometry = new THREE.RingGeometry(0.4, 0.49, 32);
        break;
      case 'lastMove':
        color = COLORS.lastMove;
        opacity = 0.4;
        geometry = new THREE.RingGeometry(0.42, 0.5, 4);
        break;
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const highlight = new THREE.Mesh(geometry, material);
    highlight.position.set(file - 3.5, BOARD_TOP + 0.004, rank - 3.5);
    highlight.rotation.x = -Math.PI / 2;
    if (type === 'lastMove') highlight.rotation.z = Math.PI / 4;
    this.scene.add(highlight);
    this.highlights.push(highlight);
  }

  clearHighlights() {
    this.highlights.forEach(h => {
      this.scene.remove(h);
      h.geometry.dispose();
      h.material.dispose();
    });
    this.highlights = [];
  }

  setSelectedSquare(square) {
    this.selectedSquare = square;
  }

  setLegalMoves(moves) {
    this.legalMoves = moves;
  }

  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height);
    this.updateCamera();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    this.highlights.forEach((h, i) => {
      h.material.opacity = 0.35 + Math.sin(time * 3 + i) * 0.15;
    });

    this.arrows.forEach((a, i) => {
      a.material.opacity = 0.65 + Math.sin(time * 4 + i) * 0.2;
    });

    this.renderer.render(this.scene, this.camera);
  }

  raycast(mouseX, mouseY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((mouseX - rect.left) / rect.width) * 2 - 1;
    const y = -((mouseY - rect.top) / rect.height) * 2 + 1;

    const raycaster = this.raycaster;
    // lookAt() só atualiza o quaternion: sem isto a matriz usada no cálculo
    // pode ainda ser a do frame anterior (clique no mesmo frame de um flip)
    this.camera.updateMatrixWorld();
    raycaster.setFromCamera(this.pointerNdc.set(x, y), this.camera);

    // interseção analítica com o plano do tabuleiro: dispensa testar
    // as 64 casas e devolve o mesmo resultado { file, rank }
    const hit = raycaster.ray.intersectPlane(this.boardPlane, this.hitPoint);
    if (!hit) return null;
    // limita ao retângulo das 64 casas (x e z entre -4 e 4)
    if (Math.abs(hit.x) > 4 || Math.abs(hit.z) > 4) return null;
    return this.coordsToSquare(hit.x, hit.z);
  }

  getPieceAt(file, rank) {
    return this.pieces.get(this.getSquareName(file, rank));
  }

  highlightLastMove(from, to) {
    if (from) this.highlightSquare(from.file, from.rank, 'lastMove');
    if (to) this.highlightSquare(to.file, to.rank, 'lastMove');
  }

  highlightCheck(kingSquare) {
    if (kingSquare) {
      this.highlightSquare(kingSquare.file, kingSquare.rank, 'check');
    }
  }

  showArrow(from, to, color = 0xe8a838, opacity = 0.85) {
    const fromPos = this.squareToCoords(from.file, from.rank);
    const toPos = this.squareToCoords(to.file, to.rank);
    const y = BOARD_TOP + 0.07;
    const start = new THREE.Vector3(fromPos.x, y, fromPos.z);
    const end = new THREE.Vector3(toPos.x, y, toPos.z);
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.05) return null;
    dir.normalize();

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });

    const group = new THREE.Group();
    const headLen = Math.min(0.5, len * 0.35);
    const shaftLen = len - headLen;
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, shaftLen, 12), material);
    shaft.position.copy(start).add(dir.clone().multiplyScalar(shaftLen / 2));
    shaft.quaternion.copy(quat);
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.19, headLen, 14), material);
    head.position.copy(start).add(dir.clone().multiplyScalar(shaftLen + headLen / 2));
    head.quaternion.copy(quat);
    group.add(head);

    this.scene.add(group);
    this.arrows.push({ group, material });
    return group;
  }

  clearArrows() {
    this.arrows.forEach(({ group, material }) => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child.isMesh) child.geometry.dispose();
      });
      material.dispose();
    });
    this.arrows = [];
  }

  toggleMarker(square) {
    const name = this.getSquareName(square.file, square.rank);
    const existing = this.markers.get(name);
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      existing.material.dispose();
      this.markers.delete(name);
      return;
    }
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      new THREE.MeshBasicMaterial({
        color: 0xe8a838,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(square.file - 3.5, BOARD_TOP + 0.003, square.rank - 3.5);
    this.scene.add(mesh);
    this.markers.set(name, mesh);
  }

  clearMarkers() {
    this.markers.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.markers.clear();
  }

  dispose() {
    this.clearHighlights();
    this.clearArrows();
    this.clearMarkers();
    this.pieces.forEach(mesh => this.scene.remove(mesh));
    this.pieces.clear();
    materialCache.forEach(m => m.dispose());
    materialCache.clear();
    templateCache.forEach(g => {
      g.traverse(child => {
        if (child.isMesh) child.geometry.dispose();
      });
    });
    templateCache.clear();
    glyphCache.forEach(m => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    glyphCache.clear();
    glyphPlaneGeometry.dispose();
    this.renderer.dispose();
  }
}

export function createScene(canvas) {
  return new ChessScene(canvas);
}
