/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 1: Settings / Init / Camera / Projection / Input
--------------------------------------------------------- */

// =========================================================
// 1. グローバル状態・定数・キャッシュ変数（純粋データ定義）
// =========================================================
let BACKGROUND_STARS = [];
let targetHistory = [];

// 💡 0:非表示（起動時は完全にオフ。ストイックホワイト起動のトリガー）
let lvecMode = 0;

window.showBarycenter = false;
window.showAngularMomentum = false;

// 三角関数の極限最適化キャッシュ変数
let _cosX = 1, _sinX = 0;
let _cosY = 1, _sinY = 0;

let stats = {
  escaped: 0,
  collided: 0,
  removed: 0,
  nanKilled: 0
};

// 🎥 カメラ初期旋回ベクトル設定
let cameraRotateSpeed = 0.0005;
let isAutoRotateEnabled = true;

// windowオブジェクト経由の参照を確保
window.cameraRotateSpeed = cameraRotateSpeed;
window.isAutoRotateEnabled = isAutoRotateEnabled;
window.spawnGoliathForce = typeof spawnGoliathForce !== "undefined" ? spawnGoliathForce : null;

/* =========================================================
   2. Settings (設定オブジェクト)
   ========================================================= */
const settings = {
  gravityMultiplier: 1.0,
  simSpeed: 2.5,                  // 知的な速度感
  spawnVelocityMultiplier: 0.95,  // 綺麗な初期楕円を生む黄金比
  trailLengthMultiplier: 1.2,
  trailColorMode: "pure", // 離心率バインド
  fullGravityThreshold: 200,
  eps2: 36,                       // 衝突・スイングバイの安全限界 (ε = 6.0)

  objMass: 1.0,
  useFixedObjMass: false,
  initialBodyCount: 50,           // 💡 UIの初期値 (QTY: 24) と同期
  spawnSettings: {
    minMass: 10.0,
    maxMass: 100.0,               // 10倍の質量幅へ拡張
    massPower: 2.0,               // ベキ乗分布バイアス（Zipfの法則）
    sizeScale: 0.7,               // 物理衝突サイズの倍率
    renderSizeScale: 1.0,         // 描画サイズの倍率
    minDist: 300,                 // 太陽近傍の余白確保
    maxDist: 800,
    direction: "chaos"
  }
};

/* =========================================================
   3. シミュレーション状態 (Simulation State)
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

    // 「L-VEC / Target Lock」グループと同期する状態変数
    showLVec: 0,                 // lvecMode (0: OFF, 1: TOTAL, 2: INDIVIDUAL+HUD)
    targetName: "AUTO",          // window.selectedTargetName と同期
  },

  camera: {
    followSun: false,
  },

  physics: {
    sunLocked: false,
  },

  selection: {
    body: null,
  }
};






// ========================================================
// 宇宙管制盤：プリセット・データ構造（ストイック調律・完全版）
// 配置場所: Block 1（トップレベル・設定オブジェクトエリア）
// ========================================================
const DEBUG_PRESETS = {
    // 💥 1. 重力カオス・スペクタクル（「動」の宇宙）
    preset1: {
        name: "PRST: 1 (重力カオス・スペクタクル)",
        ui: {
            bodyCount: 64,         bodyCountInput: 64,   // 64基の賑やかな天体群
            sunMass: 3500,        sunMassInput: 3500,   // 超絶重い主星
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 1.0,         objMassInput: 1.0,
            useFixedObjMass: false,
            gravitySlider: 1.8,   gravityInput: 1.8,    // 強重力ワールド
            spawnVelSlider: 1.3,  spawnVelInput: 1.3,   // カオスを誘発する高速初速
            speedSlider: 3.5,     speedInput: 3.5,      // 高速クロック
            eps2Input: 25,                                // 激しいスイングバイを許容
            cameraRotateSpeed: 0.001                    // ダイナミックな視点旋回
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 64;
            if (window.bodies) window.bodies.length = 64;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVz = 0.0;
                settings.gravityMultiplier = 1.8;
                settings.spawnVelocityMultiplier = 1.3;
                settings.simSpeed = 3.5;
                settings.eps2 = 25;
                settings.objBaseMass = 1.0;
                settings.useFixedObjMass = false;
                settings.sunFixed = false;
            }

            const targetON  = ['planetTrailBtn', 'cometTrailBtn', 'toggleBaryBtn'];
            const targetOFF = ['toggle-momentum-btn', 'sunTrailBtn'];

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

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.001, true);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }

            if (window.UI_DEBUG) console.log("💥 [PRST: 1] 重力カオス・スペクタクルモード（動）が執行されました。");
        }
    },

    // 🪐 2. 双太陽・二重連星系（「連」の宇宙）
    preset2: {
        name: "PRST: 2 (双太陽・二重連星系)",
        ui: {
            bodyCount: 32,         bodyCountInput: 32,   // 連星軌道が見やすい適正数量
            sunMass: 2500,        sunMassInput: 2500,   // 主星
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 2.0,         objMassInput: 2.0,
            useFixedObjMass: false,
            gravitySlider: 1.2,   gravityInput: 1.2,    // 滑らかな連続偏向を生む重力
            spawnVelSlider: 0.9,  spawnVelInput: 0.9,   // 軌道捕獲率を高めるしっとりした速度
            speedSlider: 2.5,     speedInput: 2.5,      // 軌道幾何学をじっくり観察できる速度
            eps2Input: 20,
            cameraRotateSpeed: 0.0003                    // 重心運動を引き立てるスロー視点
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 32;
            if (window.bodies) window.bodies.length = 32;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVz = 0.0;
                settings.gravityMultiplier = 1.2;
                settings.spawnVelocityMultiplier = 0.9;
                settings.simSpeed = 2.5;
                settings.eps2 = 20;
                settings.objBaseMass = 2.0;
                settings.useFixedObjMass = false;
                settings.sunFixed = false;
            }

            // Goliath 召喚
            const elType = document.getElementById("injectType");
            const elMassInput = document.getElementById("injectMassInput");
            const elMassSlider = document.getElementById("injectMassSlider");

            if (elType) {
                elType.value = "sun2";
                elType.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (elMassInput) elMassInput.value = 1500;
            if (elMassSlider) elMassSlider.value = 1500;

            setTimeout(() => {
                if (typeof spawnGoliathForce === "function") {
                    spawnGoliathForce();
                }
            }, 10);

            const targetON  = ['planetTrailBtn', 'toggleBaryBtn', 'sunTrailBtn'];
            const targetOFF = ['toggle-momentum-btn', 'cometTrailBtn'];

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

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0003, true);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }

            if (window.UI_DEBUG) console.log("🪐 [PRST: 2] Goliath ＋ SUN1軌跡を可視化した連星モード（連）が執行されました。");
        }
    },

    // 📐 3. ケプラー解析・物理デコーダー（「知」の宇宙）
    preset3: {
        name: "PRST: 3 (ケプラー解析・物理デコーダー)",
        ui: {
            bodyCount: 6,          bodyCountInput: 6,     // 幾何学解析に最適な少数精鋭
            sunMass: 2200,        sunMassInput: 2200,   // 主星
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 1.5,         objMassInput: 1.5,
            useFixedObjMass: false,
            gravitySlider: 1.0,   gravityInput: 1.0,    // 標準重力定数
            spawnVelSlider: 0.82, spawnVelInput: 0.82,  // 綺麗な高偏平楕円
            speedSlider: 2.0,     speedInput: 2.0,      // 解析用クロック
            eps2Input: 16,
            cameraRotateSpeed: 0.0002                    // 超微速旋回
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 6;
            if (window.bodies) window.bodies.length = 6;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVz = 0.0;
                settings.gravityMultiplier = 1.0;
                settings.spawnVelocityMultiplier = 0.82;
                settings.simSpeed = 2.0;
                settings.eps2 = 16;
                settings.objBaseMass = 1.5;
                settings.useFixedObjMass = false;
                settings.sunFixed = false;
            }

            window.lVecMode = 2;
            if (typeof lvecMode !== "undefined") lvecMode = 2;

            const targetON  = ['toggle-momentum-btn', 'planetTrailBtn'];
            const targetOFF = ['toggleBaryBtn', 'cometTrailBtn', 'sunTrailBtn'];

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

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0002, true);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }

            if (window.UI_DEBUG) console.log("📐 [PRST: 3] L-VEC解析HUDを展開したケプラー物理モード（知）が執行されました。");
        }
    },

    // 🌌 4. 究極の純粋N体シム（100天体・全エフェクトOFF・純粋物理）
    // 🎯【完全修整】PRST:2 からのコピペ汚染（Goliath召喚・32天体強制化）を完全除霊
    preset4: {
        name: "PRST: 4 (純粋N体)",
        ui: {
            bodyCount: 100,        bodyCountInput: 100,   // 100天体によるピュアN体
            sunMass: 2000,        sunMassInput: 2000,
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 1.0,         objMassInput: 1.0,
            useFixedObjMass: false,
            gravitySlider: 1.0,   gravityInput: 1.0,
            spawnVelSlider: 1.0,  spawnVelInput: 1.0,
            speedSlider: 2.5,     speedInput: 2.5,
            eps2Input: 36,
            cameraRotateSpeed: 0.0005
        },
        physics: () => {
            // 💡 ui との完全同期 (100天体)
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 100;
            if (window.bodies) window.bodies.length = 100;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVz = 0.0;
                settings.gravityMultiplier = 1.0;
                settings.spawnVelocityMultiplier = 1.0;
                settings.simSpeed = 2.5;
                settings.eps2 = 36;
                settings.objBaseMass = 1.0;
                settings.useFixedObjMass = false;
                settings.sunFixed = false;
            }

            // 🚨 全エフェクトボタンをOFFにし、純粋な物理演算のみに集中させる
            const targetOFF = ['planetTrailBtn', 'cometTrailBtn', 'sunTrailBtn', 'toggleBaryBtn', 'toggle-momentum-btn'];

            targetOFF.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.add('toggle-off');
                    btn.classList.remove('toggle-on', 'active');
                }
            });

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0005, true);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }

            if (window.UI_DEBUG) console.log("🌌 [PRST: 4] 純粋N体シムモードが完全執行されました。");
        }
    }
};



// ========================================================
// 🛸 神の意志を無視する：Goliath / Obj 動的強制生成コマンド
// 配置場所: Block 2 (物理演算・オブジェクト生成関数エリア)
// ========================================================
function spawnGoliathForce() {
    if (!bodies || !Array.isArray(bodies) || bodies.length === 0) {
        console.error("❌ [召喚失敗] 宇宙に中心星（Sun）が存在しません。");
        return;
    }

    // 太陽オブジェクトの安全な動的検索（インデックス0固定を排除）
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

    // UIからのリアルタイム取得と数値検証
    const elType = document.getElementById("injectType");
    const elMassInput = document.getElementById("injectMassInput");
        const selectedType = elType ? elType.value : "obj";
    let customMass = elMassInput ? parseFloat(elMassInput.value) : 5.0;

    // 🚨 NaNガード：入力値が不正な場合は安全なデフォルト値(5.0)へ補正
    if (isNaN(customMass) || customMass <= 0) {
        customMass = 5.0;
    }

    // 【聖域：完璧な3次元幾何学配置ロジック（絶対保持）】
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const r = targetMinDist + Math.random() * (targetMaxDist - targetMinDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

    // 🌌 【聖域：ケプラー回転速度ベースの物理演算（絶対保持）】
    const dist = Math.sqrt(x*x + y*y + z*z) || 1;
    const gravityMult = settings?.gravityMultiplier || 1.0;
    const vBase = Math.sqrt(currentG * gravityMult * sun.mass / dist);

    const side = Math.random() < 0.1 ? -1 : 1;
    const spawnVelMult = settings?.spawnVelocityMultiplier || 1.0;
    const v = vBase * spawnVelMult * (0.6 + 0.4 * (targetMaxDist / dist));
    const turb = Math.min(1, 300 / dist);
    const turbBoost = side === -1 ? 1.4 : 1.0;

    const vx_circ = (side * -y / dist) * v * (0.6 + 0.3 * turb * turbBoost);
    const vy_circ = (side * x / dist) * v * (0.6 + 0.3 * turb * turbBoost);

    const vx_rand = (Math.random() - 0.5) * (1.0 * turb);
    const vy_rand = (Math.random() - 0.5) * (1.0 * turb);
    const vz_rand = (Math.random() - 0.5) * (0.4 * turb);

    const vx = vx_circ + vx_rand;
    const vy = vy_circ + vy_rand;
    const vz = vz_rand;

    // massToSize 関数の安全なフォールバック
    const safeMassToSize = (m) => {
        if (typeof massToSize === "function") return massToSize(m);
        return Math.pow(m, 1/3) * 2.0; // 未定義時の立方根近似フォールバック
    };

    // 🪐 生成データの分岐アライメント
    let newBody = {};

    if (selectedType === "sun2") {
        newBody = {
            x: x,
            y: y,
            z: z,
            vx: vx,
            vy: vy,
            vz: vz,
            mass: customMass,
            size: safeMassToSize(customMass) * 0.3,
            color: "#ff00ff",
            name: "Goliath",
            type: "planet",
            trail: []
        };
        console.log(`%c [特異点観測] 異分子『Goliath』(M:${customMass.toFixed(1)}) 配置完了。重力場が歪むわよ！`, "color: #ff00ff; font-weight: bold;");
    } else {
        const t = Math.min(1, dist / (targetMaxDist || 1200));
        const sizeScale = 0.7;
        const size = safeMassToSize(customMass) * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t) * sizeScale;

        const rCol = 180 + (255 - 180) * t;
        const gCol = 220 + (255 - 220) * t;
        const bCol = 255;

        newBody = {
            x: x,
            y: y,
            z: z,
            vx: vx,
            vy: vy,
            vz: vz,
            mass: customMass,
            size: size,
            color: `rgb(${rCol|0},${gCol|0},${bCol|0})`,
            name: "Obj_Injected_" + Date.now().toString().slice(-3),
            type: "obj",
            trail: []
        };
        console.log(`%c 🪐 [放浪天体インジェクション] 質量 ${customMass.toFixed(1)} の Obj が軌道へ展開されました。`, "color: #00ff88; font-weight: bold;");
    }

    // 現役の宇宙配列へインジェクションを執行
    bodies.push(newBody);
}

// 外部参照用バインド
window.spawnGoliathForce = spawnGoliathForce;


/* =========================================================
   4. DOM構築完了後のUI初期化・イベントハンドラバインド（完全統合版）
   ※ リセット機能を保護し、全ボタン配線を1つのブロックへ安全統合しています
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

  if (camSpeedSlider) {
    camSpeedSlider.addEventListener("input", (e) => {
      syncCameraRotateSpeed(e.target.value, false);
    });
  }

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
  // ③ ボタン群完全配線マトリクス（Goliath, Barycenter, Momentum）
  // ※ DOMContentLoaded の内部に貼り付けてください（末尾の});は不要）
  // ---------------------------------------------------------

  // 1. Goliath（異分子）強制生成ボタン
  const goliathBtn = document.getElementById("triggerGoliathBtn");
  if (goliathBtn) {
    goliathBtn.addEventListener("click", function() {
      if (typeof spawnGoliathForce === "function") {
        spawnGoliathForce();
      } else if (typeof window.spawnGoliathForce === "function") {
        window.spawnGoliathForce();
      }

      // 1.5秒間のアクション点灯フィードバック
      this.classList.add("toggle-on");
      this.classList.remove("toggle-off");

      setTimeout(() => {
        this.classList.remove("toggle-on");
        this.classList.add("toggle-off");
      }, 1500);
    });
  }

  // 2. 巡回式マルチ・バリセンターボタン
  const baryBtn = document.getElementById("toggleBaryBtn");
  if (baryBtn) {
    const cleanBaryBtn = baryBtn.cloneNode(true);
    if (baryBtn.parentNode) {
      baryBtn.parentNode.replaceChild(cleanBaryBtn, baryBtn);
    }

    cleanBaryBtn.addEventListener("click", function() {
      if (typeof executeButtonCoreLogic === "function") {
        executeButtonCoreLogic("toggleBaryBtn", this);
      } else {
        console.warn("⚠️ [機能未実装] executeButtonCoreLogic 関数が読み込まれていません。");
      }
    });
  } else {
    console.warn("⚠️ [配線不発] HTML側に id='toggleBaryBtn' のボタンが見つかりません。");
  }

  // 3. 角運動量ベクトル表示切り替えボタン
  const momentumBtn = document.getElementById('toggle-momentum-btn');
  if (momentumBtn) {
    momentumBtn.addEventListener('click', function() {
      window.showAngularMomentum = !window.showAngularMomentum;

      if (window.showAngularMomentum) {
        this.classList.add("toggle-on");
        this.classList.remove("toggle-off");
      } else {
        this.classList.add("toggle-off");
        this.classList.remove("toggle-on");
      }

      if (window.UI_DEBUG) {
        console.log(`%c [物理連動] window.showAngularMomentum ──> ${window.showAngularMomentum}`, "color: #00ff88; font-weight: bold;");
      }
    });
  } else {
    console.warn("⚠️ [配線不発] HTML側に id='toggle-momentum-btn' のボタンが見つかりません。");
  }



   // =========================================================
// 4. プリセットボタン群の一括配線（ナンバリング完全同期版）
// =========================================================
const binds = [
    { id: "preset1Btn", key: "preset1" },
    { id: "preset2Btn", key: "preset2" },
    { id: "preset3Btn", key: "preset3" },
    { id: "preset4Btn", key: "preset4" }
];

binds.forEach(bind => {
    const btn = document.getElementById(bind.id);
    if (btn) {
        // 💡 割り当てられた抽象キー（"preset1"など）を流し込む
        btn.addEventListener("click", () => applyPreset(bind.key));
    }
});

// --------------------------------------------------------
    // ⚙️ 【内側に配置】新設スイッチ群の配線信号マトリクス（完全アライメント版）
    // --------------------------------------------------------
    // ※ HTML側のボタンの id に合わせて、どちらのIDでも動くように防空処理
    const executeBtn = document.getElementById("btnExecuteInject") || document.getElementById("triggerGoliathBtn");
        if (executeBtn) {
        executeBtn.addEventListener("click", function() {
            // 🚀 関数名を現在の「spawnGoliathForce()」へ完全ルーティング
            spawnGoliathForce();
                        // ボタンの点灯トグル制御
            this.classList.add("toggle-on");
            this.classList.remove("toggle-off");
                        setTimeout(() => {
                this.classList.add("toggle-off");
                this.classList.remove("toggle-on");
            }, 500);
        });
    }

    // 質量調整計器（スライダー ⇔ 入力ボックス ⇔ 動的数値ラベル）の3方向完全同期
    const elInjectMassSlider = document.getElementById("injectMassSlider");
    const elInjectMassInput  = document.getElementById("injectMassInput");
    const elInjectMassLabel  = document.getElementById("injectMassLabel");

    if (elInjectMassSlider && elInjectMassInput && elInjectMassLabel) {
        elInjectMassSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            elInjectMassInput.value = val.toFixed(1);
            elInjectMassLabel.innerText = val.toFixed(1);
        });

        elInjectMassInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) return;

            const min = parseFloat(elInjectMassSlider.min) || 0;
            const max = parseFloat(elInjectMassSlider.max) || 3000;
                        elInjectMassSlider.value = Math.max(min, Math.min(max, val));
            elInjectMassLabel.innerText = val.toFixed(1);
        });
    }
});

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





// ========================================================
//  3. 核心部：UI・物理レイヤー「同時上書き」コアインジェクター
// ========================================================
function applyPreset(presetKey) {
  const config = DEBUG_PRESETS[presetKey];
  if (!config) return;

  if (window.bodies && Array.isArray(window.bodies)) {
    window.bodies.forEach(b => {
      if (b) b.trailWidth = 0.3; // 繊細な基準値へアライメント
    });
  }
  console.log(`%c 宇宙管制盤：時空相転移 ──> 【${config.name}】を注入中...`, "color: #00ffff; font-weight: bold;");

  // UI層への流し込み
  for (const [id, value] of Object.entries(config.ui)) {
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

  // 物理層（settings）への注入
  if (typeof config.physics === "function") {
    config.physics();
  }

  // 宇宙リセット関数の自動実行
  if (typeof generateBodies === "function") {
    generateBodies();
  } else if (typeof window.generateBodies === "function") {
    window.generateBodies();
  }

  // カメラ記憶リセットの安全フォールバック
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
const camera = {
  pos: { x: 0, y: 0, z: 0 },
  rotX: 0.5,
  rotY: 0.5,
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,

  orbitRadius: 1200,           // ターゲットからの基本カメラ距離
    // 💡【修理】大元のグローバル変数（0.0005）と完全に直結アライメント！
  autoRotateSpeed: 0.0005,     // 自由巡航時のスピード
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

// 🛡️ 鉄壁の防衛線：念のためオブジェクト生成直後にもグローバル変数を 0.0005 に完全に固定
window.cameraRotateSpeed = 0.0005;

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
   3. 天体システムの初期生成（Generate Bodies）完全修復版
   ========================================================= */


