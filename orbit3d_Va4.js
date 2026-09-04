


/* ---------------------------------------------------------
    3D N-body Simulation — settings 対応 完全版
    Part 1: Settings / Init / Camera / Projection / Input
--------------------------------------------------------- */

// =========================================================
// 1. グローバル状態・定数・キャッシュ変数（純粋データ定義）
// =========================================================

// 配列オブジェクトは意図しない上書きを防ぐため const で固定
const BACKGROUND_STARS = [];
const targetHistory = [];

// 💡 0:非表示（起動時は完全にオフ。ストイックホワイト起動のトリガー）
let lvecMode = 0;

// windowグローバルプロパティの初期化
window.showBarycenter = false;
window.showAngularMomentum = false;

// 三角関数の極限最適化キャッシュ変数（行列演算用）
let _cosX = 1, _sinX = 0;
let _cosY = 1, _sinY = 0;

// 統計カウンタオブジェクト
const stats = {
  escaped: 0,
  collided: 0,
  removed: 0,
  nanKilled: 0
};

// 🎥 カメラ初期旋回パラメータの一元化（値の二重定義を防止）
const DEFAULT_CAMERA_ROTATE_SPEED = 0.001;

window.cameraRotateSpeed = DEFAULT_CAMERA_ROTATE_SPEED;
window.isAutoRotateEnabled = true;

// 安全な関数参照の確保（ReferenceErrorの発生を完全に遮断）
window.spawnGoliathForce = (typeof window.spawnGoliathForce !== "undefined")
  ? window.spawnGoliathForce
  : null;


/* =========================================================
    2. 物理エンジン設定 (Physics Engine Settings - Initial Load)
   ========================================================= */
const settings = {
  gravityMultiplier: 1.0,         // 万有引力定数 (G)
  simSpeed: 2.5,                  // 時間進行速度 (dt)
  spawnVelocityMultiplier: 0.95,  // 初期天体速度倍率
  trailLengthMultiplier: 1.2,     // 軌跡ラインの長さ
  trailColorMode: "pure",         // 軌跡色彩モード ("dynamic" | "eccentric" | "pure" | "white")

  // ■ 演算閾値・ハードウェア保護
  nbodyThreshold: 200,            // 全重力閾値 (この数値以下でN-body相互干渉が発動)
  fullGravityThreshold: 200,      // 旧コード参照用互換エイリアス（nbodyThreshold と同値）
  nbodyLimit: 150,                // N-body演算上限 (相互作用計算の最大ノード数)
  eps2: 36,                       // 軟化係数 ε² (特異点回避バッファ)

  // ■ 相互作用・空間力学
  drag: 0.0,                      // 空間粘性抵抗 (0.0 = エネルギー減衰なし)
  nbodyBoost: 1.0,                // N-body相互重力ブースト倍率 (1.0 = 標準)

  // ■ 主星 (太陽) 初期状態
  sunMass: 2000.0,                // 太陽初期質量
  sunInitialVx: 0.0,              // 太陽初期速度 X
  sunInitialVy: 0.0,              // 太陽初期速度 Y
  sunInitialVz: 0.0,              // 太陽初期速度 Z
  sunFixed: false,                // 太陽固定フラグ (false = 重心運動を行う)

  // ■ 天体生成ルール
  objMass: 1.0,                   // 生成天体の基本質量
  useFixedObjMass: false,         // false = ランダム質量 (M-RND) / true = 固定質量 (M-FIX)
  initialBodyCount: 50,           // 初期配置天体数 (QTY: 50)

  spawnSettings: {
    minMass: 10.0,
    maxMass: 100.0,               // 質量境界 [Min, Max]
    massPower: 2.0,               // べき乗分布バイアス
    sizeScale: 0.7,               // 物理衝突サイズ倍率
    renderSizeScale: 1.0,         // 描画サイズ倍率
    minDist: 300,                 // 生成最小半径 R
    maxDist: 800,                 // 生成最大半径 R
    direction: "chaos"            // 公転方向 ("direct" | "retro" | "split" | "chaos")
  },

  // ■ 動的インジェクション (INJECT) 初期設定
  injectSettings: {
    type: "obj",                  // インジェクト種別 ("obj" | "sun2")
    mode: "normal",               // 軌道モード ("normal" | "retro" | "infall" | "polar")
    mass: 5.0                     // インジェクト質量
  }
};


/* =========================================================
    3. シミュレーション状態 (Simulation State - Initial Load)
   ========================================================= */
const simulationState = {
  running: true,
  elapsedTime: 0,

  ui: {
    showNames: false,
    nameMode: 0,
    showCometTrail: true,
    showPlanetTrail: true,
    showSunTrail: false,

    // 重心表示状態 (0: OFF, 2, 3, 4, 8, 15)
    baryStage: 0,

    // 「L-VEC / Target Lock」グループと同期する状態変数
    showLVec: 0,                   // lvecMode (0: OFF, 1: TOTAL, 2: INDIVIDUAL+HUD)
    targetName: "AUTO"             // window.selectedTargetName と同期
  },

  camera: {
    followSun: false,             // 従来互換フラグ
    followMode: "Sun",            // 追尾モード ("Sun" | "Center")
    autoRotate: true,             // 自動カメラ旋回有効フラグ
    rotateSpeed: DEFAULT_CAMERA_ROTATE_SPEED, // 上部定数と完全同期

    // 👑【新規追加】自動画角追従（Auto-Framing）設定パラメータ
    autoFraming: true,            // リロード時に自動カメラ追従を有効化 (true / false)
    optimalElevation: 0.523,      // 黄金見下ろし角 30度 (約0.523 rad)
    minDistance: 800,             // カメラの最接近距離限界
    maxDistance: 8000,            // カメラの最遠退距離限界
    lerpSpeed: 0.05               // カメラ追従の滑らかさ（補間係数）
  },

  physics: {
    sunLocked: false
  },

  selection: {
    body: null
  }
};

// ========================================================
// 宇宙管制盤：プリセット・データ構造（ストイック調律・完全版）
// 配置場所: Block 1（トップレベル・設定オブジェクトエリア）
// ========================================================
const DEBUG_PRESETS = {
  // 💥 1. 重力カオス・スペクタクル（「動」の宇宙・199天体リアルタイムN-body）
  preset1: {
    name: "PRST: 1 (重力カオス・スペクタクル 199)",

    ui: {
      bodyCount: 199,
      bodyCountInput: 199,

      sunMass: 2000,
      sunMassInput: 2000,
      sunVxSlider: 0.0,
      sunVxInput: 0.0,
      sunVySlider: 0.0,
      sunVyInput: 0.0,
      sunVzSlider: 0.0,
      sunVzInput: 0.0,

      objMass: 1.0,
      objMassInput: 1.0,
      useFixedObjMass: false, // Boolean型に統一

      gravitySlider: 1.2,
      gravityInput: 1.2,
      spawnVelSlider: 1.0,
      spawnVelInput: 1.0,
      dragSlider: 0.0,
      dragInput: 0.0,
      nbodyBoostSlider: 1.0,
      nbodyBoostInput: 1.0,
      speedSlider: 1.5,
      speedInput: 1.5,

      spawnMinMass: 10.0,
      spawnMaxMass: 100.0,
      spawnMinDist: 300,
      spawnMaxDist: 1200,
      spawnDirection: "chaos",

      nbodyThreshold: 3000,
      nbodyLimitInput: 300,
      eps2Input: 30,

      trailLenSlider: 0.5,
      trailColorMode: "pure",

      cameraRotateSpeed: 0.0008,
      targetInput: "AUTO",
      followMode: "Sun",

      injectType: "obj",
      injectModeSelect: "normal",
      injectMassSlider: 5.0,
      injectMassInput: 5.0
    },

    physics: function() {
      const u = this.ui;

      if (typeof initialBodyCount !== "undefined") window.initialBodyCount = u.bodyCount;
      if (window.bodies) window.bodies.length = u.bodyCount;

      if (typeof window.settings !== "undefined") {
        settings.sunMass = u.sunMassInput;
        settings.sunInitialVx = u.sunVxInput;
        settings.sunInitialVy = u.sunVyInput;
        settings.sunInitialVz = u.sunVzInput;
        settings.sunFixed = false;

        settings.gravityMultiplier = u.gravityInput;
        settings.spawnVelocityMultiplier = u.spawnVelInput;
        settings.simSpeed = u.speedInput;
        settings.eps2 = u.eps2Input;
        settings.objBaseMass = u.objMassInput;
        settings.objMass = u.objMassInput;
        settings.useFixedObjMass = u.useFixedObjMass;
        settings.trailColorMode = u.trailColorMode;
        settings.drag = u.dragInput;
        settings.nbodyBoost = u.nbodyBoostInput;

        settings.nbodyThreshold = u.nbodyThreshold;
        settings.fullGravityThreshold = u.nbodyThreshold;
        settings.nbodyLimit = u.nbodyLimitInput;

        settings.spawnMinMass = u.spawnMinMass;
        settings.spawnMaxMass = u.spawnMaxMass;
        settings.spawnMinDist = u.spawnMinDist;
        settings.spawnMaxDist = u.spawnMaxDist;
        settings.spawnDirection = u.spawnDirection;

        if (settings.spawnSettings) {
          settings.spawnSettings.minMass = u.spawnMinMass;
          settings.spawnSettings.maxMass = u.spawnMaxMass;
          settings.spawnSettings.minDist = u.spawnMinDist;
          settings.spawnSettings.maxDist = u.spawnMaxDist;
          settings.spawnSettings.direction = u.spawnDirection;
        }
      }

      if (typeof window.simulationState !== "undefined") {
        if (simulationState.camera) {
          simulationState.camera.autoRotate = true;
          simulationState.camera.rotateSpeed = u.cameraRotateSpeed;
          simulationState.camera.followMode = u.followMode;
        }
      }

      const targetON  = ['sunTrailBtn', 'planetTrailBtn', 'cometTrailBtn', 'toggleBaryBtn', 'toggle-momentum-btn', 'btnToggleRotate'];
      const targetOFF = ['showNames', 'btnOrbitCam'];

      targetON.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-on', 'active');
          btn.classList.remove('toggle-off');
        }
      });

      targetOFF.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-off');
          btn.classList.remove('toggle-on', 'active');
        }
      });

      if (typeof syncCameraRotateSpeed === "function") {
        syncCameraRotateSpeed(u.cameraRotateSpeed, true);
      }
      window.isAutoRotateEnabled = true;

      if (typeof applyUiValuesToDOM === "function") {
        applyUiValuesToDOM(u);
      }

      const forceUpdateIds = ["nbodyThreshold", "nbodyLimitInput", "nbodyBoostInput", "gravityInput"];
      forceUpdateIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      if (window.UI_DEBUG) {
        console.log("💥 [PRST: 1] 199天体 完全相互干渉 N-body 重力カオス・スペクタクルモードが起動しました。");
      }
    }
  },

  // 🪐 2. 双太陽・二重連星系（「連」の宇宙）
  preset2: {
    name: "PRST: 2 (双太陽・二重連星系)",

    ui: {
      bodyCount: 32,
      bodyCountInput: 32,

      sunMass: 2500,
      sunMassInput: 2500,
      sunVxSlider: 0.0,
      sunVxInput: 0.0,
      sunVySlider: 0.0,
      sunVyInput: 0.0,
      sunVzSlider: 0.0,
      sunVzInput: 0.0,

      objMass: 2.0,
      objMassInput: 2.0,
      useFixedObjMass: false, // 型を Boolean (false) に統一

      gravitySlider: 1.2,
      gravityInput: 1.2,
      spawnVelSlider: 0.9,
      spawnVelInput: 0.9,
      dragSlider: 0.0,
      dragInput: 0.0,
      nbodyBoostSlider: 1.0,
      nbodyBoostInput: 1.0,
      speedSlider: 2.5,
      speedInput: 2.5,

      spawnMinMass: 0.1,
      spawnMaxMass: 5.0,
      spawnMinDist: 300,
      spawnMaxDist: 1200,
      spawnDirection: "chaos",

      nbodyThreshold: 200,
      nbodyLimitInput: 150,
      eps2Input: 20,

      trailLenSlider: 0.5,
      trailColorMode: "pure",

      cameraRotateSpeed: 0.0003,
      targetInput: "AUTO",
      followMode: "Sun",

      injectType: "sun2",
      injectModeSelect: "normal",
      injectMassSlider: 1500,
      injectMassInput: 1500
    },

    physics: function() {
      const u = this.ui;

      if (typeof initialBodyCount !== "undefined") window.initialBodyCount = u.bodyCount;
      if (typeof window.settings !== "undefined") {
        settings.sunInitialVx = u.sunVxInput;
        settings.sunInitialVy = u.sunVyInput;
        settings.sunInitialVz = u.sunVzInput;
        settings.gravityMultiplier = u.gravityInput;
        settings.spawnVelocityMultiplier = u.spawnVelInput;
        settings.simSpeed = u.speedInput;
        settings.eps2 = u.eps2Input;
        settings.objBaseMass = u.objMassInput;
        settings.useFixedObjMass = u.useFixedObjMass;
        settings.sunFixed = false;
        settings.trailColorMode = u.trailColorMode;
        settings.drag = u.dragInput;
        settings.nbodyBoost = u.nbodyBoostInput;
        settings.nbodyThreshold = u.nbodyThreshold;
        settings.nbodyLimit = u.nbodyLimitInput;
        settings.spawnMinMass = u.spawnMinMass;
        settings.spawnMaxMass = u.spawnMaxMass;
        settings.spawnMinDist = u.spawnMinDist;
        settings.spawnMaxDist = u.spawnMaxDist;
        settings.spawnDirection = u.spawnDirection;
      }

      if (typeof generateBodies === "function") {
        generateBodies(u.bodyCount);
      } else if (window.bodies) {
        window.bodies.length = u.bodyCount;
      }

      const elType = document.getElementById("injectType");
      const elMassInput = document.getElementById("injectMassInput");
      const elMassSlider = document.getElementById("injectMassSlider");

      if (elType) {
        elType.value = u.injectType;
        elType.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (elMassInput) elMassInput.value = u.injectMassInput;
      if (elMassSlider) elMassSlider.value = u.injectMassSlider;

      // 即時安全実行（タイマー遅延を解除）
      if (typeof spawnGoliathForce === "function") {
        spawnGoliathForce();
      }

      const targetON  = ['planetTrailBtn', 'toggleBaryBtn', 'sunTrailBtn', 'btnToggleRotate'];
      const targetOFF = ['toggle-momentum-btn', 'cometTrailBtn', 'showNames', 'btnOrbitCam'];

      targetON.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-on', 'active');
          btn.classList.remove('toggle-off');
        }
      });

      targetOFF.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-off');
          btn.classList.remove('toggle-on', 'active');
        }
      });

      if (typeof syncCameraRotateSpeed === "function") {
        syncCameraRotateSpeed(u.cameraRotateSpeed, true);
      }
      window.isAutoRotateEnabled = true;

      if (typeof applyUiValuesToDOM === "function") {
        applyUiValuesToDOM(u);
      }

      if (window.UI_DEBUG) {
        console.log("🪐 [PRST: 2] Goliath ＋ SUN1軌跡を可視化した連星モード（連）が執行されました。");
      }
    }
  },

// 📐 3. ケプラー解析・物理デコーダー（「知」の宇宙）
  preset3: {
    name: "PRST: 3 (ケプラー解析・物理デコーダー)",
    ui: {
      // (ui プロパティ群は既存のまま維持)
      bodyCount: 6,
      bodyCountInput: 6,
      sunMass: 2200,
      sunMassInput: 2200,
      sunVxSlider: 0.0,
      sunVxInput: 0.0,
      sunVySlider: 0.0,
      sunVyInput: 0.0,
      sunVzSlider: 0.0,
      sunVzInput: 0.0,
      objMass: 1.5,
      objMassInput: 1.5,
      useFixedObjMass: false,
      gravitySlider: 1.0,
      gravityInput: 1.0,
      spawnVelSlider: 0.82,
      spawnVelInput: 0.82,
      dragSlider: 0.0,
      dragInput: 0.0,
      nbodyBoostSlider: 1.0,
      nbodyBoostInput: 1.0,
      speedSlider: 2.0,
      speedInput: 2.0,
      spawnMinMass: 0.1,
      spawnMaxMass: 5.0,
      spawnMinDist: 300,
      spawnMaxDist: 1300,
      spawnDirection: "chaos",
      nbodyThreshold: 200,
      nbodyLimitInput: 150,
      eps2Input: 16,
      trailLenSlider: 0.5,
      trailColorMode: "pure",
      cameraRotateSpeed: 0.0002,
      targetInput: "AUTO",
      followMode: "Sun",
      injectType: "obj",
      injectModeSelect: "normal",
      injectMassSlider: 5.0,
      injectMassInput: 5.0
    },

    physics: function() {
      const u = this.ui;

      if (typeof initialBodyCount !== "undefined") window.initialBodyCount = u.bodyCount;
      if (typeof window.settings !== "undefined") {
        settings.sunInitialVx = u.sunVxInput;
        settings.sunInitialVy = u.sunVyInput;
        settings.sunInitialVz = u.sunVzInput;
        settings.gravityMultiplier = u.gravityInput;
        settings.spawnVelocityMultiplier = u.spawnVelInput;
        settings.simSpeed = u.speedInput;
        settings.eps2 = u.eps2Input;
        settings.objBaseMass = u.objMassInput;
        settings.useFixedObjMass = u.useFixedObjMass;
        settings.sunFixed = false;
        settings.trailColorMode = u.trailColorMode;
        settings.drag = u.dragInput;
        settings.nbodyBoost = u.nbodyBoostInput;
        settings.nbodyThreshold = u.nbodyThreshold;
        settings.nbodyLimit = u.nbodyLimitInput;
        settings.spawnMinMass = u.spawnMinMass;
        settings.spawnMaxMass = u.spawnMaxMass;
        settings.spawnMinDist = u.spawnMinDist;
        settings.spawnMaxDist = u.spawnMaxDist;
        settings.spawnDirection = u.spawnDirection;
      }

      if (typeof generateBodies === "function") {
        generateBodies(u.bodyCount);
      } else if (window.bodies) {
        window.bodies.length = u.bodyCount;
      }

      // 👑 【完全修復】タイポ変数 (lVecMode) を削除し、完全一元化
      window.lvecMode = 2;
      if (typeof lvecMode !== "undefined") lvecMode = 2;
      if (typeof simulationState !== "undefined" && simulationState.ui) {
        simulationState.ui.showLVec = 2;
      }

      const targetON  = ['toggle-momentum-btn', 'planetTrailBtn', 'btnToggleRotate'];
      const targetOFF = ['toggleBaryBtn', 'cometTrailBtn', 'sunTrailBtn', 'showNames', 'btnOrbitCam'];

      targetON.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-on', 'active');
          btn.classList.remove('toggle-off');
        }
      });

      targetOFF.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-off');
          btn.classList.remove('toggle-on', 'active');
        }
      });

      const baryBtn = document.getElementById("toggleBaryBtn");
      if (baryBtn) {
        baryBtn.setAttribute("data-bary-stage", "0");
        baryBtn.textContent = "BARY: OFF";
      }

      if (typeof syncCameraRotateSpeed === "function") {
        syncCameraRotateSpeed(u.cameraRotateSpeed, true);
      }
      window.isAutoRotateEnabled = true;

      if (typeof applyUiValuesToDOM === "function") {
        applyUiValuesToDOM(u);
      }

      if (window.UI_DEBUG) {
        console.log("📐 [PRST: 3] L-VEC解析HUDを展開したケプラー物理モード（知）が執行されました。");
      }
    }
  },

  // 🌌 4. 3000天体 スムース・ロードシム
  preset4: {
    name: "PRST: 4 (3000天体 スムースシム)",
    ui: {
      // (ui プロパティ群は既存のまま維持)
      bodyCount: 3000,
      bodyCountInput: 3000,
      sunMass: 2000.0,
      sunMassInput: 2000.0,
      sunVxSlider: 0.0,
      sunVxInput: 0.0,
      sunVySlider: 0.0,
      sunVyInput: 0.0,
      sunVzSlider: 0.0,
      sunVzInput: 0.0,
      objMass: 1.0,
      objMassInput: 1.0,
      useFixedObjMass: false,
      gravitySlider: 1.0,
      gravityInput: 1.0,
      spawnVelSlider: 0.95,
      spawnVelInput: 0.95,
      dragSlider: 0.0,
      dragInput: 0.0,
      nbodyBoostSlider: 1.0,
      nbodyBoostInput: 1.0,
      speedSlider: 2.5,
      speedInput: 2.5,
      spawnMinMass: 10.0,
      spawnMaxMass: 100.0,
      spawnMinDist: 300,
      spawnMaxDist: 2300,
      spawnDirection: "chaos",
      nbodyThreshold: 200,
      nbodyLimitInput: 150,
      eps2Input: 36,
      trailLenSlider: 1.2,
      trailColorMode: "pure",
      cameraRotateSpeed: 0.001,
      targetInput: "AUTO",
      followMode: "Sun",
      injectType: "obj",
      injectModeSelect: "normal",
      injectMassSlider: 5.0,
      injectMassInput: 5.0
    },

    physics: function() {
      const u = this.ui;

      if (typeof initialBodyCount !== "undefined") window.initialBodyCount = u.bodyCount;

      if (typeof generateBodies === "function") {
        generateBodies(u.bodyCount);
      } else if (window.bodies) {
        window.bodies.length = u.bodyCount;
      }

      if (typeof window.settings !== "undefined") {
        settings.sunMass = u.sunMassInput;
        settings.sunInitialVx = u.sunVxInput;
        settings.sunInitialVy = u.sunVyInput;
        settings.sunInitialVz = u.sunVzInput;
        settings.sunFixed = false;
        settings.gravityMultiplier = u.gravityInput;
        settings.spawnVelocityMultiplier = u.spawnVelInput;
        settings.simSpeed = u.speedInput;
        settings.eps2 = u.eps2Input;
        settings.objBaseMass = u.objMassInput;
        settings.objMass = u.objMassInput;
        settings.useFixedObjMass = u.useFixedObjMass;
        settings.trailLengthMultiplier = u.trailLenSlider;
        settings.trailColorMode = u.trailColorMode;
        settings.drag = u.dragInput;
        settings.nbodyBoost = u.nbodyBoostInput;
        settings.nbodyThreshold = u.nbodyThreshold;
        settings.fullGravityThreshold = u.nbodyThreshold;
        settings.nbodyLimit = u.nbodyLimitInput;
        settings.spawnMinMass = u.spawnMinMass;
        settings.spawnMaxMass = u.spawnMaxMass;
        settings.spawnMinDist = u.spawnMinDist;
        settings.spawnMaxDist = u.spawnMaxDist;
        settings.spawnDirection = u.spawnDirection;

        if (settings.spawnSettings) {
          settings.spawnSettings.minMass = u.spawnMinMass;
          settings.spawnSettings.maxMass = u.spawnMaxMass;
          settings.spawnSettings.minDist = u.spawnMinDist;
          settings.spawnSettings.maxDist = u.spawnMaxDist;
          settings.spawnSettings.direction = u.spawnDirection;
        }
      }

      // 👑 【完全修復】変数の一貫した初期化（OFF 状態へ完全制御）
      window.lvecMode = 0;
      if (typeof lvecMode !== "undefined") lvecMode = 0;

      if (typeof window.simulationState !== "undefined") {
        if (simulationState.ui) {
          simulationState.ui.showPlanetTrail = true;
          simulationState.ui.showCometTrail  = true;
          simulationState.ui.showSunTrail    = false;
          simulationState.ui.showNames       = false;
          simulationState.ui.showLVec        = 0;
          simulationState.ui.baryStage       = 0;
        }
        if (simulationState.camera) {
          simulationState.camera.autoRotate = true;
          simulationState.camera.rotateSpeed = u.cameraRotateSpeed;
          simulationState.camera.followMode = u.followMode;
        }
      }

      const targetON  = ['planetTrailBtn', 'cometTrailBtn', 'btnToggleRotate'];
      const targetOFF = ['sunTrailBtn', 'toggleBaryBtn', 'toggle-momentum-btn', 'showNames', 'btnOrbitCam'];

      targetON.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-on', 'active');
          btn.classList.remove('toggle-off');
        }
      });

      targetOFF.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('toggle-off');
          btn.classList.remove('toggle-on', 'active');
        }
      });

      const baryBtn = document.getElementById("toggleBaryBtn");
      if (baryBtn) {
        baryBtn.setAttribute("data-bary-stage", "0");
        baryBtn.textContent = "BARY: OFF";
      }

      if (typeof syncCameraRotateSpeed === "function") {
        syncCameraRotateSpeed(u.cameraRotateSpeed, true);
      }
      window.isAutoRotateEnabled = true;

      if (typeof applyUiValuesToDOM === "function") {
        applyUiValuesToDOM(u);
      }

      const forceUpdateIds = ["nbodyThreshold", "nbodyLimitInput", "nbodyBoostInput", "gravityInput", "speedInput"];
      forceUpdateIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      if (window.UI_DEBUG) {
        console.log("🌌 [PRST: 4] 3000天体 スムースロードシムモードが完全起動しました。");
      }
    }
  }
};


// ========================================================
// Goliath / Obj 動的強制生成コマンド (完全物理補正版)
// 配置場所: Block 2 (物理演算・オブジェクト生成関数エリア)
// ========================================================
function spawnGoliathForce() {
  if (!bodies || !Array.isArray(bodies) || bodies.length === 0) {
    console.error("❌ [召喚失敗] 宇宙に中心星（Sun）が存在しません。");
    return;
  }

  // 太陽オブジェクトの安全な動的検索
  const sun = (bodies[0] && bodies[0].name === "Sun")
    ? bodies[0]
    : (bodies.find(b => b && b.name === "Sun") || bodies[0]);

  if (!sun || isNaN(sun.mass)) {
    console.error("❌ [召喚失敗] 太陽の質量データが無効です。");
    return;
  }

  // 太陽の絶対位置と絶対速度を取得（未定義時は0で安全処理）
  const sunX  = Number(sun.x || 0);
  const sunY  = Number(sun.y || 0);
  const sunZ  = Number(sun.z || 0);
  const sunVx = Number(sun.vx || 0);
  const sunVy = Number(sun.vy || 0);
  const sunVz = Number(sun.vz || 0);

  const S = settings?.spawnSettings;
  const targetMinDist = S?.minDist || 300;
  const targetMaxDist = S?.maxDist || 1200;
  const currentG      = (typeof G !== "undefined") ? G : 1.0;

  // UIからのリアルタイム取得と数値検証
  const elType      = document.getElementById("injectType");
  const elMassInput = document.getElementById("injectMassInput");
  const elMode      = document.getElementById("injectModeSelect");
    const selectedType = elType ? elType.value : "obj";
  const orbitMode    = elMode ? elMode.value : "normal"; // "normal", "retro", "infall", "polar"
    let customMass = elMassInput ? parseFloat(elMassInput.value) : 5.0;
  if (isNaN(customMass) || customMass <= 0) customMass = 5.0;

  // 1. 【3次元相対幾何学配置】（太陽相対座標）
  const angle1 = Math.random() * Math.PI * 2;
  const angle2 = (orbitMode === "polar")
    ? Math.random() * Math.PI
    : (Math.PI / 2) + (Math.random() - 0.5) * 0.5;
        const r = targetMinDist + Math.random() * (targetMaxDist - targetMinDist);

  // 太陽を中心とした相対位置 (relX, relY, relZ)
  const relX = r * Math.cos(angle1) * Math.sin(angle2);
  const relY = r * Math.sin(angle1) * Math.sin(angle2);
  const relZ = r * Math.cos(angle2);

  // 2. 【ケプラー回転速度 ＆ 軌道ベクトル演算】
  const dist = Math.sqrt(relX * relX + relY * relY + relZ * relZ) || 1;
  const gravityMult = settings?.gravityMultiplier || 1.0;
    // 太陽からの半径 dist 内に含まれる全質量を計算（太陽相対距離で判定）
  const totalMassInSphere = sun.mass + bodies.reduce((acc, b) => {
    if (b !== sun && b) {
      const dx = (b.x || 0) - sunX;
      const dy = (b.y || 0) - sunY;
      const dz = (b.z || 0) - sunZ;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < dist) {
        return acc + (b.mass || 0);
      }
    }
    return acc;
  }, 0);

  const vBase = Math.sqrt(currentG * gravityMult * totalMassInSphere / dist);
  const spawnVelMult = settings?.spawnVelocityMultiplier || 1.0;
  const v = vBase * spawnVelMult;

  let relVx = 0, relVy = 0, relVz = 0;

  // 軌道モードによる相対速度ベクトルの分岐処理
  if (orbitMode === "infall") {
    // 【太陽直撃モード】：太陽中心へ向けて突撃
    const speed = v * 1.2;
    relVx = (-relX / dist) * speed;
    relVy = (-relY / dist) * speed;
    relVz = (-relZ / dist) * speed;
  } else if (orbitMode === "retro") {
    // 【逆行モード】：時計回りに公転
    relVx = (relY / dist) * v;
    relVy = (-relX / dist) * v;
    relVz = (Math.random() - 0.5) * 0.2 * v;
  } else {
    // 【通常・順行モード】：反時計回りの公転
    const side = (Math.random() < 0.05) ? -1 : 1;
    relVx = (side * -relY / dist) * v;
    relVy = (side * relX / dist) * v;
    relVz = (Math.random() - 0.5) * 0.1 * v;
  }

  // 太陽の現在位置・現在速度を合算して「絶対位置・絶対速度」を確定
  const finalX  = sunX + relX;
  const finalY  = sunY + relY;
  const finalZ  = sunZ + relZ;
  const finalVx = sunVx + relVx;
  const finalVy = sunVy + relVy;
  const finalVz = sunVz + relVz;

  // safeMassToSize 関数の安全なフォールバック
  const safeMassToSize = (m) => {
    if (typeof massToSize === "function") return massToSize(m);
    return Math.pow(m, 1 / 3) * 2.0;
  };

  // 3. 生成データの構築と追加
  let newBody = {};

  if (selectedType === "sun2") {
    newBody = {
      x: finalX,
      y: finalY,
      z: finalZ,
      vx: finalVx,
      vy: finalVy,
      vz: finalVz,
      mass: customMass,
      size: safeMassToSize(customMass) * 0.3,
      color: "#ff00ff",
      name: "Goliath_" + Date.now().toString().slice(-3),
      type: "planet",
      trail: []
    };
    console.log(`%c 🛸 [異分子召喚] 『Goliath』(M:${customMass.toFixed(1)} / Mode:${orbitMode}) 展開完了！`, "color: #ff00ff; font-weight: bold;");
  } else {
    const t = Math.min(1, dist / targetMaxDist);
    const sizeScale = 0.7;
    const size = safeMassToSize(customMass) * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t) * sizeScale;

    const rCol = 180 + (255 - 180) * t;
    const gCol = 220 + (255 - 220) * t;
    const bCol = 255;

    newBody = {
      x: finalX,
      y: finalY,
      z: finalZ,
      vx: finalVx,
      vy: finalVy,
      vz: finalVz,
      mass: customMass,
      size: size,
      color: `rgb(${rCol | 0},${gCol | 0},${bCol | 0})`,
      name: "Obj_Injected_" + Date.now().toString().slice(-3),
      type: "obj",
      trail: []
    };
    console.log(`%c 🪐 [放浪天体インジェクション] 質量 ${customMass.toFixed(1)} の Obj 軌道投入完了。`, "color: #00ff88; font-weight: bold;");
  }

  bodies.push(newBody);
}

