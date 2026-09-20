import * as THREE from 'three';
import { soundManager } from './audio';

interface DoctorMember {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  animOffset: number;
}

export class ChaserSquad {
  public group: THREE.Group;
  public doctors: DoctorMember[] = [];
  public dogGroup: THREE.Group;

  // Chase distance relative to playerZ (negative is behind player)
  public relativeZ: number = -2.8; // Starts right behind player
  public targetRelativeZ: number = -2.8;
  public isClose: boolean = true;
  public alertTimer: number = 3.8; // Starts in alert at run beginning
  public isCatching: boolean = false;
  public catchProgress: number = 0;

  // Animation cycle
  private animTimer: number = 0;

  // Dog limbs
  private dogLegFL!: THREE.Group;
  private dogLegFR!: THREE.Group;
  private dogLegBL!: THREE.Group;
  private dogLegBR!: THREE.Group;
  private dogTail!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();

    // 1. Build Doctor 1 (Center - Chief Hazmat Doctor with Syringe Gun)
    const doc1 = this.buildDoctorMember({
      color: 0xfacc15, // Hazmat Yellow
      visorColor: 0x06b6d4, // Cyan visor
      position: new THREE.Vector3(0, 0, 0),
      animOffset: 0,
      weaponType: 'giant_syringe',
    });
    this.doctors.push(doc1);
    this.group.add(doc1.group);

    // 2. Build Doctor 2 (Left Flank - Containment Medic)
    const doc2 = this.buildDoctorMember({
      color: 0xe0f2fe, // Clean Sterilized White / Light Blue
      visorColor: 0x38bdf8,
      position: new THREE.Vector3(-1.15, 0, -0.35),
      animOffset: 1.1,
      weaponType: 'injector_pistol',
    });
    this.doctors.push(doc2);
    this.group.add(doc2.group);

    // 3. Build Doctor 3 (Right Flank - Bio-Security Specialist)
    const doc3 = this.buildDoctorMember({
      color: 0x84cc16, // Bright Biohazard Lime
      visorColor: 0x10b981,
      position: new THREE.Vector3(1.15, 0, -0.35),
      animOffset: 2.2,
      weaponType: 'syringe_blaster',
    });
    this.doctors.push(doc3);
    this.group.add(doc3.group);

    // 4. Build Cyber Medical Dog (Runs on right flank)
    this.dogGroup = new THREE.Group();
    this.buildCyberDog();
    this.dogGroup.position.set(0.65, 0, 0.4);
    this.group.add(this.dogGroup);

