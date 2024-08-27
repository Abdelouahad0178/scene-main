let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let selectedObject = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let loadedTextures = {};
let gltfLoader = new THREE.GLTFLoader();
let objLoader = new THREE.OBJLoader();
let fbxLoader = new THREE.FBXLoader();
let sinkModel = null;
let mirrorModel = null;
let directionalLight;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', function(event) {
        controls.enabled = !event.value;
    });

    createWalls();
    createFloor();

    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    window.addEventListener('keydown', function(event) {
        if (event.key === 'Delete' && selectedObject) {
            removeObject();
        }
    });

    renderer.domElement.addEventListener('click', onMouseClick, false);
    renderer.domElement.addEventListener('dblclick', onMouseDoubleClick, false);
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createWalls() {
    const wallGeometry = new THREE.PlaneGeometry(5, 3);
    
    for (let i = 0;  i < 2; i++) {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);
        
        if (i === 0) {
            walls[i].position.set(0, 1.5, -2.5);
        } else {
            walls[i].position.set(-2.5, 1.5, 0);
            walls[i].rotation.y = Math.PI / 2;
        }

        walls[i].userData.type = 'wall';  // Définir le type comme 'wall'
        walls[i].userData.locked = true;  // Verrouiller le mur

        scene.add(walls[i]);
        objects.push(walls[i]); // Ajouter les murs à la liste des objets
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;

    floor.userData.type = 'floor';  // Définir le type comme 'floor'
    floor.userData.locked = true;   // Verrouiller le sol

    scene.add(floor);
    objects.push(floor); // Ajouter le sol à la liste des objets
}

function handleTextureFiles(event) {
    const files = event.target.files;
    const reader = new FileReader();

    reader.onload = function(e) {
        const texture = new THREE.TextureLoader().load(e.target.result, function(tex) {
            loadedTextures['userTexture'] = tex;
            console.log('Texture chargée avec succès');
        }, undefined, function(error) {
            console.error('Erreur lors du chargement de la texture :', error);
        });
    };

    for (let i = 0; i < files.length; i++) {
        reader.readAsDataURL(files[i]);
    }
}

function handleModelFile(event) {
    const file = event.target.files[0];
    const type = event.target.dataset.type; // 'sink' ou 'mirror'
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            const extension = file.name.split('.').pop().toLowerCase();
            
            if (extension === 'gltf' || extension === 'glb') {
                gltfLoader.parse(arrayBuffer, '', function(gltf) {
                    handleModelLoad(gltf.scene, type);
                });
            } else if (extension === 'obj') {
                const text = new TextDecoder().decode(arrayBuffer);
                const objModel = objLoader.parse(text);
                handleModelLoad(objModel, type);
            } else if (extension === 'fbx') {
                fbxLoader.parse(arrayBuffer, function(fbx) {
                    handleModelLoad(fbx, type);
                });
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function setUserDataRecursive(object, type) {
    object.userData.type = type;
    object.children.forEach(child => setUserDataRecursive(child, type));
}

function handleModelLoad(model, type) {
    const group = new THREE.Group();  // Crée un groupe pour contenir tout le modèle
    group.add(model);  // Ajoute le modèle au groupe
    
    setUserDataRecursive(group, type);  // Applique le type à tous les sous-objets dans le groupe
    centerModel(group);  // Centre le groupe plutôt que le modèle seul

    if (type === 'sink') {
        sinkModel = group;  // Assigne le groupe à sinkModel
    } else if (type === 'mirror') {
        mirrorModel = group;  // Assigne le groupe à mirrorModel
    }

    objects.push(group);  // Ajoute le groupe à la liste des objets manipulables
    console.log(`Modèle ${type} chargé avec succès`, group);
}

function centerModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.25 / maxDim;
    model.scale.multiplyScalar(scale);

    model.position.sub(center.multiplyScalar(scale));
    model.position.y = size.y * scale / 2;
    model.position.z = -2.4;
}

function applyTextureToObject(object, texture) {
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(object === floor ? 3 : 2, object === floor ? 3 : 2);

        object.material.map = texture;
        object.material.needsUpdate = true;
    } else {
        console.error('La texture est indéfinie. Assurez-vous qu\'elle est correctement chargée.');
    }
}

function addObject(type) {
    let newObject;
    if (type === 'sink' && sinkModel) {
        newObject = sinkModel.clone();
    } else if (type === 'mirror' && mirrorModel) {
        newObject = mirrorModel.clone();
    } else {
        console.error(`Modèle ${type} non chargé. Veuillez d'abord importer un modèle.`);
        return;
    }
    
    scene.add(newObject);
    objects.push(newObject);
    selectObject(newObject);
    renderer.render(scene, camera); // Force le rendu pour mettre à jour l'affichage
}

