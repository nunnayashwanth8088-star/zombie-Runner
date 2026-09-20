import * as THREE from 'three';
import { CollectibleType, ObstacleType } from '../types';

export interface ObstacleInstance {
  type: ObstacleType;
  group: THREE.Group;
  lane: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  canSlideUnder: boolean;
  canJumpOver: boolean;
  isTrain: boolean;
  trainSpeed: number; // For moving oncoming trains
  boundingBox: THREE.Box3;
}

export interface CollectibleInstance {
  type: CollectibleType;
  group: THREE.Group;
  lane: number;
  z: number;
  y: number;
  collected: boolean;
  boundingBox: THREE.Box3;
}

export interface TrackSegment {
  group: THREE.Group;
  z: number;
  obstacles: ObstacleInstance[];
  collectibles: CollectibleInstance[];
  hasTunnel: boolean;
}

export class TrackManager {
  public scene: THREE.Scene;
  public segments: TrackSegment[] = [];
  public segmentLength: number = 40;
  public visibleSegments: number = 10;
  public nextSpawnZ: number = 0;

  // Track theme: 0 (Infected Dark Wasteland) -> 1 (Vibrant Neon Cyberpunk Urban)
  public themeBlend: number = 0;

  // Shared Geometries & Materials for optimal performance (object pooling)
  private railGeo: THREE.BoxGeometry;
  private sleeperGeo: THREE.BoxGeometry;
  private groundGeo: THREE.PlaneGeometry;
  private railMat: THREE.MeshStandardMaterial;
  private sleeperMat: THREE.MeshStandardMaterial;
  private groundMatInfected: THREE.MeshStandardMaterial;
  private groundMatNeon: THREE.MeshStandardMaterial;
  private coinGeo: THREE.CylinderGeometry;
  private coinMat: THREE.MeshStandardMaterial;

  // Obstacle Materials
  private barricadeMat: THREE.MeshStandardMaterial;
  private trainBodyMat: THREE.MeshStandardMaterial;
  private trainWindowMat: THREE.MeshBasicMaterial;
  private trainLightMat: THREE.MeshBasicMaterial;
  private sludgeMat: THREE.MeshStandardMaterial;
  private laserMat: THREE.MeshBasicMaterial;

  // Powerup Geometries & Materials
  private antidoteMat: THREE.MeshStandardMaterial;
  private magnetMat: THREE.MeshStandardMaterial;
  private sneakerMat: THREE.MeshStandardMaterial;
  private jetpackMat: THREE.MeshStandardMaterial;
  private multMat: THREE.MeshStandardMaterial;