window.spawnGoliathForce = spawnGoliathForce;



/* =========================================================
   4. DOM構築完了後のUI初期化・イベントハンドラバインド（完全統合版）
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {

  // ---------------------------------------------------------
  // ① トレイル系LEDボタンの初期状態（クラス名）強制バインド
  // ---------------------------------------------------------
  const sunTrailBtn    = document.getElementById("sunTrailBtn");
  const cometTrailBtn  = document.getElementById("cometTrailBtn");
  const planetTrailBtn = document.getElementById("planetTrailBtn");

  if (planetTrailBtn) {
    planetTrailBtn.classList.add("toggle-on", "active");
    planetTrailBtn.classList.remove("toggle-off");
  }

  if (cometTrailBtn) {
    cometTrailBtn.classList.add("toggle-on", "active");
    cometTrailBtn.classList.remove("toggle-off");
  }

  if (sunTrailBtn) {
    sunTrailBtn.classList.add("toggle-off");
    sunTrailBtn.classList.remove("toggle-on", "active");
  }


  // ---------------------------------------------------------
  // ② カメラ自動巡航 UIコントロール初期化
  // ---------------------------------------------------------
  const camSpeedSlider = document.getElementById("cameraRotateSpeed");
  const camSpeedInput  = document.getElementById("rotateSpeedInput");
  const camSpeedLabel  = document.getElementById("rotateSpeedVal");
  const camToggleBtn   = document.getElementById("btnToggleRotate");

  // 初期値の安全確保
  if (typeof window.cameraRotateSpeed === "undefined") {
    window.cameraRotateSpeed = camSpeedSlider ? Number(camSpeedSlider.value) : 0.001;
  }
  window.cameraRotateSpeedVal = window.cameraRotateSpeed;

  // UI初期表示の設定
  if (camSpeedSlider) camSpeedSlider.value = window.cameraRotateSpeed;
  if (camSpeedInput)  camSpeedInput.value  = window.cameraRotateSpeed;
  if (camSpeedLabel)  camSpeedLabel.textContent = window.cameraRotateSpeed.toFixed(3);

  if (camToggleBtn) {
    camToggleBtn.classList.add("toggle-on", "active");
    camToggleBtn.classList.remove("toggle-off");
  }

  /**
   * 👑 カメラ速度を一括同期・適用する安全な関数 (windowへ公開)
   */
  window.syncCameraRotateSpeed = function(value, isFromInput = false) {
    let val = Number(value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 0.05) val = 0.05;

    window.cameraRotateSpeed = val;
    window.cameraRotateSpeedVal = val;
    if (typeof camera !== "undefined" && camera) {
      camera.autoRotateSpeed = val;
    }

    if (camSpeedLabel) camSpeedLabel.textContent = val.toFixed(3);
    if (camSpeedSlider && parseFloat(camSpeedSlider.value) !== val) {
      camSpeedSlider.value = val;
    }
    if (camSpeedInput && !isFromInput && parseFloat(camSpeedInput.value) !== val) {
      camSpeedInput.value = val;
    }
  };

  // スライダー操作イベント
  if (camSpeedSlider) {
    camSpeedSlider.addEventListener("input", (e) => {
      window.syncCameraRotateSpeed(e.target.value, false);
    });
  }

  // 数値入力欄イベント
  if (camSpeedInput) {
    camSpeedInput.addEventListener("input", (e) => {
      window.syncCameraRotateSpeed(e.target.value, true);
    });

    camSpeedInput.addEventListener("blur", (e) => {
      window.syncCameraRotateSpeed(e.target.value, false);
    });
  }

  // AUTOボタン（自動回転トグル）
  if (camToggleBtn) {
    camToggleBtn.onclick = function() {
      window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
      if (window.isAutoRotateEnabled) {
        this.classList.add("toggle-on", "active");
        this.classList.remove("toggle-off");
      } else {
        this.classList.add("toggle-off");
        this.classList.remove("toggle-on", "active");
      }
    };
  }

  // ORBITボタン（車載カメラトグル）
  const orbitBtn = document.getElementById("btnOrbitCam");
  if (orbitBtn) {
    orbitBtn.onclick = function() {
      if (typeof camera !== "undefined" && camera && camera.isOrbitCam) {
        if (typeof deactivateOrbitCam === "function") deactivateOrbitCam();
        this.classList.add("toggle-off");
        this.classList.remove("toggle-on", "active");
      } else {
        if (typeof activateOrbitCam === "function") activateOrbitCam();
        if (typeof camera !== "undefined" && camera && camera.isOrbitCam) {
          this.classList.add("toggle-on", "active");
          this.classList.remove("toggle-off");
        }
      }
    };
  }


  // ---------------------------------------------------------
  // ③ ボタン群完全配線マトリクス（二重登録・衝突を解消済み）
  // ---------------------------------------------------------

  // 1. インジェクト / Goliath（異分子）強制生成ボタン（統合版）
  const executeBtn = document.getElementById("btnExecuteInject") || document.getElementById("triggerGoliathBtn");
  if (executeBtn) {
    executeBtn.addEventListener("click", function() {
      if (typeof window.spawnGoliathForce === "function") {
        window.spawnGoliathForce();
      }

      this.classList.add("toggle-on", "active");
      this.classList.remove("toggle-off");

      setTimeout(() => {
        this.classList.remove("toggle-on", "active");
        this.classList.add("toggle-off");
      }, 500);
    });
  }

  // 2. 巡回式マルチ・バリセンターボタン
  const baryBtn = document.getElementById("toggleBaryBtn");
  if (baryBtn) {
    baryBtn.addEventListener("click", function() {
      if (typeof executeButtonCoreLogic === "function") {
        executeButtonCoreLogic("toggleBaryBtn", this);
      } else {
        console.warn("⚠️ [機能未実装] executeButtonCoreLogic 関数が読み込まれていません。");
      }
    });
  } else {
    console.warn("⚠️ [配線不発] HTML側に id='toggleBaryBtn' のボタンが見つかりません。");
  }

// ========================================================
// 👑 L-VEC (角運動量) 3ステージ・トグル完全統治制御
// ========================================================
const lvecBtn = document.getElementById("toggle-momentum-btn");

if (lvecBtn) {
    // 起動時の初期化（グローバル変数 lvecMode が未定義なら0で安全に初期化）
    if (typeof lvecMode === "undefined") window.lvecMode = 0;

    lvecBtn.addEventListener("click", () => {
        // 🔄 0 ➔ 1 ➔ 2 の3ステージを正確に巡回（モジュレーション）
        lvecMode = (lvecMode + 1) % 3;

        // 🎨 ステージに応じた「音色カラー（ビジュアル）」の確定演出
        if (lvecMode === 0) {
            // Mode 0: 完全なる静寂・ストイック（白一線）
            lvecBtn.style.background = '#333';
            lvecBtn.style.color = '#fff';
            lvecBtn.classList.add('toggle-off');
            lvecBtn.classList.remove('toggle-on', 'active');
        } else if (lvecMode === 1) {
            // Mode 1: 離心率カラー起動（第1次相転移・鮮烈なブルー）
            lvecBtn.style.background = '#00bbff';
            lvecBtn.style.color = '#000';
            lvecBtn.classList.add('toggle-on', 'active');
            lvecBtn.classList.remove('toggle-off');
        } else if (lvecMode === 2) {
            // Mode 2: 特級数理・ピザ展開（第2次相転移・サイバーグリーン）
            lvecBtn.style.background = '#00ff88';
            lvecBtn.style.color = '#000';
            lvecBtn.classList.add('toggle-on', 'active');
            lvecBtn.classList.remove('toggle-off');
        }

        if (window.UI_DEBUG) console.log(`🎛️ L-VEC Mode 相転移 ──> [ Mode: ${lvecMode} ]`);
                // 💫 描画スレッドが停止している場合、1フレーム強制更新して色を即座に反映
        if (!simulationState.running && typeof render === "function") {
            render();
        }
    });
}



 // ---------------------------------------------------------
// ④ プリセットボタン群の一括配線（堅牢化版）
// ---------------------------------------------------------
const binds = [
  { id: "preset1Btn", key: "preset1" },
  { id: "preset2Btn", key: "preset2" },
  { id: "preset3Btn", key: "preset3" },
  { id: "preset4Btn", key: "preset4" }
];

binds.forEach(bind => {
  const btn = document.getElementById(bind.id);
    if (!btn) {
    console.warn(`[Preset Warning] ボタン要素が見つかりません: #${bind.id}`);
    return;
  }

  btn.addEventListener("click", () => {
    if (typeof applyPreset === "function") {
      applyPreset(bind.key);
    } else if (typeof DEBUG_PRESETS !== "undefined" && DEBUG_PRESETS[bind.key]) {
      if (typeof DEBUG_PRESETS[bind.key].physics === "function") {
        DEBUG_PRESETS[bind.key].physics();
      } else {
        console.error(`[Preset Error] ${bind.key}.physics は関数ではありません。`);
      }
    } else {
      console.error(`[Preset Error] 実行可能なプリセット関数が見つかりません: ${bind.key}`);
    }
  });
});


 // ---------------------------------------------------------
// ⑤ 質量調整計器（スライダー ⇔ 入力ボックス ⇔ 動的数値ラベル）完全同期
// ---------------------------------------------------------
const elInjectMassSlider = document.getElementById("injectMassSlider");
const elInjectMassInput  = document.getElementById("injectMassInput");
const elInjectMassLabel  = document.getElementById("injectMassLabel");

if (elInjectMassSlider && elInjectMassInput && elInjectMassLabel) {
    // 👑 スライダー操作時：入力ボックスとラベルへ同期
  elInjectMassSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    const formatted = val.toFixed(1);
    elInjectMassInput.value = formatted;
    elInjectMassLabel.innerText = formatted;
  });

  // 👑 入力ボックス変更時：クランプ後の正確な値を全UIへ伝播
  const syncFromInput = (isFinalize = false) => {
    let val = parseFloat(elInjectMassInput.value);
    if (isNaN(val)) return;

    const min = parseFloat(elInjectMassSlider.min) || 0;
    const max = parseFloat(elInjectMassSlider.max) || 3000;
        // 1. 正確に範囲内へクランプ
    const clampedVal = Math.max(min, Math.min(max, val));
        // 2. スライダーとラベルには「クランプ後の正しい値」を設定（UI非同期を防止）
    elInjectMassSlider.value = clampedVal;
    elInjectMassLabel.innerText = clampedVal.toFixed(1);

    // 3. 編集確定（change/blur）時は入力ボックス自体もクランプ後の値に整形
    if (isFinalize) {
      elInjectMassInput.value = clampedVal.toFixed(1);
    }
  };

  // リアルタイム入力時
  elInjectMassInput.addEventListener("input", () => syncFromInput(false));
    // フォーカス外れ・Enter確定時（値を強制補正）
  elInjectMassInput.addEventListener("change", () => syncFromInput(true));
}

// ⚠️ DOMContentLoaded の終了タグは、全DOM初期化コードの最末尾に配置することを推奨

}); // 👑 ここで唯一かつ正しく DOMContentLoaded を終了




// ========================================================
//  3. 核心部：UI・物理レイヤー「同時上書き」コアインジェクター
// ========================================================
function applyPreset(presetKey) {
  const config = DEBUG_PRESETS[presetKey];
  if (!config) return;

  console.log(`%c 宇宙管制盤：時空相転移 ──> 【${config.name}】を注入中...`, "color: #00ffff; font-weight: bold;");

  // 1. UI層への流し込み（イベント発火による動的連動）
  for (const [id, value] of Object.entries(config.ui || {})) {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") {
        el.checked = value;
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // 2. 物理層（settings）への注入
  if (typeof config.physics === "function") {
    config.physics();
  }

  // 3. 宇宙リセット関数の自動実行
  if (typeof generateBodies === "function") {
    generateBodies();
  } else if (typeof window.generateBodies === "function") {
    window.generateBodies();
  }

  // 👑 【順序補正】生成された新天体群に対して trailWidth をアライメント設定
  if (window.bodies && Array.isArray(window.bodies)) {
    window.bodies.forEach(b => {
      if (b) b.trailWidth = 0.3; // 繊細な基準値へアライメント
    });
  }

  // 4. カメラ記憶リセットの安全フォールバック
  if (typeof resetCameraMemory === "function") {
    resetCameraMemory();
  } else if (typeof resetCamera === "function") {
    resetCamera();
  } else {
    if (window.UI_DEBUG) console.log("🎥 カメラ記憶リセット関数は未定義ですが、描画スレッドを完全保護しました。");
  }
}

// =======================================================
//  4. 🧹 自由視点復帰時等の軌跡クリアヘルパー
// =======================================================
function clearTrailHistory() {
  const allBodies = (typeof window !== "undefined" && window.bodies) ? window.bodies : (typeof bodies !== "undefined" ? bodies : null);
  if (allBodies && allBodies.length > 0) {
    allBodies.forEach(b => {
      if (b && b.trail && Array.isArray(b.trail)) {
        b.trail = [];
      }
    });
  }
  console.log("OrbitCam: 自由視点に復帰し、軌跡のゴースト線をクリアしました。");
}


/* ---------------------------------------------------------
   Canvas Init
--------------------------------------------------------- */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const bodyCountDisplay = document.getElementById("bodyCountDisplay");
const turnCountDisplay = document.getElementById("turnCountDisplay");

let W = window.innerWidth;
let H = window.innerHeight;
canvas.width = W;
canvas.height = H;


window.addEventListener("resize", () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

       if (!simulationState.running && typeof render === "function") {
        render();
    }
});


/* ---------------------------------------------------------
   Camera（Free 3D Camera & OrbitCam 統合版・ストイック調律版）
--------------------------------------------------------- */
// 👑 単一の真実ソース（Single Source of Truth）として定義
window.cameraRotateSpeed = 0.0005;

const camera = {
  pos: { x: 0, y: 0, z: 0 },
  rotX: 0.5,
  rotY: 0.5,
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,

  orbitRadius: 1200,          // ターゲットからの基本カメラ距離
    // 👑 グローバル変数から動的に参照（または直接 window.cameraRotateSpeed を更新）
  get autoRotateSpeed() { return window.cameraRotateSpeed; },
  set autoRotateSpeed(val) { window.cameraRotateSpeed = val; },
    orbitSpeed: 0.0005,          // 周回速度
    waveSpeed: 0.3,
  waveAmplitude: 200,
  timeCounter: 0,
  targetBodyIndex: 0,          // ロックオン対象（0 = 太陽）

  // ====== OrbitCam パラメータ群 ======
  isOrbitCam: false,
  orbitTheta: 0,
  orbitPhi: 0.5                // 上下角
};

const BASE_DISTANCE = 1200;


/* ---------------------------------------------------------
   3D → 2D Projection（ニア・クリッピング対応版）
--------------------------------------------------------- */
/**
 * 【Next Step 1】3D → 2D Screen Projection
 * 太陽中心空間に変換された座標を、厳密なパースペクティブで投影する
 */
function project3D(x, y, z) {
  const dz = z;
  const NEAR_PLANE = 10;

  // ニア・クリッピング（カメラのすぐ後ろや近すぎる天体を不可視化）
  if (dz < NEAR_PLANE) {
    return { x: -9999, y: -9999, depth: dz, visible: false };
  }

  // 規律ある等倍パースペクティブ計算（Focal Length = 1200）
  const perspective = camera.zoom * (BASE_DISTANCE / dz);

  return {
    x: W / 2 + x * perspective + camera.offsetX,
    y: H / 2 + y * perspective + camera.offsetY,
    depth: dz,
    scaleFactor: perspective,
    visible: true
  };
}


/**
 * ターゲット中心オービット回転（ピボット・シフト）
 */
function rotate3D(b) {
  if (!b) return { x: 0, y: 0, z: 0 };

  // 👑 【一本化】追尾フラグ(followTarget または followSun)がONの時だけターゲットを参照
  // OFFの時は原点 (0,0,0) を中心として旋回する
  let target = { x: 0, y: 0, z: 0 };
    const isFollowing = simulationState?.camera?.followTarget ?? simulationState?.camera?.followSun ?? true;

  if (isFollowing) {
    let targetIndex = camera.targetBodyIndex ?? 0;
    if (!bodies[targetIndex]) targetIndex = 0; // ロスト時は Sun (0)
    target = bodies[targetIndex] || target;
  }

  // ステップ1: 相対座標へ変換（追尾OFF時は target が 0 なので原点基準になる）
  const x0 = b.x - target.x;
  const y0 = b.y - target.y;
  const z0 = b.z - target.z;

  // ステップ2: カメラ角度（rotX, rotY）で回転
  const cosX = Math.cos(camera.rotX);
  const sinX = Math.sin(camera.rotX);
  const x1 = x0;
  const y1 = y0 * cosX - z0 * sinX;
  const z1 = y0 * sinX + z0 * cosX;

  const cosY = Math.cos(camera.rotY);
  const sinY = Math.sin(camera.rotY);
  const x2 = x1 * cosY - z1 * sinY;
  const y2 = y1;
  const z2 = x1 * sinY + z1 * cosY;

  // ステップ3: 奥行きの確定
  return {
    x: x2,
    y: y2,
    z: z2 + camera.orbitRadius
  };
}


/* ---------------------------------------------------------
   Mouse Control
--------------------------------------------------------- */
let dragging = false;
let dragButton = 0;
let lastX = 0, lastY = 0;
let turnCount = 0;
let maxSpeedEver = 0;
let orbitHintShown = false;

canvas.addEventListener("mousedown", e => {
  dragging = true;
  dragButton = e.button;
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener("mousemove", e => {
  if (!dragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  if (dragButton === 0) {
    camera.rotY += dx * 0.005;
    camera.rotX += dy * 0.005;

  // ★ rotX の角度制限（ジンバルロック防止）
  const limit = Math.PI / 2 - 0.01;
  camera.rotX = Math.max(-limit, Math.min(limit, camera.rotX));

// 補正：rotY が無限に増大するのを防ぐ（0 〜 2π の間に丸める）
  const PI2 = Math.PI * 2;
  camera.rotY = (camera.rotY % PI2 + PI2) % PI2;

  } else if (dragButton === 2) {
    camera.offsetX += dx;
    camera.offsetY += dy;
  }

  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener("mouseup", () => dragging = false);
canvas.addEventListener("mouseleave", () => dragging = false);
canvas.addEventListener("contextmenu", e => e.preventDefault());

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  camera.zoom *= (e.deltaY > 0 ? 0.9 : 1.1);

  // ★ 上限を 5.0 から 200.0（200倍）くらいに一気に引き上げる！
  // （下限の 0.1 は、宇宙が米粒より小さくならないために残しておいてOK）
  camera.zoom = Math.max(0.1, Math.min(200.0, camera.zoom));
}, { passive: false });



/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 2: Body Generation / Comet / Sun Velocity Adjust
--------------------------------------------------------- */

const G = 0.5;
const baseDt = 0.2;

// ★ 規律修正：グラフィックと衝突判定の整合性を取るため、値を「1.0」に固定
// 描画されている太陽のサイズと完全に一致した確実な衝突判定を実現
const SUN_HIT_SCALE = 1.0;

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 80%, 60%)`;
}

/**
 * 質量決定関数（ベキ乗分布ロジック内蔵）
 * s.massPower が未定義の場合でもフォールバック(1.0)により動作を保障
 */
function randomMass() {
  const s = settings.spawnSettings;
  if (!s) return 1.0;
  if (s.minMass === s.maxMass) return s.minMass;

  // massPower(例: 2.0) により小天体を高確率、巨大天体をごく稀に生成
  const power = s.massPower || 1.0;
  const r = Math.pow(Math.random(), power);
  return s.minMass + r * (s.maxMass - s.minMass);
}

/**
 * 質量から物理半径（サイズ）への変換
 * 密度一定の三次元球体（V ∝ r^3）として計算する物理的に厳密な公式
 */
function massToSize(m) {
  return Math.cbrt(m) * 1.5;
}

let bodies = [];
let initialBodyCount = 50;


/* ============================
   Collision Grid（Uniform Grid）
============================ */
const CELL_SIZE = 300;              // 衝突半径より少し大きめに
let collisionGrid = new Map();      // key: "cx_cy_cz" → [bodyIndex...]


/* =====================================================================
   👑 【統合調律】太陽スピード ＆ F12戦術HUD連動 3次元絶対座標(XYZ)更新関数
   ===================================================================== */
function updateSunSpeedDisplay() {
  if (!bodies || !Array.isArray(bodies) || bodies.length === 0) return;

  // 🛡️ 太陽オブジェクトの安全な動的検索（インデックス0固定を排除）
  const sun = (bodies[0] && bodies[0].name === "Sun")
    ? bodies[0]
    : (bodies.find(b => b && b.name === "Sun") || bodies[0]);

  if (!sun || typeof sun.vx === "undefined") return;

  // 1. 速度（V）の数理演算を執行（三次元スカラー速度）
  const speed = Math.sqrt(
    (sun.vx || 0) * (sun.vx || 0) +
    (sun.vy || 0) * (sun.vy || 0) +
    (sun.vz || 0) * (sun.vz || 0)
  );

  // ベースとなるスピードテキストをビルド
  let displayText = "Sun Speed: " + speed.toFixed(2);

  // 👑 【特権ハック】：F12の戦術HUDがアクティブの時だけ、XYZの座標をサイバーに結合
  if (typeof isDeveloperHUDActive !== 'undefined' && isDeveloperHUDActive) {
    const x = sun.x || 0;
    const y = sun.y || 0;
    const z = sun.z || 0;
    displayText += `  XYZ: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
  }

  // 2. DOMへインジェクション
  const speedEl = document.getElementById("sunSpeedDisplay");
  if (speedEl) {
    speedEl.textContent = displayText;
  }
}

/* =========================================================
   3. 天体システムの初期生成（Generate Bodies）冒頭ブロック最適化版
   ========================================================= */
function generateBodies() {
  // 1. 【最優先】天体配列のメモリを直接ゼロクリア（倍増バグの根絶）
  if (typeof window.bodies !== "undefined" && Array.isArray(window.bodies)) {
    window.bodies.length = 0;
  } else {
    window.bodies = [];
  }

  // 2. 統計データオブジェクトの安全初期化
  if (typeof window.stats === "undefined") {
    window.stats = { escaped: 0, collided: 0, removed: 0, nanKilled: 0 };
  } else {
    stats.escaped  = 0;
    stats.collided = 0;
    stats.removed  = 0;
    stats.nanKilled = 0;
  }

  // 3. DOM表示（カウンター）のゼロクリア
  const elAlive    = document.getElementById("statAlive");
  const elEscaped  = document.getElementById("statEscaped");
  const elCollided = document.getElementById("statCollided");
  const elRemoved  = document.getElementById("statRemoved");
  const elNaN      = document.getElementById("statNaN");

  // 消滅系カウンターは「0」にリセット
  if (elEscaped)  elEscaped.textContent  = "0";
  if (elCollided) elCollided.textContent = "0";
  if (elRemoved)  elRemoved.textContent  = "0";
  if (elNaN)      elNaN.textContent      = "0";
    // 生存数は一時的に「0」にし、生成完了後に bodies.length から正確に書き込む
  if (elAlive)    elAlive.textContent    = "0";

  console.log("%c 統計レイヤー：過去のカルマを消去。カウンターおよび天体メモリをゼロリセットした。", "color: #aaaaaa; font-style: italic;");

  // （※ この後に太陽・惑星の生成ループが続く）  // ---------------------------------------------------------
  //  既存の初期化処理
  // ---------------------------------------------------------
  // 既存の天体配列をクリア（初期化の保証）
  bodies = [];

  // 天体リセットと同時に、背景の星空データも完全に初期化
  //initBackgroundStars();


/* -------------------------------------------------------
     太陽（Sun）の生成処理：質量はUIの設定値を動的に反映（完全防御版）
     ------------------------------------------------------- */
  // 🛡️ 1. DOMの安全取得 ＆ NaN・0以下の値に対するフォールバック保護
  const sunMassEl = document.getElementById("sunMass");
  let sunMass = sunMassEl ? Number(sunMassEl.value) : 1500;
    // 値が NaN または 0 以下に破壊されている場合は、安全なデフォルト値(1500)に強制置換
  if (isNaN(sunMass) || sunMass <= 0) {
    sunMass = 1500;
  }

  // 🛡️ 2. 関数の安全取得（未定義エラー防止）
  const mToSize = (typeof massToSize === "function")
    ? massToSize
    : ((m) => Math.pow(m, 1/3) * 2);
  const hitScale = (typeof SUN_HIT_SCALE !== "undefined") ? SUN_HIT_SCALE : 1.2;

  // 太陽の描画サイズ調整（スケール係数を 0.5 に設定して巨大化を抑制）
  const sunSize = mToSize(sunMass) * 0.5;
  // 太陽の衝突判定（適正化した SUN_HIT_SCALE を適用）
  const sunHitSize = sunSize * hitScale;

  // 座標系の中心（ワールド座標 0, 0, 0）に絶対基準点として太陽を配置
  bodies.push({
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    mass: sunMass,
    size: sunSize,
    hitSize: sunHitSize,
    color: "white",
    name: "Sun",
    type: "sun",
    trail: []
  });

 /* -------------------------------------------------------
     惑星・小天体（Obj）生成ループ（3D幾何学・天体物理完全補正版）
     ------------------------------------------------------- */
  const setObj = (typeof settings !== "undefined") ? settings : {};

// 💡 【追加】initCount を安全に宣言・取得する（未定義エラーを100%防衛）
  const initCount = (typeof initialBodyCount !== "undefined")
    ? initialBodyCount
    : (setObj.initialBodyCount || 100);
  const S = setObj.spawnSettings || { minDist: 100, maxDist: 800, direction: "chaos" };
  const currentG = (typeof G !== "undefined" ? G : 1) * (setObj.gravityMultiplier || 1);
  const vMult = setObj.spawnVelocityMultiplier || 1.0;

  // 🛡️ 太陽（bodies[0]）の安全参照ガード
  const sun = (bodies && bodies[0]) ? bodies[0] : { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 1500 };

  for (let i = 0; i < initCount; i++) {
    // 💡 1. 3次元球面空間への【真の一様散布】ロジック（acosによる極集中回避）
    const angle1 = Math.random() * Math.PI * 2;              // 方位角 (0 ~ 2π)
    const angle2 = Math.acos((Math.random() * 2) - 1);       // 均一散布のための極角 (0 ~ π)
    const r = S.minDist + Math.random() * (S.maxDist - S.minDist);

    const x = sun.x + r * Math.sin(angle2) * Math.cos(angle1);
    const y = sun.y + r * Math.sin(angle2) * Math.sin(angle1);
    const z = sun.z + r * Math.cos(angle2);

    /* ---- 質量決定 ---- */
    const mass = setObj.useFixedObjMass
      ? setObj.objMass
      : ((typeof randomMass === "function") ? randomMass() : (0.5 + Math.random() * 2.5));

    // 太陽との距離ベクトル
    const dx = x - sun.x;
    const dy = y - sun.y;
    const dz = z - sun.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    /* ---- 初期速度（3D空間内での厳密な直交軌道速度計算） ---- */
    const effectiveMass = sun.mass + mass;
    const vBase = Math.sqrt(currentG * effectiveMass / dist);
    const v = vBase * vMult;

    /* ---- 回転方向 (side) の判定 ---- */
    const dirMode = S.direction || "chaos";
    let side = 1;
    if (dirMode === "direct") side = 1;
    else if (dirMode === "retro") side = -1;
    else if (dirMode === "split") side = (i % 2 === 0) ? 1 : -1;
    else if (dirMode === "chaos") side = Math.random() < 0.1 ? -1 : 1;

    // 💡 2. 3D空間上の位置ベクトルに対する完全直交接線ベクトルの算出
    // 位置ベクトル (dx, dy, dz) と Z軸単位ベクトルの外積により、周回接線方向を導出
    let tx = -dy;
    let ty = dx;
    let tz = 0;
    let tLen = Math.sqrt(tx * tx + ty * ty);

    // 真上（極付近）に配置された場合のゼロ割防止処理
    if (tLen < 0.0001) {
      tx = 1; ty = 0; tz = 0; tLen = 1;
    }

    // 単位接線ベクトル化
    const ux = (tx / tLen) * side;
    const uy = (ty / tLen) * side;
    const uz = (tz / tLen) * side;

    // 💡 3. 自然な揺らぎ（個体差 ±15% ＋ 動径方向への微小拡散）の付与
    const speedVariation = v * (0.85 + Math.random() * 0.3);
    const radialScale = (Math.random() - 0.5) * 0.2 * v;

    const vx = (sun.vx || 0) + ux * speedVariation + (dx / dist) * radialScale;
    const vy = (sun.vy || 0) + uy * speedVariation + (dy / dist) * radialScale;
    const vz = (sun.vz || 0) + uz * speedVariation + (dz / dist) * radialScale + (Math.random() - 0.5) * 0.1 * v;

    /* ---- 物理サイズと描画スケールの定義 ---- */
    const t = Math.min(1, dist / S.maxDist);
    const mToSize = (typeof massToSize === "function") ? massToSize : ((m) => Math.pow(m, 1/3) * 2);
        const physicalSize = mToSize(mass) * 0.7;
    const renderSize = physicalSize * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t);

    // 距離に応じたベースカラー計算
    const rCol = 180 + (255 - 180) * t;
    const gCol = 220 + (255 - 220) * t;
    const bCol = 255;

    bodies.push({
      x, y, z,
      vx, vy, vz,
      mass,
      size: physicalSize,        // 物理衝突用サイズ
      renderSize: renderSize,   // 描画専用サイズ
      color: `rgb(${rCol|0},${gCol|0},${bCol|0})`,
      name: "Obj" + i,
      type: "obj",
      trail: []
    });
  }





 /* -------------------------------------------------------
   【神の悪戯：極めてまれに発生する、Sunと同質量の単一異分子】
   ------------------------------------------------------- */
const EXTRA_SUN_CHANCE = 0.01; // 発生確率 1%