function generateBodies() {
  // =========================================================
  //  【最優先追記】新宇宙創生のための統計カウンター完全デトックス
  // =========================================================
  if (typeof stats !== "undefined") {
    stats.escaped   = 0;
    stats.collided  = 0;
    stats.removed   = 0;
    stats.nanKilled = 0;
  }

  // 画面の表示（DOM）を一瞬で「0」に叩き落とす！
  // (※HTML側の実際のID名「statEscaped」等に合わせてある
  const elAlive    = document.getElementById("statAlive");
  const elEscaped  = document.getElementById("statEscaped");
  const elCollided = document.getElementById("statCollided");
  const elRemoved  = document.getElementById("statRemoved");
  const elNaN      = document.getElementById("statNaN");

  // 天体生存数はリセット時に配置される初期数（initialBodyCount）を先制注入
  if (elAlive)    elAlive.textContent    = typeof initialBodyCount !== "undefined" ? initialBodyCount : "0";
  if (elEscaped)  elEscaped.textContent  = "0";
  if (elCollided) elCollided.textContent = "0";
  if (elRemoved)  elRemoved.textContent  = "0";
  if (elNaN)      elNaN.textContent      = "0";

  console.log("%c 統計レイヤー：過去のカルマを消去。カウンターをゼロリセットした。", "color: #aaaaaa; font-style: italic;");

  // ---------------------------------------------------------
  //  既存の初期化処理
  // ---------------------------------------------------------
  // 既存の天体配列をクリア（初期化の保証）
  bodies = [];

  // 天体リセットと同時に、背景の星空データも完全に初期化
  initBackgroundStars();


  /* -------------------------------------------------------
     太陽（Sun）の生成処理：質量はUIの設定値を動的に反映
     ------------------------------------------------------- */
  const sunMass = Number(document.getElementById("sunMass").value);

  // 太陽の描画サイズ調整（スケール係数を 0.5 に設定して巨大化を抑制）
  const sunSize = massToSize(sunMass) * 0.5;
    // 太陽の衝突判定（適正化した SUN_HIT_SCALE を適用）
  const sunHitSize = sunSize * SUN_HIT_SCALE;

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
     惑星・小天体（Obj）生成ループ
     ------------------------------------------------------- */
  const S = settings.spawnSettings;

  for (let i = 0; i < initialBodyCount; i++) {
    // 3次元球面空間へのランダム散布ロジック
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const r = S.minDist + Math.random() * (S.maxDist - S.minDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

   /* ---- 質量決定 ---- */
    const mass = settings.useFixedObjMass ? settings.objMass : randomMass();

    // 太陽（bodies[0]）との距離を厳密に計算
    const dx = x - bodies[0].x;
    const dy = y - bodies[0].y;
    const dz = z - bodies[0].z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

 /* ---- 初期速度（質量和を考慮した軌道速度計算） ---- */
    // 太陽質量 + 天体自体の質量を考慮し、大質量天体の初期軌道を安定化
    const effectiveMass = bodies[0].mass + mass;
    const vBase = Math.sqrt(G * settings.gravityMultiplier * effectiveMass / dist);
        // 基本となる軌道速度（spawnVelocityMultiplier で楕円具合を調整）
    const v = vBase * settings.spawnVelocityMultiplier;

    /* ---- 回転方向 (side) の判定 ---- */
    const dirMode = S.direction || "chaos";
    let side = 1;

    if (dirMode === "direct") {
      side = 1;        // 100% 順回転（時計回り/反時計回りに統一）
    } else if (dirMode === "retro") {
      side = -1;       // 100% 逆回転
    } else if (dirMode === "split") {
      side = (i % 2 === 0) ? 1 : -1; // 50% / 50%（半分ずつ互い違い）
    } else if (dirMode === "chaos") {
      side = Math.random() < 0.1 ? -1 : 1; // 従来の10%逆走り
    }

    // 💡 1. 純粋な円運動の接線ベクトル（周回方向）
    const tangentX = (side * -dy / dist);
    const tangentY = (side * dx / dist);

    // 💡 2. 回転方向を壊さない「自然な揺らぎ（ゆらゆら感）」を作る
    // 接線方向のスピードに ±15% の個体差をつける
    const speedVariation = v * (0.85 + Math.random() * 0.3);
        // 太陽に向かう / 遠ざかる方向（動径方向）に微小なランダム成分を入れる（円軌道を少し崩して綺麗な楕円にする）
    const radialX = (dx / dist) * (Math.random() - 0.5) * 0.2 * v;
    const radialY = (dy / dist) * (Math.random() - 0.5) * 0.2 * v;

    // 💡 3. ベクトルの合成
    const vx = tangentX * speedVariation + radialX;
    const vy = tangentY * speedVariation + radialY;
    const vz = (Math.random() - 0.5) * 0.1 * v; // Z軸（上下）へのわずかなゆらぎ

   /* ---- 物理サイズと描画スケールの定義 ---- */
    const t = Math.min(1, dist / S.maxDist);
    const sizeScale = 0.7;

  // 物理的衝突判定に使用する絶対サイズ（質量にのみ連動）
    const physicalSize = massToSize(mass) * sizeScale;

    // 描画上の視覚調整用（距離減衰や揺らぎを適用）
    const renderSize = physicalSize * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t);

   // 距離に応じたベースカラー計算
    const rCol = 180 + (255 - 180) * t;
    const gCol = 220 + (255 - 220) * t;
    const bCol = 255;

    bodies.push({
      x, y, z,
      vx, vy, vz,
      mass,
      size: physicalSize,       // 物理衝突用サイズ
      renderSize: renderSize, // 描画専用サイズ
      color: `rgb(${rCol|0},${gCol|0},${bCol|0})`,
      name: "Obj" + i,
      type: "obj",
      trail: []
    });
  }

/* =======================================================
   🌌 オールトの雲・自律循環エンジン（種別ハイブリッド対応版）
   ======================================================= */
function maintainEcosystem() {
  const targetCount = (typeof settings !== "undefined" && settings.targetBodyCount) ? settings.targetBodyCount : 40;
    if (!bodies || bodies.length >= targetCount) return;

  // 毎フレーム約 1.5% の確率で補填判定
  if (Math.random() > 0.015) return;

  const sun = (bodies[0] && bodies[0].name === "Sun")
    ? bodies[0]
    : (bodies.find(b => b && b.name === "Sun") || { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 1500 });

  // 1. 最外殻（オールトの雲）の座標計算
  const angle2D = Math.random() * Math.PI * 2;
  const rOuter = 4000 + Math.random() * 2000;
  const phi = Math.acos((Math.random() * 2) - 1);

  const spawnX = sun.x + rOuter * Math.sin(phi) * Math.cos(angle2D);
  const spawnY = sun.y + rOuter * Math.sin(phi) * Math.sin(angle2D);
  const spawnZ = sun.z + rOuter * Math.cos(phi);

  // 2. システム全体の質量と速度の計算
  let totalSystemMass = 0;
  for (let b of bodies) {
    if (b && b.mass) totalSystemMass += b.mass;
  }
  if (totalSystemMass <= 0) totalSystemMass = sun.mass || 1500;

  const currentG = (typeof G !== "undefined" ? G : 1) * (typeof settings !== "undefined" ? settings.gravityMultiplier : 1);
  const vLimit = Math.sqrt((2 * currentG * totalSystemMass) / rOuter) * 0.72;

  const dx = sun.x - spawnX, dy = sun.y - spawnY, dz = sun.z - spawnZ;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  const toSunX = dx / dist, toSunY = dy / dist, toSunZ = dz / dist;
  const sideX = Math.cos(angle2D + Math.PI / 2), sideY = Math.sin(angle2D + Math.PI / 2), sideZ = (Math.random() - 0.5) * 0.4;

  // 💡 【重要】70%の確率で「通常天体」、30%の確率で「彗星」として補填生成する！
  const isCometSpawn = Math.random() < 0.3;

  if (isCometSpawn && typeof addComet === "function") {
    addComet();
  } else if (typeof createRandomBody === "function") {
    createRandomBody(); // 通常天体の追加関数（既存システムに合わせて調整）
  } else if (typeof addComet === "function") {
    addComet();
  }

  // 3. 生成された新天体へ物理軌道を適用
  const newBody = bodies[bodies.length - 1];
  if (newBody) {
    newBody.x = spawnX; newBody.y = spawnY; newBody.z = spawnZ;
    newBody.vx = (sun.vx || 0) + vLimit * (toSunX * 0.88 + sideX * 0.15);
    newBody.vy = (sun.vy || 0) + vLimit * (toSunY * 0.88 + sideY * 0.15);
    newBody.vz = (sun.vz || 0) + vLimit * (toSunZ * 0.88 + sideZ * 0.20);
    if (newBody.trail) newBody.trail = [];
  }
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

  const mass = 0.001 + Math.random() * 0.004;
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
     ★ 【真・N体物理の規律】系の「全有効質量（Total Mass）」から脱出速度を算出
     ------------------------------------------------------- */
  let totalEffectiveMass = 0;
  for (let b of bodies) {
    if (b && b.type !== "comet" && b.mass) {
      totalEffectiveMass += b.mass;
    }
  }
  if (totalEffectiveMass <= 0) totalEffectiveMass = sun.mass || 1500;

 /* -------------------------------------------------------
     ★ 【スイングバイ最適化】
     全質量ではなく「Sun（または主星）の単体質量」を基準にし、
     速度を過剰に上げすぎないことで、太陽の重力で大きく曲がる「急旋回」を復活させる
     ------------------------------------------------------- */
  const primaryMass = sun.mass || 1500; // 主星の質量を基準に戻す
  const currentG = (typeof G !== "undefined" ? G : 1) * (typeof settings !== "undefined" ? settings.gravityMultiplier : 1);
    // 脱出速度のベース（太陽単体基準）
  const escapeSpeed = Math.sqrt((2 * currentG * primaryMass) / d) * 1.1; // 1.5から1.1へ調整して束縛力を強化

  /* 3割：ニアミス落下 / 7割：大楕円スイングバイ */
  const isSwingBy = Math.random() < 0.7;
  let relVx, relVy, relVz;

  if (!isSwingBy) {
    // 太陽すれすれを掠める極限Uターン軌道
    const speed = escapeSpeed * 0.78; // 0.85 -> 0.78 に減速させて重力捕獲力をUP
    const fallRatio  = 0.96;
    const slantRatio = 0.04;

    relVx = (nx * fallRatio + ox * slantRatio) * speed;
    relVy = (ny * fallRatio + oy * slantRatio) * speed;
    relVz = (nz * fallRatio + oz * slantRatio) * speed;
  } else {
    // 大楕円を描いてゆっくり帰ってくる軌道
    const speedMultiplier = 0.65 + Math.random() * 0.15; // 0.75+ -> 0.65+ に減速
    const speed = escapeSpeed * speedMultiplier;

    const orbitRatio = 0.35 + Math.random() * 0.3;
    const towardRatio = Math.sqrt(1 - orbitRatio * orbitRatio);

    relVx = (nx * towardRatio + ox * orbitRatio) * speed;
    relVy = (ny * towardRatio + oy * orbitRatio) * speed;
    relVz = (nz * towardRatio + oz * orbitRatio) * speed;
  }

  /* -------------------------------------------------------
     ★ 太陽（主星）の慣性速度（sun.vx, sun.vy, sun.vz）を底上げ加算！
     ------------------------------------------------------- */
  const vx = (sun.vx || 0) + relVx;
  const vy = (sun.vy || 0) + relVy;
  const vz = (sun.vz || 0) + relVz;

  /* リアル彗星のカラーリング */
  const rColor = Math.floor(40  + Math.random() * 80);
  const gColor = Math.floor(220 + Math.random() * 35);
  const bColor = Math.floor(140 + Math.random() * 80);
  const cometColor = `rgb(${rColor}, ${gColor}, ${bColor})`;

  bodies.push({
    x, y, z,
    vx, vy, vz,
    mass,
    size: coreSize,
renderSize: coreSize,
    color: cometColor,
    type: "comet",
    name: "Comet" + bodies.filter(b => b.type === "comet").length,
    trail: []  });
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

function isColliding(A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dz = B.z - A.z;

  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

  const rA = A.hitSize ?? A.size;
  const rB = B.hitSize ?? B.size;

  return dist < rA + rB;
}


function detectCollisionsWithGrid() {
  const collisions = [];

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

              const A = bodies[i];
              const B = bodies[j];
              if (!A || !B) continue;

              if (isColliding(A, B)) {
                collisions.push([i, j]);
              }
            }
          }
        }
      }
    }
  }

  return collisions;
}