  // Lane positions
  public static readonly LANES = [-3.2, 0, 3.2];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Shared geometries
    this.railGeo = new THREE.BoxGeometry(0.12, 0.16, this.segmentLength);
    this.sleeperGeo = new THREE.BoxGeometry(2.4, 0.14, 0.4);
    this.groundGeo = new THREE.PlaneGeometry(24, this.segmentLength);
    this.coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16);

    // Shared materials
    this.railMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e0, // Shiny silver-steel rails
      metalness: 0.95,
      roughness: 0.18,
    });
    this.sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x423223, // Rich weathered wooden railway ties
      roughness: 0.9,
    });
    this.groundMatInfected = new THREE.MeshStandardMaterial({
      color: 0x22292f, // Railway stone ballast / dark gravel
      roughness: 0.95,
    });
    this.groundMatNeon = new THREE.MeshStandardMaterial({
      color: 0x181e28, // Clean urban subway ballast
      roughness: 0.85,
      metalness: 0.15,
    });
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0xffb700,
      emissiveIntensity: 0.45,
    });

    this.barricadeMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // Vibrant hazard crimson
      roughness: 0.4,
    });
    this.trainBodyMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c, // Iconic Subway Surfers Red train body
      metalness: 0.35,
      roughness: 0.3,
    });
    this.trainWindowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Warm passenger cabin interior glow
    this.trainLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sludgeMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    this.antidoteMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d0ff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    this.magnetMat = new THREE.MeshStandardMaterial({
      color: 0xff2a2a,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.sneakerMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffcc00,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    this.jetpackMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.multMat = new THREE.MeshStandardMaterial({
      color: 0xaa00ff,
      emissive: 0x8800ff,
      emissiveIntensity: 0.8,
    });

    this.initTrack();
  }

  public initTrack() {
    // Clear any existing segments
    for (const seg of this.segments) {
      this.scene.remove(seg.group);
    }
    this.segments = [];
    this.nextSpawnZ = -10;

    // Spawn initial calm runway (first 2 segments obstacle-free)
    for (let i = 0; i < this.visibleSegments; i++) {
      this.spawnSegment(i < 2);
    }
  }

  public setThemeBlend(blend: number) {
    this.themeBlend = Math.max(0, Math.min(1, blend));
  }

  public spawnSegment(isSafeStart: boolean = false) {
    const segGroup = new THREE.Group();
    segGroup.position.z = this.nextSpawnZ + this.segmentLength / 2;

    // 1. Ground & Ballast
    const ground = new THREE.Mesh(
      this.groundGeo,
      this.themeBlend > 0.5 ? this.groundMatNeon : this.groundMatInfected
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    segGroup.add(ground);

    // 2. Rails & Sleepers across 3 lanes
    for (const laneX of TrackManager.LANES) {
      // Left and right steel rails
      const railL = new THREE.Mesh(this.railGeo, this.railMat);
      railL.position.set(laneX - 0.75, 0.08, 0);
      railL.receiveShadow = true;
      const railR = new THREE.Mesh(this.railGeo, this.railMat);
      railR.position.set(laneX + 0.75, 0.08, 0);
      railR.receiveShadow = true;
      segGroup.add(railL, railR);

      // Sleepers (ties) every 2.5 meters
      for (let zOffset = -this.segmentLength / 2 + 1; zOffset < this.segmentLength / 2; zOffset += 2.5) {
        const sleeper = new THREE.Mesh(this.sleeperGeo, this.sleeperMat);
        sleeper.position.set(laneX, 0.04, zOffset);
        sleeper.receiveShadow = true;
        segGroup.add(sleeper);
      }
    }

    // 3. Side Walls / Infrastructure & Neon Billboards
    this.buildSegmentEnvironment(segGroup);

    // Tunnel chance (rare, exciting visual contrast)
    const hasTunnel = !isSafeStart && Math.random() < 0.25;
    if (hasTunnel) {
      this.buildTunnel(segGroup);
    }

    // 4. Populate Obstacles & Collectibles
    const obstacles: ObstacleInstance[] = [];
    const collectibles: CollectibleInstance[] = [];

    if (!isSafeStart) {
      this.populateObstaclesAndCollectibles(segGroup, obstacles, collectibles);
    }

    this.scene.add(segGroup);

    this.segments.push({
      group: segGroup,
      z: segGroup.position.z,
      obstacles,
      collectibles,
      hasTunnel,
    });

    this.nextSpawnZ += this.segmentLength;
  }

  private buildSegmentEnvironment(segGroup: THREE.Group) {
    const isNeon = this.themeBlend > 0.5;

    // 1. Side barrier walls with clean subway masonry
    const wallMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0x1e2235 : 0x2d3436,
      roughness: 0.85,
    });

    const wallL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.0, this.segmentLength), wallMat);
    wallL.position.set(-8.5, 2.5, 0);
    const wallR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.0, this.segmentLength), wallMat);
    wallR.position.set(8.5, 2.5, 0);
    segGroup.add(wallL, wallR);

    // 2. Overhead Catenary Gantries (Iconic Subway Surfers railway overhead wires & steel trusses)
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      metalness: 0.8,
      roughness: 0.3,
    });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x9ca3af });

    for (const gz of [-10, 10]) {
      // Left and right support columns
      const colL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.8, 0.3), steelMat);
      colL.position.set(-6.8, 2.9, gz);
      const colR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.8, 0.3), steelMat);
      colR.position.set(6.8, 2.9, gz);

      // Overhead crossbeam truss
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.35, 0.35), steelMat);
      crossBeam.position.set(0, 5.7, gz);

      // Catenary overhead wires running along tracks
      for (const lx of TrackManager.LANES) {
        const dropWire = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), steelMat);
        dropWire.position.set(lx, 5.3, gz);
        segGroup.add(dropWire);
      }

      segGroup.add(colL, colR, crossBeam);
    }

    // Overhead power line span
    for (const lx of TrackManager.LANES) {
      const lineWire = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, this.segmentLength), wireMat);
      lineWire.position.set(lx, 5.0, 0);
      segGroup.add(lineWire);
    }

    // 3. Trackside Railway Signal (tall pole with 3 lights: Red/Yellow/Green)
    if (Math.random() < 0.6) {
      const signalPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), steelMat);
      const signalSide = Math.random() > 0.5 ? 6.2 : -6.2;
      signalPole.position.set(signalSide, 1.8, (Math.random() - 0.5) * 12);

      const signalBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.9, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      signalBox.position.set(0, 1.2, 0);
      signalPole.add(signalBox);

      // Light lens
      const lensGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const greenLens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0x10b981 }));
      greenLens.position.set(0, 1.45, -0.1);
      const redLens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      redLens.position.set(0, 0.95, -0.1);
      signalPole.add(greenLens, redLens);

      segGroup.add(signalPole);
    }

    // 4. Glowing billboard signs & graffiti posters on side walls
    if (Math.random() < 0.7) {
      const signColor = isNeon
        ? (Math.random() > 0.5 ? 0x06b6d4 : 0xec4899)
        : (Math.random() > 0.5 ? 0xf59e0b : 0x10b981);

      const signGeo = new THREE.BoxGeometry(0.18, 2.2, 6.0);
      const signMat = new THREE.MeshStandardMaterial({
        color: signColor,
        emissive: signColor,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      });

      const signSide = Math.random() > 0.5 ? 1 : -1;
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(signSide * 7.8, 3.2, (Math.random() - 0.5) * 15);
      segGroup.add(sign);
    }
  }

  private buildTunnel(segGroup: THREE.Group) {
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      roughness: 0.85,
    });

    // Arch ceiling
    const ceilingGeo = new THREE.BoxGeometry(16, 1.2, this.segmentLength);
    const ceiling = new THREE.Mesh(ceilingGeo, tunnelMat);
    ceiling.position.set(0, 6.2, 0);
    segGroup.add(ceiling);

    // Tunnel overhead lights
    for (let z = -this.segmentLength / 2 + 5; z < this.segmentLength / 2; z += 10) {
      const lightGeo = new THREE.BoxGeometry(1.5, 0.15, 0.4);
      const lightMat = new THREE.MeshBasicMaterial({
        color: this.themeBlend > 0.5 ? 0x00f0ff : 0xffaa22,
      });
      const lightFixture = new THREE.Mesh(lightGeo, lightMat);
      lightFixture.position.set(0, 5.5, z);
      segGroup.add(lightFixture);
    }
  }

  private populateObstaclesAndCollectibles(
    segGroup: THREE.Group,
    obstacles: ObstacleInstance[],
    collectibles: CollectibleInstance[]
  ) {
    // Generate 1-2 obstacle clusters per 40m segment
    const spawnZOffsets = [-10, 10];

    for (const zOffset of spawnZOffsets) {
      const patternType = Math.random();

      // Pick lanes to block (leave at least 1 lane open!)
      const blockedLanes: number[] = [];
      const numBlocked = Math.random() < 0.65 ? 1 : 2;

      const laneOptions = [0, 1, 2];
      // Shuffle lane options
      laneOptions.sort(() => Math.random() - 0.5);

      for (let i = 0; i < numBlocked; i++) {
        blockedLanes.push(laneOptions[i]);
      }

      for (const laneIdx of blockedLanes) {
        const laneX = TrackManager.LANES[laneIdx];
        const rand = Math.random();

        if (rand < 0.35) {
          // 1. Moving Subway Train
          const train = this.createTrain(laneX, zOffset);
          segGroup.add(train.group);
          obstacles.push(train);
        } else if (rand < 0.6) {
          // 2. Low Barricade (jump over)
          const bar = this.createLowBarricade(laneX, zOffset);
          segGroup.add(bar.group);
          obstacles.push(bar);
        } else if (rand < 0.8) {
          // 3. High Barrier (slide under)
          const highBar = this.createHighBarrier(laneX, zOffset);
          segGroup.add(highBar.group);
          obstacles.push(highBar);
        } else if (rand < 0.92) {
          // 4. Toxic Infected Sludge (jump over)
          const sludge = this.createSludge(laneX, zOffset);
          segGroup.add(sludge.group);
          obstacles.push(sludge);
        } else {
          // 5. Laser Gate (slide under)
          const laser = this.createLaserGate(laneX, zOffset);
          segGroup.add(laser.group);
          obstacles.push(laser);
        }
      }

      // Collectibles in non-blocked lane or jump arcs above low barriers
      const freeLaneIdx = laneOptions.find((l) => !blockedLanes.includes(l)) ?? 1;
      const freeLaneX = TrackManager.LANES[freeLaneIdx];

      // Spawn powerup chance
      if (Math.random() < 0.28) {
        const pTypes = [
          CollectibleType.ANTIDOTE,
          CollectibleType.JETPACK,
          CollectibleType.SNEAKERS,
          CollectibleType.MAGNET,
          CollectibleType.MULTIPLIER,
        ];
        // Antidote is prioritized if user is in infected zone
        const pType = Math.random() < 0.4 ? CollectibleType.ANTIDOTE : pTypes[Math.floor(Math.random() * pTypes.length)];
        const powerup = this.createPowerup(pType, freeLaneX, zOffset + 5);
        segGroup.add(powerup.group);
        collectibles.push(powerup);
      } else {
        // Spawn line of coins
        for (let cz = zOffset - 4; cz <= zOffset + 4; cz += 2) {
          const coin = this.createCoin(freeLaneX, cz, 0.9);
          segGroup.add(coin.group);
          collectibles.push(coin);
        }
      }
    }
  }

  // --- OBSTACLE FACTORIES ---

  private createTrain(laneX: number, zOffset: number): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 0, zOffset);

    // Pick train color theme: iconic Subway Surfers Crimson Red or Cobalt Blue
    const isRed = Math.random() > 0.45;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isRed ? 0xbe123c : 0x1d4ed8, // Vibrant Subway Red or Deep Subway Blue
      metalness: 0.35,
      roughness: 0.25,
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Cream yellow racing stripe

    // Train Car Body
    const bodyW = 2.4;
    const bodyH = 3.5;
    const bodyD = 14.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), bodyMat);
    body.position.y = bodyH / 2 + 0.2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Horizontal Yellow Racing Stripe on sides
    const sideStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, bodyD), stripeMat);
    sideStripeL.position.set(-bodyW / 2 - 0.02, 1.8, 0);
    const sideStripeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, bodyD), stripeMat);
    sideStripeR.position.set(bodyW / 2 + 0.02, 1.8, 0);
    group.add(sideStripeL, sideStripeR);

    // Side Passenger Windows with warm interior light
    for (let wz = -4.5; wz <= 4.5; wz += 2.2) {
      const winGeo = new THREE.BoxGeometry(0.08, 0.75, 1.2);
      const winL = new THREE.Mesh(winGeo, this.trainWindowMat);
      winL.position.set(-bodyW / 2 - 0.03, 2.5, wz);
      const winR = new THREE.Mesh(winGeo, this.trainWindowMat);
      winR.position.set(bodyW / 2 + 0.03, 2.5, wz);
      group.add(winL, winR);
    }

    // Corrugated Roof with AC Units (Iconic Subway Surfers train roof)
    const roofGeo = new THREE.BoxGeometry(bodyW - 0.2, 0.18, bodyD - 0.4);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 }));
    roof.position.set(0, bodyH + 0.25, 0);
    group.add(roof);

    // AC Unit Boxes on roof
    for (const acZ of [-3.5, 3.5]) {
      const acGeo = new THREE.BoxGeometry(1.4, 0.35, 2.2);
      const acUnit = new THREE.Mesh(acGeo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
      acUnit.position.set(0, bodyH + 0.45, acZ);
      group.add(acUnit);
    }

    // Front Sloped Nose / Driver Cab
    const noseGeo = new THREE.BoxGeometry(bodyW - 0.08, bodyH * 0.72, 1.3);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, bodyH * 0.46, -bodyD / 2 - 0.55);
    group.add(nose);

    // Front Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.12), this.trainWindowMat);
    windshield.position.set(0, 2.65, -bodyD / 2 - 1.2);
    group.add(windshield);

    // Dual High-Intensity Projector Headlights
    const lightGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 12);
    lightGeo.rotateX(Math.PI / 2);
    const headL = new THREE.Mesh(lightGeo, this.trainLightMat);
    headL.position.set(-0.8, 1.3, -bodyD / 2 - 1.22);
    const headR = new THREE.Mesh(lightGeo, this.trainLightMat);
    headR.position.set(0.8, 1.3, -bodyD / 2 - 1.22);
    group.add(headL, headR);

    // Heavy Cowcatcher Bumper with hazard stripes
    const bumperGeo = new THREE.BoxGeometry(bodyW + 0.1, 0.45, 0.3);
    const hazardStripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Bright caution yellow
    const bumper = new THREE.Mesh(bumperGeo, hazardStripeMat);
    bumper.position.set(0, 0.45, -bodyD / 2 - 1.15);
    group.add(bumper);

    // Coupler knuckle at front
    const couplerGeo = new THREE.BoxGeometry(0.35, 0.3, 0.5);
    const coupler = new THREE.Mesh(couplerGeo, new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 }));
    coupler.position.set(0, 0.45, -bodyD / 2 - 1.45);
    group.add(coupler);

    // Rear climbable boarding ladder (Subway Surfers signature detail)
    const ladderGeo = new THREE.BoxGeometry(0.8, 2.2, 0.1);
    const ladder = new THREE.Mesh(ladderGeo, new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    ladder.position.set(0, 1.8, bodyD / 2 + 0.08);
    group.add(ladder);

    // Bogie Wheel Trucks
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 2.45, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const wheel1 = new THREE.Mesh(wheelGeo, wheelMat);
    wheel1.position.set(0, 0.38, -4.5);
    const wheel2 = new THREE.Mesh(wheelGeo, wheelMat);
    wheel2.position.set(0, 0.38, 4.5);
    group.add(wheel1, wheel2);

    return {
      type: ObstacleType.TRAIN,
      group,
      lane: laneX,
      z: zOffset,
      width: bodyW,
      height: bodyH,
      depth: bodyD + 2.0,
      canSlideUnder: false,
      canJumpOver: false,
      isTrain: true,
      trainSpeed: 10 + Math.random() * 8,
      boundingBox: new THREE.Box3(),
    };
  }

  private createLowBarricade(laneX: number, zOffset: number): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 0, zOffset);

    // Subway Surfers Style Road Hurdle (jump over)
    const postGeo = new THREE.BoxGeometry(0.18, 1.05, 0.18);
    const postL = new THREE.Mesh(postGeo, this.barricadeMat);
    postL.position.set(-1.1, 0.52, 0);
    const postR = new THREE.Mesh(postGeo, this.barricadeMat);
    postR.position.set(1.1, 0.52, 0);

    const crossbarGeo = new THREE.BoxGeometry(2.3, 0.38, 0.12);
    const crossbar = new THREE.Mesh(crossbarGeo, this.barricadeMat);
    crossbar.position.set(0, 0.8, 0);

    // Reflective white diagonal hazard striping
    const stripeGeo = new THREE.BoxGeometry(2.32, 0.12, 0.14);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.8, 0);

    // Flashing Yellow Warning Strobe on top
    const strobeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const strobe = new THREE.Mesh(strobeGeo, strobeMat);
    strobe.position.set(0, 1.08, 0);

    group.add(postL, postR, crossbar, stripe, strobe);

    return {
      type: ObstacleType.BARRICADE_LOW,
      group,
      lane: laneX,
      z: zOffset,
      width: 2.3,
      height: 1.05,
      depth: 0.6,
      canSlideUnder: false,
      canJumpOver: true,
      isTrain: false,
      trainSpeed: 0,
      boundingBox: new THREE.Box3(),
    };
  }

  private createHighBarrier(laneX: number, zOffset: number): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 0, zOffset);

    // Overhead girder / sign board with clearance under (slide under)
    const postGeo = new THREE.BoxGeometry(0.18, 3.2, 0.18);
    const postL = new THREE.Mesh(postGeo, this.barricadeMat);
    postL.position.set(-1.1, 1.6, 0);
    const postR = new THREE.Mesh(postGeo, this.barricadeMat);
    postR.position.set(1.1, 1.6, 0);

    const topGeo = new THREE.BoxGeometry(2.4, 1.6, 0.3);
    const topSign = new THREE.Mesh(topGeo, this.barricadeMat);
    topSign.position.set(0, 2.2, 0); // Clearance from Y=0 to Y=1.4

    // Hazard yellow chevron warning banner
    const bannerGeo = new THREE.BoxGeometry(2.2, 0.6, 0.32);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 2.0, 0);

    group.add(postL, postR, topSign, banner);

    return {
      type: ObstacleType.BARRIER_HIGH,
      group,
      lane: laneX,
      z: zOffset,
      width: 2.3,
      height: 3.2,
      depth: 0.6,
      canSlideUnder: true,
      canJumpOver: false,
      isTrain: false,
      trainSpeed: 0,
      boundingBox: new THREE.Box3(),
    };
  }

  private createSludge(laneX: number, zOffset: number): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 0, zOffset);

    // Radioactive boiling puddle on the tracks
    const puddleGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.12, 16);
    const puddle = new THREE.Mesh(puddleGeo, this.sludgeMat);
    puddle.position.y = 0.06;
    group.add(puddle);

    // Hazard cone
    const coneGeo = new THREE.ConeGeometry(0.25, 0.8, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5500 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 0.4, 0);
    group.add(cone);

    return {
      type: ObstacleType.INFECTED_SLUDGE,
      group,
      lane: laneX,
      z: zOffset,
      width: 2.2,
      height: 0.8,
      depth: 2.2,
      canSlideUnder: false,
      canJumpOver: true,
      isTrain: false,
      trainSpeed: 0,
      boundingBox: new THREE.Box3(),
    };
  }

  private createLaserGate(laneX: number, zOffset: number): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 0, zOffset);

    // High tech laser emitters
    const postGeo = new THREE.BoxGeometry(0.2, 3.0, 0.2);
    const postL = new THREE.Mesh(postGeo, this.trainBodyMat);
    postL.position.set(-1.1, 1.5, 0);
    const postR = new THREE.Mesh(postGeo, this.trainBodyMat);
    postR.position.set(1.1, 1.5, 0);

    // Glowing laser beam at eye level (must slide under)
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, this.laserMat);
    beam.position.set(0, 1.85, 0);

    group.add(postL, postR, beam);

    return {
      type: ObstacleType.LASER_GATE,
      group,
      lane: laneX,
      z: zOffset,
      width: 2.2,
      height: 3.0,
      depth: 0.4,
      canSlideUnder: true,
      canJumpOver: false,
      isTrain: false,
      trainSpeed: 0,
      boundingBox: new THREE.Box3(),
    };
  }

  // --- COLLECTIBLE FACTORIES ---

  public createCoin(laneX: number, zOffset: number, y: number = 0.9): CollectibleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, y, zOffset);

    const coin = new THREE.Mesh(this.coinGeo, this.coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    group.add(coin);

    return {
      type: CollectibleType.COIN,
      group,
      lane: laneX,
      z: zOffset,
      y,
      collected: false,
      boundingBox: new THREE.Box3(),
    };
  }

  public createPowerup(type: CollectibleType, laneX: number, zOffset: number): CollectibleInstance {
    const group = new THREE.Group();
    group.position.set(laneX, 1.3, zOffset);

    let mat: THREE.Material = this.antidoteMat;

    if (type === CollectibleType.ANTIDOTE) {
      // 3D Glowing Syringe Vial with Antidote
      const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 12);
      const barrel = new THREE.Mesh(barrelGeo, this.antidoteMat);
      const plungerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
      const plunger = new THREE.Mesh(plungerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
      plunger.position.y = 0.45;
      const needleGeo = new THREE.ConeGeometry(0.04, 0.3, 8);
      const needle = new THREE.Mesh(needleGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
      needle.position.y = -0.45;
      needle.rotation.x = Math.PI;

      // Glow halo ring
      const ringGeo = new THREE.TorusGeometry(0.35, 0.04, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;

      group.add(barrel, plunger, needle, ring);
    } else if (type === CollectibleType.MAGNET) {
      // Horseshoe Magnet
      const magnetGeo = new THREE.TorusGeometry(0.4, 0.14, 8, 16, Math.PI);
      const magnet = new THREE.Mesh(magnetGeo, this.magnetMat);
      magnet.rotation.z = Math.PI;
      group.add(magnet);
    } else if (type === CollectibleType.SNEAKERS) {
      // Winged Sneakers Icon
      const shoeGeo = new THREE.BoxGeometry(0.35, 0.25, 0.6);
      const shoe = new THREE.Mesh(shoeGeo, this.sneakerMat);
      const wingGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
      wingGeo.rotateZ(Math.PI / 3);
      const wingL = new THREE.Mesh(wingGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      wingL.position.set(-0.25, 0.1, 0);
      group.add(shoe, wingL);
    } else if (type === CollectibleType.JETPACK) {
      // Rocket Icon
      const bodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10);
      const body = new THREE.Mesh(bodyGeo, this.jetpackMat);
      const tipGeo = new THREE.ConeGeometry(0.2, 0.3, 10);
      const tip = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
      tip.position.y = 0.45;
      group.add(body, tip);
    } else {
      // Multiplier 2X Icon
      mat = this.multMat;
      const multGeo = new THREE.OctahedronGeometry(0.45, 0);
      const mult = new THREE.Mesh(multGeo, mat);
      group.add(mult);
    }

    return {
      type,
      group,
      lane: laneX,
      z: zOffset,
      y: 1.3,
      collected: false,
      boundingBox: new THREE.Box3(),
    };
  }

  // --- UPDATE FRAME ---

  public update(playerZ: number, delta: number, hasMagnet: boolean, playerPos: THREE.Vector3) {
    // 1. Recycle segments passed behind player
    const recycleThreshold = playerZ - 30;

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      if (seg.z + this.segmentLength / 2 < recycleThreshold) {
        this.scene.remove(seg.group);
        this.segments.splice(i, 1);
        // Spawn fresh segment ahead
        this.spawnSegment(false);
      }
    }

    // 2. Animate and update bounding boxes
    const coinSpin = delta * 3.5;

    for (const seg of this.segments) {
      // Moving trains
      for (const obs of seg.obstacles) {
        if (obs.isTrain) {
          // Oncoming train moves toward player (decreasing local Z)
          obs.group.position.z -= obs.trainSpeed * delta;
        }

        // Update world bounding box
        const worldPos = new THREE.Vector3();
        obs.group.getWorldPosition(worldPos);

        if (obs.canSlideUnder) {
          // Slide-under obstacle (e.g. overhead girder from 1.3m to 3.2m)
          obs.boundingBox.min.set(worldPos.x - obs.width / 2, worldPos.y + 1.25, worldPos.z - obs.depth / 2);
          obs.boundingBox.max.set(worldPos.x + obs.width / 2, worldPos.y + obs.height, worldPos.z + obs.depth / 2);
        } else {
          // Low barricade, train, sludge
          obs.boundingBox.min.set(worldPos.x - obs.width / 2, worldPos.y, worldPos.z - obs.depth / 2);
          obs.boundingBox.max.set(worldPos.x + obs.width / 2, worldPos.y + obs.height, worldPos.z + obs.depth / 2);
        }
      }

      // Collectibles
      for (const col of seg.collectibles) {
        if (col.collected) continue;

        col.group.rotation.y += coinSpin;

        // Magnet attraction across all lanes
        if (hasMagnet && col.type === CollectibleType.COIN) {
          const worldPos = new THREE.Vector3();
          col.group.getWorldPosition(worldPos);
          const distToPlayer = worldPos.distanceTo(playerPos);

          if (distToPlayer < 24) {
            // Smoothly fly towards player
            col.group.position.x += (playerPos.x - worldPos.x) * 14 * delta;
            col.group.position.y += (playerPos.y + 1.0 - worldPos.y) * 14 * delta;
            col.group.position.z += (playerPos.z - worldPos.z) * 14 * delta;
          }
        }

        const worldPos = new THREE.Vector3();
        col.group.getWorldPosition(worldPos);
        const halfSize = col.type === CollectibleType.COIN ? 0.45 : 0.65;
        col.boundingBox.min.set(worldPos.x - halfSize, worldPos.y - halfSize, worldPos.z - halfSize);
        col.boundingBox.max.set(worldPos.x + halfSize, worldPos.y + halfSize, worldPos.z + halfSize);
      }
    }
  }
}