if (Math.random() < EXTRA_SUN_CHANCE) {
  const sun = bodies[0];

  if (sun) {
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const S = (typeof settings !== "undefined" && settings.spawnSettings) ? settings.spawnSettings : { minDist: 500, maxDist: 3000 };
    const r = S.minDist + Math.random() * (S.maxDist - S.minDist);

    const x = sun.x + r * Math.cos(angle1) * Math.sin(angle2);
    const y = sun.y + r * Math.sin(angle1) * Math.sin(angle2);
    const z = sun.z + r * Math.cos(angle2);

    const dist = Math.sqrt((x - sun.x)**2 + (y - sun.y)**2 + (z - sun.z)**2) || 1;
    const currentG = (typeof G !== "undefined" ? G : 1) * (typeof settings !== "undefined" ? settings.gravityMultiplier : 1);
    const vBase = Math.sqrt(currentG * sun.mass / dist);
        const vx = (sun.vx || 0) + (-(y - sun.y) / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vy = (sun.vy || 0) + ( (x - sun.x) / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vz = (sun.vz || 0) + (Math.random() - 0.5) * 2;

    bodies.push({
      x, y, z,
      vx, vy, vz,
      mass: sun.mass * 1.0,
      size: typeof massToSize === "function" ? massToSize(sun.mass) * 0.3 : 10,
      color: "#ff00ff",
      name: "Goliath",
      type: "planet",
      trail: []
    });

    console.log(" 観測開始：Sunと同等の質量を持つ異分子『Goliath』が配置された");
  }

   }
}


// 👑 彗星のID重複を防ぐためのグローバル通し番号カウンター（関数の外または安全なスコープに定義）
if (typeof window.cometSeqId === "undefined") {
  window.cometSeqId = 0;
}

function addComet() {
  const sun = bodies[0];
  if (!sun) return;

  const angle = Math.random() * Math.PI * 2;
  const tilt  = (Math.random() - 0.5) * 0.6;
  const distance = 800 + Math.random() * 2000;

  // 太陽の現在位置を基準に相対配置
  const x = sun.x + Math.cos(angle) * distance;
  const y = sun.y + Math.sin(angle) * distance;
  const z = sun.z + distance * tilt;

  // 👑 【仕様完全合致】質量0のテスト粒子として設定（他天体を引っ張らない）
  const mass = 0;
  const coreSize = 0.0001 + Math.random() * 0.001;

  // Sun 方向ベクトル
  const dx = sun.x - x;
  const dy = sun.y - y;
  const dz = sun.z - z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  const nx = dx / d;
  const ny = dy / d;
  const nz = dz / d;

  /* 直交ベクトル（スイングバイ用） */
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; az = 0; }

  let ox = ny * az - nz * ay;
  let oy = nz * ax - nx * az;
  let oz = nx * ay - ny * ax;

  const ol = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  ox /= ol; oy /= ol; oz /= ol;

  /* -------------------------------------------------------
     ★ 【スイングバイ最適化】
     主星（太陽）の質量と現在の G 定数から脱出速度を算出
     ------------------------------------------------------- */
  const primaryMass = sun.mass || 1500;
  const currentG = (typeof G !== "undefined" ? G : 1) * (typeof settings !== "undefined" ? settings.gravityMultiplier : 1);
    // 脱出速度のベース（太陽単体基準）
  const escapeSpeed = Math.sqrt((2 * currentG * primaryMass) / d) * 1.1;

  /* 3割：ニアミス落下 / 7割：大楕円スイングバイ */
  const isSwingBy = Math.random() < 0.7;
  let relVx, relVy, relVz;

  if (!isSwingBy) {
    // 太陽すれすれを掠める極限Uターン軌道
    const speed = escapeSpeed * 0.78;
    const fallRatio  = 0.96;
    const slantRatio = 0.04;

    relVx = (nx * fallRatio + ox * slantRatio) * speed;
    relVy = (ny * fallRatio + oy * slantRatio) * speed;
    relVz = (nz * fallRatio + oz * slantRatio) * speed;
  } else {
    // 大楕円を描いてゆっくり帰ってくる軌道
    const speedMultiplier = 0.65 + Math.random() * 0.15;
    const speed = escapeSpeed * speedMultiplier;

    const orbitRatio = 0.35 + Math.random() * 0.3;
    const towardRatio = Math.sqrt(1 - orbitRatio * orbitRatio);

    relVx = (nx * towardRatio + ox * orbitRatio) * speed;
    relVy = (ny * towardRatio + oy * orbitRatio) * speed;
    relVz = (nz * towardRatio + oz * orbitRatio) * speed;
  }

  /* -------------------------------------------------------
     ★ 太陽（主星）の慣性速度（sun.vx, sun.vy, sun.vz）を加算
     ------------------------------------------------------- */
  const vx = (sun.vx || 0) + relVx;
  const vy = (sun.vy || 0) + relVy;
  const vz = (sun.vz || 0) + relVz;

  /* リアル彗星のカラーリング */
  const rColor = Math.floor(40  + Math.random() * 80);
  const gColor = Math.floor(220 + Math.random() * 35);
  const bColor = Math.floor(140 + Math.random() * 80);
  const cometColor = `rgb(${rColor}, ${gColor}, ${bColor})`;

  // 👑 【ID重複バグ修正】通し番号インクリメントによる絶対ユニーク命名
  window.cometSeqId++;
  const cometName = "Comet" + window.cometSeqId;

  bodies.push({
    x, y, z,
    vx, vy, vz,
    mass,
    size: coreSize,
    renderSize: coreSize,
    color: cometColor,
    type: "comet",
    name: cometName,
    trail: []
  });
}


/* ============================
   Adjust Sun Velocity (Soft)
============================ */

/* ============================
   Collision Grid（build & detect）
============================ */
function buildCollisionGrid() {
  collisionGrid.clear();

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b) continue;

    const cx = Math.floor(b.x / CELL_SIZE);
    const cy = Math.floor(b.y / CELL_SIZE);
    const cz = Math.floor(b.z / CELL_SIZE);

    const key = `${cx}_${cy}_${cz}`;
    if (!collisionGrid.has(key)) {
      collisionGrid.set(key, []);
    }
    collisionGrid.get(key).push(i);
  }
}

/**
 * 👑 安全第一・高速判定関数（NaN の発生を完全に遮断）
 */
function isColliding(A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dz = B.z - A.z;
  const distSq = dx * dx + dy * dy + dz * dz;

  const rA = A.hitSize || A.size || A.radius || 1.0;
  const rB = B.hitSize || B.size || B.radius || 1.0;
    const scaleA = A.collisionScale || 1.0;
  const scaleB = B.collisionScale || 1.0;

  const radiusSum = (rA * scaleA) + (rB * scaleB);

  return distSq < (radiusSum * radiusSum);
}

/**
 * 👑 重複判定を防止しつつ既存描画を保護するグリッド衝突検出
 */
function detectCollisionsWithGrid() {
  const collisions = [];
  const processedPairs = new Set();

  for (let [key, list] of collisionGrid) {
    const [cx, cy, cz] = key.split("_").map(Number);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {

          const nKey = `${cx + dx}_${cy + dy}_${cz + dz}`;
          const neighbors = collisionGrid.get(nKey);
          if (!neighbors) continue;

          for (let i of list) {
            for (let j of neighbors) {
              if (i >= j) continue;

              const pairKey = `${i}_${j}`;
              if (processedPairs.has(pairKey)) continue;

              const A = bodies[i];
              const B = bodies[j];
              if (!A || !B) continue;

              if (isColliding(A, B)) {
                collisions.push([i, j]);
                processedPairs.add(pairKey);
              }
            }
          }
        }
      }
    }
  }

  return collisions;
}

// 👑 【完全復旧】リロード時、天体が空（0個）の場合にのみ安全に自動初期生成をキック
if (typeof generateBodies === "function" && (!window.bodies || window.bodies.length === 0)) {
  generateBodies();
}


/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 4: Physics Engine (update)
--------------------------------------------------------- */

function updateBodyCountDisplay() {
  let sunCount = 0, objCount = 0, cometCount = 0;

  for (let b of bodies) {
    if (b.name === "Sun") sunCount++;
    else if (b.type === "comet") cometCount++;
    else objCount++;
  }

  bodyCountDisplay.textContent =
    `Sun: ${sunCount} / Obj: ${objCount} / Comet: ${cometCount}`;
}

function updateTurnCountDisplay() {
  turnCountDisplay.textContent = `Turn: ${turnCount}`;
}



// ========================================================
// 【規律2】UI同期関数（Nullガード付き例外安全防壁）
// ========================================================
function updateStatsUI() {
  const elAlive = document.getElementById("statAlive");
  const elEscaped = document.getElementById("statEscaped");
  const elCollided = document.getElementById("statCollided");
  const elRemoved = document.getElementById("statRemoved");
  const elNaN = document.getElementById("statNaN");

  // 天体配列 bodies が存在する場合のみ安全に生存数を取得
  if (typeof bodies !== 'undefined' && bodies) {
    if (elAlive) elAlive.textContent = bodies.length;
  }

  // すべての要素が存在する場合のみ安全に書き換える（Nullガード）
  if (elEscaped) elEscaped.textContent = stats.escaped;
  if (elCollided) elCollided.textContent = stats.collided;
  if (elRemoved) elRemoved.textContent = stats.removed;
  if (elNaN) elNaN.textContent = stats.nanKilled;
}


/* ============================
   時間管理（FPS 非依存 dt）
============================ */
let lastTime = performance.now();

function computeDeltaTime() {
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  const targetFrame = 1 / 60;
  dt = dt * (0.2 / targetFrame);
  dt *= settings.simSpeed;
  dt = Math.min(dt, 1.0);

  return dt;
}

/* =========================================================
   物理更新 ＆ 統計排他制御 完全統合パイプライン（バグ完全消滅版）
========================================================= */
function updatePhysics(dt) {
  turnCount++;

  // 1. 冒頭でのSunの存在チェック
  let sun = bodies[0];
  if (!sun || sun.name !== "Sun") {
    const foundSun = bodies.find(b => b.name === "Sun");
    if (foundSun) sun = foundSun;
    else return;
  }

  // 2. NaN（非数）天体のパージ
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    if (isNaN(b.x) || isNaN(b.y) || isNaN(b.z) || isNaN(b.vx) || isNaN(b.vy) || isNaN(b.vz)) {
      if (b.name === "Sun") continue;
      if (typeof stats !== 'undefined') stats.nanKilled = (stats.nanKilled || 0) + 1;
      bodies.splice(i, 1);
    }
  }
  sun = bodies[0] || sun;

// ---------------------------------------------------------
  // 👑 【ここから下に続く重力計算ループ内に epsilon を適用】
  // ---------------------------------------------------------
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const b1 = bodies[i];
      const b2 = bodies[j];

      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dz = b2.z - b1.z;

      // 👑 【ここ！この行に + 144.0 を追加します】
      const epsilon = 12.0;
      const distSq = dx * dx + dy * dy + dz * dz + (epsilon * epsilon);

      // 以下、力（force）と加速度の更新処理...
    }
  }



// =======================================================
  // 👑 【★最優先修正★】巨星優先昇格ソート
  // 加速度配列(ax)を作る「前」に必ずソートし、インデックスのズレを100%防止！
  // =======================================================
  if (bodies.length > 1) {
    const sunNode = bodies[0];
    const otherNodes = bodies.slice(1).sort((a, b) => b.mass - a.mass);
    bodies = [sunNode, ...otherNodes];
  }

  // =======================================================
  // 3. ソート済みの最新 bodies に基づいて加速度配列を正確に確保
  // =======================================================
  const ax = new Array(bodies.length).fill(0);
  const ay = new Array(bodies.length).fill(0);
  const az = new Array(bodies.length).fill(0);

  for (let b of bodies) {
    b.willCollide = false;
    b.timeToCollision = 0;
  }

  // =======================================================
  // 🛡️ 【最優先修正】N-body 物理エンジン発火判定（完全防衛版）
  // settings.fullGravityThreshold を安全に数値化(Number)し、
  // 未定義や破壊時にはデフォルト「200」を強制適用して発火を100%保証！
  // =======================================================
  const threshold = (typeof settings !== "undefined" && settings.fullGravityThreshold !== undefined)
    ? Number(settings.fullGravityThreshold)
    : 200;

  // 100% 数値同士で安全に比較してフラグを確定
  const fullGravity = (bodies.length <= threshold);

  // 📡 発火の瞬間をコンソールでリアルタイム検知（デバッグ用ログ）
  if (fullGravity && !window._lastFullGravityState) {
    console.log(`%c 🚀 【物理エンジン発火】天体数が ${bodies.length} 個（閾値: ${threshold} 以下）に達したため、N-body 全重力モードへ昇格しました！`, "color: #00ff00; font-weight: bold; font-size: 14px;");
  }
  window._lastFullGravityState = fullGravity;


  // =======================================================
  // 4-A. 物理層1：Sun-only 重力（!fullGravity時）
  // =======================================================
  if (!fullGravity) {
    const isSunFixed = (typeof isSunPhysicallyFixed !== "undefined") ? isSunPhysicallyFixed : false;
    const PREDICTION_TIME_LIMIT = 15;

    for (let i = 1; i < bodies.length; i++) {
      const b = bodies[i];

      const dx = sun.x - b.x;
      const dy = sun.y - b.y;
      const dz = sun.z - b.z;

      const r2 = dx*dx + dy*dy + dz*dz + settings.eps2;
      const r = Math.sqrt(r2);
      if (r === 0) continue;
      const f = (G * settings.gravityMultiplier) / (r * r * r);

      b.vx += f * dx * sun.mass * dt;
      b.vy += f * dy * sun.mass * dt;
      b.vz += f * dz * sun.mass * dt;

      if (!isSunFixed) {
        sun.vx -= f * dx * b.mass * dt;
        sun.vy -= f * dy * b.mass * dt;
        sun.vz -= f * dz * b.mass * dt;
      }

      // 衝突直線予測
      const dvx = b.vx - sun.vx;
      const dvy = b.vy - sun.vy;
      const dvz = b.vz - sun.vz;
      const rSpeed2 = dvx*dvx + dvy*dvy + dvz*dvz;

      if (rSpeed2 > 0) {
        const tToClosest = -( (-dx)*dvx + (-dy)*dvy + (-dz)*dvz ) / rSpeed2;
        if (tToClosest > 0 && tToClosest < PREDICTION_TIME_LIMIT) {
          const cX = (-dx) + dvx * tToClosest;
          const cY = (-dy) + dvy * tToClosest;
          const cZ = (-dz) + dvz * tToClosest;
          const cDist = Math.sqrt(cX*cX + cY*cY + cZ*cZ);
          const cRadius = (sun.hitSize || sun.size || 5) + (b.hitSize || b.size || 5);
          if (cDist < cRadius * 1.5) {
            b.willCollide = true;
            b.timeToCollision = tToClosest;
            sun.willCollide = true;
          }
        }
      }
    }
  }

// =======================================================
  // 4-B. 物理層2：N-body Gravity（fullGravity時）
  // =======================================================
  if (fullGravity) {
    const PREDICTION_TIME_LIMIT = 3;

    // 🎯 UIスライダーで設定されたブースト倍率を取得（安全フォールバック: 1.0）
    const boost = (typeof settings !== "undefined" && settings.nbodyBoost !== undefined)
      ? Number(settings.nbodyBoost)
      : 1.0;

    for (let i = 0; i < bodies.length; i++) {
      const A = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const B = bodies[j];

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;

        const r2 = dx * dx + dy * dy + dz * dz + settings.eps2;
        const r = Math.sqrt(r2);
        if (r === 0) continue;

        // 🎯 物理法則 F = G*(m1*m2)/r^2 に可変ブースト倍率を適用
        const f = ((G * settings.gravityMultiplier) / (r * r * r)) * boost;

        ax[i] += f * B.mass * dx;
        ay[i] += f * B.mass * dy;
        az[i] += f * B.mass * dz;

        ax[j] -= f * A.mass * dx;
        ay[j] -= f * A.mass * dy;
        az[j] -= f * A.mass * dz;

        // (※ 以下、衝突予測等の処理)
   
        // 衝突直線予測
        const dvx = B.vx - A.vx;
        const dvy = B.vy - A.vy;
        const dvz = B.vz - A.vz;
        const rSpeed2 = dvx*dvx + dvy*dvy + dvz*dvz;

        if (rSpeed2 > 0) {
          const tToClosest = -(dx*dvx + dy*dvy + dz*dvz) / rSpeed2;
          if (tToClosest > 0 && tToClosest < PREDICTION_TIME_LIMIT) {
            const cX = dx + dvx * tToClosest;
            const cY = dy + dvy * tToClosest;
            const cZ = dz + dvz * tToClosest;
            const cDist = Math.sqrt(cX*cX + cY*cY + cZ*cZ);
            const cRadius = (A.hitSize || A.size || 5) + (B.hitSize || B.size || 5);
            if (cDist < cRadius * 1.5) {
              A.willCollide = true;
              A.timeToCollision = tToClosest;
              B.willCollide = true;
              B.timeToCollision = tToClosest;
            }
          }
        }
      }
    }
  }

  // =======================================================
  // 5. 速度の適用
  // =======================================================
  if (fullGravity) {
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].vx += ax[i] * dt;
      bodies[i].vy += ay[i] * dt;
      bodies[i].vz += az[i] * dt;
    }
  }

  // =======================================================
  // 6. 運動量保存のスタビライザー（重心補正）
  // =======================================================
  if (!(simulationState?.physics?.sunLocked || settings?.sunFixed) && sun) {
    let tX = 0, tY = 0, tZ = 0, tM = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      tX += b.vx * b.mass; tY += b.vy * b.mass; tZ += b.vz * b.mass; tM += b.mass;
    }
    if (tM > 0) {
      const vX = tX / tM, vY = tY / tM, vZ = tZ / tM;
      for (let i = 0; i < bodies.length; i++) {
        bodies[i].vx -= vX; bodies[i].vy -= vY; bodies[i].vz -= vZ;
      }
    }
  }


// ========================================================
// 🛡️ 199天体 相転移・動的エッジ検出器 (メモリ完全最適化版)
// ========================================================

if (typeof window.isPhaseTransitionTriggered === "undefined") {
    window.isPhaseTransitionTriggered = false;
}

function checkPhaseTransitionThreshold() {
    if (!bodies || !Array.isArray(bodies)) return;

    // 👑 【最適化】配列を作らず、高速な数値カウント（メモリ消費ゼロ）
    let currentAliveCount = 0;
    const len = bodies.length;
    for (let i = 0; i < len; i++) {
        const b = bodies[i];
        if (b && b.alive !== false && !b.isDead) {
            currentAliveCount++;
        }
    }

    // 2. 199個以下の閾値突破（エッジ検出）
    if (currentAliveCount <= 199 && !window.isPhaseTransitionTriggered) {
                // フラグをロック（重複発火防止）
        window.isPhaseTransitionTriggered = true;

        console.log(`%c ⚡ [相転移検知] 天体数が ${currentAliveCount} 個へ収束。199特有の制御システムを即時発火します！`, "color: #00ff88; font-weight: bold; font-size: 12px;");

        // 🎯 199個以下で起動させたい機能をここに記述
        if (typeof enablePhaseTransition === "function") {
            enablePhaseTransition();
        }
                // UI 側の表示更新トリガー
        const lvecBtn = document.getElementById("toggle-momentum-btn");
        if (lvecBtn) {
            lvecBtn.style.display = "inline-block";
        }
    }
    // 3. インジェクション等で再び200個以上に増えた場合の自動リセット処理
    else if (currentAliveCount > 199 && window.isPhaseTransitionTriggered) {
        window.isPhaseTransitionTriggered = false;
        console.log(`🪐 天体数が ${currentAliveCount} 個へ増加。199判定をリセットしました。`);
    }
}


// --------------------------------------------------------
// 🔄 毎フレームの更新ループ（update 関数等）の中で呼び出す
// --------------------------------------------------------
function updateSimulationStep() {
    // 既存の重力演算・衝突処理...
    // calculateGravity();
    // handleCollisions();

    // 🎯 毎フレーム、生存数をリアルタイム監視！
    checkPhaseTransitionThreshold();
}



// =======================================================
  // 🌀 空間抵抗・ガス減衰（完全 0 担保・安全改修版）
  // =======================================================
  // settings.orbitalDrag に数値が入っている場合のみその値を使い、
  // 未定義や0の場合は「絶対に 0（抵抗なし）」にします。
  const dragCoeff = (typeof settings !== "undefined" && typeof settings.orbitalDrag === "number")
    ? settings.orbitalDrag
    : 0;

  // dragCoeff が 0（または0以下）の時は、この減速計算を完全にスキップ！
  if (dragCoeff > 0) {
    for (let body of bodies) {
      if (body.name === "Sun" || body.type === "sun") continue;

      const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy + body.vz * body.vz);
   const dragFactor = Math.min(dragCoeff * speed * dt, 1.0); // 最大1.0（完全停止）で頭打ち

      body.vx -= body.vx * dragFactor * dt;
      body.vy -= body.vy * dragFactor * dt;
      body.vz -= body.vz * dragFactor * dt;
    }
  }

  // 位置の更新
  for (let b of bodies) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
  }

// -------------------------------------------------------
// 💥 衝突検出 ➔ 完全非弾性マージ ＆ 統計（Collided / Removed）同期
// -------------------------------------------------------
if (typeof buildCollisionGrid === "function") buildCollisionGrid();
if (typeof detectCollisionsWithGrid === "function") {
  const collisions = detectCollisionsWithGrid();
    // 👑 【多重衝突バグ防空】処理済みインデックスの記録用Set
  const processedIndices = new Set();

  for (let k = collisions.length - 1; k >= 0; k--) {
    const [i, j] = collisions[k];
    if (!bodies[i] || !bodies[j]) continue;

    // 👑 すでにこのフレームで合体消滅した天体は重複処理を絶対スキップ！
    if (processedIndices.has(i) || processedIndices.has(j)) continue;

    const A = bodies[i];
    const B = bodies[j];

    const rA = A.hitSize ?? A.size;
    const rB = B.hitSize ?? B.size;

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const dz = B.z - A.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist > rA + rB) continue;

    // 処理済みとしてロック
    processedIndices.add(i);
    processedIndices.add(j);

    const totalMass = A.mass + B.mass;
    const isSunCollision = (A.name === "Sun" || B.name === "Sun" || A.type === "sun" || B.type === "sun");

    // 📊 統計カウンター加算 ＆ DOMテキスト即時同期
    if (typeof stats !== 'undefined') {
      if (isSunCollision) {
        stats.collided++;
        const el = document.getElementById("statCollided");
        if (el) el.textContent = stats.collided;
      } else {
        stats.removed++;
        const el = document.getElementById("statRemoved");
        if (el) el.textContent = stats.removed;
      }
    }

    // 運動量保存法則に基づく完全非弾性合体（新天体の生成）
    const newBody = {
      x: (A.x * A.mass + B.x * B.mass) / totalMass,
      y: (A.y * A.mass + B.y * B.mass) / totalMass,
      z: (A.z * A.mass + B.z * B.mass) / totalMass,

      vx: (A.vx * A.mass + B.vx * B.mass) / totalMass,
      vy: (A.vy * A.mass + B.vy * B.mass) / totalMass,
      vz: (A.vz * A.mass + B.vz * B.mass) / totalMass,

      mass: totalMass,
      mergeCount: (A.mergeCount || 1) + (B.mergeCount || 1),

      renderSize: Math.min(4.0, 0.4 + 0.55 * Math.pow(totalMass, 0.30)),
            size: Math.cbrt((A.size**3) + (B.size**3)),
      hitSize: Math.cbrt((rA**3) + (rB**3)),

      name: (A.mass > B.mass ? A.name : B.name),
      color: (A.mass > B.mass ? A.color : B.color),
      type: (A.type === "sun" || B.type === "sun") ? "sun" : (A.mass > B.mass ? A.type : B.type),
      trail: []
    };

    if (isSunCollision) {
      window.sunEventLogs = window.sunEventLogs || [];

      const sunObj = (A.name === "Sun" || A.type === "sun") ? A : B;
      const targetObj = (A === sunObj) ? B : A;

      if (targetObj) {
        const relVx = (targetObj.vx || 0) - (sunObj.vx || 0);
        const relVy = (targetObj.vy || 0) - (sunObj.vy || 0);
        const relVz = (targetObj.vz || 0) - (sunObj.vz || 0);
        const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz).toFixed(1);

        const massStr = Number(targetObj.mass || targetObj.size || 1.0).toFixed(1);
        const nameStr = targetObj.name || `Obj_${targetObj.id || 'Unknown'}`;

        const logLine = `[EVENT] SUN CONSUMED ${nameStr} | Mass: +${massStr} | RelSpeed: ${relSpeed} km/s`;

        window.sunEventLogs.push(logLine);
        if (window.sunEventLogs.length > 5) {
          window.sunEventLogs.shift();
        }
      }

      newBody.name = "Sun";
      newBody.color = "white";
      newBody.size = (typeof massToSize === "function") ? massToSize(newBody.mass) * 0.5 : newBody.size;
      newBody.renderSize = newBody.size;
      newBody.hitSize = newBody.size * (typeof SUN_HIT_SCALE !== "undefined" ? SUN_HIT_SCALE : 1.5);

      if (A.name === "Sun") newBody.trail = [...A.trail];
      if (B.name === "Sun") newBody.trail = [...B.trail];
    }

    const a = Math.max(i, j);
    const b = Math.min(i, j);
    bodies.splice(a, 1);
    bodies.splice(b, 1);
    bodies.push(newBody);
  }
}

// 太陽（Sun）を常に bodies[0] へ再配置
const sunIndex = bodies.findIndex(b => b.name === "Sun" || b.type === "sun");
if (sunIndex > 0) {
  const s = bodies.splice(sunIndex, 1)[0];
  bodies.unshift(s);
}

// -------------------------------------------------------
// 彗星の動的自動追加（Zero-Allocation高速カウント化）
// -------------------------------------------------------
let currentCometCount = 0;
for (let i = 0; i < bodies.length; i++) {
  if (bodies[i] && bodies[i].type === "comet") currentCometCount++;
}
if (currentCometCount < 5 && Math.random() < 0.002) {
  if (typeof addComet === "function") addComet();
}

// -------------------------------------------------------
// 🌌 外宇宙境界センサー（脱出・遠方到達の排他判定 ＆ 統計同期）
// -------------------------------------------------------
const removeLimit = (typeof maxDistanceSq !== "undefined") ? Math.sqrt(maxDistanceSq) : 10000;
const vEscapeSq = (typeof vEscapeLimitSq !== "undefined") ? vEscapeLimitSq : 1000000;

// 👑 【即死防止】太陽オブジェクトを安全に確保
const currentSun = bodies[0] || { x: 0, y: 0, z: 0 };

for (let i = bodies.length - 1; i >= 0; i--) {
  const b = bodies[i];
  if (!b || b.name === "Sun" || b.type === "sun") continue; // 太陽は絶対にパージしない

  const dx = b.x - currentSun.x;
  const dy = b.y - currentSun.y;
  const dz = b.z - currentSun.z;
  const distSq = dx*dx + dy*dy + dz*dz;
  const speedSq = b.vx*b.vx + b.vy*b.vy + b.vz*b.vz;

  // 💡 判定①：脱出速度オーバー（Escaped）
  if (speedSq > vEscapeSq) {
    if (typeof stats !== 'undefined') {
      stats.escaped++;
      const el = document.getElementById("statEscaped");
      if (el) el.textContent = stats.escaped;
    }
    bodies.splice(i, 1);
    continue;
  }

  // 💡 判定②：距離限界オーバー（Removed）
  if (distSq > removeLimit * removeLimit) {
    if (typeof stats !== 'undefined') {
      stats.removed++;
      const el = document.getElementById("statRemoved");
      if (el) el.textContent = stats.removed;
    }
    bodies.splice(i, 1);
    continue;
  }
}

// -------------------------------------------------------
// 📊 UIデータ ＆ 生存天体数（Alive）の100%同期
// -------------------------------------------------------
const elAlive = document.getElementById("statAlive");
if (elAlive) elAlive.textContent = bodies.length;

if (typeof updateSunSpeedDisplay === 'function') updateSunSpeedDisplay();
if (typeof updateBodyCountDisplay === 'function') updateBodyCountDisplay();
if (typeof updateTurnCountDisplay === 'function') updateTurnCountDisplay();
if (typeof updateStatsUI === 'function') updateStatsUI();
}


/* =========================================================
   【世界観統一】離心率完全バインド・カラーエンジン（トーン調整版）
   ========================================================= */
function getThermalColor(b, maxVelocityExpected) {
  if (!b) return "#2b3a67"; // 🛡️ 安全防護：天体がNULLの場合はインディゴブルーを即返却

  // 💡 針のエンジンで計算され、天体に記憶された「離心率カラー」を直撃ロード！
  const finalColor = b.eccColor || "#2b3a67";

  return finalColor;
}

/* =========================================================
   👑 軌跡・軌道判定エンジン（完全最適化 ＆ ゼロ・アロケーション版）
   ========================================================= */
function updateTrails(dt) {
  if (!Array.isArray(bodies)) return;

  // 🛡️ 太陽の安全な検索
  const sun = bodies[0] && (bodies[0].name === "Sun" || bodies[0].type === "sun")
    ? bodies[0]
    : bodies.find(b => b && (b.name === "Sun" || b.type === "sun"));
    if (!sun) return;

  const currentG = (typeof G !== 'undefined') ? G : (settings.G || 1.0);
  const gravMult = settings.gravityMultiplier || 1.0;
  const sunMass = sun.mass || 1500;
  const eps2 = settings.eps2 || 0;
  const count = bodies.length;

  const densityMultiplier = (count >= 300) ? 0.3 : 1.0;
  const lengthMult = (typeof settings !== "undefined" && settings.trailLengthMultiplier) ? settings.trailLengthMultiplier : 1.0;

  // ハードキャップ値の事前計算（ループ外へ切り出して毎フレームの条件分岐を削減）
  let maxCap = 500;
  if (count > 3000) maxCap = 10;
  else if (count > 1500) maxCap = 25;
  else if (count > 500) maxCap = 50;

  for (let i = 0; i < count; i++) {
    const b = bodies[i];
    if (!b) continue;

    const isSun = (b.name === "Sun" || b.type === "sun");

    // 1. 太陽相対位置・距離の一括演算（自乗和の再計算を防止）
    const sx = b.x - sun.x;
    const sy = b.y - sun.y;
    const sz = b.z - sun.z;
    const distSq = sx * sx + sy * sy + sz * sz;
    const distFromSun = Math.sqrt(distSq);
    b.distance = distFromSun;

    // 2. 描画カラーのサンプリング
    if (!isSun) {
      b.drawColor = (typeof getThermalColor === "function") ? getThermalColor(b, 150.0) : (b.eccColor || "#2b3a67");
    } else {
      b.drawColor = "rgba(255, 255, 255, 0.9)";
    }

    // 3. 周回判定（軌道エネルギー計算）
    if (!isSun) {
      if (b.isOrbiting === undefined) b.isOrbiting = false;

      const r = Math.sqrt(distSq + eps2);
      const dvx = b.vx - sun.vx;
      const dvy = b.vy - sun.vy;
      const dvz = b.vz - sun.vz;
      const v2 = dvx * dvx + dvy * dvy + dvz * dvz;

      const E = 0.5 * v2 - (currentG * gravMult * sunMass) / (r || 1);

      if (!b.isOrbiting && E < 0) b.isOrbiting = true;

      // 👑 非周回かつ彗星でない場合は軌跡をクリアして計算をスキップ
      if (b.type !== "comet" && !b.isOrbiting) {
        if (b.trail) b.trail.length = 0; // インプレースクリア（配列を再作成しない）
        continue; // 描画不要のため、3D投影や上限計算をスキップして即次天体へ
      }
    } else {
      b.isOrbiting = true;
    }

    // 4. ハイブリッドデータ構造への追加
    if (!b.trail) b.trail = [];

    const rCurrent = (typeof rotate3D === "function") ? rotate3D(b) : { x: b.x, y: b.y, z: b.z };
    const prCurrent = (typeof project3D === "function") ? project3D(rCurrent.x, rCurrent.y, rCurrent.z) : { x: 0, y: 0 };

    b.trail.push({
      wx: b.x, wy: b.y, wz: b.z,
      sx: prCurrent.x, sy: prCurrent.y,
      color: b.eccColor || b.drawColor || b.color || "#00a2ff"
    });

    // 5. 🎯 軌跡の上限（effectiveLimit）の一元決定
    let effectiveLimit;

    if (isSun) {
      // ☀️ 太陽専用の保護ロジック（少人数・大人数問わず統一）
      effectiveLimit = Math.max(1000, 2000 * lengthMult * densityMultiplier);
    } else if (count <= 15) {
      // ① 少人数モード（一般天体）
      effectiveLimit = 800;
    } else {
      // ② 大人数・通常モード（一般天体）
      if (b.isOrbiting) {
        effectiveLimit = 800 * lengthMult * densityMultiplier;
      } else {
        effectiveLimit = Math.min(
          600 * lengthMult * densityMultiplier,
          Math.max(40, distFromSun * 8 * lengthMult * densityMultiplier) // sqrt(dist)の代わりにそのまま使用して高速化
        );
      }
      effectiveLimit = Math.min(effectiveLimit, maxCap);
    }

    // 6. パージ処理
    while (b.trail.length > effectiveLimit) {
      b.trail.shift();
    }
  }
}