/* 初回生成 */
generateBodies();



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

/* ============================
   物理更新（重力・位置・衝突・彗星 ＆ 死亡カウンター完全統合版）
============================ */
function updatePhysics(dt) {
  turnCount++;

  // 1. 冒頭でのSunの存在チェック（常に最新の状態を保持）
  let sun = bodies[0];
  if (!sun || sun.name !== "Sun") {
    // 念のためSunの位置を再検索（堅牢性の担保）
    const foundSun = bodies.find(b => b.name === "Sun");
    if (foundSun) sun = foundSun;
    else return;
  }

  // -------------------------------------------------------
  // 【超重要ガード】NaN（非数）による物理崩壊天体の検知とパージ
  // -------------------------------------------------------
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    if (isNaN(b.x) || isNaN(b.y) || isNaN(b.z) || isNaN(b.vx) || isNaN(b.vy) || isNaN(b.vz)) {
      if (b.name === "Sun") continue; // 太陽は絶対に消さない
      if (typeof stats !== 'undefined') stats.nanKilled++; // NaNカウンター加算
      bodies.splice(i, 1);
    }
  }
  // パージ後に改めて太陽を再確保
  sun = bodies[0] || sun;

  // =======================================================
  // 👑 【ここに移動＆増設！】安全な配列確保 ＆ 予知のデトックス
  // =======================================================
  // 1. パージ完了後の「正しい天体数」で加速度配列を安全に確保（境界外エラーを完全防空）
  const ax = new Array(bodies.length).fill(0);
  const ay = new Array(bodies.length).fill(0);
  const az = new Array(bodies.length).fill(0);

  // 2. 予知フラグを全天体一度フラットに戻す
  for (let b of bodies) {
    b.willCollide = false;
    b.timeToCollision = 0;
  }
  const fullGravity = (bodies.length <= settings.fullGravityThreshold);

  // =======================================================
  //  物理層：Sun-only 重力（太陽解放＆完全対等モデル）
  // =======================================================
  if (!fullGravity) {
    const isSunFixed = (typeof isSunPhysicallyFixed !== "undefined") ? isSunPhysicallyFixed : false;

    // ⏳ 何秒先まで予知能力を発動するか（3秒がベスト）
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

      // ① 惑星・彗星（b）が太陽から受ける加速
      const accelX = f * dx * sun.mass * dt;
      const accelY = f * dy * sun.mass * dt;
      const accelZ = f * dz * sun.mass * dt;

      b.vx += accelX;
      b.vy += accelY;
      b.vz += accelZ;

      // ② 【新世界：作用・反作用の法則】太陽も引っ張り返される
      if (!isSunFixed) {
        sun.vx -= f * dx * b.mass * dt;
        sun.vy -= f * dy * b.mass * dt;
        sun.vz -= f * dz * b.mass * dt;
      }

      // 🛰️ 【最速直線予測：Sun-Only時】
      // 太陽（sun）と惑星（b）の直近の衝突リスクを検算
      // 手元にある生の dx, dy, dz を反転（bからみた太陽へのベクトル）させて無駄なく流用！
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
            sun.willCollide = true; // 太陽側の警告灯もON
          }
        }
      }
    }
  }

  // ===============================
  // N-body Gravity（対称力計算）
  // ===============================
  if (fullGravity) {
    const PREDICTION_TIME_LIMIT = 3;

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
        const f = (G * settings.gravityMultiplier) / (r * r * r);

        ax[i] += f * B.mass * dx;
        ay[i] += f * B.mass * dy;
        az[i] += f * B.mass * dz;

        ax[j] -= f * A.mass * dx;
        ay[j] -= f * A.mass * dy;
        az[j] -= f * A.mass * dz;

        // 🛰️ 【最速直線予測：N-body時】
        // すでに計算で使った dx, dy, dz をその場で横流しして超高速検算！
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

  // 1. まず、計算した加速度を速度に適用
  if (fullGravity) {
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].vx += ax[i] * dt;
      bodies[i].vy += ay[i] * dt;
      bodies[i].vz += az[i] * dt;
    }
  }
 // 2.【挿入】運動量保存のスタビライザー：全体の重心のブレを速度から等しく差し引く
  if (!(simulationState.physics.sunLocked || settings.sunFixed) && sun) {
    let tX = 0, tY = 0, tZ = 0, tM = 0;
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; tX += b.vx * b.mass; tY += b.vy * b.mass; tZ += b.vz * b.mass; tM += b.mass; }
    const vX = tX / tM, vY = tY / tM, vZ = tZ / tM;
    for (let i = 0; i < bodies.length; i++) { bodies[i].vx -= vX; bodies[i].vy -= vY; bodies[i].vz -= vZ; }
  }

  // 3. 最後に、確定した速度を使って位置を更新
  for (let b of bodies) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
  }

  // -------------------------------------------------------
  //  衝突検出 → マージ ＆ 衝突カウンター連動
  // -------------------------------------------------------
  buildCollisionGrid();
  const collisions = detectCollisionsWithGrid();

  for (let k = collisions.length - 1; k >= 0; k--) {
    const [i, j] = collisions[k];
    if (!bodies[i] || !bodies[j]) continue;

    const A = bodies[i];
    const B = bodies[j];

    const rA = A.hitSize ?? A.size;
    const rB = B.hitSize ?? B.size;

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const dz = B.z - A.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist > rA + rB) continue;

    const totalMass = A.mass + B.mass;
    const isSunCollision = (A.name === "Sun" || B.name === "Sun");

    // 【統計連動】墜落(collided) と 衝突消滅(removed) を識別加算
    if (typeof stats !== 'undefined') {
      if (isSunCollision) {
        stats.collided++;
      } else {
        stats.removed++;
      }
    }

    const newBody = {
      x: (A.x * A.mass + B.x * B.mass) / totalMass,
      y: (A.y * A.mass + B.y * B.mass) / totalMass,
      z: (A.z * A.mass + B.z * B.mass) / totalMass,

      vx: (A.vx * A.mass + B.vx * B.mass) / totalMass,
      vy: (A.vy * A.mass + B.vy * B.mass) / totalMass,
      vz: (A.vz * A.mass + B.vz * B.mass) / totalMass,

      mass: totalMass,
      size: Math.cbrt(A.size**3 + B.size**3),
      hitSize: Math.cbrt((rA**3) + (rB**3)),

      name: (A.mass > B.mass ? A.name : B.name),
      color: (A.mass > B.mass ? A.color : B.color),
      trail: []
    };

    if (isSunCollision) {
      newBody.name = "Sun";
      newBody.color = "white";
      newBody.size = massToSize(newBody.mass) * 0.5;
      newBody.hitSize = newBody.size * SUN_HIT_SCALE;

      if (A.name === "Sun") newBody.trail = [...A.trail];
      if (B.name === "Sun") newBody.trail = [...B.trail];
    }

    const a = Math.max(i, j);
    const b = Math.min(i, j);
    bodies.splice(a, 1);
    bodies.splice(b, 1);
    bodies.push(newBody);
  }

  // Sun を bodies[0] に戻す
  const sunIndex = bodies.findIndex(b => b.name === "Sun");
  if (sunIndex > 0) {
    const s = bodies.splice(sunIndex, 1)[0];
    bodies.unshift(s);
  }

  // -------------------------------------------------------
  // ★ 彗星の追加（上限ガード ＆ 発生率調整）
  // -------------------------------------------------------
 const currentCometCount = bodies.filter(b => b.type === "comet").length;
  if (currentCometCount < 5 && Math.random() < 0.002) {
    addComet();
  }




 // -------------------------------------------------------
  // 【修正】外宇宙境界センサー：太陽以外の全天体をパージして負荷をゼロへ戻す
  // -------------------------------------------------------
 const removeLimit = 10000;
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    // 【変更点】彗星限定（b.type !== "comet"）を解除し、太陽（Sun）だけを絶対に除外する規律へ
    if (b.name === "Sun") continue;

    const dx = b.x - sun.x;
    const dy = b.y - sun.y;
    const dz = b.z - sun.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist > removeLimit) {
      if (typeof stats !== 'undefined') {
        stats.escaped++;
        stats.removed++; // 【追加】内部配列から消去した「本物のパージ数」を統計に同期
      }
      bodies.splice(i, 1);
    }
  }

  // UI・表示系のストリーミング執行
  updateSunSpeedDisplay();
  updateBodyCountDisplay();
  updateTurnCountDisplay();
  if (typeof updateStatsUI === 'function') updateStatsUI();
} // ── ここで大元の更新パイプライン関数が美しくクローズ








/* =========================================================
   【世界観統一】離心率完全バインド・カラーエンジン（トーン調整版）
   ========================================================= */