    this.reset();
  }

  private buildDoctorMember(config: {
    color: number;
    visorColor: number;
    position: THREE.Vector3;
    animOffset: number;
    weaponType: 'giant_syringe' | 'injector_pistol' | 'syringe_blaster';
  }): DoctorMember {
    const docGroup = new THREE.Group();
    docGroup.position.copy(config.position);

    const suitMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.4,
      metalness: 0.1,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.5,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: config.visorColor,
      emissive: config.visorColor,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.9,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.88, 0.4);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    docGroup.add(torso);

    // Hazard stripe on torso
    const stripeGeo = new THREE.BoxGeometry(0.72, 0.14, 0.42);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.15, 0);
    docGroup.add(stripe);

    // 2. Hazmat Helmet & Visor
    const helmetGeo = new THREE.SphereGeometry(0.31, 12, 12);
    const helmet = new THREE.Mesh(helmetGeo, suitMat);
    helmet.position.set(0, 1.84, 0);
    docGroup.add(helmet);

    const visorGeo = new THREE.BoxGeometry(0.36, 0.19, 0.22);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.84, 0.21);
    docGroup.add(visor);

    // Respirator filter canisters on cheeks
    const filterGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8);
    filterGeo.rotateZ(Math.PI / 2);
    const filterL = new THREE.Mesh(filterGeo, darkMat);
    filterL.position.set(-0.24, 1.75, 0.14);
    const filterR = new THREE.Mesh(filterGeo, darkMat);
    filterR.position.set(0.24, 1.75, 0.14);
    docGroup.add(filterL, filterR);

    // 3. Decontamination / Vaccine Backpack Tank
    const tankGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.72, 10);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(0, 1.25, -0.28);
    docGroup.add(tank);

    // 4. Arms
    // Left Arm (Pumping)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.44, 1.5, 0);
    const armGeo = new THREE.BoxGeometry(0.19, 0.65, 0.19);
    const lArmMesh = new THREE.Mesh(armGeo, suitMat);
    lArmMesh.position.y = -0.3;
    leftArm.add(lArmMesh);
    docGroup.add(leftArm);

    // Right Arm (Holding Weapon / Syringe)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.44, 1.5, 0);
    const rArmMesh = new THREE.Mesh(armGeo, suitMat);
    rArmMesh.position.y = -0.3;
    rightArm.add(rArmMesh);

    // Weapon
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.6, 0.25);

    const vaccineGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });

    if (config.weaponType === 'giant_syringe') {
      // Glass cylinder chamber
      const glassGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 10);
      glassGeo.rotateX(Math.PI / 2);
      const glassMesh = new THREE.Mesh(glassGeo, vaccineGlowMat);
      weaponGroup.add(glassMesh);

      // Steel needle tip
      const needleGeo = new THREE.ConeGeometry(0.03, 0.35, 8);
      needleGeo.rotateX(-Math.PI / 2);
      const needleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.set(0, 0, 0.45);
      weaponGroup.add(needle);

      // Gun grip
      const gripGeo = new THREE.BoxGeometry(0.12, 0.25, 0.12);
      const grip = new THREE.Mesh(gripGeo, darkMat);
      grip.position.set(0, -0.15, -0.15);
      weaponGroup.add(grip);
    } else if (config.weaponType === 'injector_pistol') {
      // Twin needle injector
      const bodyGeo = new THREE.BoxGeometry(0.16, 0.18, 0.38);
      const body = new THREE.Mesh(bodyGeo, darkMat);
      weaponGroup.add(body);

      const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
      tubeGeo.rotateX(Math.PI / 2);
      const tube = new THREE.Mesh(tubeGeo, vaccineGlowMat);
      tube.position.set(0, 0.1, 0);
      weaponGroup.add(tube);

      const needleGeo = new THREE.ConeGeometry(0.02, 0.28, 8);
      needleGeo.rotateX(-Math.PI / 2);
      const needleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.set(0, 0, 0.32);
      weaponGroup.add(needle);
    } else {
      // Vaccine Blaster Gun
      const barrelGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.45, 10);
      barrelGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(barrelGeo, darkMat);
      weaponGroup.add(barrel);

      const coreGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      coreGeo.rotateX(Math.PI / 2);
      const core = new THREE.Mesh(coreGeo, vaccineGlowMat);
      core.position.set(0, 0, 0.1);
      weaponGroup.add(core);

      const nozzleGeo = new THREE.ConeGeometry(0.05, 0.25, 8);
      nozzleGeo.rotateX(-Math.PI / 2);
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(0, 0, 0.35);
      weaponGroup.add(nozzle);
    }

    rightArm.add(weaponGroup);
    docGroup.add(rightArm);

    // 5. Running Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.74, 0.22);
    const bootGeo = new THREE.BoxGeometry(0.22, 0.24, 0.36);

    // Left Leg
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.2, 0.72, 0);
    const lLegMesh = new THREE.Mesh(legGeo, suitMat);
    lLegMesh.position.y = -0.32;
    const lBoot = new THREE.Mesh(bootGeo, darkMat);
    lBoot.position.set(0, -0.64, 0.05);
    leftLeg.add(lLegMesh, lBoot);
    docGroup.add(leftLeg);

    // Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.2, 0.72, 0);
    const rLegMesh = new THREE.Mesh(legGeo, suitMat);
    rLegMesh.position.y = -0.32;
    const rBoot = new THREE.Mesh(bootGeo, darkMat);
    rBoot.position.set(0, -0.64, 0.05);
    rightLeg.add(rLegMesh, rBoot);
    docGroup.add(rightLeg);

    return {
      group: docGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      animOffset: config.animOffset,
    };
  }

  private buildCyberDog() {
    const cyberMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563, // Armored dark slate
      metalness: 0.7,
      roughness: 0.3,
    });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Hazard yellow vest
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Glowing blue LED visor

    // Dog Body
    const bodyGeo = new THREE.BoxGeometry(0.38, 0.36, 0.75);
    const body = new THREE.Mesh(bodyGeo, cyberMat);
    body.position.y = 0.5;
    this.dogGroup.add(body);

    // Medical Vest on dog
    const vestGeo = new THREE.BoxGeometry(0.4, 0.38, 0.45);
    const vest = new THREE.Mesh(vestGeo, accentMat);
    vest.position.set(0, 0.52, 0);
    this.dogGroup.add(vest);

    // Dog Head
    const headGeo = new THREE.BoxGeometry(0.28, 0.28, 0.35);
    const head = new THREE.Mesh(headGeo, cyberMat);
    head.position.set(0, 0.75, 0.42);
    this.dogGroup.add(head);

    // Dog Visor Eyes
    const visorGeo = new THREE.BoxGeometry(0.26, 0.08, 0.08);
    const dogVisor = new THREE.Mesh(visorGeo, eyeMat);
    dogVisor.position.set(0, 0.8, 0.6);
    this.dogGroup.add(dogVisor);

    // Pointed robotic ears
    const earGeo = new THREE.ConeGeometry(0.06, 0.15, 6);
    const earL = new THREE.Mesh(earGeo, cyberMat);
    earL.position.set(-0.12, 0.95, 0.35);
    const earR = new THREE.Mesh(earGeo, cyberMat);
    earR.position.set(0.12, 0.95, 0.35);
    this.dogGroup.add(earL, earR);

    // Antenna Tail
    const tailGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);
    tailGeo.rotateX(Math.PI / 4);
    this.dogTail = new THREE.Mesh(tailGeo, accentMat);
    this.dogTail.position.set(0, 0.65, -0.45);
    this.dogGroup.add(this.dogTail);

    // 4 Running Legs
    const dogLegGeo = new THREE.BoxGeometry(0.1, 0.38, 0.1);

    // Front Left
    this.dogLegFL = new THREE.Group();
    this.dogLegFL.position.set(-0.16, 0.38, 0.25);
    const flMesh = new THREE.Mesh(dogLegGeo, cyberMat);
    flMesh.position.y = -0.18;
    this.dogLegFL.add(flMesh);
    this.dogGroup.add(this.dogLegFL);

    // Front Right
    this.dogLegFR = new THREE.Group();
    this.dogLegFR.position.set(0.16, 0.38, 0.25);
    const frMesh = new THREE.Mesh(dogLegGeo, cyberMat);
    frMesh.position.y = -0.18;
    this.dogLegFR.add(frMesh);
    this.dogGroup.add(this.dogLegFR);

    // Back Left
    this.dogLegBL = new THREE.Group();
    this.dogLegBL.position.set(-0.16, 0.38, -0.25);
    const blMesh = new THREE.Mesh(dogLegGeo, cyberMat);
    blMesh.position.y = -0.18;
    this.dogLegBL.add(blMesh);
    this.dogGroup.add(this.dogLegBL);

    // Back Right
    this.dogLegBR = new THREE.Group();
    this.dogLegBR.position.set(0.16, 0.38, -0.25);
    const brMesh = new THREE.Mesh(dogLegGeo, cyberMat);
    brMesh.position.y = -0.18;
    this.dogLegBR.add(brMesh);
    this.dogGroup.add(this.dogLegBR);
  }

  public reset() {
    this.relativeZ = -2.8;
    this.targetRelativeZ = -2.8;
    this.isClose = true;
    this.alertTimer = 3.8; // Initial chase proximity
    this.isCatching = false;
    this.catchProgress = 0;
    this.group.position.set(0, 0, -2.8);
    this.group.rotation.set(0, 0, 0);
  }

  public triggerStumbleSurge() {
    // When the player stumbles:
    this.targetRelativeZ = -2.1; // Surge forward right behind player's back!
    this.alertTimer = 5.0; // Stay close for 5 seconds
    this.isClose = true;
    soundManager.playChaserAlert();
  }

  public triggerCatch() {
    this.isCatching = true;
    this.catchProgress = 0;
    soundManager.playSyringeInject();
  }

  public update(delta: number, playerX: number, playerZ: number, playerY: number, speed: number) {
    this.animTimer += delta * (speed * 0.75 + 4);

    // 1. Alert timer & Distance management
    if (this.isCatching) {
      // Lunge forward into player to inject
      this.catchProgress = Math.min(1, this.catchProgress + delta * 3.5);
      this.relativeZ = THREE.MathUtils.lerp(this.relativeZ, -0.8, delta * 8);
    } else {
      if (this.alertTimer > 0) {
        this.alertTimer -= delta;
        this.targetRelativeZ = -2.2; // Right behind player
        this.isClose = true;
      } else {
        // Fall back gracefully into distance
        this.targetRelativeZ = -7.2;
        this.isClose = false;
      }

      // Smoothly interpolate relativeZ
      this.relativeZ = THREE.MathUtils.lerp(this.relativeZ, this.targetRelativeZ, delta * 3.2);
    }

    // 2. Smoothly follow player's X lane with slight chase delay
    const targetX = playerX * 0.85;
    this.group.position.x += (targetX - this.group.position.x) * 9 * delta;

    // Follow player's Z position + relativeZ
    this.group.position.z = playerZ + this.relativeZ;
    this.group.position.y = playerY > 4 ? 0 : playerY * 0.4;

    // 3. Animate All 3 Doctors Running
    for (let i = 0; i < this.doctors.length; i++) {
      const doc = this.doctors[i];
      const docAnim = this.animTimer + doc.animOffset;
      const runCycle = Math.sin(docAnim);
      const cosCycle = Math.cos(docAnim);

      // Legs
      doc.leftLeg.rotation.x = runCycle * 0.85;
      doc.rightLeg.rotation.x = -runCycle * 0.85;

      // Left Arm (pumping)
      doc.leftArm.rotation.x = -runCycle * 0.9;

      // Right Arm (aiming syringe/injector forward)
      if (this.isCatching) {
        doc.rightArm.rotation.x = -Math.PI / 2.8;
        doc.rightArm.position.z = 0.35 + Math.sin(docAnim * 2) * 0.1;
      } else if (this.isClose) {
        doc.rightArm.rotation.x = -Math.PI / 3.2 + cosCycle * 0.15;
        doc.rightArm.rotation.y = -0.15 * (i === 1 ? -1 : 1);
      } else {
        doc.rightArm.rotation.x = runCycle * 0.6;
        doc.rightArm.rotation.y = 0;
      }

      // Torso slight forward lean into sprint
      doc.group.rotation.x = 0.18 + Math.abs(runCycle) * 0.05;

      // In catch mode, flank doctors converge inward slightly
      if (this.isCatching) {
        if (i === 1) doc.group.rotation.y = 0.3; // Left doctor angles inward
        if (i === 2) doc.group.rotation.y = -0.3; // Right doctor angles inward
      } else {
        doc.group.rotation.y = 0;
      }
    }

    // 4. Animate Cyber Dog Running
    const dogCycle = Math.sin(this.animTimer * 1.1);
    this.dogLegFL.rotation.x = dogCycle * 1.1;
    this.dogLegBR.rotation.x = dogCycle * 1.1;
    this.dogLegFR.rotation.x = -dogCycle * 1.1;
    this.dogLegBL.rotation.x = -dogCycle * 1.1;

    // Tail wagging
    this.dogTail.rotation.z = Math.sin(this.animTimer * 2.5) * 0.4;
  }
}