/**
 * OrbitCam の角度更新（太陽完全ロックオン・座標系適合版）
 */
function updateOrbitCam(dt) {
  if (!camera || !camera.isOrbitCam) return;

  const target = bodies[camera.targetBodyIndex];

  // 1. 生存チェック：ターゲット（乗っている天体）がいなければ即座に停止
  if (!target) {
    if (typeof deactivateOrbitCam === "function") deactivateOrbitCam();
    const btn = document.getElementById("btnOrbitCam");
    if (btn) {
      btn.classList.add("toggle-off");
      btn.classList.remove("toggle-on");
    }
    return;
  }

  // 👑 2. 太陽（Sun）の絶対的・安全な検索（bodies[0] 決め打ちの排除）
  const sun = (bodies[0] && (bodies[0].name === "Sun" || bodies[0].type === "sun"))
    ? bodies[0]
    : bodies.find(b => b && (b.name === "Sun" || b.type === "sun"));

  if (!sun) return;

  // 3. ターゲット自身が太陽の場合は特異点（計算破綻）を回避
  if (target === sun) return;

  // =======================================================
  // 【幾何学の執行】ターゲット天体から太陽へ向かう相対ベクトル
  // =======================================================
  const dx = sun.x - target.x;
  const dy = sun.y - target.y;
  const dz = sun.z - target.z;

  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // ゼロ除算・極近接のガード
  if (horizontalDist < 0.00001 && Math.abs(dy) < 0.00001) return;

  // =======================================================
  // 👑 【視線完全ロック】3Dカメラ座標系（-Z軸奥向き標準）への位相補正
  // =======================================================
  // Y軸回転（Yaw）: -dz と dx の関係から照準角を正確に抽出
  const targetRotY = Math.atan2(dx, -dz);

  // X軸回転（Pitch）: 仰角の符号整合
  const targetRotX = Math.atan2(dy, horizontalDist);

  // 毎フレームカメラパラメータへ直撃代入
  camera.rotY = targetRotY;
  camera.rotX = targetRotX;
}

/**
 * カメラレイヤー全体の更新（メインパイプライン）
 */
function updateCamera(dt) {
  const oldRotX = camera.rotX;
  const oldRotY = camera.rotY;
  const oldOffsetX = camera.offsetX;
  const oldOffsetY = camera.offsetY;

  // ① OrbitCamの角度更新（太陽ロックオン）を最優先で実行
  updateOrbitCam(dt);

  // ② 自動回転の執行
  if (window.isAutoRotateEnabled && !camera.isOrbitCam && camera.orbitRadius !== 0) {
    camera.rotY += (camera.autoRotateSpeed || 0.005) * (dt || 1);
  }

  // ③ 車載モード（距離0）の時は、2Dオフセットを完全リセットして即座に終了
  if (camera.isOrbitCam && camera.orbitRadius === 0) {
    camera.offsetX = 0;
    camera.offsetY = 0;
    if (camera.rotX !== oldRotX || camera.rotY !== oldRotY) {
      cameraChanged = true;
    }
    return;
  }

  // ④ 変更通知の起立
  if (
    camera.rotX !== oldRotX ||
    camera.rotY !== oldRotY ||
    camera.offsetX !== oldOffsetX ||
    camera.offsetY !== oldOffsetY
  ) {
    cameraChanged = true;
  }
}

/**
 * OrbitCam用：周回対象となる天体を検索する関数
 */
function pickOrbitTarget(bodies, sun, type) {
  if (!bodies || bodies.length <= 1) return null;

  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    if (b && b.type === type) {
      b.index = i;
      return b;
    }
  }
  return null;
}

/**
 * OrbitCam 起動（車載・オンボードカメラ仕様）
 */
function activateOrbitCam() {
  const target =
    pickOrbitTarget(bodies, bodies[0], "obj") ||
    pickOrbitTarget(bodies, bodies[0], "comet");

  if (!target) return;

  camera.targetBodyIndex = target.index;
  camera.orbitRadius = 0; // 車載モード

  window.isAutoRotateEnabled = false;
    const camToggleBtn = document.getElementById("btnToggleRotate");
  if (camToggleBtn) {
    camToggleBtn.classList.add("toggle-off");
    camToggleBtn.classList.remove("toggle-on", "active");
  }

  camera.orbitTheta = camera.rotY;
  camera.orbitPhi   = camera.rotX;
  camera.isOrbitCam = true;

  const btn = document.getElementById("btnOrbitCam");
  if (btn) {
    btn.classList.remove("toggle-off");
    btn.classList.add("toggle-on", "active");
  }

  const targetHud = document.getElementById("orbitTargetDisplay");
  if (targetHud) {
    targetHud.textContent = `ONBOARD: ${target.name || "INNER"}`;
    targetHud.style.display = "block";
  }
}

/**
 * OrbitCam 停止（自由視点への帰還）
 */
function deactivateOrbitCam() {
  camera.isOrbitCam = false;
  camera.targetBodyIndex = 0;
  camera.orbitRadius = (typeof BASE_DISTANCE !== "undefined") ? BASE_DISTANCE : 1000;

  const btn = document.getElementById("btnOrbitCam");
  if (btn) {
    btn.classList.remove("toggle-on", "active");
    btn.classList.add("toggle-off");
  }

  const targetHud = document.getElementById("orbitTargetDisplay");
  if (targetHud) {
    targetHud.style.display = "none";
  }

  // 👑 【重複コードの全排除】軌跡（Trail）キャッシュの一括インプレースクリア
  if (Array.isArray(bodies)) {
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i] && bodies[i].trail) {
        bodies[i].trail.length = 0; // メモリ再割り当てを防止するZero-Allocationクリア
      }
    }
  }

  cameraChanged = true;
  console.log("OrbitCam: 自由視点に復帰し、軌跡のゴースト線をクリアしました。");
}

// ウィンドウリサイズ、またはF12開閉時のイベントハンドラ内
window.addEventListener('resize', () => {
  // 1. まずCanvasの物理サイズを確定させる
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 🌟 スマート・プロジェクションへ「画面サイズ変更」を通知
  cameraChanged = true;

  // 2. 画面中心定数を参照している場合の非同期防止（必要に応じて有効化）
  if (typeof centerX !== 'undefined') centerX = canvas.width / 2;
  if (typeof centerY !== 'undefined') centerY = canvas.height / 2;

  // 👑 3. 【Zero-Allocation】既存配列を破棄せずインプレースクリア（GCスパイク防止）
  if (Array.isArray(bodies)) {
    const len = bodies.length;
    for (let i = 0; i < len; i++) {
      const b = bodies[i];
      if (b && Array.isArray(b.trail)) {
        b.trail.length = 0; // メモリを再確保せずに中身だけを即座に空にする
      }
    }
  }
});





/* =========================================================
   Utility / Save / Load (完全防衛・完全同期・データ欠落ゼロ版)
========================================================= */
function saveUniverse(slot) {
  if (!Array.isArray(bodies)) return;

  const data = {
    settings: (typeof structuredClone === "function") ? structuredClone(settings) : JSON.parse(JSON.stringify(settings)),
    stats: (typeof stats !== 'undefined' && stats) ? structuredClone(stats) : null,
        // 💡 時間軸データの保存
    elapsedTime: (typeof simulationState !== 'undefined') ? simulationState.elapsedTime : 0,
    realAccumulatedTime: window.realAccumulatedTime || 0,
    turnCount: typeof turnCount !== 'undefined' ? turnCount : 0,

    // 👑 【完全防衛】描画・物理に必要なすべての動的プロパティを漏らさず保存
    bodies: bodies.map(b => ({
      x: b.x,
      y: b.y,
      z: b.z,
      vx: b.vx,
      vy: b.vy,
      vz: b.vz,
      mass: b.mass,
      size: b.size,
      hitSize: b.hitSize,
      renderSize: b.renderSize ?? b.size, // 👈 描画サイズの完全保持
      mergeCount: b.mergeCount || 1,       // 👈 統計合体数の保持
      color: b.color,
      drawColor: b.drawColor,
      eccColor: b.eccColor || null,        // 👈 離心率カラーの保持
      type: b.type,
      name: b.name,
      isOrbiting: b.isOrbiting ?? false
    }))
  };

  try {
    localStorage.setItem("universeSave_" + slot, JSON.stringify(data));
    console.log("Universe Saved Successfully:", slot);
  } catch (e) {
    console.error("Save Failed (QuotaExceededError or Invalid Data):", e);
  }
}

function loadUniverse(slot) {
  const raw = localStorage.getItem("universeSave_" + slot);
  if (!raw) {
    console.warn("No Save Data Found in Slot:", slot);
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Parse Save Data Failed:", e);
    return;
  }

  // 1. 設定データの復元 ＆ フォールバック構造の安全保障
  if (data.settings) {
    const loadedSettings = (typeof structuredClone === "function") ? structuredClone(data.settings) : JSON.parse(JSON.stringify(data.settings));
    Object.assign(settings, loadedSettings);
        if (!settings.spawnSettings) {
      settings.spawnSettings = { minMass: 1, maxMass: 10, minDist: 500, maxDist: 3000, direction: "chaos" };
    }
  }

  // 2. 統計カウンターの復元
  if (data.stats && typeof stats !== 'undefined') {
    Object.assign(stats, data.stats);
  }

  // 3. 時間軸データの復元
  if (typeof simulationState !== 'undefined' && data.elapsedTime !== undefined) {
    simulationState.elapsedTime = data.elapsedTime;
  }
  if (data.realAccumulatedTime !== undefined) {
    window.realAccumulatedTime = data.realAccumulatedTime;
  }
  if (data.turnCount !== undefined && typeof turnCount !== 'undefined') {
    turnCount = data.turnCount;
  }

  // 4. 天体配列のインプレース再構築
  bodies.length = 0;
  if (Array.isArray(data.bodies)) {
    for (const b of data.bodies) {
      bodies.push({
        ...b,
        renderSize: b.renderSize ?? b.size, // 古いセーブデータに対するフォールバック
        trail: [] // 軌跡のゴースト線を防ぐため空配列で初期化
      });
    }
  }

  // 👑 5. Sun を配列の先頭 (0番目) に確定復元（判定条件の完全同期）
  const sunIndex = bodies.findIndex(b => b && (b.name === "Sun" || b.type === "sun"));
  if (sunIndex > 0) {
    const sun = bodies.splice(sunIndex, 1)[0];
    bodies.unshift(sun);
  }

  // =====================================
  // 🛡️ UIの安全同期執行（Nullガード付き）
  // =====================================
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; };

  setVal("objMass", settings.objMass);
  setVal("objMassInput", settings.objMass);
  setCheck("useFixedObjMass", settings.useFixedObjMass);

  if (settings.spawnSettings) {
    setVal("spawnMinMass", settings.spawnSettings.minMass);
    setVal("spawnMaxMass", settings.spawnSettings.maxMass);
    setVal("spawnMinDist", settings.spawnSettings.minDist);
    setVal("spawnMaxDist", settings.spawnSettings.maxDist);

    const dirEl = document.getElementById("spawnDirection");
    if (dirEl) {
      if (!settings.spawnSettings.direction) settings.spawnSettings.direction = "chaos";
      dirEl.value = settings.spawnSettings.direction;
    }
  }

  setVal("gravitySlider", settings.gravityMultiplier);
  setVal("speedSlider", settings.simSpeed);
  setText("speedLabel", (settings.simSpeed || 1.0).toFixed(1));
  setVal("eps2Input", settings.eps2);
  setVal("nbodyThreshold", settings.fullGravityThreshold);

  // 🛡️ イベントハンドラ配線
  const nbodyThresholdEl = document.getElementById("nbodyThreshold");
  if (nbodyThresholdEl) {
    nbodyThresholdEl.oninput = e => {
      settings.fullGravityThreshold = Math.max(1, Number(e.target.value));
    };
  }

  // HUD & 死亡統計表示の完全同期
  if (typeof updateBodyCountDisplay === 'function') updateBodyCountDisplay();
  if (typeof updateTurnCountDisplay === 'function') updateTurnCountDisplay();
  if (typeof updateSimTimeUI === 'function') updateSimTimeUI();
  if (typeof updateStatsUI === 'function') updateStatsUI();

  // 投影再計算の強制通知
  if (typeof cameraChanged !== "undefined") cameraChanged = true;

  console.log("Universe Loaded Successfully:", slot);
}




/* =========================================================
   1. メイン描画コントロール（完全 Zero-Allocation ＆ 超高速 LOD 版）
   ========================================================= */

// 👑 【完全Zero-Allocation】ラッパーオブジェクトの事前プール確保
let renderSortBuffer = [];

function renderScene() {
  // 1. キャンバスの初期化
  ctx.clearRect(0, 0, W, H);

  const sun = bodies[0];
  if (!sun) return;

  // 背景の固定星空を描画
  if (typeof drawBackgroundStars === "function") drawBackgroundStars();

  const totalCount = bodies.length;

  // ---------------------------------------------------------
  // 🎛️ 500個刻みの「段階的描画精度 (LOD)」レベル決定
  // ---------------------------------------------------------
  let lodLevel = 4;
  if (totalCount > 2500)      lodLevel = 0;
  else if (totalCount > 2000) lodLevel = 1;
  else if (totalCount > 1500) lodLevel = 2;
  else if (totalCount > 1000) lodLevel = 3;

  if (simulationState?.ui?.vectorFieldOnly) lodLevel = 0;
  const hideVectorText = lodLevel <= 1;

  // ---------------------------------------------------------
  // 🚀 Z深度ソートの超高速化（オブジェクトプール構造でメモリ生成 0 Byte）
  // ---------------------------------------------------------
  if (renderSortBuffer.length !== totalCount) {
    const oldLen = renderSortBuffer.length;
    renderSortBuffer.length = totalCount;
    // 不足分のみ固定オブジェクト構造を事前に確保（使い回し）
    for (let i = oldLen; i < totalCount; i++) {
      renderSortBuffer[i] = { b: null, r: { x: 0, y: 0, z: 0 }, pr: null };
    }
  }

  for (let i = 0; i < totalCount; i++) {
    const b = bodies[i];
    const slot = renderSortBuffer[i];
    slot.b = b;
    // インプレース座標代入により新しいオブジェクトを一切作らない
    if (typeof rotate3D === "function") {
      const rot = rotate3D(b);
      slot.r.x = rot.x; slot.r.y = rot.y; slot.r.z = rot.z;
    } else {
      slot.r.x = b.x; slot.r.y = b.y; slot.r.z = b.z;
    }
  }

  // 代入済みの構造体をそのまま Z 昇順ソート
  renderSortBuffer.sort((a, b) => a.r.z - b.r.z);

  // ---------------------------------------------------------
  // 【第1階層ループ】天体の描画（LODレベルに応じた分岐）
  // ---------------------------------------------------------
  for (let i = 0; i < totalCount; i++) {
    const obj = renderSortBuffer[i];
    const pr = project3D(obj.r.x, obj.r.y, obj.r.z);
    obj.pr = pr; // 👑 後続の第3階層（ラベル描画）のために投影結果をキャッシュ！

    if (!pr.visible) continue;

    const isSunObj = (obj.b === sun || obj.b.type === "sun");

    // =========================================================
    // 🌌 LOD 0 (3000～2500個): 超過密ドットのみ (最軽量)
    // =========================================================
    if (lodLevel === 0 && !isSunObj) {
      ctx.fillStyle = obj.b.eccColor || "#ffffff";
      ctx.fillRect((pr.x - 0.5) | 0, (pr.y - 0.5) | 0, 1.0, 1.5);
      continue;
    }

    // =========================================================
    // ⚡ LOD 1 (2500～2000個): 固有色ドット ＋ 針（角運動量）
    // =========================================================
    if (lodLevel === 1 && !isSunObj) {
      ctx.fillStyle = obj.b.eccColor || "#ffffff";
      ctx.fillRect((pr.x - 0.75) | 0, (pr.y - 0.75) | 0, 1.5, 1.5);

      if (typeof lvecMode !== "undefined" && lvecMode > 0) {
        drawAngularMomentumVectorDirect2D(obj.b, sun, pr, hideVectorText);
      }
      continue;
    }

    // =========================================================
    // 🎨 LOD 2～4 (2000個以下 ＆ 太陽): 段階的フルパーツ描画
    // =========================================================
    const trailColor = (typeof getTrailColor === "function") ? getTrailColor(obj.b, sun) : (obj.b.color || "#ffffff");
    const screenSize = (typeof calculateScreenSize === "function") ? calculateScreenSize(obj.b, pr) : (obj.b.renderSize || 2);

    const depth = pr.depth || obj.r.z;
    const Z_NEAR = 3000;
    const Z_FAR  = 6000;

    // 1. 軌跡（Trail）描画
    if (isSunObj) {
      drawBodyTrails(obj.b, trailColor, 1.0, 1.0);
    } else if (depth < Z_FAR && lodLevel >= 3) {
      let trailAlpha = 1.0;
      let trailRatio = 1.0;

      if (depth > Z_NEAR) {
        const progress = (depth - Z_NEAR) / (Z_FAR - Z_NEAR);
        trailAlpha = 1.0 - progress * 0.7;
        trailRatio = 1.0 - progress * 0.7;
      }

      drawBodyTrails(obj.b, trailColor, trailAlpha, trailRatio);
    }

    // 2. 彗星の尾（Comet Tail）描画
    if (!isSunObj && depth < Z_FAR && lodLevel >= 2) {
      if (typeof drawCometTail === "function") drawCometTail(obj.b, sun);
    }

    // 3. 天体本体（コア）描画
    if (typeof drawBodyCore === "function") drawBodyCore(obj.b, pr, sun, screenSize);

    // 4. 針（角運動量ベクトル）描画
    if (typeof lvecMode !== "undefined" && lvecMode > 0 && !isSunObj) {
      drawAngularMomentumVectorDirect2D(obj.b, sun, pr, hideVectorText);
    }
  }

  // ---------------------------------------------------------
  // 【第2階層】レーダーピザ
  // ---------------------------------------------------------
  if (typeof lvecMode !== "undefined" && lvecMode === 2) {
    if (typeof drawLVecAreaRadar === "function") drawLVecAreaRadar(bodies, sun, targetHistory);
  } else if (typeof targetHistory !== "undefined" && targetHistory) {
    targetHistory.length = 0;
  }

  // ---------------------------------------------------------
  // 【第3階層】HUD・名前ラベル（LOD 4 = 1000個以下でのみ解禁）
  // ---------------------------------------------------------
  if (lodLevel >= 4 && simulationState?.ui?.showNames) {
    const mode = simulationState.ui.nameMode !== undefined ? simulationState.ui.nameMode : 3;

    for (let i = 0; i < totalCount; i++) {
      const obj = renderSortBuffer[i];
      const isEncountering = obj.b.isEncountering || false;

      if (!isEncountering) {
        if (mode === 1 && obj.b.type !== "obj") continue;
        if (mode === 2 && obj.b.type !== "comet") continue;
      }

      // 👑 キャッシュされた投影結果を再利用（二重計算を完全回避）
      const pr = obj.pr;
      if (!pr || !pr.visible) continue;

      const screenSize = (typeof calculateScreenSize === "function") ? calculateScreenSize(obj.b, pr) : 2;
      if (typeof drawBodyLabel === "function") drawBodyLabel(obj.b, pr, screenSize);
    }
  }

  // ---------------------------------------------------------
  // 【第4階層】システムHUD
  // ---------------------------------------------------------
  if (typeof drawGravityCenterOfTop2 === "function") drawGravityCenterOfTop2(renderSortBuffer);

  if (typeof isDeveloperHUDActive !== "undefined" && isDeveloperHUDActive) {
    if (typeof drawScreenHUD === "function") drawScreenHUD();
  }
}

/**
 * 🌌 距離に応じた天体サイズの動的減衰・LOD制御ヘルパー
 * ★【Zero-Allocation ＆ renderSize 完全バインド版】
 * @param {Object} b 天体オブジェクト
 * @param {Object} pr project3D の返り値 { x, y, depth, scaleFactor, visible }
 * @param {Object} targetStyle 書き込み先の固定オブジェクト（省略時は参照天体へ代入）
 * @returns {Object} { screenSize, isDotMode, alpha }
 */
function getAdaptiveBodyStyle(b, pr, targetStyle) {
  const depth = pr.depth || 0;
  const FAR_THRESHOLD = 5000;
  const MAX_DISTANCE  = 10000;

  const isSun = (b.name === "Sun" || b.type === "sun");

  // 1. ドットモードの判定（太陽は絶対にドット化させない）
  const isDotMode = !isSun && (depth > FAR_THRESHOLD);

  // 2. 画面上の物理サイズの算出（b.renderSize を最優先参照）
  const baseSize = b.renderSize ?? b.size ?? 2.0;
  let screenSize = baseSize * (pr.scaleFactor || 1.0);

  // 3. 遠方減衰および透明度計算
  let alpha = 1.0;

  if (!isSun && depth > FAR_THRESHOLD) {
    const progress = Math.min(1.0, (depth - FAR_THRESHOLD) / (MAX_DISTANCE - FAR_THRESHOLD));
    const shrinkFactor = Math.max(0.2, 1.0 - progress);
        screenSize *= shrinkFactor;
    alpha = Math.max(0.15, 1.0 - progress);
  }

  // 👑 【Zero-Allocation】新規オブジェクトを作らず、指定先または天体キャッシュへ数値をインプレース代入
  const out = targetStyle || (b._styleCache = b._styleCache || { screenSize: 0, isDotMode: false, alpha: 1.0 });

  out.screenSize = Math.max(1.0, screenSize);
  out.isDotMode  = isDotMode;
  out.alpha      = alpha;

  return out;
}


/**
 * 天体の3D角運動量を物理的に正しく計算し、完全追従するリアル3Dベクトル描画
 * 👑【投影重畳計算削除 ＆ 超高速化版】
 */
/**
 * 天体の3D角運動量を物理的に正しく計算し、完全追従するリアル3Dベクトル描画
 * 👑【完全 Zero-Allocation ＆ 3D投影半減・超高速版】
 */

// 👑 【Zero-Allocation】回転演算用の固定一時スロット
const vec3DTemp = { x: 0, y: 0, z: 0 };

/**
 * 👑【最速・極細シャープ版】角運動量ベクトル(2D)直描エンジン
 * 0 Byte/frame 維持 ＆ サブピクセル滲み（太さ）を物理切断
 */
function drawAngularMomentumVectorDirect2D(b, sun, pr, hideText = false) {
  if (!b || !sun || !pr || isNaN(pr.x) || isNaN(pr.y)) return;

  const SENSITIVITY = 1.5;
  const MIN_LENGTH  = 0;
  const MAX_LENGTH  = 1000;

  // 1. 相対位置 r ＆ 相対速度 v
  const rx = b.x - sun.x;
  const ry = b.y - sun.y;
  const rz = b.z - sun.z;

  const vx = (b.vx || 0) - (sun.vx || 0);
  const vy = (b.vy || 0) - (sun.vy || 0);
  const vz = (b.vz || 0) - (sun.vz || 0);

  // 2. 角運動量 L = r × v （外積演算）
  const Lx = ry * vz - rz * vy;
  const Ly = rz * vx - rx * vz;
  const Lz = rx * vy - ry * vx;

  const mag = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
  if (mag === 0 || isNaN(mag)) return;

  let dynamicScale = Math.sqrt(mag) * SENSITIVITY;
  dynamicScale = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, dynamicScale));

  const nx = (Lx / mag) * dynamicScale;
  const ny = (Ly / mag) * dynamicScale;
  const nz = (Lz / mag) * dynamicScale;

  // 👑 【Zero-Allocation】インプレース代入でオブジェクト生成を遮断
  vec3DTemp.x = b.x + nx;
  vec3DTemp.y = b.y + ny;
  vec3DTemp.z = b.z + nz;

  // 先端の3D投影計算（1回のみ実行）
  const vRot = (typeof rotate3D === "function") ? rotate3D(vec3DTemp) : vec3DTemp;
  const pTip = (typeof project3D === "function") ? project3D(vRot.x, vRot.y, vRot.z) : { visible: false };

  if (!pTip.visible) return;

  // 始点・終点座標
  const startX = pr.x;
  const startY = pr.y;
  const endX = pTip.x;
  const endY = pTip.y;

  const currentVectorColor = b.eccColor || "#00a2ff";

  // 👑 【描画最速化】整数の lineWidth: 1 によりアンチエイリアス滲みを完全遮断
  ctx.save();
  ctx.strokeStyle = currentVectorColor;
  ctx.fillStyle = currentVectorColor;
  ctx.lineWidth = 1; // 👈 小数 0.8 から 1 へ変更（ぼやけ消滅・最速化）

  // ベクトル幹軸
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 矢印ヘッド
  const angle = Math.atan2(endY - startY, endX - startX);
  const headSize = 5;
  const cosA = Math.cos(angle - Math.PI / 6);
  const sinA = Math.sin(angle - Math.PI / 6);
  const cosB = Math.cos(angle + Math.PI / 6);
  const sinB = Math.sin(angle + Math.PI / 6);

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headSize * cosA, endY - headSize * sinA);
  ctx.lineTo(endX - headSize * cosB, endY - headSize * sinB);
  ctx.closePath();
  ctx.fill();

  // テキスト描画（離心率数値）
  if (!hideText) {
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`e:${(b.ecc || 0).toFixed(2)}`, endX + 4, endY - 2);
  }

  ctx.restore();
}
/**
 * 質量上位N個（任意の複数個体）、または全天体間における合成重心（マルチ・バリセンター）を計算・描画・出力する
 * ★【完全防空・Context不整合ゼロ・可視性キャッシュバグ根絶版】
 */
