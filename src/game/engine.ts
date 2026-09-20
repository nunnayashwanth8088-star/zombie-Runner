import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { CollectibleType, GameState, PlayerStats, PowerUpState } from '../types';
import { soundManager } from './audio';
import { CharacterController } from './character';
import { TrackManager } from './trackManager';
import { ChaserSquad } from './chaser';

export interface EngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onPowerUpsUpdate: (powerups: Record<string, PowerUpState>) => void;
  onStateChange: (state: GameState) => void;
  onVictory: () => void;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public character: CharacterController;
  public trackManager: TrackManager;
  public chaserSquad: ChaserSquad;

  // Lights & Fog
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private playerPointLight: THREE.PointLight;
  private fog: THREE.Fog;

  // Particle systems
  private particleGroup: THREE.Group;
  private particles: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  // Game Loop State
  public state: GameState = 'idle';
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  // Gameplay Progression
  public playerZ: number = 0;
  public baseSpeed: number = 11.5; // Starts slow & smooth (approx 41 km/h)
  public currentSpeed: number = 11.5;
  public maxSpeed: number = 42; // Accelerates up to 151 km/h
  public distance: number = 0;
  public score: number = 0;
  public coins: number = 0;
  public cureMeter: number = 20; // starts at 20%
  public highScore: number = 0;
  public readonly TARGET_DISTANCE: number = 150000; // 150,000 meters ultimate goal
  public prestigeMode: boolean = false;

  // Active Power-ups
  public powerUps: {
    jetpack: PowerUpState;
    sneakers: PowerUpState;
    magnet: PowerUpState;
    multiplier: PowerUpState;
  } = {
    jetpack: { active: false, timeLeft: 0, duration: 10 },
    sneakers: { active: false, timeLeft: 0, duration: 12 },
    magnet: { active: false, timeLeft: 0, duration: 14 },
    multiplier: { active: false, timeLeft: 0, duration: 15 },
  };

  // Camera dynamics
  private cameraOffset = new THREE.Vector3(0, 3.8, -6.8);
  private cameraShakeIntensity: number = 0;

  // Crash cinematic state (Subway Surfers knockout & capture sequence)
  public isCrashing: boolean = false;
  private crashTimer: number = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Retrieve high score from local storage
    const savedHighScore = localStorage.getItem('subway_runner_high_score');
    if (savedHighScore) {
      this.highScore = parseInt(savedHighScore, 10) || 0;
    }

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x272c3d, 35, 145);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x272c3d);

    // 2. Camera setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 300);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting: Golden Sunlight & Vibrant Sky Ambient (Subway Surfers signature vibrancy)
    this.ambientLight = new THREE.AmbientLight(0x64748b, 1.35);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    this.dirLight.position.set(25, 45, -25);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.scene.add(this.dirLight);

    this.playerPointLight = new THREE.PointLight(0x22c55e, 2, 14);
    this.playerPointLight.position.set(0, 2, 0);
    this.scene.add(this.playerPointLight);

    // 5. Track Manager & Character
    this.trackManager = new TrackManager(this.scene);
    this.character = new CharacterController();
    this.scene.add(this.character.group);

    // 5b. Chaser Squad: Hazmat Doctor with Vaccine Syringe & Cyber Dog
    this.chaserSquad = new ChaserSquad();
    this.scene.add(this.chaserSquad.group);

    // 6. Particle system container
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    // Initial camera position
    this.camera.position.set(0, 3.8, -6.8);
    this.camera.lookAt(0, 1.6, 6);

    // Resize listener
    window.addEventListener('resize', this.handleResize);

    // Initial render
    this.render();
  }

  public handleResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // --- GAMEPLAY LIFECYCLE ---

  public startGame() {
    soundManager.startMusic();
    this.resetStats();
    this.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public pauseGame() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.callbacks.onStateChange('paused');
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
  }

  public resumeGame() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.callbacks.onStateChange('playing');
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  public restartGame() {
    this.resetStats();
    this.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public continuePrestigeRun() {
    this.prestigeMode = true;
    this.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private resetStats() {
    this.playerZ = 0;
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.currentSpeed = this.baseSpeed;
    this.cureMeter = 25; // 25% starting infection resistance
    this.cameraShakeIntensity = 0;
    this.isCrashing = false;
    this.crashTimer = 0;

    // Reset power-ups
    for (const key of Object.keys(this.powerUps) as (keyof typeof this.powerUps)[]) {
      this.powerUps[key].active = false;
      this.powerUps[key].timeLeft = 0;
    }

    // Reset systems
    this.character.reset();
    this.chaserSquad.reset();
    this.trackManager.initTrack();

    // Reset particles
    for (const p of this.particles) {
      this.particleGroup.remove(p.mesh);
    }
    this.particles = [];

    this.notifyStats();
  }

  // --- CONTROLS ---

  public onSwipeLeft() {
    if (this.state !== 'playing' || this.isCrashing) return;
    this.character.moveLeft();
  }

  public onSwipeRight() {
    if (this.state !== 'playing' || this.isCrashing) return;
    this.character.moveRight();
  }

  public onSwipeUp() {
    if (this.state !== 'playing' || this.isCrashing) return;
    this.character.jump(this.powerUps.sneakers.active);
  }

  public onSwipeDown() {
    if (this.state !== 'playing' || this.isCrashing) return;
    this.character.slide();
  }

  // --- MAIN LOOP ---

  private loop = (now: number) => {
    if (this.state !== 'playing' && !this.isCrashing) return;

    const delta = Math.min((now - this.lastTime) / 1000, 0.05); // cap delta at 50ms
    this.lastTime = now;

    this.update(delta);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(delta: number) {
    // 0. Crash Cinematic Phase (Authentic Subway Surfers Knockout & Squad Surround)
    if (this.isCrashing) {
      this.crashTimer -= delta;

      // Quick deceleration of track speed to 0
      this.currentSpeed = Math.max(0, this.currentSpeed - 55 * delta);

      // Character & chaser animations
      this.character.update(delta, this.currentSpeed);
      this.chaserSquad.update(
        delta,
        this.character.group.position.x,
        this.playerZ,
        this.character.group.position.y,
        this.currentSpeed
      );

      // Update camera and particles
      this.updateCamera(delta);
      this.updateParticles(delta);

      if (this.crashTimer <= 0) {
        this.isCrashing = false;
        this.state = 'game_over';
        this.callbacks.onStateChange('game_over');
      }
      return;
    }

    // 1. Advance Track Speed and Distance
    // Smooth speed progression: Starts slow and gently accelerates with distance
    const speedMult = this.powerUps.multiplier.active ? 1.12 : 1.0;
    const speedCurve = Math.pow(Math.max(0, this.distance) / 500, 0.6) * 3.8;
    const targetSpeed = Math.min(this.maxSpeed, this.baseSpeed + speedCurve);
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, 0.035);

    const stepDistance = this.currentSpeed * speedMult * delta;
    this.playerZ += stepDistance;
    this.distance += stepDistance;

    const pointsAdded = Math.round(stepDistance * (this.powerUps.multiplier.active ? 2 : 1) * 3);
    this.score += pointsAdded;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('subway_runner_high_score', this.highScore.toString());
    }

    // Check Victory 150,000m
    if (this.distance >= this.TARGET_DISTANCE && !this.prestigeMode && this.state === 'playing') {
      this.handleVictory();
      return;
    }

    // 2. Power-Up Timers
    for (const key of Object.keys(this.powerUps) as (keyof typeof this.powerUps)[]) {
      const pu = this.powerUps[key];
      if (pu.active) {
        pu.timeLeft -= delta;
        if (pu.timeLeft <= 0) {
          pu.active = false;
          pu.timeLeft = 0;
          if (key === 'jetpack') {
            this.character.setJetpack(false);
          } else if (key === 'sneakers') {
            this.character.setSneakersActive(false);
          }
        }
      }
    }

    // 3. Cure Meter & Transformation Logic
    if (this.character.form === 'human') {
      // In human form, cure meter slowly ticks down (over ~40s) unless sustained with antidotes
      this.cureMeter -= delta * 2.5;
      if (this.cureMeter <= 0) {
        this.cureMeter = 0;
        this.character.revertToZombie();
      }
    } else {
      // If cure meter reaches 100% via antidotes, transform into Human form!
      if (this.cureMeter >= 100) {
        this.cureMeter = 100;
        this.character.triggerTransformation();
        this.spawnTransformationBurst(this.character.group.position);
      }
    }

    // Dynamic environment theme interpolation
    const targetTheme = this.character.form === 'human' ? 1.0 : 0.0;
    this.trackManager.setThemeBlend(THREE.MathUtils.lerp(this.trackManager.themeBlend, targetTheme, delta * 2.0));
    this.updateAtmosphere(this.trackManager.themeBlend);

    // 4. Update Character
    this.character.group.position.z = this.playerZ;
    this.character.update(delta, this.currentSpeed);

    // 4b. Update Chaser Squad (Hazmat Doctor with Vaccine Syringe & Cyber Hound)
    this.chaserSquad.update(
      delta,
      this.character.group.position.x,
      this.playerZ,
      this.character.group.position.y,
      this.currentSpeed
    );

    // 5. Update Track and Obstacles
    this.trackManager.update(
      this.playerZ,
      delta,
      this.powerUps.magnet.active,
      this.character.group.position
    );

    // 6. Check Collisions & Collectibles
    this.checkCollisions();

    // 7. Jetpack Particle Thrusters
    if (this.powerUps.jetpack.active) {
      this.spawnJetpackParticles(this.character.group.position);
    }

    // 8. Update Particles
    this.updateParticles(delta);

    // 9. Update Camera Follow & Dynamics
    this.updateCamera(delta);

    // 10. Notify React UI
    this.notifyStats();
  }

  private updateAtmosphere(blend: number) {
    // Fog color: twilight deep blue-gray (0x272c3d) -> vibrant sunny azure sky (0x38bdf8)
    const fogInfected = new THREE.Color(0x272c3d);
    const fogNeon = new THREE.Color(0x38bdf8);
    this.fog.color.lerpColors(fogInfected, fogNeon, blend);
    this.scene.background = this.fog.color;

    // Ambient light: cool slate -> radiant sky blue
    const ambInfected = new THREE.Color(0x64748b);
    const ambNeon = new THREE.Color(0x93c5fd);
    this.ambientLight.color.lerpColors(ambInfected, ambNeon, blend);

    // Directional light: warm sunset gold -> crisp bright sunlight
    const dirInfected = new THREE.Color(0xffedd5);
    const dirNeon = new THREE.Color(0xffffff);
    this.dirLight.color.lerpColors(dirInfected, dirNeon, blend);

    // Player point light
    const pointInfected = new THREE.Color(0x22c55e);
    const pointNeon = new THREE.Color(0x06b6d4);
    this.playerPointLight.color.lerpColors(pointInfected, pointNeon, blend);
    this.playerPointLight.position.set(
      this.character.group.position.x,
      this.character.group.position.y + 1.8,
      this.playerZ + 1
    );
  }

  private checkCollisions() {
    const charBox = this.character.boundingBox;
    const pZ = this.playerZ;

    for (const seg of this.trackManager.segments) {
      // Check only nearby segments
      if (Math.abs(seg.z - pZ) > 35) continue;

      // 1. Collectibles
      for (const col of seg.collectibles) {
        if (col.collected) continue;

        if (charBox.intersectsBox(col.boundingBox)) {
          col.collected = true;
          seg.group.remove(col.group);
          this.handleCollectible(col.type, col.group.position);
        }
      }

      // 2. Obstacles (if jetpack active at Y=6.2, fly over all obstacles)
      if (this.powerUps.jetpack.active) continue;

      for (const obs of seg.obstacles) {
        // If obstacle is completely behind player, skip
        if (obs.boundingBox.max.z < pZ - 2) continue;
        // If obstacle is far ahead, skip
        if (obs.boundingBox.min.z > pZ + 25) continue;

        if (charBox.intersectsBox(obs.boundingBox)) {
          // Check slide clearance
          if (obs.canSlideUnder && this.character.isSliding) {
            // Safely sliding under!
            continue;
          }
          // Check jump clearance
          if (obs.canJumpOver && this.character.group.position.y > obs.height * 0.85) {
            // Safely jumped over!
            continue;
          }

          // A. Train Collision Handling (Direct Instant Out upon hitting train)
          if (obs.isTrain) {
            this.handleCrash(true);
            return;
          }

          // B. Other Obstacles (Barricade, Laser Gate, Sludge)
          // If Doctor is already right behind, any stumble or bump leads to capture
          if (this.chaserSquad.isClose && this.chaserSquad.relativeZ > -3.5) {
            this.chaserSquad.triggerCatch();
            this.handleCrash(false);
            return;
          }

          // Check if glancing side-clip
          const distToCenter = Math.abs(this.character.group.position.x - obs.lane);
          if (distToCenter > 0.85) {
            const bounceLaneX = this.character.group.position.x < obs.lane
              ? Math.max(-3.2, obs.lane - 3.2)
              : Math.min(3.2, obs.lane + 3.2);

            this.character.triggerStumble(bounceLaneX);
            this.chaserSquad.triggerStumbleSurge();
            this.cameraShakeIntensity = 0.8;
            return;
          }

          // Direct obstacle crash!
          this.handleCrash(false);
          return;
        }
      }
    }
  }

  private handleCollectible(type: CollectibleType, pos: THREE.Vector3) {
    if (type === CollectibleType.COIN) {
      this.coins += 1;
      this.score += 50 * (this.powerUps.multiplier.active ? 2 : 1);
      soundManager.playCoin();
      this.spawnCoinSparkles(pos);
    } else if (type === CollectibleType.ANTIDOTE) {
      // Antidote fills cure meter by 25%
      this.cureMeter = Math.min(100, this.cureMeter + 25);
      this.score += 200;
      soundManager.playPowerupCollect();
      this.spawnTransformationBurst(pos);

      // Trigger transformation if maxed
      if (this.cureMeter >= 100 && this.character.form === 'zombie') {
        this.character.triggerTransformation();
      }
    } else if (type === CollectibleType.JETPACK) {
      this.powerUps.jetpack.active = true;
      this.powerUps.jetpack.timeLeft = this.powerUps.jetpack.duration;
      this.character.setJetpack(true);
      soundManager.playPowerupCollect();
    } else if (type === CollectibleType.SNEAKERS) {
      this.powerUps.sneakers.active = true;
      this.powerUps.sneakers.timeLeft = this.powerUps.sneakers.duration;
      this.character.setSneakersActive(true);
      soundManager.playPowerupCollect();
    } else if (type === CollectibleType.MAGNET) {
      this.powerUps.magnet.active = true;
      this.powerUps.magnet.timeLeft = this.powerUps.magnet.duration;
      soundManager.playPowerupCollect();
    } else if (type === CollectibleType.MULTIPLIER) {
      this.powerUps.multiplier.active = true;
      this.powerUps.multiplier.timeLeft = this.powerUps.multiplier.duration;
      soundManager.playPowerupCollect();
    }
  }

  private handleCrash(isTrain: boolean = false) {
    if (this.isCrashing || this.state === 'game_over') return;
    this.isCrashing = true;
    this.crashTimer = 1.35; // 1.35s authentic Subway Surfers crash & bust sequence
    soundManager.stopMusic();

    if (isTrain) {
      this.character.triggerTrainCrash();
      this.cameraShakeIntensity = 1.6;
    } else {
      this.character.triggerCrash();
      this.cameraShakeIntensity = 1.0;
    }

    // Chase squad rushes to surround the fallen runner
    this.chaserSquad.triggerCatch();
  }

  private handleVictory() {
    this.state = 'victory';
    soundManager.playVictory();
    this.callbacks.onVictory();
    this.callbacks.onStateChange('victory');

    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }

  // --- CAMERA DYNAMICS ---

  private updateCamera(delta: number) {
    const charPos = this.character.group.position;

    if (this.isCrashing && this.character.isKnockedOut) {
      // Authentic Subway Surfers train crash camera:
      // Low angle cinematic view focused right on the fallen runner and the 3 doctors standing over him
      const targetCamX = charPos.x * 0.7;
      const targetCamY = 2.4;
      const targetCamZ = this.playerZ - 4.2;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 10 * delta;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 10 * delta;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 10 * delta;

      // Camera shake falloff
      if (this.cameraShakeIntensity > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
        this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - delta * 3);
      }

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 60, 6 * delta);
      this.camera.updateProjectionMatrix();

      // Look directly at the knocked out runner's torso on the tracks
      const lookTarget = new THREE.Vector3(charPos.x, 0.6, this.playerZ + 0.5);
      this.camera.lookAt(lookTarget);
      return;
    }

    // Follow target: camera follows player X with smooth easing
    const targetCamX = charPos.x * 0.45;
    const targetCamY = this.powerUps.jetpack.active ? 8.5 : Math.max(3.6, charPos.y + 3.2);
    const targetCamZ = this.playerZ + this.cameraOffset.z;

    this.camera.position.x += (targetCamX - this.camera.position.x) * 12 * delta;
    this.camera.position.y += (targetCamY - this.camera.position.y) * 8 * delta;
    this.camera.position.z = targetCamZ;

    // Camera shake falloff
    if (this.cameraShakeIntensity > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - delta * 3);
    }

    // Dynamic FOV based on speed (gives intense sense of velocity)
    const targetFOV = THREE.MathUtils.lerp(65, 80, (this.currentSpeed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed));
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 5 * delta);
    this.camera.updateProjectionMatrix();

    // Look at player slightly ahead
    const lookTarget = new THREE.Vector3(charPos.x * 0.25, charPos.y + 1.6, this.playerZ + 8);
    this.camera.lookAt(lookTarget);
  }

  // --- PARTICLES ---

  private spawnCoinSparkles(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.particleGroup.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 6
        ),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  private spawnTransformationBurst(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.16, 6, 6);
    const colors = [0x00f0ff, 0xffffff, 0x39ff14, 0x0088ff];

    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.particleGroup.add(mesh);

      const angle = (i / 28) * Math.PI * 2;
      const speed = 7 + Math.random() * 5;

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed * 0.6 + 3,
          (Math.random() - 0.5) * 6
        ),
        life: 0,
        maxLife: 0.7 + Math.random() * 0.3,
      });
    }
  }

  private spawnJetpackParticles(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xff5500 : 0xffcc00 });

    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + 0.8,
        pos.z - 0.4
      );
      this.particleGroup.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          -4 + Math.random() * -2,
          -8 + Math.random() * -4
        ),
        life: 0,
        maxLife: 0.3,
      });
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.vel, delta);
      const scale = 1 - p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  // --- REACT NOTIFIERS ---

  private notifyStats() {
    this.callbacks.onStatsUpdate({
      distance: Math.floor(this.distance),
      score: this.score,
      coins: this.coins,
      highScore: this.highScore,
      speed: Math.round(this.currentSpeed * 3.6), // km/h
      cureMeter: Math.round(this.cureMeter),
      targetDistance: this.TARGET_DISTANCE,
      prestigeMode: this.prestigeMode,
      characterForm: this.character.form,
      chaserClose: this.chaserSquad.isClose,
    });

    this.callbacks.onPowerUpsUpdate({ ...this.powerUps });
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    soundManager.stopMusic();
    window.removeEventListener('resize', this.handleResize);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
