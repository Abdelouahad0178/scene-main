document.addEventListener('DOMContentLoaded', function () {
    init(); // Initialisation de la scène 3D après le chargement complet du DOM

    const applyTextureBtn = document.getElementById('applyTexture');
    const textureOptions = document.getElementById('textureOptions');
    const choosePaintBtn = document.getElementById('choosePaint');
    const chooseTileBtn = document.getElementById('chooseTile');
    const tileInput = document.getElementById('tileInput');
    const colorPicker = document.getElementById('colorPicker');
    const lightSlider = document.getElementById('lightSlider');
    const moveForwardBtn = document.getElementById('moveForward');
    const moveBackwardBtn = document.getElementById('moveBackward');

    // Afficher les options de texture lorsqu'on clique sur "Appliquer Texture"
    applyTextureBtn.addEventListener('click', () => {
        textureOptions.style.display = 'flex';
    });

    // Gestionnaire d'événement pour le bouton "Peinture"
    choosePaintBtn.addEventListener('click', () => {
        tileInput.style.display = 'none';
        colorPicker.style.display = 'inline-block';
        textureOptions.style.display = 'none'; // Cache les options après sélection
    });

    // Gestionnaire d'événement pour le bouton "Carrelage"
    chooseTileBtn.addEventListener('click', () => {
        colorPicker.style.display = 'none';
        tileInput.style.display = 'inline-block';
        textureOptions.style.display = 'none'; // Cache les options après sélection
    });

    // Appliquer la peinture aux murs
    colorPicker.addEventListener('input', () => {
        applyPaintToAllWalls(colorPicker.value);
    });

    // Importer une texture de carrelage et l'appliquer au sol
    tileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const texture = new THREE.TextureLoader().load(e.target.result, function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.center.set(0.5, 0.5); // Centre la rotation sur la texture

                    // Préservation de la netteté
                    texture.magFilter = THREE.LinearFilter;  // Améliore la clarté de l'image
                    texture.minFilter = THREE.LinearMipmapLinearFilter; // Utilise le mipmapping pour maintenir la qualité

                    // Ajustement de l'échelle pour maintenir les proportions correctes de la pièce
                    const aspectRatio = texture.image.width / texture.image.height;
                    let repeatX = 8;
                    let repeatY = 8;

                    if (aspectRatio > 1) {
                        repeatY = repeatX / aspectRatio;
                    } else {
                        repeatX = repeatY * aspectRatio;
                    }

                    texture.repeat.set(repeatX, repeatY); // Ajuste la répétition pour maintenir la forme originale
                    applyTileToFloor(texture);
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Slider pour ajuster l'intensité de la lumière
    lightSlider.addEventListener('input', (event) => {
        updateLightIntensity(event.target.value);
    });

    lightSlider.style.display = 'inline-block'; // Affiche le slider dès le chargement

    // Avancer et reculer la caméra
    moveForwardBtn.addEventListener('click', () => moveCamera('forward'));
    moveBackwardBtn.addEventListener('click', () => moveCamera('backward'));
});

let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let directionalLight;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    createWalls();
    createFloor();

    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Intensité par défaut à 1
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', onMouseClick, false); // Ajout de l'événement clic

    animate();
}

function createWalls() {
    const wallGeometry = new THREE.PlaneGeometry(5, 3);

    for (let i = 0; i < 3; i++) {
        let wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);

        walls[i].position.set(i === 0 ? 0 : i === 1 ? -2.5 : 2.5, 1.5, i === 0 ? -2.5 : 0);
        walls[i].rotation.y = i === 1 ? Math.PI / 2 : i === 2 ? -Math.PI / 2 : 0;
        walls[i].userData.type = `wall${i + 1}`;

        scene.add(walls[i]);
        objects.push(walls[i]);
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5, 50, 50); // Plus de segments pour un meilleur contrôle des UVs
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
        wireframe: false,
        map: null
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.type = 'floor';
    scene.add(floor);
    objects.push(floor);
}

function applyTileToFloor(texture) {
    // Créer une deuxième texture pour les joints avec une couleur proche du carrelage
    const jointColor = new THREE.Color(texture.image);
    jointColor.offsetHSL(0, 0, -0.1); // Ajuster légèrement pour un contraste subtil
    const jointMaterial = new THREE.MeshBasicMaterial({ color: jointColor });

    // Ajuste les UVs pour simuler un joint plus épais et coloré
    const uvs = floor.geometry.attributes.uv.array;
    for (let i = 0; i < uvs.length; i += 2) {
        // Créer un joint plus épais en ajustant davantage les UVs
        if (uvs[i] % 1 < 0.1 || uvs[i] % 1 > 0.9) {
            uvs[i] += 0.05; // Déplacement horizontal pour les joints
        }
        if (uvs[i + 1] % 1 < 0.1 || uvs[i + 1] % 1 > 0.9) {
            uvs[i + 1] += 0.05; // Déplacement vertical pour les joints
        }
    }

    floor.geometry.attributes.uv.needsUpdate = true;

    // Appliquer la texture et le matériau de joint
    floor.material = jointMaterial;
    floor.material.map = texture;
    floor.material.needsUpdate = true;
    console.log('Carrelage appliqué au sol avec joints simulés.');
}

function applyPaintToAllWalls(color) {
    walls.forEach(wall => {
        wall.material.color.set(color);
        wall.material.needsUpdate = true;
    });
    console.log('Peinture appliquée à tous les murs');
}

function updateLightIntensity(value) {
    directionalLight.intensity = parseFloat(value);
    console.log('Intensité de la lumière ajustée à', value);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseClick(event) {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    // Convertir les coordonnées de l'écran en coordonnées de la scène
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Changement de l'orientation du carrelage
        if (clickedObject === floor) {
            clickedObject.material.map.rotation += Math.PI / 2; // Tourne de 90 degrés
            clickedObject.material.needsUpdate = true;
        }

        // Changement de la couleur du mur
        if (walls.includes(clickedObject)) {
            const originalColor = clickedObject.material.color.getHex();
            const newColor = new THREE.Color(originalColor).offsetHSL(0.05, 0, 0); // Changement de couleur léger
            clickedObject.material.color.set(newColor);
            clickedObject.material.needsUpdate = true;
        }
    }
}

function moveCamera(direction) {
    const moveStep = 0.5; // Distance à déplacer à chaque clic
    if (direction === 'forward') {
        camera.position.z -= moveStep;
    } else if (direction === 'backward') {
        camera.position.z += moveStep;
    }
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