function drawGravityCenterOfTop2(passedSortedBodies) {
  // ── HUDエレメントの取得 ──
  const elName = document.getElementById("barycenterNameDisplay");
  const elPos  = document.getElementById("barycenterPosDisplay");
  const elMass = document.getElementById("barycenterMassDisplay");

  // ★ 非表示トグルOFF、または対象天体がない場合はクリアして即リターン
  if (!window.showBarycenter || !passedSortedBodies || passedSortedBodies.length === 0) {
    if (elName) elName.textContent = "";
    if (elPos)  elPos.textContent  = "";
    if (elMass) elMass.textContent = "";
    return;
  }

  // 1. 【Zero-Allocation】直接走査で有効ノードを集計
  const totalInput = passedSortedBodies.length;
  const validNodes = [];
    for (let i = 0; i < totalInput; i++) {
    const item = passedSortedBodies[i];
    if (!item) continue;

    const bodyObj = item.b ? item.b : item;
    if (!bodyObj) continue;

    const m = parseFloat(bodyObj.mass !== undefined ? bodyObj.mass : (bodyObj.m !== undefined ? bodyObj.m : 0));
    if (m > 0 && !isNaN(m)) {
      validNodes.push({ item, b: bodyObj, m });
    }
  }

  if (validNodes.length === 0) return;

  // 質量の降順ソート
  validNodes.sort((a, b) => b.m - a.m);

  const targetCount = parseFloat(window.barycenterTargetCount);
  const isAllMode = (targetCount === 999 || targetCount <= 0 || isNaN(targetCount));
  const n = isAllMode ? validNodes.length : Math.min(Math.floor(targetCount), validNodes.length);
    if (n < 1) return;

  let sumMx = 0, sumMy = 0, sumMz = 0;
  let totalMass = 0;
  const targetNodes = [];

  // 2. 重心マトリクスの高速演算
  for (let i = 0; i < n; i++) {
    const node = validNodes[i].item;
    const bodyObj = validNodes[i].b;
    const m = validNodes[i].m;

    let rx = 0, ry = 0, rz = 0;
        if (node.r && typeof node.r.x === 'number' && !isNaN(node.r.x)) {
      rx = node.r.x; ry = node.r.y; rz = node.r.z || 0;
    }
    else if (typeof node.rx === 'number' && !isNaN(node.rx)) { rx = node.rx; ry = node.ry; rz = node.rz || 0; }
    else if (typeof node.x === 'number' && !isNaN(node.x)) { rx = node.x; ry = node.y; rz = node.z || 0; }
    else if (bodyObj && typeof bodyObj.x === 'number' && !isNaN(bodyObj.x)) { rx = bodyObj.x; ry = bodyObj.y; rz = bodyObj.z || 0; }
    else { continue; }

    sumMx += m * rx;
    sumMy += m * ry;
    sumMz += m * rz;
    totalMass += m;

    if (!isAllMode) {
      targetNodes.push({ body: bodyObj, rx: rx, ry: ry, rz: rz, mass: m });
    }
  }

  if (totalMass <= 0 || isNaN(totalMass)) return;

  const rotatedBaryX = sumMx / totalMass;
  const rotatedBaryY = sumMy / totalMass;
  const rotatedBaryZ = sumMz / totalMass;

  // 3. スクリーンへの透視投影（合成重心の可視性判定）
  const ppBary = (typeof project3D === "function") ? project3D(rotatedBaryX, rotatedBaryY, rotatedBaryZ) : null;
  if (!ppBary || ppBary.visible === false || isNaN(ppBary.x) || isNaN(ppBary.y)) return;

  // 👑 【Context完全防衛】描画処理全体を try-finally スコープで保護
  ctx.save();
  try {
    const zScale = (ppBary.scaleFactor || 1.0) * 0.5;

    // ドットライン（全天体モード時は非表示）
    if (!isAllMode) {
      ctx.strokeStyle = "rgba(0, 255, 192, 0.6)";
      ctx.lineWidth = Math.max(0.5, 1.5 * zScale);
      ctx.setLineDash([3 * zScale, 3 * zScale]);
      for (let i = 0; i < targetNodes.length; i++) {
        const node = targetNodes[i];
        const ppNode = (typeof project3D === "function") ? project3D(node.rx, node.ry, node.rz) : null;
        if (ppNode && ppNode.visible !== false && !isNaN(ppNode.x) && !isNaN(ppNode.y)) {
          ctx.beginPath(); ctx.moveTo(ppBary.x, ppBary.y); ctx.lineTo(ppNode.x, ppNode.y); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // 4. 精密照準レティクルのスタンプ
    const baseSize = isAllMode ? 24 : 8;
    const minSize  = isAllMode ? 12 : 2;

    const size = Math.max(minSize, baseSize * zScale);
    ctx.strokeStyle = isAllMode ? "#ff00ff" : "#ffff00";
    ctx.lineWidth = isAllMode ? 2 : Math.max(1, 1.5 * zScale);

    ctx.beginPath();
    ctx.moveTo(ppBary.x - size, ppBary.y); ctx.lineTo(ppBary.x + size, ppBary.y);
    ctx.moveTo(ppBary.x, ppBary.y - size); ctx.lineTo(ppBary.x, ppBary.y + size);
    ctx.stroke();

    ctx.lineWidth = isAllMode ? 1.5 : Math.max(1, 1 * zScale);
    ctx.beginPath();
    ctx.arc(ppBary.x, ppBary.y, isAllMode ? 8 : Math.max(1.5, 4 * zScale), 0, Math.PI * 2);
    ctx.stroke();

    // 5. HUDデータ計器盤（DOM）へのテキスト同期
    if (elName) {
      elName.textContent = isAllMode
        ? `Barycenter (All-Body System Total): ${n} Active Stars Locked`
        : `Barycenter (${n}-Body): ` + targetNodes.map(n => (n.body && n.body.name) ? n.body.name : "Unknown").join(" + ");
    }
        if (elPos) {
      elPos.textContent = `Barycenter Pos: X:${rotatedBaryX.toFixed(1)} Y:${rotatedBaryY.toFixed(1)} Z:${rotatedBaryZ.toFixed(1)}`;
    }
        if (elMass) {
      if (isAllMode) {
        elMass.textContent = `Barycenter Mass: ${totalMass.toFixed(1)} (System Total)`;
      } else {
        const massDetails = targetNodes.map(n => `${(n.body && n.body.name) ? n.body.name : "Star"}:${n.mass.toFixed(1)}`).join(" / ");
        elMass.textContent = `Barycenter Mass: ${totalMass.toFixed(1)} [ ${massDetails} ]`;
      }
    }

    // 6. ★【L-VEC(V) 連動】個別バリセンター（Sun ↔ Target）の自動追跡描画
    const isLVecActive = (window.lvecMode !== undefined && window.lvecMode > 0) || (window.lVecMode !== undefined && window.lVecMode > 0);

    if (isLVecActive && validNodes.length >= 2) {
      const sunNode = validNodes[0];
            let targetNodeItem = null;
      if (typeof getSelectedTargetBody === "function") {
        targetNodeItem = getSelectedTargetBody(validNodes);
      } else {
        targetNodeItem = validNodes[1] ? validNodes[1].item : null;
      }

      if (sunNode && targetNodeItem && sunNode.item !== targetNodeItem) {
        const m1 = sunNode.m;
        const targetBodyObj = targetNodeItem.b || targetNodeItem;
        const m2 = parseFloat(targetBodyObj.mass !== undefined ? targetBodyObj.mass : (targetBodyObj.m || 0));

        if (m1 > 0 && m2 > 0) {
          const getXYZ = (nodeItem) => {
            if (nodeItem.r && typeof nodeItem.r.x === 'number') return { x: nodeItem.r.x, y: nodeItem.r.y, z: nodeItem.r.z || 0 };
            if (typeof nodeItem.rx === 'number') return { x: nodeItem.rx, y: nodeItem.ry, z: nodeItem.rz || 0 };
            if (typeof nodeItem.x === 'number') return { x: nodeItem.x, y: nodeItem.y, z: nodeItem.z || 0 };
            if (nodeItem.b && typeof nodeItem.b.x === 'number') return { x: nodeItem.b.x, y: nodeItem.b.y, z: nodeItem.b.z || 0 };
            return { x: 0, y: 0, z: 0 };
          };

          const p1 = getXYZ(sunNode.item);
          const p2 = getXYZ(targetNodeItem);

          const totalM2 = m1 + m2;
          const localBaryX = (p1.x * m1 + p2.x * m2) / totalM2;
          const localBaryY = (p1.y * m1 + p2.y * m2) / totalM2;
          const localBaryZ = (p1.z * m1 + p2.z * m2) / totalM2;

          const ppLocalBary = (typeof project3D === "function") ? project3D(localBaryX, localBaryY, localBaryZ) : null;

          // 👑 【BUG完全撃滅】ppLocalBary.visible !== false を追加し、背後没入時の残像描画をカット！
          if (ppLocalBary && ppLocalBary.visible !== false && !isNaN(ppLocalBary.x) && !isNaN(ppLocalBary.y)) {
            const localScale = (ppLocalBary.scaleFactor || 1.0) * 0.5;
                        ctx.save();
            try {
              ctx.strokeStyle = "#00ffff";
              ctx.fillStyle = "#00ffff";
              ctx.lineWidth = Math.max(1, 2 * localScale);

              const crossSize = Math.max(3, 6 * localScale);

              ctx.beginPath();
              ctx.moveTo(ppLocalBary.x - crossSize, ppLocalBary.y);
              ctx.lineTo(ppLocalBary.x + crossSize, ppLocalBary.y);
              ctx.moveTo(ppLocalBary.x, ppLocalBary.y - crossSize);
              ctx.lineTo(ppLocalBary.x, ppLocalBary.y + crossSize);
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(ppLocalBary.x, ppLocalBary.y, Math.max(1.5, 3 * localScale), 0, Math.PI * 2);
              ctx.stroke();

              const ppSun = (typeof project3D === "function") ? project3D(p1.x, p1.y, p1.z) : null;
              const ppTarget = (typeof project3D === "function") ? project3D(p2.x, p2.y, p2.z) : null;

              // 👑 太陽およびターゲットの双方が視界内に存在する場合のみ結線（ゴースト線カット）
              if (ppSun && ppSun.visible !== false && ppTarget && ppTarget.visible !== false) {
                ctx.strokeStyle = "rgba(0, 255, 255, 0.35)";
                ctx.setLineDash([2 * localScale, 4 * localScale]);
                ctx.beginPath();
                ctx.moveTo(ppSun.x, ppSun.y);
                ctx.lineTo(ppTarget.x, ppTarget.y);
                ctx.stroke();
                ctx.setLineDash([]);
              }

              const targetName = targetBodyObj.name || "Obj";
              ctx.font = `${Math.max(9, Math.floor(11 * localScale))}px monospace`;
              ctx.fillText(`Bary[Sun-${targetName}]`, ppLocalBary.x + crossSize + 4, ppLocalBary.y + 3);
            } finally {
              ctx.restore();
            }
          }
        }
      }
    }
  } finally {
    ctx.restore();
  }
}

/**
 * 天体の3Dパースペクティブおよび対数スケーリングを適用した画面サイズを返す
 * 👑【太陽ズーム連動 ＆ 投影スケール完全補正版】
 */
function calculateScreenSize(b, pr) {
  if (!b) return 1.0;

  // 🛡️ 奥行きおよびズーム値の安全取得
  const depth = (pr && typeof pr.depth === "number" && pr.depth > 0) ? pr.depth : 1.0;
  const zoom  = (typeof camera !== "undefined" && typeof camera.zoom === "number") ? camera.zoom : 1.0;
    // 👑 【BUG完全撃滅】pr.scaleFactor に対して camera.zoom を明示的に乗算！
  const baseScale = (pr && typeof pr.scaleFactor === "number" && pr.scaleFactor > 0)
    ? pr.scaleFactor
    : (1.0 / depth);

  // 画面上の最終合成倍率（距離減衰 × カメラズーム）
  const finalScale = baseScale * zoom;

  // 1. 太陽（Sun）の固定描画サイズ（ズームと完全連動）
  if (b.name === "Sun" || b.type === "sun") {
    const sunBaseSize = 25.0;
    // 最小サイズは 2.0px にクランプ（極小時の潰れ防止）
    return Math.max(2.0, sunBaseSize * finalScale);
  }

  // 2. Goliath（巨大天体）の固定描画サイズ
  const sunMassThreshold = (typeof settings !== "undefined" && settings.sunMass) ? settings.sunMass : 1500;
  if (b.name === "Goliath" || (b.mass && b.mass >= sunMassThreshold * 0.9)) {
    const goliathBaseSize = 20.0;
    return Math.max(2.0, goliathBaseSize * finalScale);
  }

  // 3. 一般天体（Obj / Comet）：renderSize の優先適用 ＆ 対数補正
  let visualSize = 1.0;

  if (b.renderSize !== undefined && !isNaN(b.renderSize)) {
    visualSize = b.renderSize;
  } else {
    const baseSize = b.size || 1.0;
    visualSize = baseSize + 1.2 * Math.log10((b.mass || 1) + 1);
  }

// 👑 【ここを追加！】彗星（Comet）の場合のみ核の半径を 40% (0.4倍) にシャープ化
  if (b.type === "comet") {
    visualSize *= 0.3; // 0.3 〜 0.5 の範囲で調整可能
  }


  return Math.max(1.0, visualSize * finalScale);
}

/* =========================================================
   3. 各種個別パーツの描画関数（グラフィック生成の専門家）
   ========================================================= */



/**
 * 🌌 太陽の絶対空間座標を安全に取得する（完全 Zero-Allocation ＆ 参照防衛版）
 * @returns {{x: number, y: number, z: number}} 太陽の現在座標（※返り値の直接書き換え厳禁）
 */

// 👑 【Zero-Allocation】返却スロット ＆ 判定クロージャの完全固定化
const sunPosSlot = { x: 0, y: 0, z: 0 };
const isSunNode = (b) => !!(b && (b.name === "Sun" || b.type === "sun"));

function getSunPosition() {
  const bodyArr = (typeof window !== "undefined" && window.bodies)
    ? window.bodies
    : (typeof bodies !== "undefined" ? bodies : null);

  if (!bodyArr || bodyArr.length === 0) {
    sunPosSlot.x = 0; sunPosSlot.y = 0; sunPosSlot.z = 0;
    return sunPosSlot;
  }

  // 0番目を最優先チェック、なければ全走査（関数生成なし）
  const sun = isSunNode(bodyArr[0]) ? bodyArr[0] : bodyArr.find(isSunNode);

  if (sun && !isNaN(sun.x) && !isNaN(sun.y) && !isNaN(sun.z)) {
    sunPosSlot.x = sun.x;
    sunPosSlot.y = sun.y;
    sunPosSlot.z = sun.z;
  } else {
    sunPosSlot.x = 0; sunPosSlot.y = 0; sunPosSlot.z = 0;
  }

  return sunPosSlot;
}

/**
 * 👑 軌跡描画エンジン（真の Zero-Allocation ＆ 完全 0 Byte 達成版）
 */

// 👑 【Zero-Allocation】回転演算用の固定一時スロット
const trailRotTemp = { x: 0, y: 0, z: 0 };

function drawBodyTrails(b, trailColor, alphaMultiplier = 1.0, lengthRatio = 1.0) {
  // 🛡️ 1. プロパティ名の安全フォールバック
  const trailArray = b ? (b.trail || b.history) : null;
  if (!b || !trailArray || trailArray.length <= 2) return;

  const totalPoints = trailArray.length;

  // 🛡️ 2. 太陽オブジェクトの堅牢判定
  const bName = String(b.name || "").toLowerCase();
  const bType = String(b.type || "").toLowerCase();
  const isSunObj = bName.includes("sun") || bType.includes("sun");

  // 🛡️ 3. UI表示フラグの抽出
  const showSun = (simulationState?.ui?.showSunTrail !== undefined)
    ? simulationState.ui.showSunTrail
    : true;

  const isPlanet = simulationState?.ui?.showPlanetTrail && b.type !== "comet" && !isSunObj;
  const isComet  = simulationState?.ui?.showCometTrail && b.type === "comet";
  const isSun    = showSun && isSunObj;

  if (!isPlanet && !isComet && !isSun) return;

  const totalCount = (typeof bodies !== "undefined") ? bodies.length : 100;

  // 🚀 天体数に応じた軌跡ポイント数の自動調整
  let effectivePoints = totalPoints;
  if (totalCount >= 130 && totalCount <= 199) {
    const u = (199 - totalCount) / (199 - 130);
    effectivePoints = Math.max(5, Math.floor(totalPoints * (0.35 + u * 0.45)));
  } else if (totalCount > 199) {
    effectivePoints = Math.max(4, Math.floor(totalPoints * 0.20));
  }

  // 📏 距離減衰 lengthRatio の適用
  effectivePoints = Math.max(2, Math.floor(effectivePoints * lengthRatio));
  const firstIndex = totalPoints - effectivePoints;

  const zoom = (typeof camera !== "undefined" && camera.zoom) ? camera.zoom : 1.0;
  const baseWidth = 0.2 * (0.3 + zoom * 0.2);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 👑 【真の Zero-Allocation】スカラー値による状態保持（オブジェクト生成 0）
  let prevX = 0, prevY = 0;
  let hasPrev = false;

  for (let i = firstIndex; i < totalPoints; i++) {
    const p = trailArray[i];
    if (!p) {
      hasPrev = false;
      continue;
    }

    // インプレース座標代入
    trailRotTemp.x = p.wx ?? p.x;
    trailRotTemp.y = p.wy ?? p.y;
    trailRotTemp.z = p.wz ?? p.z;

    const rp = (typeof rotate3D === "function") ? rotate3D(trailRotTemp) : trailRotTemp;
    const prp = (typeof project3D === "function") ? project3D(rp.x, rp.y, rp.z) : null;

    if (!prp || prp.visible === false || isNaN(prp.x) || isNaN(prp.y)) {
      hasPrev = false;
      continue;
    }

    const currX = prp.x;
    const currY = prp.y;
    const pointColor = isSun
      ? "rgba(255, 255, 255, 0.95)"
      : (p.color || b.eccColor || trailColor || "#00a2ff");

    // 前の有効なポイントが存在する場合のみセグメントを描画
    if (hasPrev) {
      // 進行度 t (0.0 末尾 ➔ 1.0 先頭)
      const t = (i - firstIndex) / Math.max(1, effectivePoints - 1);
      const alpha = t * t * 0.85 * alphaMultiplier;

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(currX, currY);

      ctx.strokeStyle = pointColor;
      ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
      ctx.lineWidth = Math.max(0.2, baseWidth * (0.1 + 0.9 * t));

      ctx.stroke();
    }

    // 次のステップへスカラー値を引き継ぎ（Allocation ゼロ）
    prevX = currX;
    prevY = currY;
    hasPrev = true;
  }

  ctx.restore();
}


/**
 * 彗星の物理的な位置から太陽の反対方向へと流れる「尾（Tail）」の微粒子を描画する
 * 👑【完全 Zero-Allocation ＆ ダストテール広がり連動強化版】
 */

// 👑 【Zero-Allocation】回転演算用の固定一時スロット
const cometTailTemp = { x: 0, y: 0, z: 0 };

function drawCometTail(b, sun) {
  if (!b || b.type !== "comet" || !sun) return;

  const sx = b.x - sun.x;
  const sy = b.y - sun.y;
  const sz = b.z - sun.z;
  const d = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;

  const nx = sx / d;
  const ny = sy / d;
  const nz = sz / d;

  // 👑 描画用サイズ (renderSize) を優先参照
  const visualSize = (b.renderSize !== undefined) ? b.renderSize : (b.size || 1.0);

  const tailLength = Math.min(1500, 12000 / d) * (1 + visualSize * 3);
  const brightness = Math.min(1, 4000 / d);
  const particles = 25 + Math.floor(55 * brightness);

  const tColor = Math.min(1, d / 6000);
  const baseR = (180 + (255 - 180) * tColor) | 0;
  const baseG = (220 + (255 - 220) * tColor) | 0;
  const baseB = 255;

  ctx.save();

  // 👑 【演出強化】微粒子の拡散用交差ベクトル（直線を自然な扇状へ広げる）
  const perpX = -ny;
  const perpY = nx;

  for (let i = 0; i < particles; i++) {
    const t = i / particles;
    const fade = (1 - t) * brightness;

    // 🌟 後方に行くほど太陽風の乱流によって尾がわずかに広がる（物理散乱表現）
    const spread = (Math.sin(i * 1.5) * 1.8 * t) * (1 + visualSize);

    // インプレース座標代入（メモリ割り当て 0 Byte）
    cometTailTemp.x = b.x + nx * tailLength * t + perpX * spread;
    cometTailTemp.y = b.y + ny * tailLength * t + perpY * spread;
    cometTailTemp.z = b.z + nz * tailLength * t;

    const rp = (typeof rotate3D === "function") ? rotate3D(cometTailTemp) : cometTailTemp;
    const pp = (typeof project3D === "function") ? project3D(rp.x, rp.y, rp.z) : null;

    // 🛡️ カメラ背後および無効座標の即時スキップ
    if (!pp || pp.visible === false || isNaN(pp.x) || isNaN(pp.y)) continue;

    // 後方ほど粒子サイズを大きく・淡くすることで、本物の流体プラズマ感を再現
    const particleRadius = Math.max(0.5, (1 + visualSize * 2) * (1 - t * 0.7));

    ctx.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.22 * fade})`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, particleRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 天体コア描画エンジン
 * 👑【3乗根質量スケール ＆ ズーム完全連動 ＆ Zero-Allocation 確定修復版】
 */
/**
 * 天体コア描画エンジン
 * 👑【太陽のサイズ過大化を完全撃退 ＆ 上品な極小スケーリング確定版】
 */
/**
 * 天体コア描画エンジン
 * 👑【満ち欠け（陰影）リアルタイム統合 ＆ Zero-Allocation 確定版】
 */
function drawBodyCore(b, pr, sun, screenSize) {
  if (!b || !pr || !pr.visible || isNaN(pr.x) || isNaN(pr.y) || screenSize <= 0) return;

  const bName = String(b.name || "").toLowerCase();
  const bType = String(b.type || "").toLowerCase();

  const isSun = bName.includes("sun") || bType.includes("sun");
  const isGoliath = bName.includes("goliath") || bType.includes("goliath");

  // =========================================================
  // 📏 1. 距離（pr.depth）に応じた減衰パラメータの算出
  // =========================================================
  const depth = pr.depth || 0;
  const DIST_THRESHOLD = 5000;
  const DIST_MAX       = 10000;

  let distAlpha = 1.0;
  if (depth > DIST_THRESHOLD) {
    const progress = Math.min(1.0, (depth - DIST_THRESHOLD) / (DIST_MAX - DIST_THRESHOLD));
    distAlpha = Math.max(0.15, 1.0 - progress * 0.85);
  }

  // =========================================================
  // 🎯 2. 遠方 (depth > 5000) ＆ 一般天体：超高速ドット描画（LOD）
  // =========================================================
  if (depth > DIST_THRESHOLD && !isSun && !isGoliath) {
    const activeColor = b.eccColor || b.color || "#00a2ff";

    ctx.save();
    ctx.globalAlpha *= distAlpha;
    ctx.fillStyle = activeColor;
    ctx.fillRect((pr.x - 0.75) | 0, (pr.y - 0.75) | 0, 1.5, 1.5);
    ctx.restore();
    return;
  }

  // =========================================================
  // 🎨 3. 近接 (depth <= 5000) または 太陽/Goliath のサイズ算出
  // =========================================================
  let rawBaseSize = 1.0;
  const mass = Number(b.mass ?? b.m ?? b.renderSize ?? b.size ?? 1.0);

  if (isSun) {
    const sunCubic = Math.cbrt(Math.max(1.0, mass));
    rawBaseSize = Math.max(1.5, sunCubic * 0.18);
  } else if (isGoliath) {
    const goliathCubic = Math.cbrt(Math.max(1.0, mass));
    rawBaseSize = Math.max(1.2, goliathCubic * 0.15);
  } else {
    // 一般天体：3乗根スケール
    const M_MIN = 1.0;
    const M_MAX = 5000.0;
    const R_MIN = 0.8;
    const R_MAX = 3.5;
    const normalizedMass = Math.max(0.0, Math.min(1.0, (mass - M_MIN) / (M_MAX - M_MIN)));
    const cubicGrowth = Math.pow(normalizedMass, 1 / 3);
    rawBaseSize = R_MIN + (R_MAX - R_MIN) * cubicGrowth;
  }

  // 画面上での絶対半径クランプ
  const calculatedRadius = rawBaseSize * screenSize;
  const minPixel = isSun ? 1.5 : 0.5;
  const maxPixel = isSun ? 10.0 : 6.0;
    const finalRadius = Math.max(minPixel, Math.min(maxPixel, calculatedRadius));

  ctx.save();
  ctx.globalAlpha *= distAlpha;
  ctx.beginPath();
  ctx.arc(pr.x, pr.y, finalRadius, 0, Math.PI * 2);

  if (isSun) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = Math.min(12, finalRadius * 2.0);
  } else if (isGoliath) {
    ctx.fillStyle = "#ff00ff";
    ctx.shadowColor = "#aa00aa";
    ctx.shadowBlur = Math.min(10, finalRadius * 1.5);
  } else {
    const activeColor = b.eccColor || b.color || "#00a2ff";
    ctx.fillStyle = activeColor;

    const speed = Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vy || 0) * (b.vy || 0) + (b.vz || 0) * (b.vz || 0));
    if (speed > 60) {
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = Math.min(6, speed / 15);
    }
  }

  // 1. 天体本体の描画実行
  ctx.fill();

  // 👑【ここに配置】2. 太陽以外の天体に「リアルタイム満ち欠け（陰影）」を重ね描き
  if (!isSun && typeof renderBodyPhase === "function" && typeof camera !== "undefined" && window.prSun) {
    renderBodyPhase(b, sun, camera.position || camera, pr, window.prSun.x, window.prSun.y, finalRadius);
  }

  ctx.restore();
}
/**
 * HUD・個別天体ラベル描画（超高速・measureText 廃止 ＆ Zero-Save/Restore 版）
 * ⚠️ 前提: 親の描画ループ（renderScene）側で `ctx.font = "12px sans-serif"; ctx.textBaseline = "middle";` を 1 回だけ事前設定すること
 */
function drawBodyLabel(b, pr, screenSize) {
  // 🛡️ 1. カメラ背後・画面外の即時スキップ（最速ガード）
  if (!b || !pr || pr.visible === false || isNaN(pr.x) || isNaN(pr.y)) return;

  // 速度の取得（事前に計算された b.speed を最優先）
  const speed = (b.speed !== undefined)
    ? b.speed
    : Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vy || 0) * (b.vy || 0) + (b.vz || 0) * (b.vz || 0));

  // 1. ラベル文字列の一括構築
  let label = `${b.name || "Obj"} | V: ${speed.toFixed(2)} /sec`;
  if (b.name !== "Sun" && b.distance !== undefined) label += ` | D: ${b.distance.toFixed(1)}`;
  if (b.isOrbiting) label += " [STB]";
  if (b.willCollide && b.timeToCollision !== undefined) label += ` [⚠️ COLLISION: ${b.timeToCollision.toFixed(1)}s]`;

  // 👑 【超高速化】measureText を排除し、1 文字あたりの近似幅 (6.8px) で高速幅算出
  const estimatedWidth = label.length * 6.8;
  const lx = pr.x + screenSize + 4;
  const ly = pr.y;

  const isWarn = !!b.willCollide;
  const bgColor   = isWarn ? "rgba(255, 0, 50, 0.25)" : "rgba(0, 0, 0, 0.45)";
  const textColor = isWarn ? "#ff3344" : "#ffffff";

  // 2. 座布団の安全描画（save/restore 排除）
  ctx.fillStyle = bgColor;
  ctx.fillRect(lx - 2, ly - 8, estimatedWidth + 4, 16);

  // 3. テキスト描画
  ctx.fillStyle = textColor;
  ctx.fillText(label, lx, ly);
}

/**
 * 画面上部に固定配置される総合情報HUDを描画する（純粋なGetter表現）
 * 👑【デザイン・ログ5件100%保持 ＆ DOM参照キャッシュ超高速化版】
 */

// 👑 【高速化】DOMノードの参照を事前確保する安全スロット（検索コストを 0 に固定）
const hudDomCache = {};

function getDOMTextCached(id) {
  if (typeof document === "undefined") return null;
    // キャッシュになければ 1 回だけ DOM 検索を行って保持
  if (!hudDomCache[id]) {
    hudDomCache[id] = document.getElementById(id);
  }
    const el = hudDomCache[id];
  if (!el) return null;
    const txt = el.textContent || el.innerText || "";
  return txt.trim() !== "" ? txt : null;
}

function drawScreenHUD() {
  if (typeof ctx === 'undefined' || !ctx) return;
  ctx.save();
    // ==========================================
  // ⚙️ 動的タイポグラフィ ＆ 影設定（11px スリムサイズ）
  // ==========================================
  const fontSize = 11;
  ctx.font = `${fontSize}px 'Consolas', 'Courier New', monospace`;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 3;
    const pX = 15;
  let currentY = fontSize + 15;
  const lineHeight = Math.round(fontSize * 1.35); // コンパクトな行間（約15px）

  // ------------------------------------------
  // 📡 ブロック1：天体生態系＆演算ループ
  // ------------------------------------------
  const bodyText = getDOMTextCached("bodyCountDisplay");
  if (bodyText) {
    ctx.fillStyle = "white";
    ctx.fillText(bodyText, pX, currentY); currentY += lineHeight;
  }

  const turnText = getDOMTextCached("turnCountDisplay");
  if (turnText) {
    ctx.fillStyle = "#e0e6ed";
    ctx.fillText(turnText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック2：【重力重心マトリクス】
  // ------------------------------------------
  const bNameText = getDOMTextCached("barycenterNameDisplay");
  if (bNameText) {
    ctx.fillStyle = "#00ffcc";
    ctx.fillText(bNameText, pX, currentY); currentY += lineHeight;
  }

  const bPosText = getDOMTextCached("barycenterPosDisplay");
  if (bPosText) {
    ctx.fillStyle = "#a3ffee";
    ctx.fillText(bPosText, pX, currentY); currentY += lineHeight;
  }

  const bMassText = getDOMTextCached("barycenterMassDisplay");
  if (bMassText) {
    ctx.fillStyle = "#ff99cc";
    ctx.fillText(bMassText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック3：【太陽物理パラメータ】
  // ------------------------------------------
  const sunSpeedText = getDOMTextCached("sunSpeedDisplay");
  if (sunSpeedText) {
    ctx.fillStyle = "#ffffaa";
    ctx.fillText(sunSpeedText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック4：【マトリクス生死統計カウンタ】
  // ------------------------------------------
  const alive    = getDOMTextCached("statAlive") || "0";
  const escaped  = getDOMTextCached("statEscaped") || "0";
  const collided = getDOMTextCached("statCollided") || "0";
  const removed  = getDOMTextCached("statRemoved") || "0";
  const nans     = getDOMTextCached("statNaN") || "0";

  ctx.fillStyle = "white";
  ctx.fillText(`Alive: ${alive} | Escaped: ${escaped} | Collided: ${collided} | Removed: ${removed}`, pX, currentY);
  currentY += lineHeight;

  // 例外（NaN）の監視
  const nanCount = parseInt(nans) || 0;
  if (nanCount > 0) {
    ctx.fillStyle = (Math.floor(Date.now() / 100) % 2 === 0) ? "#ff00ff" : "#550055";
    ctx.fillText(`CRITICAL NaN DETECTED: ${nanCount}`, pX, currentY); currentY += lineHeight;
  } else {
    ctx.fillStyle = "#00ff00";
    ctx.fillText(`System Status: ALL GREEN (NaN: 0)`, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック5：【タイム・マトリクス（3連クロノグラフ）】
  // ------------------------------------------
  currentY += Math.round(lineHeight * 0.3);

  const simTime = getDOMTextCached("statSimTime");
  if (simTime) {
    ctx.fillStyle = "#00ffff";
    ctx.fillText(simTime, pX, currentY);
    currentY += lineHeight;
  }

  const runTime = getDOMTextCached("statRunTime");
  if (runTime) {
    ctx.fillStyle = "#ffaa00";
        let displayRunTime = runTime;
    const hasUnit = /Min|Sec|min|sec|\(Min\)|\(m\)|[0-9]m\b/i.test(runTime);

    if (!hasUnit) {
      if (runTime.includes(":")) {
        displayRunTime = runTime.replace(/(\d+):([\d.]+)/, "$1Min $2Sec");
      } else {
        displayRunTime = `${runTime} Min`;
      }
    }

    ctx.fillText(displayRunTime, pX, currentY);
    currentY += lineHeight;
  }

  const realTime = getDOMTextCached("statRealTime");
  if (realTime) {
    ctx.fillStyle = "#00ff00";
    ctx.fillText(realTime, pX, currentY);
  }

  // ------------------------------------------
  // 📡 ブロック6：【SUN吸収イベントログ（直近5件制限）】
  // ------------------------------------------
  if (window.sunEventLogs && window.sunEventLogs.length > 0) {
    currentY += Math.round(lineHeight * 0.6);

    ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pX, currentY);
    ctx.lineTo(pX + 300, currentY);
    ctx.stroke();

    currentY += Math.round(lineHeight * 0.7);

    ctx.fillStyle = "#00ffcc";
        const logsToDraw = window.sunEventLogs.slice(-5);
    for (let i = 0; i < logsToDraw.length; i++) {
      ctx.fillText(logsToDraw[i], pX, currentY);
      currentY += lineHeight;
    }
  }

  ctx.restore();
}


/**
 * 背景星空の描画エンジン（360度全天球・無限遠投影・バッチレンダリング完全版）
 */
(function() {
  // 外部から汚染されないプライベート固定配列
  let starsInstance = [];
    // 💡 輝度グループごとのバッチ配列（Draw Call 爆発の完全消滅）
  let starGroups = [];

  function ensureStarsInitialized() {
    if (starsInstance.length > 0) return;

    starsInstance = [];
    starGroups = Array.from({ length: 5 }, () => []);

    // 30,000個の超密度の星々を全天球に創生
    for (let i = 0; i < 30000; i++) {
      const theta = Math.random() * Math.PI * 2;
            // 周期ノイズによる銀河の濃淡モジュレーション（天の川構造の形成）
      const wave = Math.sin(theta * 8);
      let u = Math.random() * 2 - 1;
      if (Math.random() < Math.abs(wave) * 0.7) {
        u *= (1 - Math.abs(wave) * 0.3);
      }

      const phi = Math.asin(Math.max(-1, Math.min(1, u)));

      // 輝度の決定 [0.15, 0.55]
      const rawBrightness = Math.random() * 0.4 + 0.15;
            // 💡 輝度を 5 段階のバッチグループ (0〜4) に量子化
      const groupIdx = Math.min(4, Math.floor((rawBrightness - 0.15) / 0.4 * 5));

      const star = {
        wx: Math.cos(theta) * Math.cos(phi),
        wy: Math.sin(phi),
        wz: Math.sin(theta) * Math.cos(phi),
        size: Math.random() * 0.6 + 0.5
      };

      starsInstance.push(star);
      starGroups[groupIdx].push(star); // バッチグループへ登録
    }
  }

  /**
   * 背景星空の描画（360度全天球・超軽量バッチマトリクス）
   */
  window.drawBackgroundStars = function() {
    ensureStarsInitialized();

    if (typeof ctx === "undefined" || !ctx) return;

    ctx.save();

    // カメラの回転角（サイン・コサイン）をループ外で一括キャッシュ
    const rotX = (typeof camera !== "undefined" && camera.rotX) ? camera.rotX : 0;
    const rotY = (typeof camera !== "undefined" && camera.rotY) ? camera.rotY : 0;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    const cx = W / 2;
    const cy = H / 2;
    const fov = 500;

    // 💡【バッチレンダリング】5つの輝度グループごとに一括描画
    for (let g = 0; g < starGroups.length; g++) {
      const group = starGroups[g];
      if (group.length === 0) continue;

      // fillStyle のセットはグループごとにたったの 1 回！
      const alpha = 0.15 + g * 0.08;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

      for (let i = 0; i < group.length; i++) {
        const star = group[i];

        // 1. 3D絶対ベクトルからのダイレクト抽出
        const wx = star.wx;
        const wy = star.wy;
        const wz = star.wz;

        // 2. カメラの回転行列演算（ヨー -> ピッチ）
        const x1 = wz * sinY + wx * cosY;
        const z1 = wz * cosY - wx * sinY;

        const y2 = wy * cosX - z1 * sinX;
        const z2 = wy * sinX + z1 * cosX;

        // 3. カメラ前方（z2 > 0）のみスクリーン投影
        if (z2 > 0) {
          const sx = cx + (x1 * fov) / z2;
          const sy = cy + (y2 * fov) / z2;

          // スクリーン可視領域のカリング（画面内のみ描画）
          if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) {
            ctx.fillRect(sx | 0, sy | 0, star.size, star.size);
          }
        }
      }
    }

    ctx.restore();
  };
})();


// =====================================================================
// 👑【バグパージ】カメラ状態保持変数の安全グローバル保証（SyntaxError 完全遮断版）
// window 直下に状態をバインドし、重複宣言エラーやスコープ汚染を物理的に根絶する
// =====================================================================
window.lastCamRotX   = window.lastCamRotX   ?? 0;
window.lastCamRotY   = window.lastCamRotY   ?? 0;
window.lastCamZoom   = window.lastCamZoom   ?? 0;
window.lastCamOffsetX = window.lastCamOffsetX ?? 0;
window.lastCamOffsetY = window.lastCamOffsetY ?? 0;
window.cameraChanged = window.cameraChanged ?? false;

// 🛡️ ローカルスコープ参照用の安全なショートカット宣言（必要な場合のみ）
var lastCamRotX   = window.lastCamRotX;
var lastCamRotY   = window.lastCamRotY;
var lastCamZoom   = window.lastCamZoom;
var lastCamOffsetX = window.lastCamOffsetX;
var lastCamOffsetY = window.lastCamOffsetY;
var cameraChanged = window.cameraChanged;

/**
 * メインループ（毎フレームの実行規律・時間統治・リアルタイム自動変色完全版）
 */
function loop() {
  // 1. 倍速化（simSpeed乗算）される前の、純粋な現実の経過秒数を一時計算
  const now = performance.now();
  const rawPassedSecond = (now - lastTime) / 1000;

  // 2. 物理演算用の dt を計算（内部で simSpeed が掛け算される）
  const dt = computeDeltaTime();

  const isMoving = simulationState.running || window.isTimeProgressing;

  if (isMoving) {
    // 物理演算（全天体の位置・速度更新）
    updatePhysics(dt);

    // 🌌【生態系自律維持エンジン】天体数が減った時だけ、外縁部から1体ずつ静かに補賃する
    if (typeof maintainEcosystem === "function") {
      maintainEcosystem();
    }

    // 宇宙時間の累積（ここには倍速発展した dt を足し込む）
    if (typeof simulationState !== "undefined" && simulationState.elapsedTime !== undefined) {
      simulationState.elapsedTime += dt;
    }

    // ★【バグ完全パージ】時間倍率(simSpeed)の影響を1ミリも受けない「生の秒数」だけをガッチリ蓄積！
    if (typeof window.realAccumulatedTime !== "undefined") {
      window.realAccumulatedTime += rawPassedSecond;
    }

    updateTrails(dt);
    updateCamera(dt);
  }

  // 👑【LVEC-OFF時リアルタイム変色保証】描画直前に全天体の離心率カラー（青〜赤）を自動更新！
  if (typeof updateBodyEccentricityColor === "function" && Array.isArray(bodies)) {
    const sun = bodies[0] && (bodies[0].name === "Sun" || bodies[0].type === "sun")
      ? bodies[0]
      : bodies.find(b => b && (b.name === "Sun" || b.type === "sun"));
        if (sun) {
      for (let i = 0; i < bodies.length; i++) {
        updateBodyEccentricityColor(bodies[i], sun);
      }
    }
  }

  // カメラの変更検知
  cameraChanged = (
    camera.rotX !== lastCamRotX || camera.rotY !== lastCamRotY ||
    camera.zoom !== lastCamZoom || camera.offsetX !== lastCamOffsetX || camera.offsetY !== lastCamOffsetY
  );

  // 手動操作時の永久機関デスループストッパー
  if (typeof dragging !== "undefined" && dragging) {
    cameraChanged = true;
    lastCamRotX = camera.rotX; lastCamRotY = camera.rotY;
    lastCamZoom = camera.zoom; lastCamOffsetX = camera.offsetX; lastCamOffsetY = camera.offsetY;
  } else {
    lastCamRotX = camera.rotX; lastCamRotY = camera.rotY;
    lastCamZoom = camera.zoom; lastCamOffsetX = camera.offsetX; lastCamOffsetY = camera.offsetY;
  }

  // 画面の再描画
  renderScene();

  // 三連時計の一斉掃射（0になった瞬間も焼き付ける）
  if (typeof updateSimTimeUI === "function") {
    updateSimTimeUI();
  }

  requestAnimationFrame(loop);
}

/**
 * 👑【設定完全連動型・自動画角追従エンジン】
 */
function calculateOptimalCamera(bodies, sun) {
  // 自動追従がオフ、または天体データが存在しない場合は即時スキップ
  if (!simulationState.camera.autoFraming || !bodies || bodies.length === 0) return;

  let validCount = 0;
  let sumDistance = 0;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b || b === sun) continue;

    // 離心率 e > 1.2 の脱出天体はカメラ距離の計算から除外
    if (b.ecc && b.ecc > 1.2) continue;

    const dx = b.x - (sun ? sun.x : 0);
    const dy = b.y - (sun ? sun.y : 0);
    const dz = b.z - (sun ? sun.z : 0);
    sumDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    validCount++;
  }

  const rEff = validCount > 0 ? (sumDistance / validCount) : 1200;
  const camCfg = simulationState.camera;
  const targetCamDist = Math.max(camCfg.minDistance, Math.min(camCfg.maxDistance, rEff * 2.8));

  if (typeof camera !== "undefined") {
    // スムーズ補間（Lerp）によるカメラ距離および角度の滑らかな自動更新
    camera.distance += (targetCamDist - camera.distance) * camCfg.lerpSpeed;
    camera.elevation += (camCfg.optimalElevation - camera.elevation) * camCfg.lerpSpeed;

    if (camCfg.autoRotate) {
      camera.azimuth += camCfg.rotateSpeed;
    }
  }
}

/**
 * 👑【タスクB解決】天体の離心率カラー自動更新エンジン
 * LVECボタンのON/OFFに関わらず、物理状態（離心率e）から常に色をリアルタイム算出する
 */
/**
 * 👑【リアルタイム離心率カラー確定エンジン】
 * 天体の位置・速度から正確に離心率 e を計算し、b.eccColor を確実に上書きする
 */
/* =========================================================
   👑【リアルタイム離心率カラー確定エンジン（完全正則化版）】
   天体の位置・速度から正確に離心率 e を計算し、b.eccColor を確実に上書きする
   ========================================================= */
/* =========================================================
   👑【進化版】8段階・高精細 L-VEC カラー更新エンジン
   （ルンゲ・レンツ・ベクトル厳密解 ＆ Zero-Allocation 適合版）
   ========================================================= */
function updateBodyEccentricityColor(b, sun) {
  if (!b || !sun || b.name === "Sun" || b.type === "sun") return;

  // 1. 相対座標および相対速度の取得（数値保証）
  const rx = (typeof b.x === "number" && !isNaN(b.x) ? b.x : 0) - (typeof sun.x === "number" && !isNaN(sun.x) ? sun.x : 0);
  const ry = (typeof b.y === "number" && !isNaN(b.y) ? b.y : 0) - (typeof sun.y === "number" && !isNaN(sun.y) ? sun.y : 0);
  const rz = (typeof b.z === "number" && !isNaN(b.z) ? b.z : 0) - (typeof sun.z === "number" && !isNaN(sun.z) ? sun.z : 0);

  const vx = (typeof b.vx === "number" && !isNaN(b.vx) ? b.vx : 0) - (typeof sun.vx === "number" && !isNaN(sun.vx) ? sun.vx : 0);
  const vy = (typeof b.vy === "number" && !isNaN(b.vy) ? b.vy : 0) - (typeof sun.vy === "number" && !isNaN(sun.vy) ? sun.vy : 0);
  const vz = (typeof b.vz === "number" && !isNaN(b.vz) ? b.vz : 0) - (typeof sun.vz === "number" && !isNaN(sun.vz) ? sun.vz : 0);

  const r_len = Math.sqrt(rx * rx + ry * ry + rz * rz);
  let ecc = 0;

  if (r_len > 0) {
    // 2. システム標準の重力パラメータ μ = G * M_sun の直接算出
    const currentG = (typeof G !== "undefined" && !isNaN(G)) ? G : 1.0;
    const realSunMass = Number(sun.mass || sun.m || 1500.0);
    const mu = currentG * realSunMass;

    if (mu > 0) {
      const v2 = vx * vx + vy * vy + vz * vz;
      const r_dot_v = rx * vx + ry * vy + rz * vz;

      // 3. ルンゲ・レンツ・ベクトル (LRL) の厳密代数計算
      const ex = (v2 * rx - r_dot_v * vx) / mu - rx / r_len;
      const ey = (v2 * ry - r_dot_v * vy) / mu - ry / r_len;
      const ez = (v2 * rz - r_dot_v * vz) / mu - rz / r_len;

      const calculatedEcc = Math.sqrt(ex * ex + ey * ey + ez * ez);
      ecc = isNaN(calculatedEcc) ? 0 : calculatedEcc;
    }
  }

  b.ecc = ecc;

  // 👑 8段階・物理相転移カラー判定マトリクス (Zero-Allocation ルックアップ)
  if (ecc < 0.02)      b.eccColor = "#00ffcc"; // 1. 完全円軌道 (ネオンエメラルド)
  else if (ecc < 0.20) b.eccColor = "#00a2ff"; // 2. 低偏平楕円 (ディープシアン)
  else if (ecc < 0.50) b.eccColor = "#0044ff"; // 3. 中偏平楕円 (コバルトブルー)
  else if (ecc < 0.85) b.eccColor = "#9900ff"; // 4. 高偏平楕円 (バイオレット)
  else if (ecc < 0.98) b.eccColor = "#ff00cc"; // 5. 極限楕円 (マゼンタ)
  else if (ecc <= 1.02) b.eccColor = "#ff3300"; // 6. 臨界放物線 (ブライトレッド)
  else if (ecc <= 2.00) b.eccColor = "#ff9900"; // 7. 双曲線スイングバイ (アンバーオレンジ)
  else                  b.eccColor = "#ffff00"; // 8. 超高エネルギー脱出 (プラズマイエロー)
}

/* =========================================================
   👑【1】軌跡カラー取得エンジン（完全同調・完全保護版）
   ========================================================= */
/**
 * 👑【軌跡カラー取得エンジン】
 * 不要な計算を排除し、本体の 8 段階離心率カラー(b.eccColor)へ 100% 同調
 */
function getTrailColor(b, sun) {
  if (!b) return "rgba(255, 255, 255, 0.5)";

  // UIで明示的に "white" が指定されている場合は白色を返却
  if (typeof settings !== "undefined" && settings.trailColorMode === "white") {
    return "#ffffff";
  }

  // 天体本体のリアルタイム離心率カラー(b.eccColor)を最優先で返却
  return b.eccColor || b.drawColor || b.color || "#00a2ff";
}

/* =========================================================
   ★ フェーズ2: カメラプリセット設定関数（UI・キー連動用・完全クリーン版）
   ======================================================== */
function applyCameraPreset(presetName) {
  if (typeof camera === "undefined" || !camera) return;

  // 1. マウス平行移動（右ドラッグ）のオフセットを中央（0）に完全リセット！
  camera.offsetX = 0;
  camera.offsetY = 0;

  // 🛡️【完全防空】camera.pos オブジェクトが存在する場合のみ安全に座標リセット
  if (camera.pos) {
    camera.pos.x = 0;
    camera.pos.y = 0;
  }

  // 2. プリセットに応じたカメラアングル・距離の適用
  switch (presetName) {
    case 'equator': // 太陽赤道面ビュー（真横から平面軌道を観察）
      if (camera.pos) camera.pos.z = -800; // 標準距離
      camera.rotX = 0.0;   // ピッチゼロ（真横）
      camera.rotY = 0.0;   // ヨー正面
      camera.zoom = 1.0;   // 等倍
      console.log("Preset: 太陽赤道面ビュー");
      break;

    case 'polar': // 極ビュー（太陽の真上から軌道平面を完璧に見下ろす）
      if (camera.pos) camera.pos.z = -800;
      // 💡 ジンバルロック制限（Math.PI/2 - 0.01）のギリギリで真上を向かせる数学的規律
      camera.rotX = Math.PI / 2 - 0.01;
      camera.rotY = 0.0;
      camera.zoom = 1.0;
      console.log("Preset: 極ビュー（北極俯瞰）");
      break;

    case 'overview': // 遠方全体俯瞰（立体感溢れる斜め上アングル）
      if (camera.pos) camera.pos.z = -1200; // 宇宙全体を視野に収めるために引く
      camera.rotX = 0.7;    // 上空約40度から見下ろす
      camera.rotY = 0.7;    // 横方向にも約40度回転させて立体感を創出
      camera.zoom = 0.7;    // 視野を少し広くする
      console.log("Preset: 遠方全体俯瞰ビュー");
      break;

    default: // 🛡️【例外防護】未知のプリセット名が指定された場合は赤道面へ安全フォールバック
      if (camera.pos) camera.pos.z = -800;
      camera.rotX = 0.0;
      camera.rotY = 0.0;
      camera.zoom = 1.0;
      console.warn(`Preset: 未知のプリセット名 '${presetName}' のためデフォルト復帰`);
      break;
  }

  // 💡【即時同期】メインループ側へカメラ変更を通知し、一時停止中も即座に画面を再描画！
  if (typeof cameraChanged !== "undefined") {
    cameraChanged = true;
  }
}


// ========================================================
//  宇宙管制盤：UI診断・本体ロジック完全分離システム
// ========================================================

// ========================================================
//  宇宙管制盤：UI診断・本体ロジック完全分離システム（完全統合版）
// ========================================================

(function() {
    // 1. 【UI_MAPの完全網羅】提示されたHTML内のすべての操作・統計系ID
    const UI_MAP = [
        // --- システム・時間操作 ---
        { id: "startBtn",           name: "時間開始（Q）" },
        { id: "resetBtn",           name: "宇宙リセット（E）" },
        { id: "consoleTestBtn",     name: "コンソール診断ボタン" },
                // --- 軌跡レンダリングフィルタ ---
        { id: "cometTrailBtn",  en: "CMT I", ja: "彗星 I" },
        { id: "planetTrailBtn", en: "PLN O", ja: "惑星 O" },
        { id: "sunTrailBtn",    en: "SUN P", ja: "太陽 P" },
                // --- ディスプレイ・表示トグル ---
        { id: "showNames",          en: "NAME N", ja: "名前 N" },
        { id: "sunControlToggle",   name: "太陽制御ブロック開閉" },
        { id: "toggleSettingsBtn",  name: "詳細設定パネル開閉" },
                // --- 太陽・オブジェクト物理パラメータ ---
        { id: "sunMass",            name: "太陽質量スライダー" },
        { id: "sunMassInput",       name: "太陽質量数値入力" },
        { id: "sunVxSlider",        name: "太陽初期速度Vxスライダー" },
        { id: "sunVxInput",         name: "太陽初期速度Vx数値入力" },
        { id: "sunVySlider",        name: "太陽初期速度Vyスライダー" },
        { id: "sunVyInput",         name: "太陽初期速度Vy数値入力" },
        { id: "sunVzSlider",        name: "太陽初期速度Vzスライダー" },
        { id: "sunVzInput",         name: "太陽初期速度Vz数値入力" },
        { id: "objMass",            name: "新規天体質量スライダー" },
        { id: "objMassInput",       name: "新規天体質量数値入力" },
        { id: "useFixedObjMass",    name: "一律質量固定チェック" },
        { id: "bodyCount",          name: "天体数スライダー" },
        { id: "bodyCountInput",     name: "天体数数値入力" },
        { id: "speedSlider",        name: "シミュレーション速度スライダー" },
        { id: "speedInput",         name: "シミュレーション速度数値入力" },
        { id: "trailColorModeSelect", name: "軌跡色彩モード選択" },

        // --- 宇宙自転・カメラ操作 ---
        { id: "cameraRotateSpeed",  name: "宇宙自動回転スライダー" },
        { id: "rotateSpeedInput",   name: "宇宙自動回転数値入力" },
        { id: "btnToggleRotate",    en: "AUTO", ja: "自動" },
        { id: "camEquatorBtn",      en: "EQT", ja: "赤道" },
        { id: "camPolarBtn",        en: "PLR", ja: "極域" },
        { id: "camOverviewBtn",     en: "OVW", ja: "俯瞰" },
                // --- リアルタイム統計・監視ラベル ---
        { id: "statAlive",          name: "統計：生存数" },
        { id: "statEscaped",        name: "統計：脱出数" },
        { id: "statCollided",       name: "統計：衝突消滅数" },
        { id: "statRemoved",        name: "統計：距離カリング消滅数" },
        { id: "statNaN",            name: "統計：NaN防衛数" },
        { id: "toggleBaryBtn",      name: "バリセンター表示トグル" },
        { id: "statRealTime",       name: "統計：現実観測時間" },
        { id: "statRunTime",        name: "統計：シミュレーション稼働時間" },
        { id: "statSimTime",        name: "統計：宇宙経過時間" }
    ];
        window.UI_DEBUG = true;

    // 🛡️【安全表示名ヘルパー】どのプロパティ定義でも表示名を落とさず抽出
    function getUIName(ui) {
        return ui.name || ui.ja || ui.en || ui.id;
    }


  // ========================================================
    // DOM構築完了待機 ＆ 初期化
    // ========================================================
    document.addEventListener("DOMContentLoaded", () => {
        initializeUniverseControlCenter();
    });

    function initializeUniverseControlCenter() {
        attachUIWatchersAndLogics();
                const testBtn = document.getElementById("consoleTestBtn");
        if (testBtn) {
            testBtn.onclick = function() {
                executeConsoleSelfTest();
                setTimeout(() => {
                    runDOMConnectionCheck();
                }, 200);
            };
        }
    }

   // ========================================================
// 規律4-A：【診断ロジック】純粋な観測とエラー検知（ログ出力専用）
// ========================================================
function executeConsoleSelfTest() {
    console.log("%c[診断01: LOG] コンソール通信は正常や。", "color: #00ff00;");
    console.warn("[診断02: WARN] 警告表示（黄色）の出力確認。");
    console.error("[診断03: ERROR] エラー表示（赤色）の出力確認。");
}

function runDOMConnectionCheck() {
    console.log("%c=========================================", "color: #ff8800; font-weight: bold;");
    console.log("%c UI接続診断：全計器の開通テストを開始...", "color: #00ffff; font-weight: bold;");
    console.log("%c=========================================", "color: #ff8800; font-weight: bold;");

    let healthy = 0;
    // UI_MAP の存在チェック付き安全ループ
    const targetMap = (typeof UI_MAP !== "undefined" && Array.isArray(UI_MAP)) ? UI_MAP : (window.UI_MAP || []);

    for (const ui of targetMap) {
        const el = document.getElementById(ui.id);
        // 👑【一元化】安全表示名ヘルパー getUIName を使用して名前を確実に抽出
        const uiDisplayName = (typeof getUIName === "function") ? getUIName(ui) : (ui.name || ui.ja || ui.id);

        if (el) {
            console.log(` 【${uiDisplayName}】(ID: ${ui.id}) ── 正常確認 (${el.tagName})`);
            healthy++;
        } else {
            console.error(` 【${uiDisplayName}】(ID: ${ui.id}) ── 迷子！HTML側のIDを確認せよ`);
        }
    }
    console.log("-----------------------------------------");
    console.log(` 総合結果: ${healthy} / ${targetMap.length} 基がオンライン。`);
    console.log("=========================================");
}

// --------------------------------------------------------
// 診断ロジックB：動的ログ（操作された時にコンソールに吐き出す）
// --------------------------------------------------------
function logUIActivity(ui, value, type) {
    if (!window.UI_DEBUG || !ui) return;

    // 👑【バグパージ】ui.name 直参照をやめ、getUIName で安全に表示名を取得（undefined印字を根絶）
    const uiDisplayName = (typeof getUIName === "function") ? getUIName(ui) : (ui.name || ui.ja || ui.en || ui.id);

    if (type === "click") {
        console.log(` [操作検知] ${uiDisplayName} がクリックされました。`);
    } else if (type === "change") {
        console.log(` [計器変動] ${uiDisplayName} ──> 現在値: ${value}`);
    }
}

// ========================================================
// 本体ロジック ＆ 多重登録防止イベントアタッチ（二重発火完全パージ版）
// ========================================================
function attachUIWatchersAndLogics() {
    // 🛡️ UI_MAP の安全参照フォールバック
    const targetMap = (typeof UI_MAP !== "undefined" && Array.isArray(UI_MAP))
        ? UI_MAP
        : (typeof window !== "undefined" && window.UI_MAP ? window.UI_MAP : []);

    for (const ui of targetMap) {
        const el = document.getElementById(ui.id);
        if (!el) continue;

        // 👑【多重登録防止】既にアタッチ済みの要素は安全にスキップ
        if (el.dataset.uiWatchAttached) continue;
        el.dataset.uiWatchAttached = "true";

        // --- INPUT / SELECT 系のイベント仕込み ---
        if (el.tagName === "INPUT" || el.tagName === "SELECT") {
            const isCheckbox = el.type === "checkbox";
            const isSelect = el.tagName === "SELECT" || el.type === "select-one";

            // 💡 SELECT タグおよび Checkbox は "change"、それ以外（range 等）は "input" に明確化
            const primaryEventType = (isCheckbox || isSelect) ? "change" : "input";

            const handleInputChange = (e) => {
                const currentVal = isCheckbox ? el.checked : e.target.value;
                if (typeof logUIActivity === "function") {
                    logUIActivity(ui, currentVal, "change");
                }
                if (typeof executeInputCoreLogic === "function") {
                    executeInputCoreLogic(ui.id, currentVal);
                }
            };

            // 👑【バグパージ】1 つの要素に対して主イベントタイプ 1 つのみを登録（二重発火を完全遮断）
            el.addEventListener(primaryEventType, handleInputChange);
        }

        // --- BUTTON 系のイベント仕込み ---
        if (el.tagName === "BUTTON") {
            el.addEventListener("click", () => {
                if (typeof logUIActivity === "function") {
                    logUIActivity(ui, null, "click");
                }
                if (typeof executeButtonCoreLogic === "function") {
                    executeButtonCoreLogic(ui.id, el);
                }
            });
        }
    }
}


// ========================================================
    // INPUT / SLIDER / SELECT の更新エンジン
    // ========================================================
    function executeInputCoreLogic(id, val) {
        const numVal = parseFloat(val);
        switch (id) {
            // 💡 軌跡カラーモード選択の即時注入 ＆ 描画更新通知
            case "trailColorModeSelect":
                if (typeof settings !== "undefined") {
                    settings.trailColorMode = val; // "dynamic", "eccentric", "pure", "white"
                    console.log(`🎨 [軌跡色彩切替] モード ──> ${val}`);
                }
                if (typeof cameraChanged !== "undefined") {
                    cameraChanged = true;
                }
                break;

            case "cameraRotateSpeed":
            case "rotateSpeedInput":
                if (typeof camera !== "undefined") {
                    camera.autoRotateSpeed = numVal;
                }
                break;
        }
    }


// ========================================================
    // BUTTON の状態切り替えエンジン
    // ========================================================
    function executeButtonCoreLogic(id, element) {
        switch (id) {
            case "btnToggleRotate":
                window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
                if (element) {
                    if (window.isAutoRotateEnabled) {
                        element.classList.add("toggle-on");
                        element.classList.remove("toggle-off");
                    } else {
                        element.classList.add("toggle-off");
                        element.classList.remove("toggle-on");
                    }
                }
                if (typeof updateButtonLabels === "function") updateButtonLabels();
                break;

            case "camEquatorBtn":
                if (typeof applyCameraPreset === "function") applyCameraPreset("equator");
                break;

            case "camPolarBtn":
                if (typeof applyCameraPreset === "function") applyCameraPreset("polar");
                break;

            case "camOverviewBtn":
                if (typeof applyCameraPreset === "function") applyCameraPreset("overview");
                break;

            case "startBtn":
                if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = true;
                break;

            case "stopBtn":
                if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = false;
                break;

            case "resetBtn":
                if (typeof simulationState !== "undefined") {
                    simulationState.elapsedTime = 0;
                }
                window.realAccumulatedTime = 0;
                if (typeof lastTime !== "undefined") {
                    lastTime = performance.now();
                }
                if (typeof generateBodies === "function") {
                    generateBodies();
                }
                if (typeof updateSimTimeUI === "function") {
                    updateSimTimeUI();
                }
                break;
        }
    }
})(); // 👈 閉じ括弧を補正して即時関数を正しくバインド

// ========================================================
// ⏳ 時間統治レイヤー：変数定義と三連時計マトリクス（外側）
// ========================================================

// 🛑 【Sim時間が止まらなかったカルマをパージする新兵器】
// 起動時刻の差分ではなく「メインループが動いている現実の時間」だけを
// 正確にストップウォッチとして積み上げるための「現実の累積秒数」よ！
window.realAccumulatedTime = 0;

/**
 * 宇宙時間(AGE) ＆ 現実時間(REAL) ＆ 稼働時間(RUN) を一斉に同期するコア関数
 */
function updateSimTimeUI() {
    // --- 1. 宇宙時間の同期 (AGE) ---
    const elSim = document.getElementById("statSimTime");
    if (elSim && typeof simulationState !== "undefined") {
        const DAYS_PER_SEC = 10;
        const totalDays = simulationState.elapsedTime * DAYS_PER_SEC;
        const years = (totalDays / 365) | 0;
        const remDays1 = totalDays % 365;
        const months = (remDays1 / 30) | 0;
        const days = (remDays1 % 30) | 0;
        const seconds = ((simulationState.elapsedTime % 1) * 60).toFixed(1);
        elSim.textContent = `AGE: ${String(years).padStart(4, '0')} Yr, ${String(months).padStart(2, '0')} Mo, ${String(days).padStart(2, '0')} Day [${seconds}s]`;
    }

    // --- 2. 現実時間の同期 (REAL) ---
    const elReal = document.getElementById("statRealTime");
    if (elReal) {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        elReal.textContent = `REAL: ${hrs}:${mins}:${secs}`;
    }

    // --- 3. シミュレーション稼働時間の同期 (RUN) ---
    const elRun = document.getElementById("statRunTime");
    if (elRun) {
        const totalSec = window.realAccumulatedTime || 0; // 👈 window. から読み出す！
        const runMins = (totalSec / 60) | 0;
        const runSecs = (totalSec % 60).toFixed(1);
        elRun.textContent = `RUN: ${String(runMins).padStart(2, '0')}:${String(runSecs).padStart(4, '0')}`;
    }
}

// 👑【宇宙創世のマスターリセット関数】
// キーボードもマウスも、全員この関数を呼び出すように強制統一する！
function executeAbsoluteReset() {
    console.log("🌌 宇宙の完全なる再起動シーケンスを開始します。");

    // 1. 2つの時間軸を完全に過去にする
    if (typeof simulationState !== "undefined") {
        simulationState.elapsedTime = 0;
    }
    window.realAccumulatedTime = 0;

    // 2. FPS計算の基準点を今にロックする
    if (typeof lastTime !== "undefined") {
        lastTime = performance.now();
    }

    // 3. 【ターン数のリセットはここだ！】
    // あなたのシステムでターン数を管理している変数（例: turn や totalTurns）をここで 0 にしなさい！
    if (typeof turn !== "undefined") {
        turn = 0;
    }

    // 4. 天体たちを完全に再生成する
    if (typeof generateBodies === "function") {
        generateBodies();
    }

    // 5. ゼロになった瞬間を即座にUIに焼き付ける
    if (typeof updateSimTimeUI === "function") {
        updateSimTimeUI();
    }
}

// 📡 宇宙管制・UI表記デトックスパッチ（クリック後・言語切り替え完全追従版）
function applyMinimalUITexts() {
  // 1. 各要素のIDと、上書きしたい「極限まで削った文字（ステータス変化対応）」の定義
 const minimalLabels = {
    "toggleSettingsBtn": { text: "SET ▼", en: "SET ▼", ja: "設定 ▼" },
        // 👑 初期状態は「RUN（稼働中）」なので、ここもRUNに統一！
    "startBtn":          { text: "RUN (Q)", en: "RUN (Q)", ja: "稼働 (Q)" },
        "resetBtn":          { text: "RST (E)", en: "RST (E)", ja: "リセット (E)" },
   "triggerGoliathBtn": { text: "SUN II", en: "SUN II", ja: "第二の太陽" },
    "toggleLangBtn":     { text: "LANG: EN", en: "LANG: EN", ja: "言語: JA" },
    // プリセット系
    "presetStableBtn":   { text: "PRST: STB", en: "PRST: STB", ja: "軌道: 安定" },
    "presetChaosBtn":    { text: "PRST: CHS", en: "PRST: CHS", ja: "軌道: 崩壊" },
    "presetScatterBtn":  { text: "PRST: SCT", en: "PRST: SCT", ja: "軌道: 散乱" },
    "presetRenderBtn":   { text: "PRST: LDF", en: "PRST: LDF", ja: "軌道: 負荷" },

    // カメラ系
    // カメラ系
  // 👑 【調律】実際のボタンの文字とデータソースを100%一致させる
  "btnOrbitCam":       { text: "ORBIT", en: "ORBIT", ja: "周回" },
  // 👑 【一本化】重複していたブロックを削ぎ落とし、純度100%の1セットのみ残す
"camEquatorBtn":  { text: "EQT", en: "EQT", ja: "赤道" },
"camPolarBtn":    { text: "PLR", en: "PLR", ja: "極域" },
"camOverviewBtn": { text: "OVW", en: "OVW", ja: "俯瞰" },
   // 👑 状態の「OFF」文字を完全パージ。文字はシンプルにこれだけで固定！
"btnToggleRotate": { text: "AUTO", en: "AUTO", ja: "自動" },

    // ベクトル・軌跡系
   "toggleBaryBtn":     { text: "BARY(B)", en: "BARY(B)", ja: "重心(B)" },
   "toggle-momentum-btn": { text: "L-VEC(V)", en: "L-VEC(V)", ja: "角運動量(V)" },
  // 👑 【調律】「-TRK」も括弧も完全パージ。表面は冷徹な記号で固定
"cometTrailBtn":  { text: "CMT(I)", en: "CMT(I)", ja: "彗星(I)" },
"planetTrailBtn": { text: "PLN(O)", en: "PLN(O)", ja: "惑星(O)" },
"sunTrailBtn":    { text: "SUN(P)", en: "SUN(P)", ja: "太陽(P)" },
"showNames": { text: "NAME N", en: "NAME N", ja: "名前 N" },
    // その他
    "consoleTestBtn":    { text: "DIAG", en: "DIAG", ja: "診断" },
    "copyTelemetryBtn":  { text: "COPY", en: "COPY", ja: "コピー" }
  };

  // 2. 骨組み（data属性）の文字のデータベース自体を、短い文字で完全に破壊・書き換える
  for (const [id, labelData] of Object.entries(minimalLabels)) {
    const el = document.getElementById(id);
    if (el) {
      // HTMLが持っている「長い元データ属性」を、短い文字で上書きして上流を塞ぐ
      el.setAttribute("data-en", labelData.en);
      el.setAttribute("data-ja", labelData.ja);
            // 初回のテキスト強制上書き
      if (typeof currentLang === "undefined" || currentLang === "en") {
        el.textContent = labelData.text;
      }
    }
  }
}

// 執行
setTimeout(applyMinimalUITexts, 100);


// 👑 【真・開通】AUTOボタンがクリックされたら、コアロジックへ自身(element)を叩き込む
const autoRotateBtn = document.getElementById("btnToggleRotate");
if (autoRotateBtn) {
    autoRotateBtn.addEventListener("click", function() {
        // executeButtonCoreLogicに「ID」と「ボタンの要素本体(this)」を渡して執行！
        if (typeof executeButtonCoreLogic === "function") {
            executeButtonCoreLogic("btnToggleRotate", this);
        }
    });
}



// =====================================================================
// 👑 仕様変更：F12連動・戦術HUD【完全トグル（ON/OFF）制御】
// =====================================================================
let isDeveloperHUDActive = false; // 初期状態は非表示（漆黒の宇宙）

// 1. F12キー（KeyCode: 123）の入力を「絶対的な反転トリガー」に拘束
window.addEventListener("keydown", (e) => {
  if (e.key === "F12" || e.keyCode === 123) {
    // 状態を完全に反転（ONならOFFへ、OFFならONへ）
    isDeveloperHUDActive = !isDeveloperHUDActive;
    console.log(`TACTICAL HUD: TOGGLED -> ${isDeveloperHUDActive ? "ACTIVE" : "SLEEP"}`);
        // ONになった瞬間だけ、初動の焼き付けを執行
    if (isDeveloperHUDActive) {
      setTimeout(() => {
        if (typeof drawScreenHUD === "function") drawScreenHUD();
      }, 10);
    }
  }
});

// 2. ウィンドウのリサイズ（F12展開による画面の歪み）への追従
window.addEventListener("resize", () => {
  // ★ここがディフェンスの要！HUDがONの時だけ、サイズ変更に合わせて再描画をかける（勝手にトグルさせない）
  if (isDeveloperHUDActive) {
    setTimeout(() => {
      if (typeof drawScreenHUD === "function") drawScreenHUD();
    }, 10);
  }
});


// ========================================================
// 部屋2：宇宙管制盤・ボタンが押された時の中央集約ロジック（修復・完全統合版）
// ========================================================
window.executeButtonCoreLogic = function(id, element) {
    // IDから直接HTMLのボタンを強制サンプリング（迷子参照を完全に防空）
    const targetBtn = document.getElementById(id) || element;
    if (!targetBtn) return;

    switch (id) {
        // 🛸 【復元】AUTO ROTATE（自動回転）制御ロジック
        case "btnToggleRotate":
            window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
                        if (window.UI_DEBUG) {
                console.log(`🛸 [本体連動] window.isAutoRotateEnabled ──> ${window.isAutoRotateEnabled}`);
            }

            if (targetBtn) {
                if (window.isAutoRotateEnabled) {
                    targetBtn.classList.add("toggle-on", "active");
                    targetBtn.classList.remove("toggle-off");
                    targetBtn.innerText = "ON";
                } else {
                    targetBtn.classList.add("toggle-off");
                    targetBtn.classList.remove("toggle-on", "active");
                    targetBtn.innerText = "AUTO";
                }
            }
            if (typeof updateButtonLabels === "function") updateButtonLabels();
            break;

        // ⚙️ 重心幾何調律 (BARYCENTER) 制御ロジック
        case "toggleBaryBtn":
            let currentStage = parseInt(targetBtn.getAttribute("data-bary-stage"));
            if (isNaN(currentStage)) currentStage = 0;

            if (currentStage === 0) {
                currentStage = 2; window.showBarycenter = true; window.barycenterTargetCount = 2;
                targetBtn.classList.add("toggle-on"); targetBtn.classList.remove("toggle-off");
            } else if (currentStage === 2) { currentStage = 3; window.barycenterTargetCount = 3;
            } else if (currentStage === 3) { currentStage = 4; window.barycenterTargetCount = 4;
            } else if (currentStage === 4) { currentStage = 8; window.barycenterTargetCount = 8;
            } else if (currentStage === 8) { currentStage = 15; window.barycenterTargetCount = 15;
            } else {
                currentStage = 0;
                window.showBarycenter = false;
                window.barycenterTargetCount = 2;
                targetBtn.classList.add("toggle-off");
                targetBtn.classList.remove("toggle-on");
            }

            targetBtn.setAttribute("data-bary-stage", currentStage.toString());

            const langBtnElement = document.getElementById("toggleLangBtn");
            const isJapanese = langBtnElement ? (langBtnElement.innerText.includes("EN") || langBtnElement.textContent.includes("EN")) : true;

            if (currentStage === 0) {
                targetBtn.innerText = isJapanese ? "重心: 全閉" : "BARY: OFF";
            } else {
                targetBtn.innerText = isJapanese ? `重心: ${currentStage}天体` : `BARY: ${currentStage}-BODY`;
            }

            console.log(`%c ⚙️ [重心幾何調律] Stage: ${currentStage} / 算入数: ${window.barycenterTargetCount} / 表示: ${window.showBarycenter}`, "color: #00ffcc; font-weight: bold;");
            break;

        // 時間制御系
        case "startBtn":
            if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = true;
            break;

        case "stopBtn":
            if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = false;
            break;

        case "resetBtn":
            if (typeof executeAbsoluteReset === "function") {
                executeAbsoluteReset();
            }
            break;
    }
};

/**
 * ☀️ 最小半径天体を自動ロックし、
 * 「周回軌道上の P/A」・「面積速度ピザ」・「エネルギー相互変換(K/U)」・「全軌道要素」を描画する (バグ修正版)
 */
function drawLVecAreaRadar(bodies, sun, targetHistory) {
  const hud = document.getElementById("tactical-hud");

  if (!sun || !bodies || bodies.length <= 1) {
    if (hud) hud.style.display = "none";
    return;
  }

  // ── 1. 🎯 名指し指定（LOCK）の判定 ＆ 自動選出 ──
  let target = null;

  if (window.selectedTargetName && window.selectedTargetName.toUpperCase() !== "AUTO") {
    const searchTargetUpper = window.selectedTargetName.toUpperCase();
    target = bodies.find(b => b && b.name && b.name.toUpperCase() === searchTargetUpper);
  }

  if (!target) {
    let minScore = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b || b === sun) continue;

      const m = b.mass || 1;
      const rx = b.x - sun.x, ry = b.y - sun.y, rz = b.z - sun.z;
      const vx = b.vx || 0,   vy = b.vy || 0,   vz = b.vz || 0;

      const hx = ry * vz - rz * vy;
      const hy = rz * vx - rx * vz;
      const hz = rx * vy - ry * vx;
      const h = Math.sqrt(hx * hx + hy * hy + hz * hz);

      const score = h / (m * m);
      if (score < minScore) {
        minScore = score;
        target = b;
      }
    }
  }

  if (!target) {
    if (hud) hud.style.display = "none";
    return;
  }

  // ── ターゲット切り替え時の履歴＆状態のクリア ──
  if (window._lastRadarTarget !== target) {
    targetHistory.length = 0;
    window._lastRadarTarget = target;
  }

  // ── 2. 🌌 ケプラー力学に基づく「真の P/A ベクトル」の幾何学リアルタイム算出 ──
  const curDx = target.x - sun.x;
  const curDy = target.y - sun.y;
  const curDz = target.z - sun.z;
  const curR = Math.sqrt(curDx * curDx + curDy * curDy + curDz * curDz) || 1e-6;

  let tvx = target.vx || 0, tvy = target.vy || 0, tvz = target.vz || 0;
  let svx = sun.vx || 0,    svy = sun.vy || 0,    svz = sun.vz || 0;
  const relVx = tvx - svx,  relVy = tvy - svy,    relVz = tvz - svz;
  const vMag2 = relVx * relVx + relVy * relVy + relVz * relVz;

  const gConst = (typeof G !== "undefined") ? G : 0.5;
  const mu = gConst * ((sun.mass || 2000) + (target.mass || 1));

  // 離心率ベクトル (Eccentricity Vector) の厳密導出
  const r_dot_v = curDx * relVx + curDy * relVy + curDz * relVz;
  const ex = ((vMag2 - mu / curR) * curDx - r_dot_v * relVx) / mu;
  const ey = ((vMag2 - mu / curR) * curDy - r_dot_v * relVy) / mu;
  const ez = ((vMag2 - mu / curR) * curDz - r_dot_v * relVz) / mu;
  const eccCalc = Math.sqrt(ex * ex + ey * ey + ez * ez);

  // 軌道長半径 a の計算
  const invA = (2 / curR) - (vMag2 / mu);
  const semiACalc = (invA > 0) ? (1 / invA) : null;

  // P点・A点の幾何学的更新（離心率ベクトル方向へ展開）
  if (eccCalc >= 0.03 && semiACalc) {
    const ux = ex / eccCalc, uy = ey / eccCalc, uz = ez / eccCalc;
    const rPeri = semiACalc * (1 - eccCalc);
    const rApho = semiACalc * (1 + eccCalc);

    // 太陽の「現在地」を基準とした絶対座標で保存
    target.periPoint = { x: sun.x + ux * rPeri, y: sun.y + uy * rPeri, z: sun.z + uz * rPeri, rMag: rPeri };
    target.aphoPoint = { x: sun.x - ux * rApho, y: sun.y - uy * rApho, z: sun.z - uz * rApho, rMag: rApho };
  } else {
    // 円軌道 (ecc < 0.03) の場合は P/A 不定として消去
    target.periPoint = null;
    target.aphoPoint = null;
  }

  // ── 履歴の更新（太陽からの相対座標で記録） ──
  if (targetHistory.length > 0) {
    const last = targetHistory[targetHistory.length - 1];
    if (last.rx !== curDx || last.ry !== curDy || last.rz !== curDz) {
      targetHistory.push({ rx: curDx, ry: curDy, rz: curDz });
    }
  } else {
    targetHistory.push({ rx: curDx, ry: curDy, rz: curDz });
  }

  if (targetHistory.length > 300) targetHistory.shift();

  ctx.save();

// =======================================================
// 👑 3. 🍕 ネオンピザ残像の描画（Zero-Allocation ＆ キャッシュバグ完全防空版）
// =======================================================

// 👑 【Zero-Allocation】回転演算用の事前固定スロット
const pizzaAbsTemp = { x: 0, y: 0, z: 0 };

if (targetHistory && targetHistory.length >= 10) {
  // 🛡️ 防空1: 太陽の投影座標を取得
  pizzaAbsTemp.x = sun.x;
  pizzaAbsTemp.y = sun.y;
  pizzaAbsTemp.z = sun.z;
    const sunRot = (typeof rotate3D === "function") ? rotate3D(pizzaAbsTemp) : pizzaAbsTemp;
  const pSun = (typeof project3D === "function") ? project3D(sunRot.x, sunRot.y, sunRot.z) : null;

  if (pSun && pSun.visible !== false && !isNaN(pSun.x) && !isNaN(pSun.y)) {
    const historyLen = targetHistory.length;

    ctx.save();
    for (let i = 1; i < historyLen; i++) {
      const prevRel = targetHistory[i - 1];
      const currRel = targetHistory[i];
      if (!prevRel || !currRel) continue;

      // 👑 【Zero-Allocation】前フレーム絶対座標の書き込み
      pizzaAbsTemp.x = sun.x + (prevRel.rx || 0);
      pizzaAbsTemp.y = sun.y + (prevRel.ry || 0);
      pizzaAbsTemp.z = sun.z + (prevRel.rz || 0);
      const prevRot = (typeof rotate3D === "function") ? rotate3D(pizzaAbsTemp) : pizzaAbsTemp;
      const pPrev = (typeof project3D === "function") ? project3D(prevRot.x, prevRot.y, prevRot.z) : null;

      // 👑 【Zero-Allocation】現フレーム絶対座標の書き込み
      pizzaAbsTemp.x = sun.x + (currRel.rx || 0);
      pizzaAbsTemp.y = sun.y + (currRel.ry || 0);
      pizzaAbsTemp.z = sun.z + (currRel.rz || 0);
      const currRot = (typeof rotate3D === "function") ? rotate3D(pizzaAbsTemp) : pizzaAbsTemp;
      const pCurr = (typeof project3D === "function") ? project3D(currRot.x, currRot.y, currRot.z) : null;

      // 🛡️ 防空2: 背後・不可視領域への描画漏れ（残像化）を完全遮断
      if (!pPrev || pPrev.visible === false || !pCurr || pCurr.visible === false) continue;
      if (isNaN(pPrev.x) || isNaN(pPrev.y) || isNaN(pCurr.x) || isNaN(pCurr.y)) continue;

      const ageFactor = Math.pow(i / historyLen, 2);

      // 👑 【高速化】重い RadialGradient を廃止し、軽量かつ美しいアルファ合成パスへ昇華
      ctx.fillStyle = `rgba(0, 255, 136, ${0.12 * ageFactor})`;
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.25 * ageFactor})`;
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(pSun.x, pSun.y);
      ctx.lineTo(pPrev.x, pPrev.y);
      ctx.lineTo(pCurr.x, pCurr.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

  // ── 4. 🔴/🔵 固定された「周回軌道上の P 点 / A 点」を描画（Canvas上） ──
  if (target.periPoint) {
    const absP = target.periPoint;
    const rotP = rotate3D(absP);
    const pProj = project3D(rotP.x, rotP.y, rotP.z);
    if (pProj.visible) {
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(pProj.x, pProj.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 68, 0, 0.95)";
      ctx.font = "bold 9px monospace";
      const pText = `P(${absP.x.toFixed(0)}, ${absP.y.toFixed(0)}, ${absP.z.toFixed(0)})`;
      ctx.fillText(pText, pProj.x + 6, pProj.y - 3);
    }
  }

  if (target.aphoPoint) {
    const absA = target.aphoPoint;
    const rotA = rotate3D(absA);
    const aProj = project3D(rotA.x, rotA.y, rotA.z);
    if (aProj.visible) {
      ctx.fillStyle = "#00d5ff";
      ctx.beginPath();
      ctx.arc(aProj.x, aProj.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0, 213, 255, 0.85)";
      ctx.font = "9px monospace";
      const aText = `A(${absA.x.toFixed(0)}, ${absA.y.toFixed(0)}, ${absA.z.toFixed(0)})`;
      ctx.fillText(aText, aProj.x + 6, aProj.y - 3);
    }
  }

  // ── 5. 🎯 天体位置の「ターゲット角枠（□）」を描画（Canvas上） ──
  const lockRot = rotate3D({ x: target.x, y: target.y, z: target.z });
  const pLock = project3D(lockRot.x, lockRot.y, lockRot.z);

  if (pLock.visible) {
    const boxSize = 12;
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1.2;

    ctx.strokeRect(pLock.x - boxSize / 2, pLock.y - boxSize / 2, boxSize, boxSize);

    ctx.fillStyle = "#00ff88";
    ctx.fillRect(pLock.x - boxSize / 2 - 2, pLock.y - boxSize / 2 - 2, 3, 3);
    ctx.fillRect(pLock.x + boxSize / 2 - 1, pLock.y - boxSize / 2 - 2, 3, 3);
    ctx.fillRect(pLock.x - boxSize / 2 - 2, pLock.y + boxSize / 2 - 1, 3, 3);
    ctx.fillRect(pLock.x + boxSize / 2 - 1, pLock.y + boxSize / 2 - 1, 3, 3);

    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#00ff88";
    ctx.fillText(`[${target.name || "INNER"}]`, pLock.x - 14, pLock.y - boxSize / 2 - 4);
  }

  ctx.restore();

  // ── 6. 📊 画面右下固定 Tactical HUD（更新処理） ──
  if (hud) {
    hud.style.display = "block";

    const rx = target.x - sun.x;
    const ry = target.y - sun.y;
    const rz = target.z - sun.z;
    const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;

    const vMag = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

    // 面積速度 dS/dt
    const cx = ry * relVz - rz * relVy;
    const cy = rz * relVx - rx * relVz;
    const cz = rx * relVy - ry * relVx;
    const areaVal = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    const areaVelocityText = (!isNaN(areaVal) && isFinite(areaVal)) ? areaVal.toFixed(1) : "0.0";

    const m = target.mass || 1.0;

    // エネルギー計算
    const K = 0.5 * m * (vMag * vMag);
    const U_abs = (mu * m) / rMag;
    const totalE_abs = (K + U_abs) || 1;
    const kRatio = Math.min(1, Math.max(0, K / totalE_abs));

    // 軌道タイプ判定
    let orbitType = "ELLIPSE";
    if (eccCalc < 0.05) orbitType = "CIRCULAR";
    else if (eccCalc < 0.98) orbitType = "ELLIPSE";
    else if (eccCalc < 1.02) orbitType = "PARABOLA";
    else orbitType = "HYPERBOLA";

    let periodText = "--";
    let semiAText = "--";
    if (semiACalc && semiACalc > 0) {
      semiAText = semiACalc.toFixed(1);
      const period = 2 * Math.PI * Math.sqrt(Math.pow(semiACalc, 3) / mu);
      periodText = `${period.toFixed(1)}s`;
    }

    // HUDテキスト反映
    const displayName = target.name || "INNER";
    const targetMass = (target.mass !== undefined) ? target.mass.toFixed(1) : "1.0";

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

    setTxt("hud-title", `TARGET: ${displayName} [LOCKED]`);
    setTxt("hud-mass", `MASS: ${targetMass}`);

// ★追加: 合体数の表示（1体の場合は 1 BODY、複数の場合は X BODIES）
    const mergeCount = target.mergeCount || 1;
    setTxt("hud-merged", `MERGED: ${mergeCount} ${mergeCount > 1 ? "BODIES" : "BODY"}`);

    setTxt("hud-vel", `VEL: ${vMag.toFixed(2)}`);
    setTxt("hud-dist", `DIST: ${rMag.toFixed(1)}`);
    setTxt("hud-area", `dS/dt: ${areaVelocityText}`);

    const typeElem = document.getElementById("hud-orbit-type");
    if (typeElem) {
      typeElem.innerText = `TYPE: ${orbitType}`;
      typeElem.style.color = (orbitType === "CIRCULAR") ? "#00ff88" : (orbitType === "ELLIPSE") ? "#ffbb00" : "#ff3366";
    }

    setTxt("hud-ecc", `e: ${eccCalc.toFixed(2)}`);
    setTxt("hud-period", `PERIOD(T): ${periodText}`);
    setTxt("hud-semi-a", `a: ${semiAText}`);
    setTxt("hud-pos", `POS: (${target.x.toFixed(0)}, ${target.y.toFixed(0)}, ${target.z.toFixed(0)})`);

    const pStr = target.periPoint ? `P(${target.periPoint.x.toFixed(0)},${target.periPoint.y.toFixed(0)},${target.periPoint.z.toFixed(0)})` : `P(--)`;
    const pRStr = target.periPoint ? `r:${target.periPoint.rMag.toFixed(1)}` : `r:--`;
    setTxt("hud-peri", `PERI: ${pStr} [${pRStr}]`);

    const aStr = target.aphoPoint ? `A(${target.aphoPoint.x.toFixed(0)},${target.aphoPoint.y.toFixed(0)},${target.aphoPoint.z.toFixed(0)})` : `A(--)`;
    const aRStr = target.aphoPoint ? `r:${target.aphoPoint.rMag.toFixed(1)}` : `r:--`;
    setTxt("hud-apho", `APHO: ${aStr} [${aRStr}]`);

    setTxt("hud-eng-text", `ENG [K:${(kRatio * 100).toFixed(0)}% | U:${((1 - kRatio) * 100).toFixed(0)}%]`);
    const kBarElem = document.getElementById("hud-k-bar");
    if (kBarElem) kBarElem.style.width = `${(kRatio * 100).toFixed(1)}%`;
  }
}

// 🎯 グローバルターゲット設定
window.selectedTargetName = "AUTO";

document.addEventListener("DOMContentLoaded", () => {
  // 1. ボタン処理（変数名を lvecMode / lVecMode の不一致が起きないよう統一）
  const momentumBtn = document.getElementById("toggle-momentum-btn");
  if (momentumBtn) {
    momentumBtn.addEventListener("click", () => {
      const currentMode = window.lvecMode !== undefined ? window.lvecMode : (window.lVecMode || 0);
      const nextMode = (currentMode + 1) % 3;
            window.lvecMode = nextMode;
      window.lVecMode = nextMode; // 互換性維持

      momentumBtn.className = (nextMode === 0) ? "toggle-off" : "toggle-on";
            // OFF時にHUDパネルを非表示にする制御
      const hud = document.getElementById("tactical-hud");
      if (nextMode === 0 && hud) {
        hud.style.display = "none";
      }

      console.log("[L-VEC MODE]:", nextMode);
    });
  }

  // 2. LOCK機能（入力テキストボックス ＆ ボタン配線）
  const targetInput = document.getElementById("targetInput");
  const targetBtn = document.getElementById("targetBtn");

  const applyTargetLock = () => {
    if (!targetInput) return;
    const val = targetInput.value.trim();
        if (val === "" || val.toUpperCase() === "AUTO") {
      window.selectedTargetName = "AUTO";
      targetInput.value = "AUTO";
    } else {
      window.selectedTargetName = val;
    }
    console.log("[TARGET LOCK ENGAGED]:", window.selectedTargetName);
  };

  if (targetBtn) targetBtn.addEventListener("click", applyTargetLock);
  if (targetInput) {
    targetInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyTargetLock();
    });
  }
});


/**
 * LOCK入力（#targetInput）または自動判定から、現在のターゲット天体を取得する
 */
function getSelectedTargetBody(allValidNodes) {
  const inputEl = document.getElementById("targetInput");
  const inputValue = inputEl ? inputEl.value.trim().toUpperCase() : "AUTO";

  if (!allValidNodes || allValidNodes.length === 0) return null;

  // AUTOモード、または入力が空の場合：最も重い天体（Sun等）の「次に重い天体（伴星）」を自動選択
  if (inputValue === "AUTO" || inputValue === "") {
    return allValidNodes.length > 1 ? allValidNodes[1].item : allValidNodes[0].item;
  }

  // 名前（例: "OBJ0", "EARTH" など）でマッチング
  const matchedNode = allValidNodes.find(node => {
    const name = (node.item.b && node.item.b.name) ? node.item.b.name.toUpperCase() : "";
    const id = (node.item.b && node.item.b.id !== undefined) ? String(node.item.b.id).toUpperCase() : "";
    return name === inputValue || id === inputValue || ("OBJ" + id) === inputValue;
  });

  // マッチすればその天体を返し、見つからなければフォールバックで2番目に重い天体を返す
  return matchedNode ? matchedNode.item : (allValidNodes[1] ? allValidNodes[1].item : allValidNodes[0].item);
}

/* =========================================================
   Block 4: DOM構築完了後のUI初期化・イベントハンドラバインド内
   ========================================================= */

// ---------------------------------------------------------
// 1. Sun初期速度スライダーのリアルタイム同期（X, Y, Z 完全安全版）
// ---------------------------------------------------------
[
  { axis: 'x', sliderId: 'sunVxSlider', inputId: 'sunVxInput', settingKey: 'sunInitialVx', bodyKey: 'vx' },
  { axis: 'y', sliderId: 'sunVySlider', inputId: 'sunVyInput', settingKey: 'sunInitialVy', bodyKey: 'vy' },
  { axis: 'z', sliderId: 'sunVzSlider', inputId: 'sunVzInput', settingKey: 'sunInitialVz', bodyKey: 'vz' }
].forEach(config => {
  const slider = document.getElementById(config.sliderId);
  const input = document.getElementById(config.inputId);

  if (!slider || !input) return; // DOM要素非存在時の安全弁

  // 太陽オブジェクトの安全取得
  const getSunBody = () => {
    if (typeof bodies === "undefined" || !Array.isArray(bodies)) return null;
    if (bodies[0] && bodies[0].name === "Sun") return bodies[0];
    return bodies.find(b => b && b.name === "Sun") || null;
  };

  const syncVelocity = (value, source) => {
    const v = Number(value);
        // 🚨 NaNガード: "-" や空文字入力による物理崩壊を阻止
    if (isNaN(v)) return;

    if (typeof settings !== "undefined") {
      settings[config.settingKey] = v;
    }

    const sun = getSunBody();
    if (sun) {
      sun[config.bodyKey] = v;
    }

    if (source === "slider") input.value = value;
    if (source === "input")  slider.value = value;
  };

  slider.addEventListener("input", (e) => syncVelocity(e.target.value, "slider"));
  input.addEventListener("input", (e) => syncVelocity(e.target.value, "input"));
});


// ========================================================
// 🛸 INJECT パネル完全対応：Goliath / Obj 動的強制生成エンジン (ReferenceError対策済)
// 配置場所: Block 2 (物理演算・オブジェクト生成関数エリア)
// ========================================================

// 二重発火防止タイムスタンプ
let lastSpawnTime = 0;

// 1. 本体：Goliath / Obj 動的強制生成コマンド
function spawnGoliathForce() {
    // 🚨 二重発火防止ガード（50ms以内の連続呼び出しを遮断）
    const now = Date.now();
    if (now - lastSpawnTime < 50) return;
    lastSpawnTime = now;

    if (!bodies || !Array.isArray(bodies) || bodies.length === 0) {
        console.error("❌ [召喚失敗] 宇宙に中心星（Sun）が存在しません。");
        return;
    }

    // 太陽オブジェクトの安全な動的検索
    const sun = (bodies[0] && bodies[0].name === "Sun")
        ? bodies[0]
        : (bodies.find(b => b && b.name === "Sun") || bodies[0]);

    if (!sun || isNaN(sun.mass)) {
        console.error("❌ [召喚失敗] 太陽の質量データが無効です。");
        return;
    }

    const S = settings?.spawnSettings;
    const targetMinDist = S?.minDist || 300;
    const targetMaxDist = S?.maxDist || 1200;
    const currentG       = (typeof G !== "undefined") ? G : 1.0;

    // UIからのリアルタイム値取得
    const elType       = document.getElementById("injectType");
    const elMassInput  = document.getElementById("injectMassInput");
    const elMode       = document.getElementById("injectModeSelect");
        const selectedType = elType ? elType.value : "obj";
    const orbitMode    = elMode ? elMode.value : "normal";
        let customMass = elMassInput ? parseFloat(elMassInput.value) : 5.0;
    if (isNaN(customMass) || customMass <= 0) customMass = 5.0;

    // 3次元配置幾何学
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = (orbitMode === "polar")
        ? Math.random() * Math.PI
        : (Math.PI / 2) + (Math.random() - 0.5) * 0.4;

    const r = targetMinDist + Math.random() * (targetMaxDist - targetMinDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

    // ケプラー回転速度演算
    const dist = Math.sqrt(x*x + y*y + z*z) || 1;
    const gravityMult = settings?.gravityMultiplier || 1.0;
        const totalMassInSphere = sun.mass + bodies.reduce((acc, b) => {
        if (b !== sun && Math.sqrt(b.x*b.x + b.y*b.y + b.z*b.z) < dist) return acc + (b.mass || 0);
        return acc;
    }, 0);

    const vBase = Math.sqrt(currentG * gravityMult * totalMassInSphere / dist);
    const spawnVelMult = settings?.spawnVelocityMultiplier || 1.0;
    const v = vBase * spawnVelMult;

    let vx = 0, vy = 0, vz = 0;

    // 軌道モードによるベクトル分岐
    if (orbitMode === "infall") {
        const speed = v * 1.2;
        vx = (-x / dist) * speed;
        vy = (-y / dist) * speed;
        vz = (-z / dist) * speed;
    } else if (orbitMode === "retro") {
        vx = (y / dist) * v;
        vy = (-x / dist) * v;
        vz = (Math.random() - 0.5) * 0.1 * v;
    } else if (orbitMode === "polar") {
        vx = (Math.random() - 0.5) * 0.2 * v;
        vy = (-z / dist) * v;
        vz = (y / dist) * v;
    } else {
        vx = (-y / dist) * v;
        vy = (x / dist) * v;
        vz = (Math.random() - 0.5) * 0.1 * v;
    }

    const safeMassToSize = (m) => {
        if (typeof massToSize === "function") return massToSize(m);
        return Math.pow(m, 1/3) * 2.0;
    };

    let newBody = {};

    if (selectedType === "sun2") {
        newBody = {
            x: x, y: y, z: z, vx: vx, vy: vy, vz: vz,
            mass: customMass,
            size: safeMassToSize(customMass) * 0.3,
            color: "#ff00ff",
            name: "Goliath_" + Date.now().toString().slice(-3),
            type: "planet",
            trail: []
        };
        console.log(`%c 🛸 [異分子召喚] 『Goliath』(M:${customMass.toFixed(1)} / Mode:${orbitMode}) 展開完了！`, "color: #ff00ff; font-weight: bold;");
    } else {
        const t = Math.min(1, dist / (targetMaxDist || 1200));
        const sizeScale = 0.7;
        const size = safeMassToSize(customMass) * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t) * sizeScale;

        newBody = {
            x: x, y: y, z: z, vx: vx, vy: vy, vz: vz,
            mass: customMass,
            size: size,
            color: `rgb(${(180 + 75*t)|0},${(220 + 35*t)|0},255)`,
            name: "Obj_Injected_" + Date.now().toString().slice(-3),
            type: "obj",
            trail: []
        };
        console.log(`%c 🪐 [放浪天体インジェクション] 質量 ${customMass.toFixed(1)} (Mode:${orbitMode}) 軌道投入完了。`, "color: #00ff88; font-weight: bold;");
    }

    bodies.push(newBody);
}

// 2. グローバルバインド ＆ UI自動連動（スコープ分離なしの完全一元化）
window.spawnGoliathForce = spawnGoliathForce;

(function autoBindInjectUI() {
    const bind = () => {
        const slider = document.getElementById("injectMassSlider");
        const input  = document.getElementById("injectMassInput");
        const label  = document.getElementById("injectMassLabel");
        const btn    = document.getElementById("btnExecuteInject");

        if (slider) {
            slider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (input) input.value = val;
                if (label) label.textContent = val.toFixed(1);
            };
        }

        if (input) {
            input.oninput = (e) => {
                const val = parseFloat(e.target.value) || 0;
                if (slider) slider.value = val;
                if (label) label.textContent = val.toFixed(1);
            };
        }

        if (btn) {
            btn.onclick = (e) => {
                if (e) e.preventDefault();
                window.spawnGoliathForce();
            };
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }
})();



/* =========================================================
   Block 4: DOM構築完了後のUI初期化・イベントハンドラバインド内
   ========================================================= */

// ---------------------------------------------------------
// 管制盤テレメトリー：一括クリップボードコピー機能（完全調律版）
// ---------------------------------------------------------
const elCopyBtn = document.getElementById("copyTelemetryBtn");

if (elCopyBtn) {
  elCopyBtn.addEventListener("click", () => {
    // 1. 各種計器からの安全なスキャン
    const getTxt = (id) => {
      const el = document.getElementById(id);
      return el ? el.textContent.trim() : "0";
    };

    // 太陽を動的に検索し、正確な速度を抽出
    const getSunSpeed = () => {
      if (typeof bodies === "undefined" || !Array.isArray(bodies)) return "0.00";
      let sun = bodies[0] && bodies[0].name === "Sun" ? bodies[0] : bodies.find(b => b && b.name === "Sun");
      return sun ? Math.sqrt(sun.vx**2 + sun.vy**2 + sun.vz**2).toFixed(2) : "0.00";
    };

    const turn      = typeof frameCount !== "undefined" ? frameCount : (typeof turnCount !== "undefined" ? turnCount : "Unknown");
    const baryName  = getTxt("barycenterNameDisplay");
    const baryPos   = getTxt("barycenterPosDisplay");
    const baryMass  = getTxt("barycenterMassDisplay");
    const sunSpeed  = getSunSpeed();
        const alive     = getTxt("statAlive");
    const escaped   = getTxt("statEscaped");
    const collided  = getTxt("statCollided");
    const removed   = getTxt("statRemoved"); // 💡 UIには無いが、内部DOM（またはログ）からは抽出
    const nanCount  = getTxt("statNaN");
        const simTime   = getTxt("statSimTime");
    const runTime   = getTxt("statRunTime");
    const realTime  = getTxt("statRealTime");

    // 2. ログフォーマットへの自動整形
    const logText =
`描画公負荷テスト。 ${alive.replace("生存数:", "Obj:")}
Turn: ${turn}
${baryName}
${baryPos}
${baryMass}
Sun Speed: ${sunSpeed}
Alive: ${alive.replace(/[^0-9]/g, '')}
Escaped: ${escaped.replace(/[^0-9]/g, '')}
Collided: ${collided.replace(/[^0-9]/g, '')}
Removed: ${removed.replace(/[^0-9]/g, '')}
NaN: ${nanCount.replace(/[^0-9]/g, '')}  宇宙年齢: ${simTime}
稼働時間: ${runTime}
現実時刻: ${realTime}`.trim();

    // 3. クリップボードへの射出と、鉄の規律に従ったUIフィードバック
    navigator.clipboard.writeText(logText).then(() => {
      const originalText = elCopyBtn.textContent;
      elCopyBtn.textContent = "OK";
            // 🚨 旧来のインラインスタイル(#00ff88等)を完全廃止し、3D立体発光クラスを適用
      elCopyBtn.classList.add("toggle-on");
      elCopyBtn.classList.remove("toggle-off");
            setTimeout(() => {
        elCopyBtn.textContent = originalText;
        elCopyBtn.classList.remove("toggle-on");
        elCopyBtn.classList.add("toggle-off");
      }, 1500);
            if (window.UI_DEBUG) console.log("🛸 [システム] テレメトリーログをクリップボードに格納しました。");
    }).catch(err => {
      console.error("📋 ログのコピーに失敗しました:", err);
    });
  });
}

/* =========================================================
   4. DOM構築完了後のUI初期化・イベントハンドラバインド（安全保護版）
   ※ 既存のリセット機能(Eキー連動)を破壊せず、UI初期化のみを安全に実行します
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    // --- UI ボタン参照の安全取得 ---
  const sunTrailBtn    = document.getElementById("sunTrailBtn");
  const cometTrailBtn  = document.getElementById("cometTrailBtn");
  const planetTrailBtn = document.getElementById("planetTrailBtn");

  // ① トレイル系LEDボタンの初期状態（クラス名）強制バインド
  if (planetTrailBtn) {
    planetTrailBtn.classList.add("toggle-on", "active");
    planetTrailBtn.classList.remove("toggle-off");
  }

  if (cometTrailBtn) {
    cometTrailBtn.classList.add("toggle-on", "active");
    cometTrailBtn.classList.remove("toggle-off");
  }

  if (sunTrailBtn) {
    sunTrailBtn.classList.add("toggle-off");
    sunTrailBtn.classList.remove("toggle-on", "active");
  }

  // ② カメラ自動巡航 UIコントロール初期化
  const camSpeedSlider = document.getElementById("cameraRotateSpeed");
  const camSpeedInput  = document.getElementById("rotateSpeedInput");
  const camSpeedLabel  = document.getElementById("rotateSpeedVal");
  const camToggleBtn   = document.getElementById("btnToggleRotate");

  // UI入力項目の初期数値を強制同期
  if (camSpeedSlider && typeof window.cameraRotateSpeed !== "undefined") {
    camSpeedSlider.value = window.cameraRotateSpeed;
  }
  if (camSpeedInput && typeof window.cameraRotateSpeed !== "undefined") {
    camSpeedInput.value  = window.cameraRotateSpeed;
  }
  if (camSpeedLabel && typeof window.cameraRotateSpeed !== "undefined") {
    camSpeedLabel.textContent = window.cameraRotateSpeed.toString();
  }

  if (camToggleBtn) {
    camToggleBtn.classList.add("toggle-on", "active");
    camToggleBtn.classList.remove("toggle-off");
  }

  // カメラ速度同期用ヘルパー関数
  function syncCameraRotateSpeed(value, isFromInput = false) {
    let val = Number(value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 0.05) val = 0.05;

    if (typeof camera !== "undefined" && camera) {
      camera.autoRotateSpeed = val;
    }
    window.cameraRotateSpeed = val;

    if (camSpeedLabel) camSpeedLabel.textContent = val.toFixed(3);
    if (camSpeedSlider) camSpeedSlider.value = val;
    if (camSpeedInput && !isFromInput) {
      camSpeedInput.value = val;
    }
  }

  // スライダー操作イベント
  if (camSpeedSlider) {
    camSpeedSlider.addEventListener("input", (e) => {
      syncCameraRotateSpeed(e.target.value, false);
    });
  }

  // テキストボックス直接入力イベント
  if (camSpeedInput) {
    camSpeedInput.addEventListener("input", (e) => {
      syncCameraRotateSpeed(e.target.value, true);
    });

    camSpeedInput.addEventListener("blur", (e) => {
      let val = Number(e.target.value);
      if (val < 0) val = 0;
      if (val > 0.05) val = 0.05;
      camSpeedInput.value = val;
    });
  }

  // AUTOボタン（自動回転トグル）
  if (camToggleBtn) {
    camToggleBtn.onclick = function() {
      window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
      if (window.isAutoRotateEnabled) {
        this.classList.add("toggle-on", "active");
        this.classList.remove("toggle-off");
      } else {
        this.classList.add("toggle-off");
        this.classList.remove("toggle-on", "active");
      }
    };
  }

  // ORBITボタン（車載カメラトグル）
  const orbitBtn = document.getElementById("btnOrbitCam");
  if (orbitBtn) {
    orbitBtn.onclick = function() {
      if (typeof camera !== "undefined" && camera && camera.isOrbitCam) {
        if (typeof deactivateOrbitCam === "function") deactivateOrbitCam();
        this.classList.add("toggle-off");
        this.classList.remove("toggle-on", "active");
      } else {
        if (typeof activateOrbitCam === "function") activateOrbitCam();
        if (typeof camera !== "undefined" && camera && camera.isOrbitCam) {
          this.classList.add("toggle-on", "active");
          this.classList.remove("toggle-off");
        }
      }
    };
  }

}); // ← 完全な閉じカッコ



/**
 * カメラの追尾モード（ターゲット追尾 / 絶対原点固定）をトグル切替する
 */
function toggleCameraFollow() {
  // 1. フラグの反転（既存のオブジェクト構造に合わせて安全に反転）
  if (typeof simulationState !== "undefined" && simulationState.camera) {
    const current = simulationState.camera.followTarget ?? simulationState.camera.followSun ?? true;
    const nextState = !current;

    simulationState.camera.followTarget = nextState;
    simulationState.camera.followSun    = nextState; // 互換性保持
  }

  // 2. UI（ボタン表示）の状態同期
  updateFollowButtonUI();
}

/**
 * トグルボタンの表示テキスト・アクティブ状態を同期する
 */
function updateFollowButtonUI() {
  const btn = document.getElementById("btnToggleFollow");
  if (!btn) return;

  const isFollowing = simulationState?.camera?.followTarget ?? true;
  const targetIndex = camera?.targetBodyIndex ?? 0;
  const targetName  = (bodies[targetIndex] && bodies[targetIndex].name) ? bodies[targetIndex].name : "Sun";

  if (isFollowing) {
    btn.textContent = `📷 追尾モード: [ ${targetName} ]`;
    btn.classList.add("active");
  } else {
    btn.textContent = `🌐 固定モード: [ 原点 (0,0,0) ]`;
    btn.classList.remove("active");
  }
}

// =========================================================
// 初期化＆イベントバインド（DOMContentLoaded等で実行）
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  // ① ボタンクリックでの切り替え
  const btn = document.getElementById("btnToggleFollow");
  if (btn) {
    btn.addEventListener("click", toggleCameraFollow);
  }

  // ② キーボードショートカット（[F] キーでトグル切替）
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyF" && e.target.tagName !== "INPUT") {
      toggleCameraFollow();
    }
  });

  // 初期状態のUI反映
  updateFollowButtonUI();
});