function getThermalColor(b, maxVelocityExpected) {
  if (!b) return "#2b3a67"; // 🛡️ 安全防護：天体がNULLの場合はインディゴブルーを即返却

  // 💡 針のエンジンで計算され、天体に記憶された「渋い離心率カラー」を直撃ロード！
  // まだ針の計算が走っていない初期フレーム等のフォールバックとして、上品なインディゴブルー（#2b3a67）を配備。
  const finalColor = b.eccColor || "#2b3a67";

  return finalColor;
}



/* =========================================================
   軌跡・軌道判定（サーモグラフィ完全統合・論理統合修復版）
   ========================================================= */
function updateTrails(dt) {
  // 🛡️ 太陽の安全な検索
  const sun = (bodies && bodies[0] && bodies[0].name === "Sun")
    ? bodies[0]
    : (bodies ? bodies.find(b => b && b.name === "Sun") : null);
    if (!sun) return;

  // グローバル定数Gの安全な確保
  const currentG = (typeof G !== 'undefined') ? G : (settings.G || 1.0);
  const count = bodies.length;

  // 密度に応じた透明度・長さ補正（300個以上で描画を間引く）
  const densityMultiplier = (count >= 300) ? 0.3 : 1.0;
  const lengthMult = (typeof settings !== "undefined" && settings.trailLengthMultiplier) ? settings.trailLengthMultiplier : 1.0;

  for (let b of bodies) {
    if (!b) continue;

    const sx = b.x - sun.x;
    const sy = b.y - sun.y;
    const sz = b.z - sun.z;
    const distFromSun = Math.sqrt(sx * sx + sy * sy + sz * sz);
    b.distance = distFromSun;

    // 1. 描画カラーの事前サンプリング
    if (b.name !== "Sun") {
      b.drawColor = (typeof getThermalColor === "function") ? getThermalColor(b, 150.0) : (b.eccColor || "#2b3a67");
    } else {
      b.drawColor = "rgba(255, 255, 255, 0.9)"; // 太陽は常に白
    }

    // 2. 周回判定（軌道エネルギー計算）
    if (b.name !== "Sun") {
      if (b.isOrbiting === undefined) b.isOrbiting = false;

      const r2 = sx * sx + sy * sy + sz * sz + (settings.eps2 || 0);
      const r = Math.sqrt(r2);

      const dvx = b.vx - sun.vx;
      const dvy = b.vy - sun.vy;
      const dvz = b.vz - sun.vz;
      const v2 = dvx * dvx + dvy * dvy + dvz * dvz;

      const E = 0.5 * v2 - (currentG * (settings.gravityMultiplier || 1.0) * (sun.mass || 1500)) / (r || 1);

      if (!b.isOrbiting && E < 0) b.isOrbiting = true;

      if (b.type !== "comet" && !b.isOrbiting) {
        b.trail = [];
      }
    } else {
      b.isOrbiting = true;
    }

    // 3. ハイブリッドデータ構造への現在位置格納
    if (!b.trail) b.trail = [];

    const rCurrent = (typeof rotate3D === "function") ? rotate3D(b) : { x: b.x, y: b.y, z: b.z };
    const prCurrent = (typeof project3D === "function") ? project3D(rCurrent.x, rCurrent.y, rCurrent.z) : { x: 0, y: 0 };

    b.trail.push({
      wx: b.x, wy: b.y, wz: b.z,
      sx: prCurrent.x, sy: prCurrent.y
    });

    // 4. 🎯 【統合アルゴリズム】軌跡の記憶上限（effectiveLimit）の一元決定
    let effectiveLimit;

    // ① 少人数モード（15個以下）：観察優先の特別規律
    if (count <= 15) {
      effectiveLimit = b.isOrbiting ? 800 : Infinity;
    }
    // ② 大人数・通常モード：パフォーマンス＆毛玉防止ガードの適用
    else {
      // ベースとなる長さの決定
      if (b.name === "Sun") {
        effectiveLimit = 2000 * lengthMult * densityMultiplier;
      } else if (b.isOrbiting) {
        effectiveLimit = 800 * lengthMult * densityMultiplier;
      } else {
        effectiveLimit = Math.min(
          600 * lengthMult * densityMultiplier,
          Math.max(40, Math.sqrt(distFromSun) * 8 * lengthMult * densityMultiplier)
        );
      }

      // 天体数に応じたハードキャップ（毛玉爆発ガード）
      let maxCap = 500;
      if (count > 3000) maxCap = 10;
      else if (count > 1500) maxCap = 25;
      else if (count > 500) maxCap = 50;

      effectiveLimit = Math.min(effectiveLimit, maxCap);
    }

    // 5. 決定した最終上限値（effectiveLimit）で1回だけ美しくパージ！
    while (b.trail.length > effectiveLimit) {
      b.trail.shift();
    }
  }
}



/**
 * OrbitCam の角度更新（太陽強制ロックオン・車載特化版）
 */
function updateOrbitCam(dt) {
  if (!camera.isOrbitCam) return;


  const target = bodies[camera.targetBodyIndex];

  // 1. 生存チェック：ターゲット（乗っている天体）がいなければ即座に停止
  if (!target) {
    deactivateOrbitCam();
    const btn = document.getElementById("btnOrbitCam");
    if (btn) {
      // 👑 文字の書き換えはパージ、ただ消灯させるだけの規律
      btn.classList.add("toggle-off");
      btn.classList.remove("toggle-on");    }
    return;
  }

  // 2. 太陽（bodies[0]）の位置を取得
  const sun = bodies[0];
  if (!sun) return;

  // =======================================================
  // 【幾何学の執行】ターゲット天体から太陽へ向かう相対ベクトルを計算
  // =======================================================
  const dx = sun.x - target.x;
  const dy = sun.y - target.y;
  const dz = sun.z - target.z;

  // 水平方向の距離（影の長さ）を計算
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // =======================================================
  // 【3D視線ロック】アークタンジェント(atan2)で必要な回転角を完全逆算！
  // =======================================================
  const targetRotY = Math.atan2(dx, dz);
  const targetRotX = Math.atan2(-dy, horizontalDist);

  // 計算された絶対的な視線角度を、毎フレームカメラパラメータへSetter！
  camera.rotY = targetRotY;
  camera.rotX = targetRotX;
}

/**
 * カメラレイヤー全体の更新（メインパイプライン）
 * ※SyntaxErrorを永久追放し、あらゆるカメラ移動を検知する
 */
function updateCamera(dt) {
  // 変更前のカメラ状態を厳密に記録（不整合検出用）
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

  // ④ ターゲット追従（通常の三人称モード時）
 
  // 🌟 【絶対規律】重複を一本化！どのような移動であれ、変化があれば変更通知を起立！
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
 * @param {Array} bodies - 全天体の配列
 * @param {Object} sun - 基準となる太陽オブジェクト (bodies[0])
 * @param {string} type - 探索したい天体のタイプ ("obj" または "comet")
 * @returns {Object|null} - 見つかった天体オブジェクト（インデックス付き）、なければnull
 */
function pickOrbitTarget(bodies, sun, type) {
  if (!bodies || bodies.length <= 1) return null;

  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    if (b && b.type === type) {
      b.index = i; // 元の配列内での絶対位置を特定できるようにインデックスをバインド
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
    // 自動回転ボタンを消灯
  const camToggleBtn = document.getElementById("btnToggleRotate");
  if (camToggleBtn) {
    camToggleBtn.classList.add("toggle-off");
    camToggleBtn.classList.remove("toggle-on", "active");
  }

  camera.orbitTheta = camera.rotY;
  camera.orbitPhi   = camera.rotX;
  camera.isOrbitCam = true;

  // 👑 【強固な点灯処理】ORBITボタンを鮮やかに発光させる
  const btn = document.getElementById("btnOrbitCam");
  if (btn) {
    btn.classList.remove("toggle-off");
    btn.classList.add("toggle-on", "active");
  }

  // 画面右上の車載インジケーターを表示
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
  camera.orbitRadius = BASE_DISTANCE;

  // 👑 【絶対消灯処理】すべての点灯系クラスを剥ぎ取り、消灯クラスのみを付与！
  const btn = document.getElementById("btnOrbitCam");
  if (btn) {
    btn.classList.remove("toggle-on", "active");
    btn.classList.add("toggle-off");
  }

  // 画面右上の車載インジケーターを非表示
  const targetHud = document.getElementById("orbitTargetDisplay");
  if (targetHud) {
    targetHud.style.display = "none";
  }

  // 軌跡キャッシュをクリア
  if (typeof bodies !== 'undefined' && bodies) {
    for (let b of bodies) {
      b.trail = [];
    }
  }
  cameraChanged = true;

  // =======================================================
  // 🧹 【重要】全天体の軌跡キャッシュを強制リセット！
  // =======================================================
  if (bodies && bodies.length > 0) {
    bodies.forEach(b => {
            if (b.trail && Array.isArray(b.trail)) {
        b.trail = [];
      }
    });
  }

  console.log("OrbitCam: 自由視点に復帰し、軌跡のゴースト線をクリアしました。");
}

// ウィンドウリサイズ、またはF12開閉時のイベントハンドラ内
window.addEventListener('resize', () => {
  // 1. まずCanvasの物理サイズを確定させる
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 🌟 【絶対規律】スマート・プロジェクションに「時空の崩壊」を強制通知する！
  cameraChanged = true;

  // 2. その上で、リサイズ途中の不安定な座標キャッシュを完全にデトックス
  if (bodies && bodies.length > 0) {
    bodies.forEach(b => {
      if (b.trail && Array.isArray(b.trail)) {
        b.trail = [];
      }
    });
  }
    // 必要であれば、画面中心座標などの定数もここで即座に再計算して同期
  // centerX = canvas.width / 2;
  // centerY = canvas.height / 2;
});







/* ============================
   Utility / Save / Load (完全防衛・完全同期版)
============================ */
function saveUniverse(slot) {
  const data = {
    settings: structuredClone(settings),
    stats: typeof stats !== 'undefined' ? structuredClone(stats) : null,
        // 💡 時間軸データの保存
    elapsedTime: (typeof simulationState !== 'undefined') ? simulationState.elapsedTime : 0,
    realAccumulatedTime: window.realAccumulatedTime || 0,
    turnCount: typeof turnCount !== 'undefined' ? turnCount : 0,

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
      color: b.color,
      drawColor: b.drawColor,
      type: b.type,
      name: b.name,
      isOrbiting: b.isOrbiting ?? false
    }))
  };

  localStorage.setItem("universeSave_" + slot, JSON.stringify(data));
  console.log("Universe Saved:", slot);
}

