import * as THREE from 'three';
import { CharacterForm, Lane } from '../types';
import { soundManager } from './audio';

export interface RagdollPart {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
}

export class CharacterController {
  public group: THREE.Group;
  public form: CharacterForm = 'zombie';

  // Position and movement
  public currentLane: Lane = 0;
  public targetX: number = 0;
  public y: number = 0;
  public vy: number = 0;
  public isGrounded: boolean = true;
  public isJumping: boolean = false;
  public isSliding: boolean = false;
  public slideTimer: number = 0;
  public slideDuration: number = 0.75; // seconds
  public isJetpack: boolean = false;

  // Stumble state (Subway Surfers side-clip / obstacle stumble)
  public isStumbling: boolean = false;
  public stumbleTimer: number = 0;

  // Knockout state (Subway Surfers train crash)
  public isKnockedOut: boolean = false;
  private dizzyStarsGroup!: THREE.Group;

  // Collision box
  public boundingBox: THREE.Box3 = new THREE.Box3();
  public collisionRadius: number = 0.55;

  // Visual sub-groups
  private zombieGroup: THREE.Group;
  private humanGroup: THREE.Group;
  private auraMesh: THREE.Mesh;
  private jetpackGroup: THREE.Group;
  private sneakersMeshL: THREE.Mesh | null = null;
  private sneakersMeshR: THREE.Mesh | null = null;

  // Zombie limbs for animation
  private zHead!: THREE.Mesh;
  private zTorso!: THREE.Mesh;
  private zLeftArm!: THREE.Group;
  private zRightArm!: THREE.Group;
  private zLeftLeg!: THREE.Group;
  private zRightLeg!: THREE.Group;

  // Human limbs for animation
  private hHead!: THREE.Group;
  private hTorso!: THREE.Mesh;
  private hLeftArm!: THREE.Group;
  private hRightArm!: THREE.Group;
  private hLeftLeg!: THREE.Group;
  private hRightLeg!: THREE.Group;

  // Animation cycle
  private animTimer: number = 0;
  private footstepTimer: number = 0;

  // Transformation FX
  private isTransforming: boolean = false;
  private transformProgress: number = 0;

  // Ragdoll on crash
  public isRagdoll: boolean = false;
  private ragdollParts: RagdollPart[] = [];

  // Lane constants
  public static readonly LANE_WIDTH: number = 3.2;

  constructor() {
    this.group = new THREE.Group();

    // 1. Build Zombie
    this.zombieGroup = new THREE.Group();
    this.buildZombieMesh();
    this.group.add(this.zombieGroup);

    // 2. Build Human
    this.humanGroup = new THREE.Group();
    this.buildHumanMesh();
    this.humanGroup.visible = false;
    this.group.add(this.humanGroup);

    // 3. Transformation Aura
    const auraGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    this.auraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.group.add(this.auraMesh);

    // 4. Jetpack mesh attached to back
    this.jetpackGroup = this.buildJetpack();
    this.jetpackGroup.visible = false;
    this.group.add(this.jetpackGroup);

    // 5. Cartoon Dizzy Stars for Train Crash Knockout
    this.dizzyStarsGroup = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4;
      const starGeo = new THREE.OctahedronGeometry(0.12, 0);
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.set(Math.cos(angle) * 0.45, 0, Math.sin(angle) * 0.45);
      this.dizzyStarsGroup.add(starMesh);
    }
    this.dizzyStarsGroup.position.set(0, 2.3, 0);
    this.dizzyStarsGroup.visible = false;
    this.group.add(this.dizzyStarsGroup);