/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 3: UI Events / Toggles / Sliders / Settings Link
--------------------------------------------------------- */


/* =========================================================
   UI同期＆各種イベント配線マトリクス (思想統合・完全修復版)
   ========================================================= */

// ---------------------------------------------------------
// 1. Start / Stop / Reset 制御 ＆ クリック演出
// ---------------------------------------------------------
startBtn.onclick = () => {
  simulationState.running = !simulationState.running;

  if (simulationState.running) {
    startBtn.textContent = window.currentLang === 'en' ? "RUN (Q)" : "稼働 (Q)";
    startBtn.classList.add("toggle-on");
    startBtn.classList.remove("toggle-off");
  } else {
    startBtn.textContent = window.currentLang === 'en' ? "PAUSE (Q)" : "停止 (Q)";
    startBtn.classList.add("toggle-off");
    startBtn.classList.remove("toggle-on");
  }
};

// リセットボタン（処理 ＋ 200ms 点灯演出 ＋ ログ＆カラー初期化完全統合版）
resetBtn.onclick = () => {
  // ① 時間の停止 ＆ ボタン表記の同期
  simulationState.running = false;
  startBtn.textContent = window.currentLang === 'en' ? "PAUSE (Q)" : "停止 (Q)";
  startBtn.classList.add("toggle-off");
  startBtn.classList.remove("toggle-on");

  // ② 時間軸のゼロクリア ＆ 👑【課題1解決】HUD吸収ログの完全消去
  if (typeof simulationState !== "undefined") {
    simulationState.elapsedTime = 0;
  }
  window.realAccumulatedTime = 0;
  if (typeof lastTime !== "undefined") {
    lastTime = performance.now();
  }
  window.sunEventLogs = []; // ★ ターミナルHUDの吸収ログを0件へ初期化

  // ③ 宇宙の完全初期化（天体の再生成）
  generateBodies();

  // ④ ターン数の巻き戻しとUI更新
  turnCount = 0;
  if (typeof updateTurnCountDisplay === "function") updateTurnCountDisplay();
  if (typeof updateSimTimeUI === "function") updateSimTimeUI();

  // ⑤ Sunの初期速度（X, Y, Z）をUI入力値から強制執行
  const sun = (bodies && bodies[0] && bodies[0].name === "Sun") ? bodies[0] : (bodies ? bodies.find(b => b && b.name === "Sun") : null);
  if (sun) {
    const inputX = document.getElementById("sunVxInput");
    const inputY = document.getElementById("sunVyInput");
    const inputZ = document.getElementById("sunVzInput");
    if (inputX) sun.vx = Number(inputX.value);
    if (inputY) sun.vy = Number(inputY.value);
    if (inputZ) sun.vz = Number(inputZ.value);
  }

  // 👑【課題2解決】全天体の離心率カラー（青〜赤）を生成直後に一括事前計算
  if (typeof updateBodyEccentricityColor === "function" && Array.isArray(bodies) && sun) {
    for (let i = 0; i < bodies.length; i++) {
      updateBodyEccentricityColor(bodies[i], sun);
    }
  }

  // ⑥ 初期状態（カラー適用済み）をスロット0へ即時保存
  if (typeof saveUniverse === "function") {
    saveUniverse(0);
  }

  // ⑦ ボタンのクリック演出（200ms後に消灯）
  resetBtn.classList.add("toggle-on");
  setTimeout(() => {
    resetBtn.classList.remove("toggle-on");
    resetBtn.classList.add("toggle-off");
  }, 200);
};