function loadUniverse(slot) {
  const raw = localStorage.getItem("universeSave_" + slot);
  if (!raw) {
    console.warn("No Save Data:", slot);
    return;
  }

  const data = JSON.parse(raw);

  // 1. 設定データの復元 ＆ フォールバック構造の安全保障
  if (data.settings) {
    const loadedSettings = structuredClone(data.settings);
    Object.assign(settings, loadedSettings);
        // 古いデータに対する spawnSettings の構造防衛
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
  for (const b of data.bodies) {
    bodies.push({
      ...b,
      trail: [] // 軌跡のゴースト線を防ぐため空配列で初期化
    });
  }

  // 5. Sun を配列の先頭 (0番目) に復元
  const sunIndex = bodies.findIndex(b => b.name === "Sun");
  if (sunIndex > 0) {
    const sun = bodies.splice(sunIndex, 1)[0];
    bodies.unshift(sun);
  }

  // =====================================
  // 🛡️ UIの安全同期執行（Nullガード付き）
  // =====================================
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

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

  // 🛡️ イベントハンドラ配線（nbodyThreshold の入力制御）
  const nbodyThresholdEl = document.getElementById("nbodyThreshold");
  if (nbodyThresholdEl) {
    nbodyThresholdEl.oninput = e => {
      settings.fullGravityThreshold = Math.max(1, Number(e.target.value));
    };
  }

  // HUD & 死亡統計表示の完全同期
  updateBodyCountDisplay();
  updateTurnCountDisplay();
  if (typeof updateSimTimeUI === 'function') updateSimTimeUI();
  if (typeof updateStatsUI === 'function') updateStatsUI();

  // 投影再計算の強制通知
  if (typeof cameraChanged !== "undefined") cameraChanged = true;

  console.log("Universe Loaded Successfully:", slot);
}





/* =========================================================
   1. メイン描画コントロール（自動順応・段階的軽量化対応版・復元版）
========================================================= */
function renderScene() {
  // キャンバスの初期化
  ctx.clearRect(0, 0, W, H);

  const sun = bodies[0];
  if (!sun) return;

  // 背景の固定星空を描画
  if (typeof drawBackgroundStars === "function") drawBackgroundStars();

  // 画家アルゴリズム（Z深度ソート）
  const sortedBodies = bodies
    .map(b => ({ b, r: rotate3D(b) }))
    .sort((a, b) => a.r.z - b.r.z);

  const totalCount = sortedBodies.length;

  // ---------------------------------------------------------
  // 🎛️ 天体数に応じた「段階的描画フィルター」の判定
  // ---------------------------------------------------------
  // 手動フラグ (simulationState.ui.vectorFieldOnly) が真、または 2500個超で自動発動
  const isMinimalMode = simulationState?.ui?.vectorFieldOnly || totalCount > 2500;
  // 1000個超で「e:x.xx」テキスト描画をオフにする
  const hideVectorText = isMinimalMode || totalCount > 1000;

  // ---------------------------------------------------------
  // 【第1階層ループ】天体の描画
  // ---------------------------------------------------------
  for (const obj of sortedBodies) {
    const pr = project3D(obj.r.x, obj.r.y, obj.r.z);
    if (!pr.visible) continue;

    // =========================================================
    // 🌌 最終段階：ドット ＋ 針 ＋ 色 のみの極小レンダリング
    // =========================================================
    if (isMinimalMode) {
      // 1. 純粋なドット（天体位置）を極小サイズ(1.5px)で直撃描画
      ctx.fillStyle = obj.b.eccColor || "#ffffff";
      ctx.fillRect((pr.x - 0.75) | 0, (pr.y - 0.75) | 0, 1.5, 1.5);

      // 2. 針（角運動量ベクトル）のみを描画（テキスト省略フラグを渡す）
      if (lvecMode > 0 && obj.b !== sun) {
        drawAngularMomentumVectorDirect2D(obj.b, sun, pr, hideVectorText);
      }
            // 軌跡・尾・大きな球体描画はすべてスキップ！
      continue;
    }

    // =========================================================
    // 🎨 通常〜中規模モード（フルパーツ描画）
    // =========================================================
    const trailColor = getTrailColor(obj.b, sun);
    const screenSize = calculateScreenSize(obj.b, pr);

    drawBodyTrails(obj.b, trailColor);
    drawCometTail(obj.b, sun);
    drawBodyCore(obj.b, pr, sun, screenSize);

    if (lvecMode > 0 && obj.b !== sun) {
      drawAngularMomentumVectorDirect2D(obj.b, sun, pr, hideVectorText);
    }
  }

  // ---------------------------------------------------------
  // 【第2階層】レーダーピザ
  // ---------------------------------------------------------
  if (lvecMode === 2) {
    drawLVecAreaRadar(bodies, sun, targetHistory);
  } else {
    targetHistory = [];
  }

  // ---------------------------------------------------------
  // 【第3階層】HUD・名前ラベル（極小モード時は自動スキップ）
  // ---------------------------------------------------------
  if (!isMinimalMode && simulationState?.ui?.showNames) {
    const mode = simulationState.ui.nameMode !== undefined ? simulationState.ui.nameMode : 3;

    for (const obj of sortedBodies) {
      const isEncountering = obj.b.isEncountering || false;

      if (!isEncountering) {
        if (mode === 1 && obj.b.type !== "obj") continue;
        if (mode === 2 && obj.b.type !== "comet") continue;
      }

      const pr = project3D(obj.r.x, obj.r.y, obj.r.z);
      if (!pr.visible) continue;

      const screenSize = calculateScreenSize(obj.b, pr);
      drawBodyLabel(obj.b, pr, screenSize);
    }
  }

  // ---------------------------------------------------------
  // 【第4階層】システムHUD（★ここに sortedBodies が正しく渡されます）
  // ---------------------------------------------------------
  drawGravityCenterOfTop2(sortedBodies);

  if (isDeveloperHUDActive) {
    drawScreenHUD();
  }
}


/**
 * 天体の3D角運動量を物理的に正しく計算し、完全追従するリアル3Dベクトル描画
 * 👑【テキスト動的スキップ ＆ 物理定数完全同期版】
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

  const vx = b.vx - sun.vx;
  const vy = b.vy - sun.vy;
  const vz = b.vz - sun.vz;

  // 2. 角運動量 L = r × v
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

  // 3D空間の投影
  const bRot = (typeof rotate3D === "function") ? rotate3D({ x: b.x, y: b.y, z: b.z }) : { x: b.x, y: b.y, z: b.z };
  const vRot = (typeof rotate3D === "function") ? rotate3D({ x: b.x + nx, y: b.y + ny, z: b.z + nz }) : { x: b.x + nx, y: b.y + ny, z: b.z + nz };

  const pBase = (typeof project3D === "function") ? project3D(bRot.x, bRot.y, bRot.z) : { visible: false };
  const pTip  = (typeof project3D === "function") ? project3D(vRot.x, vRot.y, vRot.z) : { visible: false };

  if (!pBase.visible || !pTip.visible) return;

  const dx = pTip.x - pBase.x;
  const dy = pTip.y - pBase.y;

  const startX = pr.x;
  const startY = pr.y;
  const endX = startX + dx;
  const endY = startY + dy;

  // 💡 離心率(e)のリアルタイム計算（幾何学優先 ＆ 物理定数完全同期版）
  let ecc = 0;

  // ① P点(近日点)と A点(遠日点)の両方が実測されている場合は、幾何学の厳密式を最優先
  if (b.periPoint && b.aphoPoint && b.periPoint.rMag && b.aphoPoint.rMag) {
    const rMin = b.periPoint.rMag;
    const rMax = b.aphoPoint.rMag;
    ecc = Math.abs(rMax - rMin) / (rMax + rMin);
  } else {
    // ② 未固定時は、ルンゲ・レンツ・パウリベクトルから精度100%の e を算出
    const r_len = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (r_len > 0) {
      const v2 = vx * vx + vy * vy + vz * vz;
      const r_dot_v = rx * vx + ry * vy + rz * vz;
            // 🛡️ シミュレーター本体の真の重力係数 (μ = G * gravityMultiplier * sun.mass) に同期！
      const currentG = (typeof G !== "undefined") ? G : 1.0;
      const gMult = (typeof settings !== "undefined" && settings.gravityMultiplier !== undefined) ? settings.gravityMultiplier : 1.0;
      const realSunMass = (sun && sun.mass) ? sun.mass : 1500.0;
      const mu = currentG * gMult * realSunMass;

      if (mu > 0) {
        const ex = (v2 * rx - r_dot_v * vx) / mu - rx / r_len;
        const ey = (v2 * ry - r_dot_v * vy) / mu - ry / r_len;
        const ez = (v2 * rz - r_dot_v * vz) / mu - rz / r_len;
        ecc = Math.sqrt(ex * ex + ey * ey + ez * ez);
      }
    }
  }

  // 天体オブジェクト自身にも算出した正確な e を持たせておく
  b.ecc = ecc;

  // 離心率カラーの判定（5段階のトーン）
  let eccColor = "#00a2ff";
  if (ecc < 0.08)      eccColor = "#00a2ff";
  else if (ecc < 0.25) eccColor = "#00e58b";
  else if (ecc < 0.45) eccColor = "#ded000";
  else if (ecc < 0.75) eccColor = "#ff7700";
  else                 eccColor = "#ff2a55";

  b.eccColor = eccColor;

  // レンダリング執行
  ctx.save();
  ctx.strokeStyle = eccColor;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 矢印ヘッド
  const angle = Math.atan2(endY - startY, endX - startX);
  const headSize = 5;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headSize * Math.cos(angle - Math.PI / 6), endY - headSize * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headSize * Math.cos(angle + Math.PI / 6), endY - headSize * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = eccColor;
  ctx.fill();

  // 👑 【完全防空】hideText === true のときはテキスト描画（fillText）を完全に省略！
  if (!hideText) {
    ctx.fillStyle = eccColor;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`e:${ecc.toFixed(2)}`, endX + 4, endY - 2);
  }

  ctx.restore();
}

/**
 * 質量上位N個（任意の複数個体）、または全天体間における合成重心（マルチ・バリセンター）を計算・描画・出力する
 * ★【万能データ構造受容 ＆ 完全防空版】
 */
function drawGravityCenterOfTop2(passedSortedBodies) {
  // ── HUDエレメントを先に取得 ──
  const elName = document.getElementById("barycenterNameDisplay");
  const elPos  = document.getElementById("barycenterPosDisplay");
  const elMass = document.getElementById("barycenterMassDisplay");

  // ★【画面テキスト消去】非表示トグルOFF、または対象天体がない場合はクリアして即リターン
  if (!window.showBarycenter || !passedSortedBodies || passedSortedBodies.length === 0) {
    if (elName) elName.textContent = "";
    if (elPos)  elPos.textContent  = "";
    if (elMass) elMass.textContent = "";
    return;
  }

  // 1. 💡【構造破壊バグ完全防衛】{ b, r } ラッパーと生 bodies オブジェクトの双方を安全に吸収
  const allValidNodes = [...passedSortedBodies]
    .filter(item => item && (item.b || item.x !== undefined || item.rx !== undefined))
    .map(item => {
      // ラッパー構造 ({ b, r }) なら item.b、生オブジェクトなら item 自体を抽出
      const bodyObj = item.b ? item.b : item;
      const m = parseFloat(bodyObj.mass !== undefined ? bodyObj.mass : (bodyObj.m !== undefined ? bodyObj.m : 0));
      return { item, b: bodyObj, m };
    })
    .filter(node => node.m > 0 && !isNaN(node.m))
    .sort((a, b) => b.m - a.m); // 質量の降順ソート

  const targetCount = parseFloat(window.barycenterTargetCount);
  const isAllMode = (targetCount === 999 || targetCount <= 0 || isNaN(targetCount));
  const n = isAllMode ? allValidNodes.length : Math.min(Math.floor(targetCount), allValidNodes.length);
    if (n < 1) return;

  let sumMx = 0, sumMy = 0, sumMz = 0;
  let totalMass = 0;
  const targetNodes = [];

  // 2. 重心マトリクスの全天体高速スキャン演算
  for (let i = 0; i < n; i++) {
    if (!allValidNodes[i]) continue;

    const node = allValidNodes[i].item;
    const bodyObj = allValidNodes[i].b;
    const m = allValidNodes[i].m;
    if (!node || !bodyObj || m <= 0 || isNaN(m)) continue;

    let rx = 0, ry = 0, rz = 0;
        // 👑 どんな構造が来ても絶対に死なない座標抽出マトリクス
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

  // 3. スクリーンへの透視投影
  const ppBary = (typeof project3D === "function") ? project3D(rotatedBaryX, rotatedBaryY, rotatedBaryZ) : null;
  if (!ppBary || isNaN(ppBary.x) || isNaN(ppBary.y)) return;

  const zScale = (ppBary.scaleFactor || 1.0) * 0.5;
  ctx.save();

  // ドットライン（全天体モード時は完全非表示）
  if (!isAllMode) {
    ctx.strokeStyle = "rgba(0, 255, 192, 0.6)";
    ctx.lineWidth = Math.max(0.5, 1.5 * zScale);
    ctx.setLineDash([3 * zScale, 3 * zScale]);
    for (let i = 0; i < targetNodes.length; i++) {
      const node = targetNodes[i];
      const ppNode = (typeof project3D === "function") ? project3D(node.rx, node.ry, node.rz) : null;
      if (ppNode && !isNaN(ppNode.x) && !isNaN(ppNode.y)) {
        ctx.beginPath(); ctx.moveTo(ppBary.x, ppBary.y); ctx.lineTo(ppNode.x, ppNode.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // 4. 精密照準レティクルのスタンプ（コンパクトHUD仕様）
  const baseSize = isAllMode ? 24 : 8;
  const minSize  = isAllMode ? 12 : 2;

  const size = Math.max(minSize, baseSize * zScale);
  ctx.strokeStyle = isAllMode ? "#ff00ff" : "#ffff00";
  ctx.lineWidth = isAllMode ? 2 : Math.max(1, 1.5 * zScale);

  // 十字ライン描画
  ctx.beginPath();
  ctx.moveTo(ppBary.x - size, ppBary.y); ctx.lineTo(ppBary.x + size, ppBary.y);
  ctx.moveTo(ppBary.x, ppBary.y - size); ctx.lineTo(ppBary.x, ppBary.y + size);
  ctx.stroke();

  // 照準サークル描画
  ctx.lineWidth = isAllMode ? 1.5 : Math.max(1, 1 * zScale);
  ctx.beginPath();
  ctx.arc(ppBary.x, ppBary.y, isAllMode ? 8 : Math.max(1.5, 4 * zScale), 0, Math.PI * 2);
  ctx.stroke();

  // 5. HUDデータ計器盤（DOM）へのテキスト安全射出
  if (elName) {
    elName.textContent = isAllMode
      ? `Barycenter (All-Body System Total): ${n} Active Stars Locked`
      : `Barycenter (${n}-Body): ` + targetNodes.map(n => (n.body && n.body.name) ? n.body.name : "Unknown").join(" + ");
  }
    if (elPos) {
    let trueZ = rotatedBaryZ;
    if (trueZ > 1000) { trueZ -= 1200; }
    elPos.textContent = `Barycenter Pos: X:${rotatedBaryX.toFixed(1)} Y:${rotatedBaryY.toFixed(1)} Z:${trueZ.toFixed(1)}`;
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

  if (isLVecActive && allValidNodes.length >= 2) {
    const sunNode = allValidNodes[0];
        let targetNodeItem = null;
    if (typeof getSelectedTargetBody === "function") {
      targetNodeItem = getSelectedTargetBody(allValidNodes);
    } else {
      targetNodeItem = allValidNodes[1] ? allValidNodes[1].item : null;
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

        if (ppLocalBary && !isNaN(ppLocalBary.x) && !isNaN(ppLocalBary.y)) {
          const localScale = (ppLocalBary.scaleFactor || 1.0) * 0.5;
                    ctx.save();
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

          if (ppSun && ppTarget) {
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

          ctx.restore();
        }
      }
    }
  }

  ctx.restore();
}



/**
 * 天体の3Dパースペクティブおよび対数スケーリングを適用した画面サイズを返す
 * 👑【完全補正】renderSize のダイレクト反映 ＆ 完全防空版
 */
function calculateScreenSize(b, pr) {
  if (!b) return 1.0;

  // 🛡️ 奥行きおよびカメラズーム値の安全取得
  const depth = (pr && pr.depth && pr.depth > 0) ? pr.depth : 1.0;
  const zoom  = (typeof camera !== "undefined" && camera.zoom) ? camera.zoom : 1.0;

  // 1. 太陽（Sun）の固定描画サイズ
  if (b.name === "Sun") {
    const sunBaseSize = 25.0;
    return Math.max(4.0, (sunBaseSize * zoom) / depth);
  }

  // 2. Goliath（巨大天体）の固定描画サイズ
  const sunMassThreshold = (typeof settings !== "undefined" && settings.sunMass) ? settings.sunMass : 1500;
  if (b.name === "Goliath" || (b.mass && b.mass >= sunMassThreshold * 0.9)) {
    const goliathBaseSize = 20.0;
    return Math.max(4.0, (goliathBaseSize * zoom) / depth);
  }

  // 3. 一般天体（Obj / Comet）：renderSize（演出用半径）のダイレクト適用 ＆ 対数補正
  let visualSize = 1.0;

  if (b.renderSize !== undefined) {
    // 💡【設計思想への完全整合】renderSize があればダイレクトに反映！
    visualSize = b.renderSize;
  } else {
    // 未設定時のみ、ベースサイズ ＋ 質量による対数補正を算出
    const baseSize = b.size || 1.0;
    visualSize = baseSize + 1.2 * Math.log10((b.mass || 1) + 1);
  }

  // 遠近感（depth）とカメラズームを適用（最小 1.0px ガード）
  return Math.max(1.0, (visualSize * zoom) / depth);
}

/**
 * 太陽からの距離に応じた多様な天体色（寒暖ハイブリッド配色）を計算
 * 👑【絶対防空 ＆ 質量シード安全保証版】
 */
function getCelestialColor(b, sun) {
  // 🛡️ 安全防護：オブジェクト未定義時のデフォルトカラー（深宇宙インディゴ）
  if (!b || !sun) return "#2b3a67";

  const bx = typeof b.x === "number" && !isNaN(b.x) ? b.x : 0;
  const by = typeof b.y === "number" && !isNaN(b.y) ? b.y : 0;
  const bz = typeof b.z === "number" && !isNaN(b.z) ? b.z : 0;

  const sx = typeof sun.x === "number" && !isNaN(sun.x) ? sun.x : 0;
  const sy = typeof sun.y === "number" && !isNaN(sun.y) ? sun.y : 0;
  const sz = typeof sun.z === "number" && !isNaN(sun.z) ? sun.z : 0;

  const dx = bx - sx;
  const dy = by - sy;
  const dz = bz - sz;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  // 0.0〜1.0 に正規化（基準距離 2500）
  const t = Math.min(1.0, d / 2500.0);

  // 天体の質量をシード値にして、色相にわずかな個体差（多様性）を与える
  const rawMass = (typeof b.mass === "number" && !isNaN(b.mass)) ? b.mass : 1.0;
  const variety = (Math.floor(rawMass * 123) % 20) - 10;

  // 太陽に極めて近い内惑星（t < 0.25）は、熱を帯びた「暖色・ゴールド系」にする演出
  if (t < 0.25) {
    const hue = 35 + variety; // ゴールド〜オレンジ
    return `hsl(${hue}, 85%, ${75 - t * 40}%)`;
  }

  // 外惑星：距離に応じて 青 → 藍 → 紫 へと美しく遷移する寒色モデル
  const hue = 200 + 80 * ((t - 0.25) / 0.75) + variety;
  const saturation = 70 + 20 * t;    // 遠方ほど星の冷たさを強調するために彩度UP
  const lightness = 95 - 25 * t;     // 遠方ほど宇宙の闇に溶けるように暗く
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


/* =========================================================
   3. 各種個別パーツの描画関数（グラフィック生成の専門家）
   ========================================================= */



// =======================================================
//  1. エラーゼロ防衛：Sun相対座標の安全な抽出マトリクス
// =======================================================
function getTargetCenterOffset() {
  const bodyArr = (typeof window !== "undefined" && window.bodies) ? window.bodies : (typeof bodies !== "undefined" ? bodies : null);
  const sun = (bodyArr && bodyArr[0] && bodyArr[0].name === "Sun")
    ? bodyArr[0]
    : (bodyArr ? bodyArr.find(b => b && b.name === "Sun") : null);

  if (sun && !isNaN(sun.x) && !isNaN(sun.y) && !isNaN(sun.z)) {
    return { x: sun.x, y: sun.y, z: sun.z };
  }
  return { x: 0, y: 0, z: 0 };
}


/* =======================================================
   👑 軌跡描画エンジン（アダプティブマルチステージ・つなぎ目消滅版）
   ======================================================= */
function drawBodyTrails(b, trailColor) {
  if (!b || !b.trail || b.trail.length <= 2) return;

  // 🛡️【完全防御】極小モードまたは天体数2000超の時は全カット
  const allBodies = (typeof window !== "undefined" && window.bodies) ? window.bodies : (typeof bodies !== "undefined" ? bodies : null);
  const totalCount = allBodies ? allBodies.length : 0;
  if (totalCount > 2000 || simulationState?.ui?.vectorFieldOnly) return;

  const isPlanet = simulationState?.ui?.showPlanetTrail && b.type !== "comet" && b.name !== "Sun";
  const isComet  = simulationState?.ui?.showCometTrail && b.type === "comet";
  const isSun    = simulationState?.ui?.showSunTrail && b.name === "Sun";

  if (!isPlanet && !isComet && !isSun) return;

  const totalPoints = b.trail.length;

  ctx.save();

  // 1. 色彩モード（settings.trailColorMode）の適用
  const mode = (typeof settings !== "undefined" && settings.trailColorMode) ? settings.trailColorMode : "dynamic";
  let strokeColor;

  if (isPlanet) {
    if (mode === "eccentric") strokeColor = b.eccColor || trailColor || "#00a2ff";
    else if (mode === "pure") strokeColor = b.color || "rgba(255, 255, 255, 0.8)";
    else if (mode === "white") strokeColor = "#ffffff";
    else strokeColor = b.drawColor || trailColor || "#00e58b";
  } else if (isComet) {
    strokeColor = b.color || "#00ffff";
  } else if (isSun) {
    strokeColor = "rgba(255, 255, 255, 0.9)";
  }

  // 2. 基本線幅の選定
  const zoom = (typeof camera !== "undefined" && camera.zoom) ? camera.zoom : 1.0;
  let baseWidth = 0.3;
  if (isPlanet) baseWidth = (b.isOrbiting ? 1.0 : 0.7) * (0.3 + zoom * 0.15);
  else if (isComet) baseWidth = 0.1;
  else if (isSun) baseWidth = 1.0;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = strokeColor;

  // 💡【核心：アダプティブ動的分割マトリクス】
  // obj数が少ない時は20〜24分割まで追い込んでつなぎ目を完全消滅させ、数が増えた時だけ賢く手を抜く！
  let desiredSteps;
  if (totalCount <= 15) {
    desiredSteps = 20; // 超精密：つなぎ目完全視認不能領域
  } else if (totalCount <= 100) {
    desiredSteps = 12; // 高精細：なめらかな有機的グラデーション
  } else if (totalCount <= 500) {
    desiredSteps = 6;  // 軽量：実用十分なフェードアウト
  } else {
    desiredSteps = 3;  // 爆速：大量天体時のパフォーマンス最優先
  }

  // 軌跡の実際の点数を超えない安全ガード
  const numSteps = Math.min(desiredSteps, Math.max(1, totalPoints - 1));
  const pointsPerStep = Math.max(1, Math.floor((totalPoints - 1) / numSteps));

  // 3. グループ単位のバッチ連結描画ループ
  for (let step = 0; step < numSteps; step++) {
    const startIndex = step * pointsPerStep;
    const endIndex = (step === numSteps - 1) ? (totalPoints - 1) : Math.min(startIndex + pointsPerStep, totalPoints - 1);

    if (startIndex >= endIndex) continue;

    // グループの中央における進行割合 t (0.0 〜 1.0)
    const midPoint = (startIndex + endIndex) / 2;
    const t = midPoint / (totalPoints - 1);

    // 🌌 【感性補間】累乗透明度 (t^1.4) とテーパー線幅
    ctx.globalAlpha = Math.pow(t, 1.4);
    ctx.lineWidth = baseWidth * (0.15 + 0.85 * t);

    ctx.beginPath();
    let pathStarted = false;

    for (let i = startIndex; i <= endIndex; i++) {
      const p = b.trail[i];
      if (!p) continue;

      const rp = (typeof rotate3D === "function") ? rotate3D({ x: p.wx, y: p.wy, z: p.wz }) : { x: p.wx, y: p.wy, z: p.wz };
      const prp = (typeof project3D === "function") ? project3D(rp.x, rp.y, rp.z) : { visible: false };

      if (!prp.visible || isNaN(prp.x) || isNaN(prp.y)) {
        pathStarted = false;
        continue;
      }

      if (!pathStarted) {
        ctx.moveTo(prp.x, prp.y);
        pathStarted = true;
      } else {
        ctx.lineTo(prp.x, prp.y);
      }
    }

    ctx.stroke();
  }

  ctx.restore();
}


/**
 * 彗星の物理的な位置から太陽の反対方向へと流れる「尾（Tail）」の微粒子を描画する
 */
function drawCometTail(b, sun) {
  if (b.type !== "comet") return;

  const sx = b.x - sun.x;
  const sy = b.y - sun.y;
  const sz = b.z - sun.z;
  const d = Math.sqrt(sx*sx + sy*sy + sz*sz) || 1;

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
  for (let i = 0; i < particles; i++) {
    const t = i / particles;
    const fade = (1 - t) * brightness;

    const px = b.x + nx * tailLength * t;
    const py = b.y + ny * tailLength * t;
    const pz = b.z + nz * tailLength * t;

    const rp = rotate3D({ x: px, y: py, z: pz });
    const pp = project3D(rp.x, rp.y, rp.z);

// 🛡️【修正ポイント】カメラの背後に回った粒子や無効な座標は即座にスキップ！
    if (!pp || !pp.visible || isNaN(pp.x) || isNaN(pp.y)) continue;

    ctx.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.25 * fade})`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, (1 + visualSize * 2) * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


/**
 * 天体本体の球体（および太陽・Goliathの特有グラデーション）を描画する
 * 👑【演出100%保持 ＆ カメラ背後カリング完全防空版】
 */
function drawBodyCore(b, pr, sun, screenSize) {
  // 🛡️【完全防空】カメラの背後に回った天体や無効な画面座標は即座に描画スキップ！
  if (!b || !pr || !pr.visible || isNaN(pr.x) || isNaN(pr.y) || screenSize <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(pr.x, pr.y, screenSize, 0, Math.PI * 2);

  if (b.name === "Sun") {
    // 太陽：中心が白熱し、外周に向かって赤く燃え広がる放射状グラデーション演出
    const grad = ctx.createRadialGradient(pr.x, pr.y, screenSize * 0.1, pr.x, pr.y, screenSize);
    grad.addColorStop(0, "white");
    grad.addColorStop(0.3, "#ffcc00");
    grad.addColorStop(0.8, "#ff3300");
    grad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = 15;
  } else if (b.name === "Goliath") {
    // Goliath：異分子らしい禍々しさを放つマゼンタ×ディープパープルのグラデーション
    const grad = ctx.createRadialGradient(pr.x, pr.y, screenSize * 0.2, pr.x, pr.y, screenSize);
    grad.addColorStop(0, "#ff00ff");
    grad.addColorStop(0.6, "#aa00aa");
    grad.addColorStop(1, "rgba(30, 0, 50, 0)");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#aa00aa";
    ctx.shadowBlur = 12;
  } else {
    // 一般天体：新開発の多様化カラーモデルを適用
    ctx.fillStyle = (typeof getCelestialColor === "function") ? getCelestialColor(b, sun) : (b.color || "#00a2ff");

    // 高速スイングバイ時の輝き表現
    const speed = Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vy || 0) * (b.vy || 0) + (b.vz || 0) * (b.vz || 0));
    if (speed > 60) {
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = Math.min(8, speed / 12);
    }
  }

  ctx.fill();
  ctx.restore();
}


/**
 * HUD・個別天体ラベル描画（軽量・無駄全削ぎ落とし完全版）
 */
function drawBodyLabel(b, pr, screenSize) {
  // 🛡️【不要処理1の削除】カメラ背後または画面外の天体はテキスト計算前に即リターン！
  if (!b || !pr || !pr.visible || isNaN(pr.x) || isNaN(pr.y)) return;

  ctx.save();
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "middle"; // 💡 中央揃えにして位置計算のオフセット処理をスリム化

  // 速度の取得（事前に計算された b.speed があれば優先参照）
  const speed = (b.speed !== undefined)
    ? b.speed
    : Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vy || 0) * (b.vy || 0) + (b.vz || 0) * (b.vz || 0));

  // 1. ラベル文字列の一括構築
  let label = `${b.name || "Obj"} | V: ${speed.toFixed(2)} /sec`;
  if (b.name !== "Sun" && b.distance !== undefined) label += ` | D: ${b.distance.toFixed(1)}`;
  if (b.isOrbiting) label += " [STB]";
  if (b.willCollide && b.timeToCollision !== undefined) label += ` [⚠️ COLLISION: ${b.timeToCollision.toFixed(1)}s]`;

  // 2. 座標とスタイルの事前決定（🛡️【不要処理2の削除】分岐を一元化）
  const textWidth = ctx.measureText(label).width;
  const lx = pr.x + screenSize + 4;
  const ly = pr.y;

  const isWarn = !!b.willCollide;
  const bgColor   = isWarn ? "rgba(255, 0, 50, 0.25)" : "rgba(0, 0, 0, 0.45)";
  const textColor = isWarn ? "#ff3344" : "#ffffff";

  // 3. 座布団 ＆ テキストの安全描画
  ctx.fillStyle = bgColor;
  ctx.fillRect(lx - 2, ly - 8, textWidth + 4, 16); // 上下中央揃えに対応した綺麗な16px座布団

  ctx.fillStyle = textColor;
  ctx.fillText(label, lx, ly);

  ctx.restore();
}


/**
 * 画面上部に固定配置される総合情報HUDを描画する（純粋なGetter表現）
 * 👑【二重単位防止 ＆ リフロー非発生・完全防空版】
 */
function drawScreenHUD() {
  if (typeof ctx === 'undefined' || !ctx) return;
  ctx.save();
    // ==========================================
  // ⚙️ 動的タイポグラフィ ＆ 影設定
  // ==========================================
  const fontSize = 14;
  ctx.font = `${fontSize}px 'Consolas', 'Courier New', monospace`;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
    const pX = 20;                        // 左端マージン
  let currentY = fontSize + 20;          // 開始Y座標
  const lineHeight = Math.round(fontSize * 1.45); // 動的行間
    // 🛡️ ヘルパー関数：DOMから安全かつ高速に文字列を抽出する（textContentを最優先）
  const getDOMText = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const txt = el.textContent || el.innerText || "";
    return txt.trim() !== "" ? txt : null;
  };

  // ------------------------------------------
  // 📡 ブロック1：天体生態系＆演算ループ
  // ------------------------------------------
  const bodyText = getDOMText("bodyCountDisplay");
  if (bodyText) {
    ctx.fillStyle = "white";
    ctx.fillText(bodyText, pX, currentY); currentY += lineHeight;
  }

  const turnText = getDOMText("turnCountDisplay");
  if (turnText) {
    ctx.fillStyle = "#e0e6ed"; // プラチナシルバー
    ctx.fillText(turnText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック2：【重力重心マトリクス】
  // ------------------------------------------
  const bNameText = getDOMText("barycenterNameDisplay");
  if (bNameText) {
    ctx.fillStyle = "#00ffcc"; // シアン
    ctx.fillText(bNameText, pX, currentY); currentY += lineHeight;
  }

  const bPosText = getDOMText("barycenterPosDisplay");
  if (bPosText) {
    ctx.fillStyle = "#a3ffee"; // 淡いシアン
    ctx.fillText(bPosText, pX, currentY); currentY += lineHeight;
  }

  const bMassText = getDOMText("barycenterMassDisplay");
  if (bMassText) {
    ctx.fillStyle = "#ff99cc"; // マゼンタピンク
    ctx.fillText(bMassText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック3：【太陽物理パラメータ】
  // ------------------------------------------
  const sunSpeedText = getDOMText("sunSpeedDisplay");
  if (sunSpeedText) {
    ctx.fillStyle = "#ffffaa"; // 鈍いイエロー
    ctx.fillText(sunSpeedText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック4：【マトリクス生死統計カウンタ】
  // ------------------------------------------
  const alive    = getDOMText("statAlive") || "0";
  const escaped  = getDOMText("statEscaped") || "0";
  const collided = getDOMText("statCollided") || "0";
  const removed  = getDOMText("statRemoved") || "0";
  const nans     = getDOMText("statNaN") || "0";

  ctx.fillStyle = "white";
  ctx.fillText(`Alive: ${alive} | Escaped: ${escaped} | Collided: ${collided} | Removed: ${removed}`, pX, currentY);
  currentY += lineHeight;

  // 例外（NaN）の監視。0でなければ烈火の警告点滅
  const nanCount = parseInt(nans) || 0;
  if (nanCount > 0) {
    ctx.fillStyle = (Math.floor(Date.now() / 100) % 2 === 0) ? "#ff00ff" : "#550055";
    ctx.fillText(`CRITICAL NaN DETECTED: ${nanCount}`, pX, currentY); currentY += lineHeight;
  } else {
    ctx.fillStyle = "#00ff00"; // 正常グリーン
    ctx.fillText(`System Status: ALL GREEN (NaN: 0)`, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック5：【タイム・マトリクス（3連クロノグラフ）】
  // ------------------------------------------
  currentY += Math.round(lineHeight * 0.5);

  const simTime = getDOMText("statSimTime");
  if (simTime) {
    ctx.fillStyle = "#00ffff"; // 宇宙年齢：鮮烈シアン
    ctx.fillText(simTime, pX, currentY); currentY += lineHeight;
  }

  const runTime = getDOMText("statRunTime");
  if (runTime) {
    ctx.fillStyle = "#ffaa00"; // 稼働時間：アンバー
    // 💡【単位の二重付与防止ガード】すでに "(Min)" や "m" が含まれている場合は二重追記しない
    const hasUnit = runTime.includes("(Min)") || runTime.includes("Min") || runTime.toLowerCase().endsWith("m");
    const displayRunTime = hasUnit ? runTime : `${runTime} (Min)`;
    ctx.fillText(displayRunTime, pX, currentY); currentY += lineHeight;
  }

  const realTime = getDOMText("statRealTime");
  if (realTime) {
    ctx.fillStyle = "#00ff00"; // 現実時刻：グリーン
    ctx.fillText(realTime, pX, currentY);
  }

  ctx.restore();
}

/**
 * 背景の固定星空（150個）を全天球に幾何学的に一様散布する
 * 👑【球面逆関数法 ＆ ストリクトモード完全防空版】
 */
function initBackgroundStars() {
  // 🛡️ グローバル配列の安全確保（未定義の場合は初期化）
  if (typeof BACKGROUND_STARS === "undefined") {
    window.BACKGROUND_STARS = [];
  } else {
    BACKGROUND_STARS.length = 0; // 参照を維持したままメモリ再利用（GC負荷削減）
  }

  // 150個の固定星を天球（3D球面座標）に幾何学的一様散布
  for (let i = 0; i < 150; i++) {
    BACKGROUND_STARS.push({
      theta: Math.random() * Math.PI * 2,         // 経度方向の回転 [0, 2π)
      phi: Math.acos(Math.random() * 2 - 1),       // 緯度方向の回転（極での密集を防ぐ球面一様補正）
      size: Math.random() * 1.5 + 0.5,             // 星の物理半径 [0.5, 2.0)
      brightness: Math.random() * 0.4 + 0.6        // 星の初期輝度 [0.6, 1.0)
    });
  }
}


/**
 * 背景星空の具体的な描画（無限遠投影ロジック・バッチレンダリング完全防空版）
 */
(function() {
  // 外部から絶対に汚染されないプライベートな固定配列
  let starsInstance = [];
    // 💡【性能極限化】輝度グループごとのバッチ配列（Draw Call 爆発の完全消滅）
  let starGroups = [];

  function ensureStarsInitialized() {
    if (starsInstance.length > 0) return;

    starsInstance = [];
    starGroups = Array.from({ length: 5 }, () => []);

    // 30,000個の超密度の星々を全天球に創生
    for (let i = 0; i < 30000; i++) {
      const theta = Math.random() * Math.PI * 2;
            // 周期ノイズによる銀河の濃淡モジュレーション
      const wave = Math.sin(theta * 8);
      let u = Math.random() * 2 - 1;
      if (Math.random() < Math.abs(wave) * 0.7) {
        u *= (1 - Math.abs(wave) * 0.3); // 天の川のような帯状の偏りを形成
      }

      const phi = Math.asin(Math.max(-1, Math.min(1, u)));

      // 輝度とサイズの決定 [0.15, 0.55]
      const rawBrightness = Math.random() * 0.4 + 0.15;
            // 💡 輝度を 5 段階のバッチグループ (0〜4) に量子化
      const groupIdx = Math.min(4, Math.floor((rawBrightness - 0.15) / 0.4 * 5));

      const star = {
        wx: Math.cos(theta) * Math.cos(phi),
        wy: Math.sin(phi),
        wz: Math.sin(theta) * Math.cos(phi),
        size: Math.random() * 0.6 + 0.5,
        brightness: (0.15 + groupIdx * 0.08).toFixed(2)
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

    // 💡【バッチレンダリング】5つの輝度グループごとに一括描画（毎フレームのGC発生をゼロへ！）
    for (let g = 0; g < starGroups.length; g++) {
      const group = starGroups[g];
      if (group.length === 0) continue;

      // fillStyle のセットはグループごとにたったの 1 回だけ！
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

          // スクリーン可視領域のカリング
          if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) {
            ctx.fillRect(sx | 0, sy | 0, star.size, star.size);
          }
        }
      }
    }

    ctx.restore();
  };
})();


/* ============================
   メインループ
============================ */
let lastCamRotX = 0;
let lastCamRotY = 0;
let lastCamZoom = 0;
let lastCamOffsetX = 0;
let lastCamOffsetY = 0;
let cameraChanged = false; // システム全体が参照するフラグ

/**
 * メインループ（毎フレームの実行規律・時間統治完全版）
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

    // 🌌【生態系自律維持エンジン】天体数が減った時だけ、外縁部から1体ずつ静かに補填する
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





/* =========================================================
   【追加】軌跡カラー取得（安全版互換レイヤー・配色アライメント版）
   ========================================================= */
function getTrailColor(b, sun) {
  if (!b) return "rgba(255, 255, 255, 0.5)";

  // 1. "pure" モード設定時は天体の固有色を最優先
  if (typeof settings !== "undefined" && settings.trailColorMode === "pure") {
    return b.color || "rgba(255, 255, 255, 0.5)";
  }

  // 2. 太陽（基準天体）がない場合のフォールバック
  if (!sun) return b.color || "white";

  // 🛡️ 座標の型安全取得
  const bx = typeof b.x === "number" && !isNaN(b.x) ? b.x : 0;
  const by = typeof b.y === "number" && !isNaN(b.y) ? b.y : 0;
  const bz = typeof b.z === "number" && !isNaN(b.z) ? b.z : 0;

  const sx = typeof sun.x === "number" && !isNaN(sun.x) ? sun.x : 0;
  const sy = typeof sun.y === "number" && !isNaN(sun.y) ? sun.y : 0;
  const sz = typeof sun.z === "number" && !isNaN(sun.z) ? sun.z : 0;

  // 3. 太陽からの3D距離を計算
  const dx = bx - sx;
  const dy = by - sy;
  const dz = bz - sz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  // 4. 最大描画スコープ（S.maxDist）を基準に正規化 [0.0, 1.0]
  const maxD = (typeof settings !== "undefined" && settings.spawnSettings && settings.spawnSettings.maxDist) ? settings.spawnSettings.maxDist : 600;
  const t = Math.min(1.0, dist / maxD);

  // 💡【配色バグ修正】中心(t=0)で白熱(255, 255, 255)、遠方(t=1)で冷徹シアン(180, 220, 255)へ美しく遷移
  const rCol = 255 - (255 - 180) * t; // t=0 で 255, t=1 で 180
  const gCol = 255 - (255 - 220) * t; // t=0 で 255, t=1 で 220
  const bCol = 255;                  // 常に 255

  return `rgb(${rCol | 0}, ${gCol | 0}, ${bCol | 0})`;
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
        for (const ui of UI_MAP) {
            const el = document.getElementById(ui.id);
            // 👑【調律】ui.name が無くても、ja プロパティか ID名で自動迎撃するスマートフォールバックを執行
            const uiDisplayName = ui.name || ui.ja || ui.id;

            if (el) {
                console.log(` 【${uiDisplayName}】(ID: ${ui.id}) ── 正常確認 (${el.tagName})`);
                healthy++;
            } else {
                console.error(` 【${uiDisplayName}】(ID: ${ui.id}) ── 迷子！HTML側のIDを確認せよ`);
            }
        }
        console.log("-----------------------------------------");
        console.log(` 総合結果: ${healthy} / ${UI_MAP.length} 基がオンライン。`);
        console.log("=========================================");
    }

    // --------------------------------------------------------
    // 診断ロジックB：動的ログ（操作された時にコンソールに吐き出す）
    // --------------------------------------------------------
    function logUIActivity(ui, value, type) {
        if (!window.UI_DEBUG) return;
        if (type === "click") {
            console.log(` [操作検知] ${ui.name} がクリックされました。`);
        } else if (type === "change") {
            console.log(` [計器変動] ${ui.name} ──> 現在値: ${value}`);
        }
    }

 // ========================================================
    // 本体ロジック ＆ 多重登録防止イベントアタッチ
    // ========================================================
    function attachUIWatchersAndLogics() {
        for (const ui of UI_MAP) {
            const el = document.getElementById(ui.id);
            if (!el) continue;

            if (el.dataset.uiWatchAttached) continue;
            el.dataset.uiWatchAttached = "true";

            // --- INPUT / SELECT 系のイベント仕込み ---
            if (el.tagName === "INPUT" || el.tagName === "SELECT") {
                const isCheckbox = el.type === "checkbox";
                const isSelect = el.tagName === "SELECT" || el.type === "select-one";

                // 💡 SELECT タグには確実に "change" イベントを割り当てる
                const primaryEventType = (isCheckbox || isSelect) ? "change" : "input";

                const handleInputChange = (e) => {
                    const currentVal = isCheckbox ? el.checked : e.target.value;
                    logUIActivity(ui, currentVal, "change");
                    executeInputCoreLogic(ui.id, currentVal);
                };

                el.addEventListener(primaryEventType, handleInputChange);

                if (isSelect) {
                    el.addEventListener("input", handleInputChange);
                }
            }

            // --- BUTTON 系のイベント仕込み ---
            if (el.tagName === "BUTTON") {
                el.addEventListener("click", () => {
                    logUIActivity(ui, null, "click");
                    executeButtonCoreLogic(ui.id, el);
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
// 部屋2：宇宙管制盤・ボタンが押された時の中央集約ロジック（完全同期版）
// ========================================================
window.executeButtonCoreLogic = function(id, element) {
    // IDから直接HTMLのボタンを強制サンプリング（迷子参照を完全に防空）
    const targetBtn = document.getElementById(id) || element;
    if (!targetBtn) return;

    switch (id) {
        case "toggleBaryBtn":
            let currentStage = parseInt(targetBtn.getAttribute("data-bary-stage"));
            if (isNaN(currentStage)) currentStage = 0;

            // 👑 規律：15体（Stage 15）の次は、全天体(999)へ行かず、美しく0（全閉）へ帰還執行
            if (currentStage === 0) {
                currentStage = 2; window.showBarycenter = true; window.barycenterTargetCount = 2;
                targetBtn.classList.add("toggle-on"); targetBtn.classList.remove("toggle-off");
            } else if (currentStage === 2) { currentStage = 3; window.barycenterTargetCount = 3;
            } else if (currentStage === 3) { currentStage = 4; window.barycenterTargetCount = 4;
            } else if (currentStage === 4) { currentStage = 8; window.barycenterTargetCount = 8;
            } else if (currentStage === 8) { currentStage = 15; window.barycenterTargetCount = 15;
            } else {
                // ★ 15個の極致を見たあと、カチッと押すと安全にOFF（0）へ復帰
                currentStage = 0;
                window.showBarycenter = false;
                window.barycenterTargetCount = 2; // 初期値フォールバック
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
    }
};

/**
 * ☀️ 最小半径天体を自動ロックし、
 * 「周回軌道上の P/A」・「面積速度ピザ」・「エネルギー相互変換(K/U)」・「全軌道要素」を描画する
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
    target = bodies.find(b => b.name && b.name.toUpperCase() === searchTargetUpper);
  }

  if (!target) {
    let minScore = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b === sun) continue;

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

  // ── 2. 🌌 真の近日点(P)・遠日点(A)のリアルタイム判定（太陽移動対応） ──
  const curDx = target.x - sun.x;
  const curDy = target.y - sun.y;
  const curDz = target.z - sun.z;
  const curR = Math.sqrt(curDx * curDx + curDy * curDy + curDz * curDz);

  if (!target.maxObservedR || curR > target.maxObservedR) {
    target.maxObservedR = curR;
  }

  if (target.lastR !== undefined) {
    const isApproaching = curR < target.lastR;

    // ① 近日点 P のピン留め（接近から遠ざかりへ切り替わった瞬間）
    if (target.wasApproaching && !isApproaching) {
      target.periPoint = { rx: curDx, ry: curDy, rz: curDz, rMag: curR };
    }

    // ② 遠日点 A のピン留め（遠ざかりから接近へ切り替わった瞬間）
    if (!target.wasApproaching && isApproaching) {
      target.aphoPoint = { rx: curDx, ry: curDy, rz: curDz, rMag: curR };
      target.maxObservedR = curR;
    }

    target.wasApproaching = isApproaching;
  } else {
    target.wasApproaching = true;
  }
  target.lastR = curR;

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

  // ── 3. 🍕 ネオンピザ残像の描画（Canvas上） ──
  if (targetHistory.length >= 10) {
    const sunRot = rotate3D({ x: sun.x, y: sun.y, z: sun.z });
    const pSun = project3D(sunRot.x, sunRot.y, sunRot.z);

    if (pSun.visible) {
      for (let i = 1; i < targetHistory.length; i++) {
        const prevRel = targetHistory[i - 1];
        const currRel = targetHistory[i];

        const prevAbs = { x: sun.x + prevRel.rx, y: sun.y + prevRel.ry, z: sun.z + prevRel.rz };
        const currAbs = { x: sun.x + currRel.rx, y: sun.y + currRel.ry, z: sun.z + currRel.rz };

        const prevRot = rotate3D(prevAbs);
        const currRot = rotate3D(currAbs);

        const pPrev = project3D(prevRot.x, prevRot.y, prevRot.z);
        const pCurr = project3D(currRot.x, currRot.y, currRot.z);

        if (!pPrev.visible || !pCurr.visible) continue;

        const dx = pCurr.x - pSun.x;
        const dy = pCurr.y - pSun.y;
        const distance2D = Math.sqrt(dx * dx + dy * dy);
        if (distance2D <= 0) continue;

        const ageFactor = Math.pow(i / targetHistory.length, 2);

        const grad = ctx.createRadialGradient(pSun.x, pSun.y, 0, pSun.x, pSun.y, distance2D);
        grad.addColorStop(0,    `rgba(0, 255, 136, ${0.45 * ageFactor})`);
        grad.addColorStop(0.15, `rgba(0, 255, 136, ${0.18 * ageFactor})`);
        grad.addColorStop(0.4,  `rgba(0, 255, 136, ${0.08 * ageFactor})`);
        grad.addColorStop(1,    `rgba(0, 255, 136, 0.0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pSun.x, pSun.y);
        ctx.lineTo(pPrev.x, pPrev.y);
        ctx.lineTo(pCurr.x, pCurr.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ── 4. 🔴/🔵 固定された「周回軌道上の P 点 / A 点」を描画（Canvas上） ──
  if (target.periPoint) {
    const absP = { x: sun.x + target.periPoint.rx, y: sun.y + target.periPoint.ry, z: sun.z + target.periPoint.rz };
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
    const absA = { x: sun.x + target.aphoPoint.rx, y: sun.y + target.aphoPoint.ry, z: sun.z + target.aphoPoint.rz };
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

// ── 6. 📊 画面右下固定 Tactical HUD（高度拡張データの算出と更新） ──
    if (hud) {
      hud.style.display = "block";

      // 1. 位置ベクトルの安全取得
      const tx = (target && typeof target.x === "number") ? target.x : 0;
      const ty = (target && typeof target.y === "number") ? target.y : 0;
      const tz = (target && typeof target.z === "number") ? target.z : 0;

      const sx = (sun && typeof sun.x === "number") ? sun.x : 0;
      const sy = (sun && typeof sun.y === "number") ? sun.y : 0;
      const sz = (sun && typeof sun.z === "number") ? sun.z : 0;

      const rx = tx - sx;
      const ry = ty - sy;
      const rz = tz - sz;
      const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;

      // 2. 速度ベクトルの安全取得（vx / dx / v.x すべてのデータ構造に対応）
      let tvx = 0, tvy = 0, tvz = 0;
      if (target) {
        if (typeof target.vx === "number") { tvx = target.vx; tvy = target.vy; tvz = target.vz; }
        else if (typeof target.dx === "number") { tvx = target.dx; tvy = target.dy; tvz = target.dz; }
        else if (target.v && typeof target.v.x === "number") { tvx = target.v.x; tvy = target.v.y; tvz = target.v.z; }
      }

      let svx = 0, svy = 0, svz = 0;
      if (sun) {
        if (typeof sun.vx === "number") { svx = sun.vx; svy = sun.vy; svz = sun.vz; }
        else if (typeof sun.dx === "number") { svx = sun.dx; svy = sun.dy; svz = sun.dz; }
        else if (sun.v && typeof sun.v.x === "number") { svx = sun.v.x; svy = sun.v.y; svz = sun.v.z; }
      }

      const relVx = tvx - svx;
      const relVy = tvy - svy;
      const relVz = tvz - svz;
      const vMag = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

      // 3. 外積 (r x relV) による面積速度の厳密導出: dS/dt = 0.5 * |r x v|
      const cx = ry * relVz - rz * relVy;
      const cy = rz * relVx - rx * relVz;
      const cz = rx * relVy - ry * relVx;
      const areaVal = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      const areaVelocityText = (!isNaN(areaVal) && isFinite(areaVal)) ? areaVal.toFixed(1) : "0.0";

      // 4. 物理パラメータ（質量 & 物理定数）
      const m = target.mass || 1.0;
      const gConst = (typeof G !== "undefined") ? G : 0.5;
      const sunM = (sun && sun.mass) ? sun.mass : 2000.0;
      const mu = gConst * sunM;

      // 5. エネルギー計算
      const K = 0.5 * m * (vMag * vMag);
      const U_abs = (mu * m) / rMag;
      const totalE_abs = (K + U_abs) || 1;
      const kRatio = Math.min(1, Math.max(0, K / totalE_abs));

      // ⚡【高度軌道要素の計算】
      let periodText = "--";
      let semiAText = "--";
      let orbitType = "ELLIPSE";
      let ecc = 0;
      let semiA = null;

      let rMin = target.periPoint ? target.periPoint.rMag : null;
      let rMax = target.aphoPoint ? target.aphoPoint.rMag : null;

      if (rMin && rMax) {
        // P点・A点が両方ピン留めされている場合は幾何学式で算出（最も正確）
        ecc = Math.abs(rMax - rMin) / (rMax + rMin);
        semiA = (rMin + rMax) / 2;
      } else {
        // 未固定時はエネルギー方程式から長半径 a を逆算
        const invA = (2 / rMag) - ((vMag * vMag) / mu);
        if (invA > 0) {
          semiA = 1 / invA;
          const knownR = rMin || rMax || rMag;
          ecc = Math.min(0.99, Math.abs(1 - (knownR / semiA)));
        } else {
          ecc = 1.0 + ((vMag * vMag) / mu);
        }
      }

      // 軌道タイプ判定
      if (ecc < 0.05) {
        orbitType = "CIRCULAR";
      } else if (ecc < 0.98) {
        orbitType = "ELLIPSE";
      } else if (ecc < 1.02) {
        orbitType = "PARABOLA";
      } else {
        orbitType = "HYPERBOLA";
      }

      // 周期 T の計算
      if (semiA && semiA > 0) {
        semiAText = semiA.toFixed(1);
        const period = 2 * Math.PI * Math.sqrt(Math.pow(semiA, 3) / mu);
        periodText = `${period.toFixed(1)}s`;
      }

      // ── 6. DOM要素への流し込み（描画更新） ──
      const displayName = target.name || "INNER";
      const targetMass = (target.mass !== undefined) ? target.mass.toFixed(1) : "1.0";

      const titleElem = document.getElementById("hud-title");
      if (titleElem) titleElem.innerText = `TARGET: ${displayName} [LOCKED]`;

      const massElem = document.getElementById("hud-mass");
      if (massElem) massElem.innerText = `MASS: ${targetMass}`;

      const velElem = document.getElementById("hud-vel");
      if (velElem) velElem.innerText = `VEL: ${vMag.toFixed(2)}`;

      const distElem = document.getElementById("hud-dist");
      if (distElem) distElem.innerText = `DIST: ${rMag.toFixed(1)}`;

      const areaElem = document.getElementById("hud-area");
      if (areaElem) areaElem.innerText = `dS/dt: ${areaVelocityText}`;

      const typeElem = document.getElementById("hud-orbit-type");
      if (typeElem) {
        typeElem.innerText = `TYPE: ${orbitType}`;
        if (orbitType === "CIRCULAR") typeElem.style.color = "#00ff88";
        else if (orbitType === "ELLIPSE") typeElem.style.color = "#ffbb00";
        else typeElem.style.color = "#ff3366";
      }

      const eccElem = document.getElementById("hud-ecc");
      if (eccElem) eccElem.innerText = `e: ${ecc.toFixed(2)}`;

      const periodElem = document.getElementById("hud-period");
      if (periodElem) periodElem.innerText = `PERIOD(T): ${periodText}`;

      const semiAElem = document.getElementById("hud-semi-a");
      if (semiAElem) semiAElem.innerText = `a: ${semiAText}`;

      const posElem = document.getElementById("hud-pos");
      if (posElem) posElem.innerText = `POS: (${tx.toFixed(0)}, ${ty.toFixed(0)}, ${tz.toFixed(0)})`;

      const absP = target.periPoint ? { x: sx + target.periPoint.rx, y: sy + target.periPoint.ry, z: sz + target.periPoint.rz } : null;
      const pStr = absP ? `P(${absP.x.toFixed(0)},${absP.y.toFixed(0)},${absP.z.toFixed(0)})` : `P(--)`;
      const pRStr = rMin ? `r:${rMin.toFixed(1)}` : `r:--`;
      const periElem = document.getElementById("hud-peri");
      if (periElem) periElem.innerText = `PERI: ${pStr} [${pRStr}]`;

      const absA = target.aphoPoint ? { x: sx + target.aphoPoint.rx, y: sy + target.aphoPoint.ry, z: sz + target.aphoPoint.rz } : null;
      const aStr = absA ? `A(${absA.x.toFixed(0)},${absA.y.toFixed(0)},${absA.z.toFixed(0)})` : `A(--)`;
      const aRStr = rMax ? `r:${rMax.toFixed(1)}` : `r:--`;
      const aphoElem = document.getElementById("hud-apho");
      if (aphoElem) aphoElem.innerText = `APHO: ${aStr} [${aRStr}]`;

      const engTextElem = document.getElementById("hud-eng-text");
      if (engTextElem) engTextElem.innerText = `ENG [K:${(kRatio * 100).toFixed(0)}% | U:${((1 - kRatio) * 100).toFixed(0)}%]`;

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


// ---------------------------------------------------------
// 2. 新規天体質量（スライダー ⇔ 数値入力）の双方向連動
// ---------------------------------------------------------
const elObjMassSlider = document.getElementById("objMass");
const elObjMassInput  = document.getElementById("objMassInput");

if (elObjMassSlider && elObjMassInput) {
    // 設定オブジェクトへの安全なSetter（キー名の不整合を吸収）
  const updateSettingsObjMass = (val) => {
    if (typeof settings !== "undefined") {
      settings.objMass = val;     // Part 1の標準キー
      settings.objBaseMass = val; // 別名参照への互換代入
    }
  };

  // 1. スライダー操作時
  elObjMassSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    elObjMassInput.value = val.toFixed(1);
    updateSettingsObjMass(val);

    if (window.UI_DEBUG) console.log(`🛸 [UI連動] 生成天体質量(Slider) ──> ${val}`);
  });

  // 2. 数値入力欄操作時
  elObjMassInput.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    // スライダーの可動域にクランプ
    const min = parseFloat(elObjMassSlider.min) || 0.1;
    const max = parseFloat(elObjMassSlider.max) || 50;
    elObjMassSlider.value = Math.max(min, Math.min(max, val));

    updateSettingsObjMass(val);

    if (window.UI_DEBUG) console.log(`🛸 [UI連動] 生成天体質量(Input) ──> ${val}`);
  });
}


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

// リセットボタン（処理 ＋ 200ms 点灯演出の完全統合版）
resetBtn.onclick = () => {
  // ① 時間の停止 ＆ ボタン表記の同期
  simulationState.running = false;
  startBtn.textContent = window.currentLang === 'en' ? "PAUSE (Q)" : "停止 (Q)";
  startBtn.classList.add("toggle-off");
  startBtn.classList.remove("toggle-on");

  // ② 時間軸のゼロクリア
  if (typeof simulationState !== "undefined") {
    simulationState.elapsedTime = 0;
  }
  window.realAccumulatedTime = 0;
  if (typeof lastTime !== "undefined") {
    lastTime = performance.now();
  }

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

  // ⑥ 初期状態をスロット0へ即時保存
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

      // === 軌跡レンダリングフィルタ ===
    case "i":
      safeClick("cometTrailBtn");
      break;

    case "o":
      safeClick("planetTrailBtn");
      break;

    case "p":
      safeClick("sunTrailBtn");
      break;

    // === カメラプリセット（J / K / L） ===
    case "j":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("equator");
      }
      break;

    case "k":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("polar");
      }
      break;

    case "l":
      if (typeof applyCameraPreset === "function") {
        applyCameraPreset("overview");
      }
      break;

    // === ディスプレイ・表示トグル（N / M） ===
   case "n":
  // 👑 【調律】チェックボックス依存をパージし、他のボタンと同じ安全クリックへ同期
  safeClick("showNames");
  break;

   case "m":
     safeClick("btnOrbitCam"); // btnOrbitCam
     break;

    default:
      // 未定義のキーは宇宙の静寂を乱さないよう、そのままスルーするわ
      break;

// === バリセンター表示トグル（B） ===
    case "b":
      safeClick("toggleBaryBtn");
      break;

// === LVEC(V） ===
    case "v":
      safeClick("toggle-momentum-btn");
      break;


  }
});



loop();