    this.updateBoundingBox();
  }

  private buildZombieMesh() {
    // Decaying Zombie skin & ragged biker/runner clothes
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x47633e, // Textured zombie olive green
      roughness: 0.85,
      metalness: 0.1,
    });
    const decayPatchMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e27, // Dark necrotic moss patches
      roughness: 0.95,
    });
    const raggedMat = new THREE.MeshStandardMaterial({
      color: 0x1c211e, // Torn biker vest / dark leather rags
      roughness: 0.9,
    });
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xdad2bc, // Exposed bone / ribs / bandages
      roughness: 0.7,
    });
    const headbandMat = new THREE.MeshStandardMaterial({
      color: 0xd92525, // Torn red biker headband
      roughness: 0.6,
    });
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xb4ff14, // Intense glowing radioactive yellow-green eyes
    });
    const eyeSocketMat = new THREE.MeshBasicMaterial({
      color: 0x0a100a, // Deep hollow dark eye sockets
    });
    const teethMat = new THREE.MeshStandardMaterial({
      color: 0xeee3bf, // Dirty sharp teeth
      roughness: 0.5,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x151d14, // Spiky messy dark zombie hair
      roughness: 0.9,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x181a19, // Heavy combat boots with steel toe
      roughness: 0.7,
      metalness: 0.3,
    });

    // 1. Torso (hunched, with ripped vest and exposed ribs)
    const torsoGeo = new THREE.BoxGeometry(0.72, 0.92, 0.46);
    this.zTorso = new THREE.Mesh(torsoGeo, raggedMat);
    this.zTorso.position.y = 1.2;
    this.zTorso.rotation.x = 0.25; // Predatory hunched posture
    this.zTorso.castShadow = true;
    this.zombieGroup.add(this.zTorso);

    // Exposed ribcage on chest
    const ribGeo = new THREE.BoxGeometry(0.42, 0.07, 0.08);
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(ribGeo, boneMat);
      rib.position.set(0, 0.15 - r * 0.14, 0.22);
      this.zTorso.add(rib);
    }

    // Spine bumps along back
    const spineGeo = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    for (let s = 0; s < 4; s++) {
      const spine = new THREE.Mesh(spineGeo, boneMat);
      spine.position.set(0, 0.3 - s * 0.18, -0.25);
      this.zTorso.add(spine);
    }

    // Torn shoulder tassels
    const tasselGeo = new THREE.BoxGeometry(0.25, 0.08, 0.3);
    const tasselL = new THREE.Mesh(tasselGeo, decayPatchMat);
    tasselL.position.set(-0.38, 0.42, 0);
    const tasselR = new THREE.Mesh(tasselGeo, decayPatchMat);
    tasselR.position.set(0.38, 0.42, 0);
    this.zTorso.add(tasselL, tasselR);

    // 2. Head with detailed features
    const headGeo = new THREE.BoxGeometry(0.52, 0.56, 0.52);
    this.zHead = new THREE.Mesh(headGeo, skinMat);
    this.zHead.position.set(0, 0.68, 0.15);
    this.zHead.rotation.x = -0.1;
    this.zHead.castShadow = true;
    this.zTorso.add(this.zHead);

    // Torn Red Headband
    const bandGeo = new THREE.BoxGeometry(0.56, 0.14, 0.56);
    const band = new THREE.Mesh(bandGeo, headbandMat);
    band.position.set(0, 0.16, 0);
    // Headband tail knot
    const knotGeo = new THREE.BoxGeometry(0.12, 0.3, 0.08);
    const knot = new THREE.Mesh(knotGeo, headbandMat);
    knot.position.set(0.24, 0.05, -0.3);
    knot.rotation.z = -0.3;
    this.zHead.add(band, knot);

    // Spiky Messy Hair tufts on top
    for (let h = 0; h < 5; h++) {
      const hairGeo = new THREE.ConeGeometry(0.08, 0.22, 5);
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set((h - 2) * 0.1, 0.35, (Math.random() - 0.5) * 0.2);
      hair.rotation.z = (h - 2) * 0.15;
      this.zHead.add(hair);
    }

    // Sunken Eye Sockets
    const socketGeo = new THREE.BoxGeometry(0.16, 0.15, 0.08);
    const socketL = new THREE.Mesh(socketGeo, eyeSocketMat);
    socketL.position.set(-0.14, 0.04, 0.25);
    const socketR = new THREE.Mesh(socketGeo, eyeSocketMat);
    socketR.position.set(0.14, 0.04, 0.25);
    this.zHead.add(socketL, socketR);

    // Glowing Neon Lime-Yellow Eyes
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.14, 0.04, 0.28);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.14, 0.04, 0.28);
    this.zHead.add(eyeL, eyeR);

    // Snarling Jaws with Sharp Teeth
    const jawGeo = new THREE.BoxGeometry(0.38, 0.18, 0.3);
    const jaw = new THREE.Mesh(jawGeo, decayPatchMat);
    jaw.position.set(0, -0.22, 0.15);
    this.zHead.add(jaw);

    // Jagged Teeth
    const teethGeo = new THREE.BoxGeometry(0.3, 0.06, 0.06);
    const topTeeth = new THREE.Mesh(teethGeo, teethMat);
    topTeeth.position.set(0, -0.12, 0.26);
    const botTeeth = new THREE.Mesh(teethGeo, teethMat);
    botTeeth.position.set(0, -0.2, 0.28);
    this.zHead.add(topTeeth, botTeeth);

    // 3. Left Arm & Claw (Pivot at shoulder)
    this.zLeftArm = new THREE.Group();
    this.zLeftArm.position.set(-0.48, 0.36, 0.05);
    const armGeoL = new THREE.BoxGeometry(0.2, 0.72, 0.2);
    const armMeshL = new THREE.Mesh(armGeoL, skinMat);
    armMeshL.position.y = -0.34;
    armMeshL.castShadow = true;
    this.zLeftArm.add(armMeshL);
    // Forearm / Claw with black nails
    const clawGeo = new THREE.BoxGeometry(0.24, 0.24, 0.28);
    const clawL = new THREE.Mesh(clawGeo, skinMat);
    clawL.position.y = -0.74;
    clawL.castShadow = true;
    // Nails
    const nailGeo = new THREE.ConeGeometry(0.04, 0.14, 4);
    for (let n = -1; n <= 1; n++) {
      const nail = new THREE.Mesh(nailGeo, teethMat);
      nail.rotation.x = Math.PI / 2;
      nail.position.set(n * 0.08, -0.86, 0.12);
      this.zLeftArm.add(nail);
    }
    this.zLeftArm.add(clawL);
    this.zTorso.add(this.zLeftArm);

    // 4. Right Arm & Claw
    this.zRightArm = new THREE.Group();
    this.zRightArm.position.set(0.48, 0.36, 0.05);
    const armMeshR = new THREE.Mesh(armGeoL, skinMat);
    armMeshR.position.y = -0.34;
    armMeshR.castShadow = true;
    this.zRightArm.add(armMeshR);
    const clawR = new THREE.Mesh(clawGeo, skinMat);
    clawR.position.y = -0.74;
    clawR.castShadow = true;
    for (let n = -1; n <= 1; n++) {
      const nail = new THREE.Mesh(nailGeo, teethMat);
      nail.rotation.x = Math.PI / 2;
      nail.position.set(n * 0.08, -0.86, 0.12);
      this.zRightArm.add(nail);
    }
    this.zRightArm.add(clawR);
    this.zTorso.add(this.zRightArm);

    // 5. Left Leg (Torn knee revealing bone)
    this.zLeftLeg = new THREE.Group();
    this.zLeftLeg.position.set(-0.22, 0.8, 0);
    const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.24);
    const legMeshL = new THREE.Mesh(legGeo, raggedMat);
    legMeshL.position.y = -0.36;
    legMeshL.castShadow = true;

    // Exposed Knee bone
    const kneeBone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), boneMat);
    kneeBone.position.set(0, -0.36, 0.13);
    this.zLeftLeg.add(legMeshL, kneeBone);

    // Heavy combat boot Left
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.44), bootMat);
    bootL.position.set(0, -0.74, 0.08);
    bootL.castShadow = true;
    this.zLeftLeg.add(bootL);
    this.zombieGroup.add(this.zLeftLeg);

    // 6. Right Leg
    this.zRightLeg = new THREE.Group();
    this.zRightLeg.position.set(0.22, 0.8, 0);
    const legMeshR = new THREE.Mesh(legGeo, raggedMat);
    legMeshR.position.y = -0.36;
    legMeshR.castShadow = true;

    // Heavy combat boot Right
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.44), bootMat);
    bootR.position.set(0, -0.74, 0.08);
    bootR.castShadow = true;
    this.zRightLeg.add(legMeshR, bootR);
    this.zombieGroup.add(this.zRightLeg);
  }

  private buildHumanMesh() {
    // Stylized Subway Surfers Street Runner:
    // Cyan/Blue hoodie, backwards cap, wireless DJ headphones, cargo joggers, high-top sneakers, spray can
    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0x0099ff, // Subway Surfers Electric Cobalt
      roughness: 0.5,
      metalness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff6600, // Vibrant Street Orange
      roughness: 0.4,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe0a880, // Healthy runner skin
      roughness: 0.8,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e27, // Dark cargo jogger
      roughness: 0.7,
    });
    const sneakerMat = new THREE.MeshStandardMaterial({
      color: 0xfdfdfd, // Crisp white sneaker leather
      roughness: 0.3,
    });
    const sneakerSoleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, // Glowing cyan sneaker sole
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Classic Subway Surfers Red cap
      roughness: 0.5,
    });
    const headphoneMat = new THREE.MeshStandardMaterial({
      color: 0x111111, // Headphone body
      metalness: 0.8,
      roughness: 0.2,
    });
    const cushionMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff, // Cyan headphone cushions
    });
    const sprayCanMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00, // Graffiti spray can
      metalness: 0.7,
      roughness: 0.3,
    });

    // Torso (Athletic streetwear hoodie)
    const torsoGeo = new THREE.BoxGeometry(0.72, 0.92, 0.46);
    this.hTorso = new THREE.Mesh(torsoGeo, hoodieMat);
    this.hTorso.position.y = 1.25;
    this.hTorso.castShadow = true;
    this.humanGroup.add(this.hTorso);

    // Orange accent stripes on hoodie chest & back
    const stripeGeo = new THREE.BoxGeometry(0.74, 0.12, 0.48);
    const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
    stripeMesh.position.set(0, 0.2, 0);
    this.hTorso.add(stripeMesh);

    // Kangaroo front pocket
    const pocketGeo = new THREE.BoxGeometry(0.5, 0.28, 0.1);
    const pocket = new THREE.Mesh(pocketGeo, hoodieMat);
    pocket.position.set(0, -0.16, 0.23);
    this.hTorso.add(pocket);

    // Holstered Graffiti Spray Can on right hip
    const canGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10);
    const sprayCan = new THREE.Mesh(canGeo, sprayCanMat);
    sprayCan.position.set(0.42, -0.2, 0.12);
    sprayCan.rotation.z = -0.2;
    const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    canCap.position.y = 0.18;
    sprayCan.add(canCap);
    this.hTorso.add(sprayCan);

    // Head Group
    this.hHead = new THREE.Group();
    this.hHead.position.set(0, 0.7, 0);
    this.hTorso.add(this.hHead);

    const headGeo = new THREE.BoxGeometry(0.48, 0.5, 0.48);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.hHead.add(headMesh);

    // Backwards Red Cap
    const capGeo = new THREE.BoxGeometry(0.52, 0.22, 0.52);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.22, 0);
    const brimGeo = new THREE.BoxGeometry(0.46, 0.05, 0.35);
    const brim = new THREE.Mesh(brimGeo, capMat);
    brim.position.set(0, 0.13, -0.35); // Pointed backwards
    const logoPatch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    logoPatch.position.set(0, 0.22, 0.27);
    this.hHead.add(cap, brim, logoPatch);

    // Wireless DJ Headphones resting around neck
    const bandArc = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.56), headphoneMat);
    bandArc.position.set(0, -0.22, 0);
    const cushionL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), cushionMat);
    cushionL.rotation.z = Math.PI / 2;
    cushionL.position.set(-0.32, -0.22, 0.05);
    const cushionR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), cushionMat);
    cushionR.rotation.z = Math.PI / 2;
    cushionR.position.set(0.32, -0.22, 0.05);
    this.hHead.add(bandArc, cushionL, cushionR);

    // Left Arm (Hoodie sleeve + hand)
    this.hLeftArm = new THREE.Group();
    this.hLeftArm.position.set(-0.46, 0.35, 0);
    const sleeveGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
    const sleeveL = new THREE.Mesh(sleeveGeo, hoodieMat);
    sleeveL.position.y = -0.32;
    sleeveL.castShadow = true;
    const handGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.y = -0.7;
    this.hLeftArm.add(sleeveL, handL);
    this.hTorso.add(this.hLeftArm);

    // Right Arm
    this.hRightArm = new THREE.Group();
    this.hRightArm.position.set(0.46, 0.35, 0);
    const sleeveR = new THREE.Mesh(sleeveGeo, hoodieMat);
    sleeveR.position.y = -0.32;
    sleeveR.castShadow = true;
    const handR = new THREE.Mesh(handGeo, skinMat);
    handR.position.y = -0.7;
    this.hRightArm.add(sleeveR, handR);
    this.hTorso.add(this.hRightArm);

    // Left Leg
    this.hLeftLeg = new THREE.Group();
    this.hLeftLeg.position.set(-0.22, 0.8, 0);
    const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.y = -0.38;
    legL.castShadow = true;

    // High top sneaker Left
    const shoeGeo = new THREE.BoxGeometry(0.26, 0.22, 0.44);
    const shoeL = new THREE.Mesh(shoeGeo, sneakerMat);
    shoeL.position.set(0, -0.74, 0.08);
    shoeL.castShadow = true;
    // Orange accent swoosh
    const swooshL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.24), accentMat);
    swooshL.position.set(0, -0.72, 0.08);
    // Glowing cyan sole
    const soleGeo = new THREE.BoxGeometry(0.28, 0.06, 0.46);
    const soleL = new THREE.Mesh(soleGeo, sneakerSoleMat);
    soleL.position.set(0, -0.83, 0.08);
    this.sneakersMeshL = soleL;

    this.hLeftLeg.add(legL, shoeL, swooshL, soleL);
    this.humanGroup.add(this.hLeftLeg);

    // Right Leg
    this.hRightLeg = new THREE.Group();
    this.hRightLeg.position.set(0.22, 0.8, 0);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.y = -0.38;
    legR.castShadow = true;

    const shoeR = new THREE.Mesh(shoeGeo, sneakerMat);
    shoeR.position.set(0, -0.74, 0.08);
    shoeR.castShadow = true;
    const swooshR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.24), accentMat);
    swooshR.position.set(0, -0.72, 0.08);
    const soleR = new THREE.Mesh(soleGeo, sneakerSoleMat);
    soleR.position.set(0, -0.83, 0.08);
    this.sneakersMeshR = soleR;

    this.hRightLeg.add(legR, shoeR, swooshR, soleR);
    this.humanGroup.add(this.hRightLeg);
  }

  private buildJetpack(): THREE.Group {
    const jetpack = new THREE.Group();
    const tankGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.7, 12);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0xd62828,
      metalness: 0.8,
      roughness: 0.3,
    });
    const tank1 = new THREE.Mesh(tankGeo, tankMat);
    tank1.position.set(-0.2, 1.25, -0.35);
    const tank2 = new THREE.Mesh(tankGeo, tankMat);
    tank2.position.set(0.2, 1.25, -0.35);

    // Nozzles
    const nozzleGeo = new THREE.ConeGeometry(0.12, 0.22, 10);
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const nozzle1 = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle1.rotation.x = Math.PI;
    nozzle1.position.set(-0.2, 0.82, -0.35);
    const nozzle2 = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle2.rotation.x = Math.PI;
    nozzle2.position.set(0.2, 0.82, -0.35);

    jetpack.add(tank1, tank2, nozzle1, nozzle2);
    return jetpack;
  }

  // --- CONTROLLER ACTIONS ---

  public moveLeft(): boolean {
    if (this.isRagdoll) return false;
    if (this.currentLane > -1) {
      this.currentLane = (this.currentLane - 1) as Lane;
      // In Three.js with camera looking toward +Z, positive X is screen left
      this.targetX = -this.currentLane * CharacterController.LANE_WIDTH;
      soundManager.playLaneSwitch();
      return true;
    }
    return false;
  }

  public moveRight(): boolean {
    if (this.isRagdoll) return false;
    if (this.currentLane < 1) {
      this.currentLane = (this.currentLane + 1) as Lane;
      // In Three.js with camera looking toward +Z, negative X is screen right
      this.targetX = -this.currentLane * CharacterController.LANE_WIDTH;
      soundManager.playLaneSwitch();
      return true;
    }
    return false;
  }

  public jump(hasSneakers: boolean = false): boolean {
    if (this.isRagdoll || this.isJetpack) return false;
    if (this.isGrounded && !this.isSliding) {
      this.vy = hasSneakers ? 17.5 : 13.0; // Higher jump with super sneakers
      this.isGrounded = false;
      this.isJumping = true;
      soundManager.playJump();
      return true;
    }
    return false;
  }

  public slide(): boolean {
    if (this.isRagdoll || this.isJetpack) return false;
    // Can cancel jump immediately and fast-fall into slide
    if (this.isJumping) {
      this.vy = -18; // Quick slam down
    }
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      soundManager.playSlide();
      return true;
    }
    return false;
  }

  public triggerTransformation() {
    this.isTransforming = true;
    this.transformProgress = 0;
    this.form = 'human';
    this.humanGroup.visible = true;
    soundManager.setForm('human');
    soundManager.playTransformation();
  }

  public revertToZombie() {
    this.form = 'zombie';
    this.zombieGroup.visible = true;
    this.humanGroup.visible = false;
    soundManager.setForm('zombie');
  }

  public setJetpack(active: boolean) {
    this.isJetpack = active;
    this.jetpackGroup.visible = active;
    if (active) {
      this.isJumping = false;
      this.isSliding = false;
    }
  }

  public setSneakersActive(active: boolean) {
    const color = active ? 0xffea00 : 0x00f0ff;
    if (this.sneakersMeshL) (this.sneakersMeshL.material as THREE.MeshBasicMaterial).color.setHex(color);
    if (this.sneakersMeshR) (this.sneakersMeshR.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  public triggerStumble(bounceLaneX?: number) {
    if (this.isRagdoll || this.isStumbling) return;
    this.isStumbling = true;
    this.stumbleTimer = 0.55; // 0.55s stumble animation
    soundManager.playStumble();

    if (bounceLaneX !== undefined) {
      // Revert/bounce player back to the safe lane
      this.targetX = bounceLaneX;
      // Also sync currentLane
      const closestLane = Math.round(-bounceLaneX / CharacterController.LANE_WIDTH) as Lane;
      this.currentLane = Math.max(-1, Math.min(1, closestLane)) as Lane;
    }
  }

  public triggerCrash() {
    if (this.isRagdoll || this.isKnockedOut) return;
    this.isRagdoll = true;
    soundManager.playCrash();

    // Spawn ragdoll parts with random explosive velocities
    const activeGroup = this.form === 'zombie' ? this.zombieGroup : this.humanGroup;
    this.ragdollParts = [];

    activeGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);

        const part: RagdollPart = {
          mesh: child,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 8 + 4,
            (Math.random() - 0.5) * 8 + 6 // Forward crash momentum
          ),
          rotVelocity: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
          ),
        };
        this.ragdollParts.push(part);
      }
    });
  }

  public triggerTrainCrash() {
    if (this.isKnockedOut || this.isRagdoll) return;
    this.isKnockedOut = true;
    soundManager.playTrainCrash();

    // Comical Subway Surfers flat-on-back knockback
    this.group.rotation.x = -Math.PI / 2; // Flat on back
    this.group.position.y = 0.22; // Resting on tracks

    // Sprawl zombie limbs out
    this.zLeftArm.rotation.set(0, 0, -1.25);
    this.zRightArm.rotation.set(0, 0, 1.25);
    this.zLeftLeg.rotation.set(0, 0, -0.3);
    this.zRightLeg.rotation.set(0, 0, 0.3);

    // Sprawl human limbs out
    this.hLeftArm.rotation.set(0, 0, -1.25);
    this.hRightArm.rotation.set(0, 0, 1.25);
    this.hLeftLeg.rotation.set(0, 0, -0.3);
    this.hRightLeg.rotation.set(0, 0, 0.3);

    // Position cartoon dizzy stars right above player's head on the ground
    this.dizzyStarsGroup.position.set(0, 0.55, 1.8);
    this.dizzyStarsGroup.visible = true;
  }

  public reset() {
    this.currentLane = 0;
    this.targetX = 0;
    this.y = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.isStumbling = false;
    this.stumbleTimer = 0;
    this.isJetpack = false;
    this.isRagdoll = false;
    this.isKnockedOut = false;
    this.isTransforming = false;
    this.form = 'zombie';

    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);

    this.zombieGroup.visible = true;
    this.humanGroup.visible = false;
    this.jetpackGroup.visible = false;
    this.dizzyStarsGroup.visible = false;

    // Reset child rotations
    this.zTorso.position.set(0, 1.2, 0);
    this.zTorso.rotation.set(0.25, 0, 0);
    this.hTorso.position.set(0, 1.25, 0);
    this.hTorso.rotation.set(0, 0, 0);

    soundManager.setForm('zombie');
    this.updateBoundingBox();
  }

  // --- UPDATE FRAME ---

  public update(delta: number, runSpeed: number) {
    if (this.isKnockedOut) {
      this.animTimer += delta;
      this.dizzyStarsGroup.rotation.y += delta * 6.5;
      this.dizzyStarsGroup.position.y = 0.55 + Math.sin(this.animTimer * 5) * 0.08;
      return;
    }

    if (this.isRagdoll) {
      // Ragdoll crash physics
      for (const part of this.ragdollParts) {
        part.velocity.y -= 25 * delta;
        part.mesh.position.addScaledVector(part.velocity, delta);
        part.mesh.rotation.x += part.rotVelocity.x * delta;
        part.mesh.rotation.y += part.rotVelocity.y * delta;
        part.mesh.rotation.z += part.rotVelocity.z * delta;

        // Bounce on floor
        if (part.mesh.position.y < 0.2) {
          part.mesh.position.y = 0.2;
          part.velocity.y = -part.velocity.y * 0.4;
          part.velocity.x *= 0.7;
          part.velocity.z *= 0.7;
        }
      }
      return;
    }

    // 1. Horizontal Smooth Lane-Switch Lerp with Banking
    const dx = this.targetX - this.group.position.x;
    this.group.position.x += dx * Math.min(1, 16 * delta);

    // Lateral banking lean when dashing
    let bankAngle = -dx * 0.08;
    if (this.isStumbling) {
      this.stumbleTimer -= delta;
      if (this.stumbleTimer <= 0) {
        this.isStumbling = false;
      } else {
        // Dramatic stagger wobble
        bankAngle += Math.sin(this.stumbleTimer * 28) * 0.22;
        this.group.rotation.x = Math.sin(this.stumbleTimer * 20) * 0.15;
      }
    }
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, bankAngle, 0.2);

    // 2. Vertical Physics (Jump / Jetpack / Slide)
    if (this.isJetpack) {
      // Fly at elevated altitude
      this.y = THREE.MathUtils.lerp(this.y, 6.2, 6 * delta);
      this.group.position.y = this.y;
    } else {
      const gravity = 36;
      this.vy -= gravity * delta;
      this.y += this.vy * delta;

      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.isGrounded = true;
        this.isJumping = false;
      }
      this.group.position.y = this.y;
    }

    // 3. Slide Timer
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // 4. Running Animation Cycles
    const animFreq = (runSpeed / 12) * (this.form === 'human' ? 14 : 11);
    this.animTimer += delta * animFreq;

    // Footsteps sound sync
    this.footstepTimer += delta * animFreq;
    if (this.isGrounded && !this.isSliding && this.footstepTimer > Math.PI) {
      soundManager.playFootstep(this.form === 'zombie');
      this.footstepTimer = 0;
    }

    const sinAnim = Math.sin(this.animTimer);
    const cosAnim = Math.cos(this.animTimer);

    if (this.form === 'zombie') {
      if (this.isSliding) {
        // Crouch low slide
        this.zTorso.position.y = 0.5;
        this.zTorso.rotation.x = 1.2; // Slide flat
        this.zLeftLeg.rotation.x = -1.2;
        this.zRightLeg.rotation.x = -1.2;
        this.zLeftArm.rotation.x = 0;
        this.zRightArm.rotation.x = 0;
      } else if (this.isJumping) {
        // Air jump pose
        this.zTorso.position.y = 1.2;
        this.zTorso.rotation.x = 0.4;
        this.zLeftLeg.rotation.x = 0.8;
        this.zRightLeg.rotation.x = -0.5;
        this.zLeftArm.rotation.x = -1.5;
        this.zRightArm.rotation.x = -1.5;
      } else {
        // Predatory frantic zombie sprint
        this.zTorso.position.y = 1.2 + Math.abs(sinAnim) * 0.12;
        this.zTorso.rotation.x = 0.35 + sinAnim * 0.05;
        this.zTorso.rotation.y = sinAnim * 0.1;

        this.zLeftLeg.rotation.x = sinAnim * 0.9;
        this.zRightLeg.rotation.x = -sinAnim * 0.9;

        // Flailing aggressive arms
        this.zLeftArm.rotation.x = -0.8 + -sinAnim * 1.1;
        this.zRightArm.rotation.x = -0.8 + sinAnim * 1.1;
        this.zLeftArm.rotation.z = -0.3;
        this.zRightArm.rotation.z = 0.3;
      }
    } else {
      // Human Streetwear Runner
      if (this.isSliding) {
        // Smooth knee slide
        this.hTorso.position.y = 0.55;
        this.hTorso.rotation.x = 1.1;
        this.hLeftLeg.rotation.x = -1.3;
        this.hRightLeg.rotation.x = -1.1;
        this.hLeftArm.rotation.x = 0.4;
        this.hRightArm.rotation.x = 0.4;
      } else if (this.isJumping) {
        // High air jump athletic kick
        this.hTorso.position.y = 1.25;
        this.hTorso.rotation.x = 0.1;
        this.hLeftLeg.rotation.x = 0.9;
        this.hRightLeg.rotation.x = -0.6;
        this.hLeftArm.rotation.x = -1.2;
        this.hRightArm.rotation.x = 1.0;
      } else {
        // Athletic rhythmic sprint
        this.hTorso.position.y = 1.25 + Math.abs(cosAnim) * 0.08;
        this.hTorso.rotation.x = 0.15;
        this.hTorso.rotation.y = sinAnim * 0.08;

        this.hLeftLeg.rotation.x = sinAnim * 1.0;
        this.hRightLeg.rotation.x = -sinAnim * 1.0;

        this.hLeftArm.rotation.x = -sinAnim * 1.0;
        this.hRightArm.rotation.x = sinAnim * 1.0;
      }
    }

    // 5. Transformation Visual Shockwave & Mesh Blend
    if (this.isTransforming) {
      this.transformProgress += delta * 1.8;
      const auraMat = this.auraMesh.material as THREE.MeshBasicMaterial;

      if (this.transformProgress < 1.0) {
        // Expanding aura pulse
        const scale = 1.0 + this.transformProgress * 2.5;
        this.auraMesh.scale.set(scale, scale, scale);
        auraMat.opacity = Math.sin(this.transformProgress * Math.PI) * 0.85;

        // Blend zombie to human visibility
        if (this.transformProgress > 0.4) {
          this.zombieGroup.visible = false;
          this.humanGroup.visible = true;
        }
      } else {
        this.isTransforming = false;
        auraMat.opacity = 0;
        this.zombieGroup.visible = false;
        this.humanGroup.visible = true;
      }
    }

    this.updateBoundingBox();
  }

  private updateBoundingBox() {
    const x = this.group.position.x;
    const y = this.group.position.y;
    const z = this.group.position.z;

    const height = this.isSliding ? 0.9 : 1.9;
    const halfW = 0.45;
    const halfD = 0.45;

    this.boundingBox.min.set(x - halfW, y, z - halfD);
    this.boundingBox.max.set(x + halfW, y + height, z + halfD);
  }
}
