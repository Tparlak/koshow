/**
 * KO CORE 3D Engine - Minimalist Version
 * Optimized for Knight Online Item Visuals.
 */

var scene, camera, renderer, cameraControls;
var _lastMesh = null;
var _plugPoints = [];
var renderRequested = false;
var renderTimeout = null;

function initEngine() {
    scene = new THREE.Scene();

    // Near/Far planes optimized for small items
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 2000);
    camera.position.set(2, 2, 2);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const viewport = document.getElementById('viewport');
    viewport.appendChild(renderer.domElement);

    // Natural Lighting (Subtle/Clean)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5e1, 0.6); // Subtle gold tint
    keyLight.position.set(5, 10, 5);

    const fillLight = new THREE.PointLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);

    scene.add(ambientLight, hemiLight, keyLight, fillLight);

    // Enhanced Grid (More Visible)
    const grid = new THREE.GridHelper(10, 40, 0x555555, 0x333333);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    scene.add(grid);

    // Controls
    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.05;
    cameraControls.zoomSpeed = 0.8;
    cameraControls.rotateSpeed = 0.7;

    cameraControls.addEventListener('change', requestFrame);
    renderer.domElement.addEventListener('wheel', requestFrame, { passive: true });
    window.addEventListener('resize', onResize);

    requestFrame();
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    requestFrame();
}

function requestFrame() {
    if (renderTimeout) clearTimeout(renderTimeout);
    if (renderRequested) {
        renderTimeout = setTimeout(() => { renderRequested = false; }, 2000);
        return;
    }
    renderRequested = true;
    (function engineLoop() {
        if (!renderRequested) return;
        cameraControls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(engineLoop);
    })();
    renderTimeout = setTimeout(() => { renderRequested = false; }, 2000);
}

function flushGPU(obj) {
    if (!obj) return;
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }
}

/**
 * PUBLIC API
 */
window.addObject = function (vertices, faces) {
    if (_lastMesh) flushGPU(_lastMesh);
    _plugPoints.forEach(p => flushGPU(p));
    _plugPoints = [];

    const geometry = new THREE.Geometry();
    vertices.forEach(v => geometry.vertices.push(new THREE.Vector3(v.x, v.y, v.z)));

    for (let i = 0; i < faces.length; i += 3) {
        const v1 = faces[i], v2 = faces[i + 1], v3 = faces[i + 2];
        geometry.faces.push(new THREE.Face3(v1, v2, v3));
        geometry.faceVertexUvs[0].push([
            new THREE.Vector2(vertices[v1].u, vertices[v1].v),
            new THREE.Vector2(vertices[v2].u, vertices[v2].v),
            new THREE.Vector2(vertices[v3].u, vertices[v3].v)
        ]);
    }

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8
    });

    _lastMesh = new THREE.Mesh(geometry, material);
    scene.add(_lastMesh);

    const box = new THREE.Box3().setFromObject(_lastMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    cameraControls.target.copy(center);
    camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
    cameraControls.update();

    requestFrame();
};

window.addTexture = function (texture) {
    if (_lastMesh) {
        if (_lastMesh.material.map) _lastMesh.material.map.dispose();
        _lastMesh.material.map = texture;
        _lastMesh.material.alphaTest = 0.5;
        _lastMesh.material.transparent = true;
        _lastMesh.material.needsUpdate = true;
        requestFrame();
    }
};

/**
 * Visualizing Plug Points (Gold Flare Color)
 */
window.addPlugs = function (points) {
    _plugPoints.forEach(p => flushGPU(p));
    _plugPoints = [];

    const markerGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 }); // KO Gold color

    points.forEach(p => {
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(p.pos.x, p.pos.y, p.pos.z);
        scene.add(marker);
        _plugPoints.push(marker);
    });

    requestFrame();
};

window.clearEngine = function () {
    if (_lastMesh) { flushGPU(_lastMesh); _lastMesh = null; }
    _plugPoints.forEach(p => flushGPU(p));
    _plugPoints = [];
    requestFrame();
};

const clearBtn = document.getElementById('clear-stack');
if (clearBtn) {
    clearBtn.addEventListener('click', window.clearEngine);
}

initEngine();