// ---------------------------------------------------------
// 2. 軌跡3兄弟 ON/OFF（表記ブレ完全吸収・クラス完全同期版）
// ---------------------------------------------------------
// 彗星軌跡ボタン (CMT)
if (typeof cometTrailBtn !== "undefined" && cometTrailBtn) {
  cometTrailBtn.onclick = () => {
    const current = !!(simulationState.ui.showCometTrail || simulationState.ui.showCometsTrail || (typeof settings !== 'undefined' && settings.showCometTrail));
    const next = !current;

    simulationState.ui.showCometTrail = next;
    simulationState.ui.showCometsTrail = next;
    if (typeof settings !== 'undefined') {
      settings.showCometTrail = next;
      settings.showCometsTrail = next;
    }

    cometTrailBtn.classList.toggle("toggle-on", next);
    cometTrailBtn.classList.toggle("toggle-off", !next);
    cometTrailBtn.classList.toggle("active", next);
  };
}

// 惑星軌跡ボタン (PLN)
if (typeof planetTrailBtn !== "undefined" && planetTrailBtn) {
  planetTrailBtn.onclick = () => {
    const current = !!(simulationState.ui.showPlanetTrail || simulationState.ui.showPlanetsTrail || (typeof settings !== 'undefined' && settings.showPlanetTrail));
    const next = !current;

    simulationState.ui.showPlanetTrail = next;
    simulationState.ui.showPlanetsTrail = next;
    if (typeof settings !== 'undefined') {
      settings.showPlanetTrail = next;
      settings.showPlanetsTrail = next;
    }

    planetTrailBtn.classList.toggle("toggle-on", next);
    planetTrailBtn.classList.toggle("toggle-off", !next);
    planetTrailBtn.classList.toggle("active", next);
  };
}