function selectObject(object) {
    // Si l'objet est verrouillé, ne rien faire
    if (object.userData.locked) {
        console.log('L\'objet est verrouillé et ne peut pas être sélectionné:', object);
        return;
    }

    // Rechercher le groupe parent au lieu d'une sous-partie individuelle
    while (object.parent && object.parent.type !== 'Scene') {
        object = object.parent;
    }

    if (selectedObject === object) {
        console.log('L\'objet est déjà sélectionné:', object);
        return;
    }
    
    if (selectedObject) {
        transformControls.detach(selectedObject);
    }
    selectedObject = object;
    transformControls.attach(object);
    console.log('Objet sélectionné:', object, 'Type:', object.userData.type);
}

function removeObject() {
    if (selectedObject) {
        scene.remove(selectedObject);
        objects = objects.filter(obj => obj !== selectedObject);
        transformControls.detach();
        selectedObject = null;
        console.log('Objet supprimé');
    }
}

function toggleObjectLock(object) {
    if (object.userData.locked) {
        console.log('L\'objet est verrouillé et ne peut pas être manipulé:', object);
        return;
    }

    console.log('Toggling lock for object:', object);
    if (object.userData.locked) {
        object.userData.locked = false;
        transformControls.attach(object);
        console.log('Objet déverrouillé');
    } else {
        object.userData.locked = true;
        transformControls.detach();
        console.log('Objet verrouillé');
    }
}

function onMouseClick(event) {
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (!intersectedObject.userData.locked) {
            selectObject(intersectedObject);
        } else {
            console.log('Tentative de sélection d\'un objet verrouillé:', intersectedObject);
        }
    }
}

function onMouseDoubleClick(event) {
    console.log('Double clic détecté');
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    console.log('Intersections:', intersects);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;

        // Rechercher le parent avec userData.type (groupe parent)
        while (clickedObject && !clickedObject.userData.type) {
            clickedObject = clickedObject.parent;
        }

        if (clickedObject && (clickedObject.userData.type === 'sink' || clickedObject.userData.type === 'mirror')) {
            toggleObjectLock(clickedObject);
        } else {
            console.log('L\'objet double-cliqué n\'est ni un lavabo ni un miroir');
        }
    } else {
        console.log('Aucun objet intersecté');
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function checkModelLoaded(type) {
    if ((type === 'sink' && !sinkModel) || (type === 'mirror' && !mirrorModel)) {
        alert(`Veuillez d'abord charger un modèle ${type} 3D.`);
        return false;
    }
    return true;
}

function printScene() {
    renderer.render(scene, camera);
    const imgData = renderer.domElement.toDataURL('image/png');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let isBlank = true;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
                isBlank = false;
                break;
            }
        }

        if (isBlank) {
            console.error("L'image capturée est entièrement blanche. Vérifiez le rendu de la scène.");
            alert("Erreur : L'image capturée est vide. Impossible d'imprimer.");
            return;
        }

        const date = new Date().toLocaleString();
        const printWindow = window.open('', 'Print', 'height=600,width=800');

        printWindow.document.write(`
            <html>
            <head>
                <title>Impression de la Scène 3D</title>
                <style>
                    @media print {
                        @page {
                            size: auto;
                            margin: 0mm;
                        }
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                    }
                    .container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        max-width: 100%;
                        padding: 20px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        margin-bottom: 20px;
                    }
                    .info {
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="${imgData}" alt="Scène 3D"/>
                    <div class="info">
                        <p>Date d'impression : ${date}</p>
                        <p>Dimensions de la pièce : 5m x 5m x 3m</p>
                        <p>Objets dans la scène : ${objects.length}</p>
                    </div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        printWindow.onload = function() {
            printWindow.print();
            printWindow.close();
        };
    };
    img.src = imgData;
}

function updateLightIntensity(value) {
    directionalLight.intensity = parseFloat(value);
}

// Event Listeners
document.getElementById('textureInput').addEventListener('change', handleTextureFiles, false);
document.getElementById('sinkModelInput').addEventListener('change', handleModelFile, false);
document.getElementById('mirrorModelInput').addEventListener('change', handleModelFile, false);
document.getElementById('changeWall1').addEventListener('click', () => {
    applyTextureToObject(walls[0], loadedTextures['userTexture']);
});
document.getElementById('changeWall2').addEventListener('click', () => {
    applyTextureToObject(walls[1], loadedTextures['userTexture']);
});
document.getElementById('changeFloor').addEventListener('click', () => {
    applyTextureToObject(floor, loadedTextures['userTexture']);
});
document.getElementById('addSink').addEventListener('click', () => {
    if (checkModelLoaded('sink')) addObject('sink');
});
document.getElementById('addMirror').addEventListener('click', () => {
    if (checkModelLoaded('mirror')) addObject('mirror');
});
document.getElementById('removeObject').addEventListener('click', removeObject);
document.getElementById('printScene').addEventListener('click', printScene);
document.getElementById('lightSlider').addEventListener('input', function(event) {
    updateLightIntensity(event.target.value);
});

// Initialisation
init();