// 太陽軌跡ボタン (SUN)
if (typeof sunTrailBtn !== "undefined" && sunTrailBtn) {
  sunTrailBtn.onclick = () => {
    const current = !!simulationState.ui.showSunTrail;
    const next = !current;

    simulationState.ui.showSunTrail = next;
    if (typeof settings !== 'undefined') {
      settings.showSunTrail = next;
    }

    sunTrailBtn.classList.toggle("toggle-on", next);
    sunTrailBtn.classList.toggle("toggle-off", !next);
    sunTrailBtn.classList.toggle("active", next);
  };
}

// ---------------------------------------------------------
// 3. Names 表示 ON/OFF（4状態ローテーション仕様）
// ---------------------------------------------------------
const namesBtn = document.getElementById("showNames");
if (namesBtn) {
  namesBtn.addEventListener("click", () => {
    if (simulationState.ui.nameMode === undefined) {
      simulationState.ui.nameMode = 0;
    }
    simulationState.ui.nameMode = (simulationState.ui.nameMode + 1) % 4;
    simulationState.ui.showNames = (simulationState.ui.nameMode !== 0);

    namesBtn.classList.toggle("toggle-on", simulationState.ui.showNames);
    namesBtn.classList.toggle("toggle-off", !simulationState.ui.showNames);
  });
}

// ---------------------------------------------------------
// 4. 質量・個数・速度のリアルタイム双方向同期
// ---------------------------------------------------------
// 太陽質量同期
const sunMassSlider = document.getElementById("sunMass");
const sunMassInput  = document.getElementById("sunMassInput");

if (sunMassSlider && sunMassInput) {
  function syncSunMass(v) {
    let val = Number(v);
    if (isNaN(val) || val <= 0) val = 1;

    sunMassSlider.value = v;
    sunMassInput.value  = v;

    if (bodies && bodies[0]) {
      bodies[0].mass = val;
      if (typeof massToSize === "function") {
        bodies[0].size = massToSize(val) * 0.5;
        bodies[0].hitSize = bodies[0].size * (typeof SUN_HIT_SCALE !== "undefined" ? SUN_HIT_SCALE : 1.0);
      }
    }
  }
  sunMassSlider.oninput = e => syncSunMass(e.target.value);
  sunMassInput.oninput  = e => syncSunMass(e.target.value);
}

// 固定質量チェックボックス
const elUseFixedObjMass = document.getElementById("useFixedObjMass");
if (elUseFixedObjMass) {
  elUseFixedObjMass.onchange = e => {
    settings.useFixedObjMass = e.target.checked;
  };
}

// 天体初期個数同期
const bodyCountSlider = document.getElementById("bodyCount");
const bodyCountInput  = document.getElementById("bodyCountInput");
const bodyCountLabel  = document.getElementById("bodyCountLabel");

if (bodyCountSlider && bodyCountInput && bodyCountLabel) {
  function syncBodyCount(v) {
    initialBodyCount = Number(v);
    bodyCountSlider.value = v;
    bodyCountInput.value = v;
    bodyCountLabel.textContent = v;
  }
  bodyCountSlider.oninput = e => syncBodyCount(e.target.value);
  bodyCountInput.oninput  = e => syncBodyCount(e.target.value);
}

// 時間倍率（simSpeed）同期
const speedSlider = document.getElementById("speedSlider");
const speedInput  = document.getElementById("speedInput");
const speedLabel  = document.getElementById("speedLabel");

if (speedSlider && speedInput && speedLabel) {
  function syncSpeed(v) {
    const val = Number(v);
    speedSlider.value = val;
    speedInput.value  = val;
    speedLabel.textContent = val.toFixed(1);
    settings.simSpeed = val;
  }
  speedSlider.oninput = e => syncSpeed(e.target.value);
  speedInput.oninput  = e => syncSpeed(e.target.value);
}

// ---------------------------------------------------------
// 5. settings 拡張 UI パラメータ同期群
// ---------------------------------------------------------
// 重力倍率 (G)
const gravitySlider = document.getElementById("gravitySlider");
const gravityInput  = document.getElementById("gravityInput");
if (gravitySlider && gravityInput) {
  gravityInput.oninput = e => {
    const v = Number(e.target.value);
    gravitySlider.value = v;
    settings.gravityMultiplier = v;
  };
  gravitySlider.oninput = e => {
    const v = Number(e.target.value);
    gravityInput.value = v;
    settings.gravityMultiplier = v;
  };
}

// 初速倍率
const spawnVelSlider = document.getElementById("spawnVelSlider");
const spawnVelInput  = document.getElementById("spawnVelInput");
if (spawnVelSlider && spawnVelInput) {
  spawnVelInput.oninput = e => {
    const v = Number(e.target.value);
    spawnVelSlider.value = v;
    settings.spawnVelocityMultiplier = v;
  };
  spawnVelSlider.oninput = e => {
    const v = Number(e.target.value);
    spawnVelInput.value = v;
    settings.spawnVelocityMultiplier = v;
  };
}

// 軌跡の長さ倍率
const trailLenSlider = document.getElementById("trailLenSlider");
if (trailLenSlider) {
  trailLenSlider.oninput = e => {
    settings.trailLengthMultiplier = Number(e.target.value);
  };
}

// 軌跡の色モード
const trailColorSelect = document.getElementById("trailColorSelect");
if (trailColorSelect) {
  trailColorSelect.onchange = e => {
    settings.trailColorMode = e.target.value;
  };
}

// N体閾値
const nbodyThresholdInput = document.getElementById("nbodyThreshold");
if (nbodyThresholdInput) {
  nbodyThresholdInput.oninput = e => {
    settings.fullGravityThreshold = Number(e.target.value);
  };
}

// EPS²（ソフトニング）
const eps2Input = document.getElementById("eps2Input");
if (eps2Input) {
  eps2Input.oninput = e => {
    settings.eps2 = Number(e.target.value);
  };
}

// 生成パラメータ（minMass / maxMass / minDist / maxDist / direction）
const spawnMinMass   = document.getElementById("spawnMinMass");
const spawnMaxMass   = document.getElementById("spawnMaxMass");
const spawnMinDist   = document.getElementById("spawnMinDist");
const spawnMaxDist   = document.getElementById("spawnMaxDist");
const spawnDirection = document.getElementById("spawnDirection");

if (spawnMinMass) spawnMinMass.oninput = e => settings.spawnSettings.minMass = Number(e.target.value);
if (spawnMaxMass) spawnMaxMass.oninput = e => settings.spawnSettings.maxMass = Number(e.target.value);
if (spawnMinDist) spawnMinDist.oninput = e => settings.spawnSettings.minDist = Number(e.target.value);
if (spawnMaxDist) spawnMaxDist.oninput = e => settings.spawnSettings.maxDist = Number(e.target.value);
if (spawnDirection) spawnDirection.onchange = e => settings.spawnSettings.direction = e.target.value;



/* =========================================================
   空間抵抗（Orbital Drag）UI ↔ 物理エンジン相互同期処理
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const dragSlider = document.getElementById("dragSlider");
  const dragInput  = document.getElementById("dragInput");

  // settingsオブジェクトが存在しない場合の安全なフォールバック
  if (typeof window.settings === "undefined") {
    window.settings = {};
  }

  if (dragSlider && dragInput) {
    // 1. スライダー（range）を動かした時 ➔ 数値入力とJS変数を更新
    dragSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      dragInput.value = val;
      window.settings.orbitalDrag = val;
    });

    // 2. 数値入力（number）を変えた時 ➔ スライダーとJS変数を更新
    dragInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) || 0;
      dragSlider.value = val;
      window.settings.orbitalDrag = val;
    });
  }
});


/* =========================================================
   🎯 N-body ブースト (nbodyBoost) UI双方向同期 ＆ イベント制御
========================================================= */
function initNbodyBoostControl() {
  const slider = document.getElementById("nbodyBoostSlider");
  const input = document.getElementById("nbodyBoostInput");

  if (!slider || !input) return;

  // 設定オブジェクトへの安全な初期値確保 (デフォルト: 1.0)
  if (typeof window.settings !== "undefined") {
    window.settings.nbodyBoost = window.settings.nbodyBoost || 1.0;
  }

  // 値の更新 ＆ 双方向UI同期関数
  function updateNbodyBoost(value) {
    // 1. 数値化と安全ガード（NaN防止）
    let numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 1) numVal = 1.0;

    // 2. 設定オブジェクトへ即時反映
    if (typeof settings !== "undefined") {
      settings.nbodyBoost = numVal;
    }

    // 3. UIの値を相互同期（入力中でない方を更新）
    if (document.activeElement !== slider) slider.value = numVal;
    if (document.activeElement !== input) input.value = numVal;
  }

  // イベントリスナーの登録（スライダー操作 ＆ 数値入力）
  slider.addEventListener("input", (e) => updateNbodyBoost(e.target.value));
  input.addEventListener("input", (e) => updateNbodyBoost(e.target.value));

  // 初回読み込み時のUI初期化
  const initialVal = (typeof settings !== "undefined" && settings.nbodyBoost) ? settings.nbodyBoost : 1.0;
  updateNbodyBoost(initialVal);
}

// DOM読み込み完了時に自動実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNbodyBoostControl);
} else {
  initNbodyBoostControl();
}


// =====================================================
  // 🛡️ objMass (スライダー) ⇔ objMassInput (数値入力) 完全双方向連動
  // =====================================================
  const elObjMassSlider = document.getElementById("objMass");      // スライダー本体 (0.1 ~ 50)
  const elObjMassInput  = document.getElementById("objMassInput"); // 数値入力欄 (0.1 ~ 200)

  if (elObjMassSlider && elObjMassInput) {
        // 1. スライダー (objMass) を動かした時 ➔ 数値欄 & settings へ即時反映
    elObjMassSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        elObjMassInput.value = val.toFixed(1);
        if (typeof settings !== "undefined") {
          settings.objMass = val;
          settings.objBaseMass = val;
        }
      }
    });

    // 2. 数値入力欄 (objMassInput) を変更した時 ➔ スライダー & settings へ即時反映
    elObjMassInput.addEventListener("input", (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        // スライダーの表示位置は スライダーの最大値(50) 内にクランプして安全に同期
        const sliderMin = parseFloat(elObjMassSlider.min) || 0.1;
        const sliderMax = parseFloat(elObjMassSlider.max) || 50.0;
        const clampedSliderVal = Math.max(sliderMin, Math.min(sliderMax, val));

        elObjMassSlider.value = clampedSliderVal;

        // 内部設定値は数値入力欄のフルレンジ (最大200) をそのまま受容
        if (typeof settings !== "undefined") {
          settings.objMass = val;
          settings.objBaseMass = val;
        }
      }
    });

    // 3. 数値入力欄からフォーカスが外れた時 (入力値の安全クランプ)
    elObjMassInput.addEventListener("blur", (e) => {
      let val = parseFloat(e.target.value);
      const inputMin = parseFloat(elObjMassInput.min) || 0.1;
      const inputMax = parseFloat(elObjMassInput.max) || 200.0;

      if (isNaN(val)) val = inputMin;
      const finalVal = Math.max(inputMin, Math.min(inputMax, val));

      elObjMassInput.value = finalVal.toFixed(1);
            const sliderMax = parseFloat(elObjMassSlider.max) || 50.0;
      elObjMassSlider.value = Math.min(sliderMax, finalVal);

      if (typeof settings !== "undefined") {
        settings.objMass = finalVal;
        settings.objBaseMass = finalVal;
      }
    });
  }


/* ========================================================
   Keyboard Shortcuts (QWERTYUIOP + JKLNM: 完全DOM独立・Null安全版)
======================================================== */
window.addEventListener("keydown", e => {

  // --------------------------------------------------------
  // 規律1：入力欄へのタイピング中はショートカットを完全無効化
  // --------------------------------------------------------
  const activeEl = document.activeElement;
  if (activeEl) {
    const tag = activeEl.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      activeEl.isContentEditable
    ) {
      return;
    }
  }

  // キー名を小文字に統一して判定
  const key = e.key.toLowerCase();

  // --------------------------------------------------------
  // 規律2：安全なDOM要素の取得とクリック代行処理関数
  // --------------------------------------------------------
  function safeClick(id) {
    const el = document.getElementById(id);
    if (el && typeof el.click === "function") {
      el.click();
    } else {
      console.warn(`[Shortcut Warning] Target DOM element '#${id}' not found or unreachable.`);
    }
  }

  // --------------------------------------------------------
  // 規律3：チェックボックスの安全な論理反転 ＆ イベント同期関数
  // --------------------------------------------------------
  function safeToggleCheckbox(id) {
    const cb = document.getElementById(id);
    if (cb && cb.type === "checkbox") {
      cb.checked = !cb.checked;
      // 宇宙管制盤（IIFE）や外部イベントリスナーへ「変わったわよ」と通知するための儀式
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.warn(`[Shortcut Warning] Checkbox element '#${id}' not found or invalid.`);
    }
  }

// --------------------------------------------------------
  // 規律4：キーマッピング執行マトリクス
  // --------------------------------------------------------
  switch (key) {

    // === システム・時間操作（最上段） ===
    // 👑【極小・完全デトックス版】キーボードショートカット統合層
    case "q":
    case "Q":
      if (e.repeat) break;
      startBtn.click(); // 👍 safeClickをパージし、本物のトグルボタンを直接着火！
      break;

    case "e":
    case "E":
      if (e.repeat) break;
      resetBtn.click(); // 👍 本物のリセットボタンを直接着火！
      break;

    // === 👑 隠しタクティカルHUD表示トグル（H） ===
    case "h":
    case "H":
      if (e.repeat) break;
      // 💡 新設した 'btnToggleHUD' ボタンを直接クリック発火して完全同期！
      if (typeof safeClick === "function") {
        safeClick("btnToggleHUD");
      }
      // フォールバック（ボタンが存在しない場合でもフラグを確実反転）
      window.showHUD = !window.showHUD;
      break;

    // === 軌跡レンダリングフィルタ ===
    case "i":
    case "I":
      safeClick("cometTrailBtn");
      break;

    case "o":
    case "O":
      safeClick("planetTrailBtn");
      break;

    case "p":
    case "P":
      safeClick("sunTrailBtn");
      break;

    // === カメラプリセット（J / K / L） ===
    case "j":
    case "J":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("equator");
      }
      break;

    case "k":
    case "K":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("polar");
      }
      break;

    case "l":
    case "L":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("overview");
      }
      break;

    // === ディスプレイ・表示トグル（N / M） ===
    case "n":
    case "N":
      // 👑 【調律】チェックボックス依存をパージし、他のボタンと同じ安全クリックへ同期
      safeClick("showNames");
      break;

    case "m":
    case "M":
      safeClick("btnOrbitCam");
      break;

    // === バリセンター表示トグル（B） ===
    case "b":
    case "B":
      safeClick("toggleBaryBtn");
      break;

    // === LVEC (V) ===
    case "v":
      safeClick("toggle-momentum-btn");
      break;

    default:
      // 未定義のキーは宇宙の静寂を乱さないよう、そのままスルーするわ
      break;
  }
});


loop();

