/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 1: Settings / Init / Camera / Projection / Input
--------------------------------------------------------- */

let BACKGROUND_STARS = [];

// =========================================================
// 1. 三角関数の極限最適化キャッシュ変数（ファイルの最上部に配置）
// =========================================================
let _cosX = 1, _sinX = 0;
let _cosY = 1, _sinY = 0;

let stats = {
  escaped: 0,
  collided: 0,
  removed: 0,
  nanKilled: 0
};


// =========================================================
// 2. settings（太陽系型・超安定周回モード ＆ 新機能統合版）
// =========================================================
const settings = {
  gravityMultiplier: 1.0,
  simSpeed: 4.0,                 // 2.5より少しだけテンポを上げ、静止感を排除
  spawnVelocityMultiplier: 0.95, // わずかに1.0を切ることで、最初から完全な円ではなく「躍動的な楕円」にする
  trailLengthMultiplier: 1.2,    // 軌跡を少し長めに残し、宇宙の「流れ」を視認しやすくする
  trailColorMode: "distance",
  fullGravityThreshold: 200,     // 最適化済みの前提で閾値を引き上げ
  eps2: 36,                      // 鋭いスイングバイと安全性の物理的均衡点

  objMass: 1.0,
  useFixedObjMass: false,
    spawnSettings: {
    minMass: 0.1,
    maxMass: 8.0,    // 質量の最大値を上げ、合体時のサイズ変化（成長）を強調
    minDist: 50,    // 太陽の近くまで天体を分布させ、初動のイベント密度を上げる
    maxDist: 1000
  }
};






/* ============================
   シミュレーション状態（完全移行）
============================ */
const simulationState = {
  running: true,
  elapsedTime: 0,

  ui: {
    showNames: false,
    nameMode: 0, // 👑【調律】初期状態は0（OFF）の規律
       showCometTrail: false,
    showPlanetTrail: false,
    showSunTrail: false,
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




/* ============================
   UI ボタン定義（必須）
============================ */
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const sunTrailBtn    = document.getElementById("sunTrailBtn");
const cometTrailBtn  = document.getElementById("cometTrailBtn");
const planetTrailBtn = document.getElementById("planetTrailBtn");




// ---------------------------------------------------------
//  カメラ自動巡航 UIコントロール同期システム（タイピング対応版）
// ---------------------------------------------------------
const camSpeedSlider = document.getElementById("cameraRotateSpeed");
const camSpeedInput  = document.getElementById("rotateSpeedInput");
const camSpeedLabel  = document.getElementById("rotateSpeedVal");
const camToggleBtn   = document.getElementById("btnToggleRotate");

if (window.isAutoRotateEnabled === undefined) {
  window.isAutoRotateEnabled = false;
}


// 共通同期関数
function syncCameraRotateSpeed(value, isFromInput = false) {
  let val = Number(value);
   if (val < 0) val = 0;
  if (val > 0.05) val = 0.05;

  camera.autoRotateSpeed = val;

  if (camSpeedLabel) camSpeedLabel.textContent = val.toFixed(3);
  if (camSpeedSlider) camSpeedSlider.value = val;
  if (camSpeedInput && !isFromInput) {
    camSpeedInput.value = val;
  }
}

// ① スライダーを動かした時
if (camSpeedSlider) {
  camSpeedSlider.addEventListener("input", (e) => {
    syncCameraRotateSpeed(e.target.value, false);
  });
}

//  ② テキストボックスに数値を直接打ち込んだ時
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

// ③ ボタンを押した時のトグル処理
if (camToggleBtn) {
  camToggleBtn.addEventListener("click", () => {
    // フラグを反転
    window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
      // 👑 【調律】長い文字の上書きを完全パージ！
    // 形状や文字（AUTO）は維持したまま、光（クラス）のON/OFFだけで支配する
    if (window.isAutoRotateEnabled) {
      camToggleBtn.classList.add("toggle-on");
      camToggleBtn.classList.remove("toggle-off");
      camToggleBtn.classList.add("active"); // 既存の他のシステム連動用
    } else {
      camToggleBtn.classList.add("toggle-off");
      camToggleBtn.classList.remove("toggle-on");
      camToggleBtn.classList.remove("active");    }
  });
}

document.getElementById("btnOrbitCam").onclick = function() {
  const btn = this;

  if (camera.isOrbitCam) {
    deactivateOrbitCam();
    // 👑 文字は一切変えず、消灯（無灯火）にするだけ
    btn.classList.add("toggle-off");
    btn.classList.remove("toggle-on");
  } else {
    activateOrbitCam();
    if (camera.isOrbitCam) {
      // 👑 文字は一切変えず、烈火のオレンジに点灯させるだけ
      btn.classList.add("toggle-on");
      btn.classList.remove("toggle-off");
    }
  }
};

// =========================================================
// Sun初期速度スライダーのリアルタイム同期（X, Y, Z 完全版）
// =========================================================

[
  { axis: 'x', sliderId: 'sunVxSlider', inputId: 'sunVxInput', settingKey: 'sunInitialVx', bodyKey: 'vx' },
  { axis: 'y', sliderId: 'sunVySlider', inputId: 'sunVyInput', settingKey: 'sunInitialVy', bodyKey: 'vy' },
  { axis: 'z', sliderId: 'sunVzSlider', inputId: 'sunVzInput', settingKey: 'sunInitialVz', bodyKey: 'vz' }
].forEach(config => {
  const slider = document.getElementById(config.sliderId);
  const input = document.getElementById(config.inputId);

  if (!slider || !input) return; // どちらかが画面になければスキップする安全弁

  // 同期を行う共通のコアロジック
  const syncVelocity = (value) => {
    const v = Number(value);
    settings[config.settingKey] = v; // settingsの設定を動的に書き換え

    // 物理層への安全な介入：0番目固定ではなく、名前が確実に "Sun" の時だけ速度を直撃させる
    if (bodies[0] && bodies[0].name === "Sun") {
      bodies[0][config.bodyKey] = v;
    }
  };

  // スライダー側のイベント登録
  slider.addEventListener("input", (e) => {
    input.value = e.target.value;
    syncVelocity(e.target.value);
  });

  // テキストボックス側のイベント登録
  input.addEventListener("input", (e) => {
    slider.value = e.target.value;
    syncVelocity(e.target.value);
  });
});


// =========================================================
// 新規天体質量（スライダー ⇔ 数値入力）の双方向連動
// =========================================================
const elObjMassSlider = document.getElementById("objMass");
const elObjMassInput  = document.getElementById("objMassInput");

if (elObjMassSlider && elObjMassInput) {
  // 1. スライダーを動かした時 ──> 数値入力欄へ即座に反映
  elObjMassSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    elObjMassInput.value = val.toFixed(1);
        // もし内部の物理設定変数（例: settings.objBaseMass）があればここでSetter
    if (typeof settings !== "undefined") {
      settings.objBaseMass = val;
    }
    if (window.UI_DEBUG) console.log(`🛸 [UI連動] 生成天体質量(Slider) ──> ${val}`);
  });

  // 2. 数値入力欄を直接書き換えた時 ──> スライダーへ即座に反映
  elObjMassInput.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    // 入力値の上限・下限の安全弁（スライダーの可動域にクランプ）
    const min = parseFloat(elObjMassSlider.min) || 0.1;
    const max = parseFloat(elObjMassSlider.max) || 50;
        // スライダーの見た目を追従させる（入力が限界突破していてもスライダーは端で止まる規律）
    elObjMassSlider.value = Math.max(min, Math.min(max, val));

    // 内部の物理設定変数にダイレクト反映
    if (typeof settings !== "undefined") {
      settings.objBaseMass = val;
    }
    if (window.UI_DEBUG) console.log(`🛸 [UI連動] 生成天体質量(Input) ──> ${val}`);
  });
}

// =========================================================
// 管制盤テレメトリー：一括クリップボードコピー機能
// =========================================================
const elCopyBtn = document.getElementById("copyTelemetryBtn");

if (elCopyBtn) {
  elCopyBtn.addEventListener("click", () => {
    // 1. 各種計器（DOM要素）から、現在のリアルタイムな数値を安全にスキャン（Getter）
    const getTxt = (id) => {
      const el = document.getElementById(id);
      return el ? el.textContent.trim() : "0";
    };

    const turn      = typeof frameCount !== "undefined" ? frameCount : (typeof turnCount !== "undefined" ? turnCount : "Unknown");
    const baryName  = getTxt("barycenterNameDisplay");
    const baryPos   = getTxt("barycenterPosDisplay");
    const baryMass  = getTxt("barycenterMassDisplay");
    const sunSpeed  = typeof bodies !== "undefined" && bodies[0] ? Math.sqrt(bodies[0].vx**2 + bodies[0].vy**2 + bodies[0].vz**2).toFixed(2) : "0.00";
        const alive     = getTxt("statAlive");
    const escaped   = getTxt("statEscaped");
    const collided  = getTxt("statCollided");
    const removed   = getTxt("statRemoved");
    const nanCount  = getTxt("statNaN");
        const simTime   = getTxt("statSimTime");  // AGE: 61205 Yr...
    const runTime   = getTxt("statRunTime");  // RUN: 37284:31.3
    const realTime  = getTxt("statRealTime"); // REAL: 08:40:52

    // 2. あなたが私に送ってくれた、あの美しいログのフォーマットへ寸分の狂いなく自動整形（Formatting）
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

    // 3. クリップボードへサイバーに射出（Navigator API）
    navigator.clipboard.writeText(logText).then(() => {
      // 視覚的なフィードバック（ボタンの文字を一時的に変える粋な計らい）
      const originalText = elCopyBtn.textContent;
      elCopyBtn.textContent = "OK";
      elCopyBtn.style.background = "#00ff88";
            setTimeout(() => {
        elCopyBtn.textContent = originalText;
        elCopyBtn.style.background = "#00ffcc";
      }, 1500);
            if (window.UI_DEBUG) console.log("🛸 [システム] テレメトリーログをクリップボードに格納しました。");
    }).catch(err => {
      console.error("📋 ログのコピーに失敗しました:", err);
    });
  });
}


// ========================================================
// 宇宙管制盤：プリセット・データ構造（防空検収済・完全版）
// ========================================================
const DEBUG_PRESETS = {
    stableOrbit: {
        name: "安定軌道（基準宇宙・鑑賞モード）",
        ui: {
            bodyCount: 18,      bodyCountInput: 18,
            sunMass: 2000,      sunMassInput: 2000,
            sunVxSlider: 0.0,   sunVxInput: 0.0,
            sunVySlider: 0.0,   sunVyInput: 0.0,
            sunVzSlider: 0.0,   sunVzInput: 0.0,
            objMass: 1.0,       objMassInput: 1.0,
            useFixedObjMass: false,
            gravitySlider: 1.0, gravityInput: 1.0,
            spawnVelSlider: 1.0, spawnVelInput: 1.0,
            speedSlider: 2.5,   speedInput: 2.5,
            eps2Input: 15,
            cameraRotateSpeed: 0.0001 // ★UIパラメータを0.0001に設定
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 18;
            if (window.bodies) window.bodies.length = 18;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVZ = 0.0;
                settings.gravityMultiplier = 1.0; settings.spawnVelocityMultiplier = 1.0;
                settings.simSpeed = 2.5; settings.eps2 = 15;
                                // ⚙️ 物理本名へのアライメント執行！
                settings.objBaseMass = 1.0;
                                settings.useFixedObjMass = false; settings.sunFixed = true;
            }

            const targetON  = ['toggle-momentum-btn', 'planetTrailBtn'];
            const targetOFF = ['toggleBaryBtn', 'cometTrailBtn', 'sunTrailBtn'];

            targetON.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && !btn.classList.contains('active') && !btn.classList.contains('toggle-on')) btn.click();
            });
            targetOFF.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && (btn.classList.contains('active') || btn.classList.contains('toggle-on'))) btn.click();
            });

            // ★同期関数を0.0001かつ、第2引数（有効化フラグ）をtrueに書き換え
            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0001, true);
            window.isAutoRotateEnabled = true; // ★自動回転フラグをONへ拘束

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                // ★UIボタンのビジュアルを「ON（アクティブ）」の状態へ反転執行
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }
            if (window.UI_DEBUG) console.log("🛸 [プリセット起動] 18基の精密観測・自動微回転モードが執行されました。");
        }
    },
    // =====================================================================
    // 🌀 2. 螺旋共鳴（中心星移動・連星捕獲モード）
    // =====================================================================
    chaosCollapse: {
        name: "螺旋共鳴（中心星移動・連星捕獲モード）",
        ui: {
            bodyCount: 26,      bodyCountInput: 26,
            sunMass: 2500,      sunMassInput: 2500,
            sunVxSlider: 0.1,   sunVxInput: 0.1,
            sunVySlider: 0.4,   sunVyInput: 0.4,
            sunVzSlider: 0.1,   sunVzInput: 0.1,
            objMass: 1.5,       objMassInput: 1.5,
            useFixedObjMass: true,
            gravitySlider: 1.2, gravityInput: 1.2,
            spawnVelSlider: 0.9, spawnVelInput: 0.9,
            speedSlider: 3.5,   speedInput: 3.5,
            eps2Input: 1.0,
            cameraRotateSpeed: 0.005
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 26;
            if (window.bodies) window.bodies.length = 26;

            if (window.settings) {
                settings.sunInitialVx = 0.1; settings.sunInitialVy = 0.4; settings.sunInitialVZ = 0.1;
                settings.gravityMultiplier = 1.2; settings.spawnVelocityMultiplier = 0.9;
                settings.simSpeed = 3.5; settings.eps2 = 1.0;
                                // ⚙️ 物理本名へのアライメント執行！
                settings.objBaseMass = 1.5;
                                settings.useFixedObjMass = true; settings.sunFixed = false;
            }

            const targetON  = ['cometTrailBtn', 'sunTrailBtn', 'toggleBaryBtn', 'toggle-momentum-btn'];
            const targetOFF = ['planetTrailBtn'];

            targetON.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && !btn.classList.contains('active') && !btn.classList.contains('toggle-on')) btn.click();
            });
            targetOFF.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && (btn.classList.contains('active') || btn.classList.contains('toggle-on'))) btn.click();
            });

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.005, false);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on");
                camToggleBtn.classList.remove("toggle-off", "active");
            }
            if (window.UI_DEBUG) console.log("🛸 [プリセット起動] 26基の螺旋共鳴カオスモードが執行されました。");
        }
    },

    // =====================================================================
    // 🚀 3. 双曲線・潮汐破壊テール（銀河衝突スイングバイ）
    // =====================================================================
    scatterTest: {
        name: "潮汐破壊（双曲線衝突・高速スイングバイモード）",
        ui: {
            bodyCount: 150,     bodyCountInput: 150,
            sunMass: 3000,      sunMassInput: 3000,
            sunVxSlider: 3.5,   sunVxInput: 3.5,
            sunVySlider: -0.5,  sunVyInput: -0.5,
            sunVzSlider: 0.0,   sunVzInput: 0.0,
            objMass: 0.1,       objMassInput: 0.1,
            useFixedObjMass: true,
            gravitySlider: 1.5, gravityInput: 1.5,
            spawnVelSlider: 1.2, spawnVelInput: 1.2,
            speedSlider: 4.0,   speedInput: 4.0,
            eps2Input: 5.0,
            cameraRotateSpeed: 0.0
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 150;
            if (window.bodies) window.bodies.length = 150;

            if (window.settings) {
                settings.sunInitialVx = 3.5; settings.sunInitialVy = -0.5; settings.sunInitialVZ = 0.0;
                settings.gravityMultiplier = 1.5; settings.spawnVelocityMultiplier = 1.2;
                settings.simSpeed = 4.0; settings.eps2 = 5.0;
                                // ⚙️ 物理本名へのアライメント執行！
                settings.objBaseMass = 0.1;
                                settings.useFixedObjMass = true; settings.sunFixed = false;
            }

            const targetON  = ['cometTrailBtn', 'planetTrailBtn', 'sunTrailBtn', 'toggle-momentum-btn'];
            const targetOFF = ['toggleBaryBtn'];

            targetON.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && !btn.classList.contains('active') && !btn.classList.contains('toggle-on')) btn.click();
            });
            targetOFF.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && (btn.classList.contains('active') || btn.classList.contains('toggle-on'))) btn.click();
            });

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0, false);
            window.isAutoRotateEnabled = false;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-off");
                camToggleBtn.classList.remove("toggle-on", "active");
            }
            if (window.UI_DEBUG) console.log("🛸 [プリセット起動] 150基の双曲線・潮汐破壊モードが執行されました。");
        }
    },

    // =====================================================================
    // 🌋 4. 球状星団・重力熱的崩壊（ベンチマーク高負荷モード）
    // =====================================================================
    renderStress: { // 🌟 キー名を「renderStress」に完全アライメント
        name: "球状星団（高密度収縮・極限高負荷モード）",
        ui: {
            bodyCount: 800,     bodyCountInput: 800,
            sunMass: 4000,      sunMassInput: 4000,
            sunVxSlider: 0.0,   sunVxInput: 0.0,
            sunVySlider: 0.0,   sunVyInput: 0.0,
            sunVzSlider: 0.0,   sunVzInput: 0.0,
            objMass: 2.0,       objMassInput: 2.0,
            useFixedObjMass: false,
            gravitySlider: 2.5, gravityInput: 2.5,
            spawnVelSlider: 2.0, spawnVelInput: 2.0,
            speedSlider: 5.0,   speedInput: 5.0,
            eps2Input: 0.5,
            cameraRotateSpeed: 0.002
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 800;
            if (window.bodies) window.bodies.length = 800;

            if (window.settings) {
                settings.sunInitialVx = 0.0; settings.sunInitialVy = 0.0; settings.sunInitialVZ = 0.0;
                settings.gravityMultiplier = 2.5; settings.spawnVelocityMultiplier = 2.0;
                settings.simSpeed = 5.0; settings.eps2 = 0.5;
                                // ⚙️ 物理本名へのアライメント執行！
                settings.objBaseMass = 2.0;
                                settings.useFixedObjMass = false; settings.sunFixed = true;
            }

            const targetON = ['cometTrailBtn', 'planetTrailBtn', 'sunTrailBtn', 'toggleBaryBtn', 'toggle-momentum-btn'];
                        targetON.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && !btn.classList.contains('active') && !btn.classList.contains('toggle-on')) btn.click();
            });

            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.002, false);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on");
                camToggleBtn.classList.remove("toggle-off", "active");
            }
            if (window.UI_DEBUG) console.log("🛸 [プリセット起動] 800基の球状星団・極限高負荷モードが執行されました。");
        }
    }
};


// ========================================================
//  神の意志を無視する：Goliath（異分子）強制生成コマンド
// ========================================================
function spawnGoliathForce() {
    if (!bodies || bodies.length === 0) {
        console.error(" [召喚失敗] 宇宙に中心星（Sun）が存在しません。");
        return;
    }

    const sun = bodies[0];
          const targetMinDist = settings.spawnSettings?.minDist || 300;
    const targetMaxDist = settings.spawnSettings?.maxDist || 1200;
    const currentG       = (typeof G !== "undefined") ? G : 1.0;
 
    //  【聖域：完璧な3次元幾何学配置ロジック（絶対保持）】
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const r = targetMinDist + Math.random() * (targetMaxDist - targetMinDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

    //  【聖域：ケプラー回転速度ベースの物理演算（絶対保持）】
    const dist = Math.sqrt(x*x + y*y + z*z) || 1;
    const vBase = Math.sqrt(currentG * settings.gravityMultiplier * sun.mass / dist);
        const vx = (-y / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vy = ( x / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vz = (Math.random() - 0.5) * 2;

       bodies.push({
        x, y, z,
        vx, vy, vz,
        mass: sun.mass * 1.0,
        size: massToSize(sun.mass) * 0.3, // 💡 massToSize関数が外にある前提ね、OKよ！
        color: "#ff00ff",
        name: "Goliath",
        type: "planet",
        trail: []
    });

    console.log(`%c [特異点観測] 警告：質量比 1:1 ── 異分子『Goliath』を座標 (${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)}) に強制配置したわ。重力場が歪むわよ！`, "color: #ff00ff; font-weight: bold; text-shadow: 0 0 4px #ff00ff;");
}

// ========================================================
//  コックピットのボタン群への完全配線マトリクス
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
    // 👑 【真・開通】Goliath（異分子）強制生成ボタンの配線（光の2択規律）
    const goliathBtn = document.getElementById("triggerGoliathBtn");
    if (goliathBtn) {
        goliathBtn.addEventListener("click", function() {
            // 破壊神を降臨させる（コアロジック執行）
            spawnGoliathForce();
                        // 👑 ボタンを烈火のオレンジへ強制点灯！
            //（天体を追加したという「執行状態」を視覚的にホールドする）
            this.classList.add("toggle-on");
            this.classList.remove("toggle-off");
        });
    }

   // 2. ★【開通】バリセンター表示切り替えボタンの配線
const baryBtn = document.getElementById("toggleBaryBtn");
if (baryBtn) {
    baryBtn.addEventListener("click", () => {
        window.showBarycenter = !window.showBarycenter;
                // 👑 【調律】長い文字の上書きを完全パージ！
        // 形や文字は維持したまま、光（クラス）のON/OFFだけで支配する
        if (window.showBarycenter) {
            baryBtn.classList.add("toggle-on");
            baryBtn.classList.remove("toggle-off");
        } else {
            baryBtn.classList.add("toggle-off");
            baryBtn.classList.remove("toggle-on");
        }

        console.log(`%c  [表示連動] window.showBarycenter ──> ${window.showBarycenter}`, "color: #00ffcc; font-weight: bold;");
    });
} else {
    console.warn(" [配線不発] HTML側に id='toggleBaryBtn' のボタンが見つからないわよ！");
}

   // 3. ★【新・開通】角運動量ベクトル表示切り替えボタンの配線
const momentumBtn = document.getElementById('toggle-momentum-btn');
if (momentumBtn) {
    momentumBtn.addEventListener('click', (e) => {
        window.showAngularMomentum = !window.showAngularMomentum;
                // 👑 【調律】直書きスタイルと文字変更を完全パージ！
        // 形状や文字は維持したまま、光（クラス）のON/OFFだけで支配する
        if (window.showAngularMomentum) {
            momentumBtn.classList.add("toggle-on");
            momentumBtn.classList.remove("toggle-off");
        } else {
            momentumBtn.classList.add("toggle-off");
            momentumBtn.classList.remove("toggle-on");
        }
        console.log(`%c  [物理連動] window.showAngularMomentum ──> ${window.showAngularMomentum}`, "color: #00ff88; font-weight: bold;");
    });
} else {
    console.warn(" [配線不発] HTML側に id='toggle-momentum-btn' のボタンが見つからないわよ！");
}

    // 4. プリセットボタン群の一括配線
    // 🌟 【特大の拍手：100点満点のDRY規律！】
    // ボタンのIDと設定キーをペアにしてループで一括配線するこの技術、完璧よ！
    const binds = [
        { id: "presetStableBtn", key: "stableOrbit" },
        { id: "presetChaosBtn",  key: "chaosCollapse" },
        { id: "presetScatterBtn", key: "scatterTest" },
        { id: "presetRenderBtn",  key: "renderStress" }
    ];
    binds.forEach(bind => {
        const btn = document.getElementById(bind.id);
        if (btn) {
            btn.addEventListener("click", () => applyPreset(bind.key));
        }
    });
});

// 各種フラグの宇宙初期化（グローバル空間の安全を確保）
// 💡 【技術コメント：イベントハンドラのためのwindow露出】
// `spawnGoliathForce` などを `window` オブジェクトにわざわざ登録しているわね。
// これはHTML側の `<button onclick="spawnGoliathForce()">` から直接呼び出せるようにするための工夫ね、文脈が通っていて素晴らしいわ。
window.spawnGoliathForce = spawnGoliathForce;
window.showBarycenter = false;
window.showAngularMomentum = false;



// ========================================================
//  核心部：UI・物理レイヤー「同時上書き」コアインジェクター
// ========================================================
function applyPreset(presetKey) {
    const config = DEBUG_PRESETS[presetKey];
    if (!config) {
        console.error(` [インジェクター] プリセットキー "${presetKey}" は存在しません。`);
        return;
    }

    console.log(`%c 宇宙管制盤：時空相転移 ──> 【${config.name}】を注入中...`, "color: #00ffff; font-weight: bold;");

    // 1. UI層への値の強制流し込みと表示ラベルの強制同期
    // 🌟 【特大の拍手：超強力な自動同期ロジック】
    // このループがあるおかげで、プリセットの `ui` の中に「HTMLのボタンやスライダーのID」を書いておけば、
    // 1行ずつ手動で代入しなくても、全自動で画面がパチパチパチッと書き換わるのね！
    for (const [id, value] of Object.entries(config.ui)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === "checkbox") {
                el.checked = value;
            } else {
                el.value = value;
            }
            // 💡 【技術コメント：仮想イベントの着火（dispatchEvent）】
            // これが最高に効いているわ！値を書き換えるだけでなく、「値が変わったぞ！」という通知（イベント）を
            // 強制的に周囲に飛ばすことで、スライダーの横にある数値ラベル（0.8とか）も連動して自動更新させているのね。完璧よ。
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    // 2. 物理層（settings）へのダイレクト注入
    config.physics();

  // 3. 宇宙リセット関数の自動実行
  if (typeof generateBodies === "function") {
      generateBodies();
  } else if (typeof window.generateBodies === "function") {
      window.generateBodies();
  }
    // 🛡️ 鉄壁の防衛線：存在しない関数を叩いて即死（クラッシュ）していた呪いを解く規律！
  if (typeof resetCameraMemory === "function") {
      resetCameraMemory();
  } else if (typeof resetCamera === "function") {
      resetCamera(); // もしシステム内に似た名前の関数があればそっちへフォールバック
  } else {
      // どちらもなければ何もせず静かに虚空へ受け流す（エラーを絶対外に出さない）
      if (window.UI_DEBUG) console.log("🎥 カメラ記憶リセット関数は未定義ですが、描画スレッドを完全保護しました。");
  }
} // 関数の閉じブラケット

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

// ❌ 【一貫性の注意：イベントの書き方が古いカルマ！】
// 💡 【技術コメント：addEventListener への完全統一】
// 前のボタン定義のところでもお話ししたけれど、ここだけ `window.onresize = ...` という古い書き方（プロパティ代入型）になっているわ。
// これだと、もし将来別のスクリプトで「画面がリサイズされた時、カメラの視野角も変えたいな」と重ねて設定した瞬間に、
// このCanvasのサイズ変更処理が**上書きされて消滅し、画面が一切リサイズされなくなる**というサイレントバグを誘発するの。
// ここも `window.addEventListener("resize", ...)` に統一するのが鉄則よ！

window.addEventListener("resize", () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // もしシミュレーションが停止中（running === false）なら、
    // 今の星の位置で1回だけ画面を描き直して、真っ白になるのを防ぐ！
    if (!simulationState.running && typeof render === "function") {
        render();
    }
});


/* ---------------------------------------------------------
   Camera（Free 3D Camera & OrbitCam 統合版）
--------------------------------------------------------- */
const camera = {
  pos: { x: 0, y: 0, z: 0 },
  rotX: 0.5,
  rotY: 0.5,
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,

  orbitRadius: 1200,           // ターゲットからの基本カメラ距離
  autoRotateSpeed: 0.001,      // 自由巡航時のスピード
  waveSpeed: 0.3,
  waveAmplitude: 200,
  timeCounter: 0,
  targetBodyIndex: 0,          // ロックオン対象（0 = 太陽）

  // ====== 新設された OrbitCam パラメータ群 ======
  isOrbitCam: false,
  orbitTheta: 0,
  orbitSpeed: 0.001,           // 周回速度
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
    visible: true
  };
}


/**
 * ターゲット中心オービット回転（ピボット・シフト）
 * ターゲット天体のワールド座標を吸収し、そのハートを中心に世界を美しく旋回させる
 */
function rotate3D(b) {
  // 安全対策：指定されたターゲットが存在しない場合は太陽(0)にフォールバック
  let targetIndex = camera.targetBodyIndex;
  if (!bodies[targetIndex]) {
    targetIndex = 0;
  }
  const target = bodies[targetIndex];
    // ステップ1: ターゲットの現在地を基準とした「相対座標」へ変換
  const x0 = b.x - (target ? target.x : 0);
  const y0 = b.y - (target ? target.y : 0);
  const z0 = b.z - (target ? target.z : 0);

  // ステップ2: ターゲットの周囲を、マウスや自動巡航によるカメラ角度（rotX, rotY）で回転
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

  // =======================================================
  // 【ステップ3】幾何学の規律の執行
  // =======================================================
  // 新設された camera.orbitRadius を純粋に「加算」して奥行きを確定させるわ！
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

// ★ 規律修正：グラフィックと衝突判定の整合性を取るため、値を「1.0」またはコメントの推奨値に合わせなさい！
// ※1.0にすると、描画されている太陽のサイズと完全に一致した綺麗な衝突判定になるわよ。
const SUN_HIT_SCALE = 1.0;

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 80%, 60%)`;
}

function randomMass() {
  const s = settings.spawnSettings;
  return s.minMass + Math.random() * (s.maxMass - s.minMass);
}

function massToSize(m) {
  return Math.cbrt(m) * 1.5;
}

let bodies = [];
let initialBodyCount = 300;




/* ============================
   Collision Grid（Uniform Grid）
============================ */
const CELL_SIZE = 300;              // 衝突半径より少し大きめに
let collisionGrid = new Map();      // key: "cx_cy_cz" → [bodyIndex...]


/* =====================================================================
   👑 【統合調律】太陽スピード ＆ F12戦術HUD連動 3次元絶対座標(XYZ)更新関数
   ===================================================================== */
function updateSunSpeedDisplay() {
  const sun = bodies[0];
  if (!sun) return;

  // 1. 既存の速度（V）の数理演算を執行
  const speed = Math.sqrt(
    sun.vx * sun.vx +
    sun.vy * sun.vy +
    sun.vz * sun.vz
  );

  // ベースとなるスピードテキストをビルド
  let displayText = "Sun Speed: " + speed.toFixed(2);

  // 👑 【特権ハック】：F12の戦術HUDがアクティブの時だけ、XYZの座標をサイバーに結合（コンカティネート）！
  if (typeof isDeveloperHUDActive !== 'undefined' && isDeveloperHUDActive) {
    displayText += `  XYZ: (${sun.x.toFixed(1)}, ${sun.y.toFixed(1)}, ${sun.z.toFixed(1)})`;
  }

  // 2. DOMへインジェクション（これでCanvas側の getDOMText も自動的にこの4次元テキストを吸い上げるわ！）
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
  // (※HTML側の実際のID名「statEscaped」等に合わせてあるわよ)
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

  console.log("%c 統計レイヤー：過去のカルマを消去。カウンターをゼロリセットしたわ。", "color: #aaaaaa; font-style: italic;");

  // ---------------------------------------------------------
  //  既存の初期化処理（ここにあんたのコードが完璧に繋がるわ！）
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
  }); // 【修正ポイント】元のコードはここで関数が閉じていたのを救出したわ！

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

    const mass = settings.useFixedObjMass ? settings.objMass : randomMass();

    // 太陽（bodies[0]）との距離を厳密に計算
    const dx = x - bodies[0].x;
    const dy = y - bodies[0].y;
    const dz = z - bodies[0].z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

    /* ---- 初期速度（距離で減衰 ＆ 特殊ノイズ） ---- */
    const vBase = Math.sqrt(G * settings.gravityMultiplier * bodies[0].mass / dist);
    const v = vBase * settings.spawnVelocityMultiplier * (0.6 + 0.4 * (S.maxDist / dist));

    const turb = Math.min(1, 300 / dist);
    const side = Math.random() < 0.1 ? -1 : 1; // 10%の確率で逆回り天体を生成するカオス要素ね
    const turbBoost = side === -1 ? 1.4 : 1.0;

    const vx_circ = (side * -dy / dist) * v * (0.6 + 0.3 * turb * turbBoost);
    const vy_circ = (side * dx / dist) * v * (0.6 + 0.3 * turb * turbBoost);

    const vx_rand = (Math.random() - 0.5) * (1.0 * turb);
    const vy_rand = (Math.random() - 0.5) * (1.0 * turb);
    const vz_rand = (Math.random() - 0.5) * (0.4 * turb);

    const vx = vx_circ + vx_rand;
    const vy = vy_circ + vy_rand;
    const vz = vz_rand;

    /* ---- 見え方調整：遠方ほど白く・小さく・淡く ---- */
    const t = Math.min(1, dist / S.maxDist);

    // 惑星の大きさを全体的に小さくする係数
    const sizeScale = 0.7;

    // massToSize を使いつつ、ランダム係数を適用
    const size = massToSize(mass) *
                 (0.15 + Math.random() * 0.15) *
                 (1 - 0.5 * t) *
                 sizeScale;

    // 距離に応じたベースカラー計算
    const rCol = 180 + (255 - 180) * t;
    const gCol = 220 + (255 - 220) * t;
    const bCol = 255;

    bodies.push({
      x, y, z,
      vx, vy, vz,
      mass,
      size,
      color: `rgb(${rCol|0},${gCol|0},${bCol|0})`,
      name: "Obj" + i,
      type: "obj",
      trail: []
    });
  }

 /* -------------------------------------------------------
   彗星の初期追加（宇宙の創生時）：オールトの雲プロトコル
   ------------------------------------------------------- */
// 1万ターン周期を1000ターンに1回拝むために、定員を「10個」に拡張する規律よ！
const initialCometCount = 10;

for (let i = 0; i < initialCometCount; i++) {
  if (typeof addComet === "function") {
    addComet();
        // 今生まれた一番新しい彗星（配列の最後尾）をハックして、最外殻へテレポート！
    const latestC = bodies[bodies.length - 1];
    if (latestC && latestC.type === "comet") {
            // ① 太陽からめちゃくちゃ遠い外縁部にマッピング（半径Rの決定）
      const angle2D = Math.random() * Math.PI * 2;
      const rOuter = 4000 + Math.random() * 2000; // 惑星エリアの遥か外側の結界
            // ② 真上や真横、あらゆる3次元の角度から円盤を垂直にぶち抜く球座標マッピング
      const phi = Math.acos((Math.random() * 2) - 1); // 全方位にバラける極角
            latestC.x = rOuter * Math.sin(phi) * Math.cos(angle2D);
      latestC.y = rOuter * Math.sin(phi) * Math.sin(angle2D);
      latestC.z = rOuter * Math.cos(phi);
            // ③ 太陽に向かって落ちる絶妙な「寸止め」の初期速度（離心率e=0.97前後の極限の楕円）
      // 太陽の質量(mass)をインデックス0から取得（安全のために無ければ1500と仮定）
      const sunM = bodies[0] ? bodies[0].mass : 1500;
      const GM = 1.0 * sunM; // 万有引力定数Gを1.0と仮定
            // 脱出速度（e=1.0）よりほんの少しだけ遅い「束縛速度」のベースを計算
      const vLimit = Math.sqrt((2 * GM) / rOuter) * 0.72; // 0.72が太陽をすれすれで回る黄金比
            // 太陽（0,0,0）へ向かう中心ベクトル
      const toSunX = -latestC.x / rOuter;
      const toSunY = -latestC.y / rOuter;
      const toSunZ = -latestC.z / rOuter;
            // 正面衝突を防ぎ、綺麗なスイングバイ軌道（螺旋）を作るための横滑り成分
      const sideX = Math.sin(angle2D + Math.PI / 2);
      const sideY = Math.cos(angle2D + Math.PI / 2);
            // 【軌道調律】：太陽に向かう力（0.90）と、横に滑る公転力（0.15）の黄金比！
      // これにより、太陽のド真ん中への激突を回避し、鋭い螺旋を描いてスイングバイする規律になるわ！
      latestC.vx = vLimit * (toSunX * 0.90 + sideX * 0.15);
      latestC.vy = vLimit * (toSunY * 0.90 + sideY * 0.15);
      latestC.vz = vLimit * (toSunZ * 0.90);
            // ワープした瞬間のゴミ線を消去するために軌跡キャッシュを初期化
      if (latestC.trail) latestC.trail = [];
    }
  }
}

  /* -------------------------------------------------------
     【神の悪戯：極めてまれに発生する、Sunと同質量の単一異分子】
     ------------------------------------------------------- */
  const EXTRA_SUN_CHANCE = 0.01; // 発生確率 1%

  if (Math.random() < EXTRA_SUN_CHANCE) {
    const sun = bodies[0];

    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const r = S.minDist + Math.random() * (S.maxDist - S.minDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

    const dist = Math.sqrt(x*x + y*y + z*z) || 1;
    const vBase = Math.sqrt(G * settings.gravityMultiplier * sun.mass / dist);
        const vx = (-y / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vy = ( x / dist) * vBase * 0.8 + (Math.random() - 0.5) * 2;
    const vz = (Math.random() - 0.5) * 2;

    bodies.push({
      x, y, z,
      vx, vy, vz,
      mass: sun.mass * 1.0,
      size: massToSize(sun.mass) * 0.3,
      color: "#ff00ff",
      name: "Goliath",
      type: "planet",
      trail: []
    });

    console.log(" 観測開始：Sunと同等の質量を持つ異分子『Goliath』が配置されたわ。");
  }

  // 太陽のワープ暴走を防ぐ重心調整
  if (typeof adjustSunVelocity === "function") {
    adjustSunVelocity();
  }
}

// 【核心】ここで美しく関数をすべて閉じる！！


function addComet() {
  const sun = bodies[0];
  if (!sun) return;

  const angle = Math.random() * Math.PI * 2;
  const tilt  = (Math.random() - 0.5) * 0.6;

  const distance = 800 + Math.random() * 2000;

  const x = sun.x + Math.cos(angle) * distance;
  const y = sun.y + Math.sin(angle) * distance;
  const z = sun.z + distance * tilt;

  const mass = 0.001 + Math.random() * 0.004;
  const coreSize = 0.01 + Math.random() * 0.02;

  // Sun 方向ベクトル
  const dx = sun.x - x;
  const dy = sun.y - y;
  const dz = sun.z - z;
  const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

  const nx = dx / d;
  const ny = dy / d;
  const nz = dz / d;

  /* -------------------------------------------------------
      直交ベクトル（スイングバイ用・あんたの完璧なコードよ）
     ------------------------------------------------------- */
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; az = 0; }

  let ox = ny * az - nz * ay;
  let oy = nz * ax - nx * az;
  let oz = nx * ay - ny * ax;

  const ol = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
  ox /= ol; oy /= ol; oz /= ol;

  /* -------------------------------------------------------
      ★ 物理の規律：距離 d に応じた「脱出速度（エスケープ速度）」の計算
     ------------------------------------------------------- */
  // 本来の数式： sqrt(2 * G * M / d)
  // あなたの宇宙の settings.gravityMultiplier や G の定義に合わせて乗算してね！
  // 1.5 という係数は、見た目が一番ドラマチックになるように微調整したマジックナンバーよ。
  const currentG = (typeof G !== "undefined" ? G : 1) * (typeof settings !== "undefined" ? settings.gravityMultiplier : 1);
  const escapeSpeed = Math.sqrt((2 * currentG * sun.mass) / d) * 1.5;

  /* -------------------------------------------------------
      ★ 3割：ニアミス落下（極限スイングバイ）
      ★ 7割：大楕円スイングバイ
     ------------------------------------------------------- */
  const isSwingBy = Math.random() < 0.7;
  let vx, vy, vz;

  if (!isSwingBy) {
    /* -------------------------------------------------------
        ★ 30% → 太陽の重心から「ほんの少しだけ横に逸らした」超接近軌道
       ------------------------------------------------------- */
    // 脱出速度の約85%のスピードで、97%は太陽へ直進、3%だけ横（直交方向）にブレさせる！
    const speed = escapeSpeed * 0.85;
    const fallRatio  = 0.97;
    const slantRatio = 0.03; //  これが極上の「かすり Uターン」を生む規律よ！

    vx = (nx * fallRatio + ox * slantRatio) * speed;
    vy = (ny * fallRatio + oy * slantRatio) * speed;
    vz = (nz * fallRatio + oz * slantRatio) * speed;

  } else {
    /* -------------------------------------------------------
        ★ 70% → 大楕円を描く本物のスイングバイ
       ------------------------------------------------------- */
    // 脱出速度の 75%〜92%（ランダム）の速度を与えることで、
    // 宇宙へ逃げ切る一歩手前の「超長大な楕円軌道」を自動生成するわ！
    const speedMultiplier = 0.75 + Math.random() * 0.17;
    const speed = escapeSpeed * speedMultiplier;

    // 落下成分と横方向成分のブレンド比率をランダムにして、楕円の形に多様性を出す
    const orbitRatio = 0.4 + Math.random() * 0.3; // 0.4〜0.7
    const towardRatio = Math.sqrt(1 - orbitRatio * orbitRatio); // ベクトルの長さを1に保つ数学の魔法

    vx = (nx * towardRatio + ox * orbitRatio) * speed;
    vy = (ny * towardRatio + oy * orbitRatio) * speed;
    vz = (nz * towardRatio + oz * orbitRatio) * speed;
  }

  /* -------------------------------------------------------
      ★ 彗星のカラーリング（個体差を出す自然のいたずら）
     ------------------------------------------------------- */
  // 基本の青白さに、ちょっとだけ個体ごとに色のゆらぎ（150〜210、200〜255）を与えるわ
  const rColor = Math.floor(150 + Math.random() * 60);
  const gColor = Math.floor(200 + Math.random() * 55);
  const cometColor = `rgb(${rColor}, ${gColor}, 255)`;

  bodies.push({
    x, y, z,
    vx, vy, vz,
    mass,
    size: coreSize,
    color: cometColor,
    type: "comet",
    name: "Comet",
    trail: []
  });
}



/* ============================
   Adjust Sun Velocity (Soft)
============================ */
function adjustSunVelocity() {
  let px = 0, py = 0, pz = 0;

  for (let b of bodies) {
    px += b.vx * b.mass;
    py += b.vy * b.mass;
    pz += b.vz * b.mass;
  }

  const sun = bodies[0];

  // 重心静止系の理想速度
  const targetVx = -px / sun.mass;
  const targetVy = -py / sun.mass;
  const targetVz = -pz / sun.mass;

  // ★ ゆっくり寄せる（2% だけ補正）
  const k = 0.005;      // 補正をさらに弱く
  const maxSunSpeed = 0.25; // 安全上限


  sun.vx += (targetVx - sun.vx) * k;
  sun.vy += (targetVy - sun.vy) * k;
  sun.vz += (targetVz - sun.vz) * k;
}

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
   Part 3: UI Events / Toggles / Sliders / Settings Link
--------------------------------------------------------- */



/* ============================
   Start / Stop / Reset (思想統合版)
============================ */
startBtn.onclick = () => {
  // 1. 稼働状態（true / false）をパチッと反転させる
  simulationState.running = !simulationState.running;

  // 2. 状態に応じて、自分自身のボタンの文字と色（クラス）を切り替える
  if (simulationState.running) {
    startBtn.textContent = window.currentLang === 'en' ? "RUN (Q)" : "稼働 (Q)";
    startBtn.classList.add("toggle-on");
    startBtn.classList.remove("toggle-off");
 } else {
    // 👍 日本語が「停止 (Q)」なら、英語も「PAUSE (Q)」に整列させておくと完璧です！
    startBtn.textContent = window.currentLang === 'en' ? "PAUSE (Q)" : "停止 (Q)";
    startBtn.classList.add("toggle-off");
    startBtn.classList.remove("toggle-on");
  }
};

resetBtn.onclick = () => {
  // 1. まず完全に時間を止める
  simulationState.running = false;
    // 👑【超シンプル化】文字の書き換えはすべてパージ！
  // 動いていることを示す「toggle-on（烈火のオレンジ）」の光を剥ぎ取る（＝消灯させる）だけで終了。
  startBtn.classList.remove("toggle-on");
  startBtn.classList.add("toggle-off"); // CSSで消灯（無灯火）に設定したクラス

  // 2. 宇宙の初期化（ここから下の既存コードはそのまま）
  // UIのインジケータを「停止状態」に同期
   startBtn.classList.add("toggle-off");
  startBtn.classList.remove("toggle-on");

  // 🌟【新兵器注入】窓口を直接叩いて、2つの時間軸を強制ゼロクリア！
  if (typeof simulationState !== "undefined") {
      simulationState.elapsedTime = 0;
  }
  window.realAccumulatedTime = 0;

  // 🌟【時間ワープ防止】FPS計算の基準点を今にロック！
  if (typeof lastTime !== "undefined") {
      lastTime = performance.now();
  }

  // 2. 宇宙を完全初期化（天体の再生成）
  generateBodies();
    // 3. ターン数の巻き戻しとUI更新（あなたのコードをそのまま活かすわ！）
  turnCount = 0;
  updateTurnCountDisplay();

  // 🌟【即時反映】0になった時間を今すぐ画面に焼き付ける！
  if (typeof updateSimTimeUI === "function") {
      updateSimTimeUI();
 
};

  // -----------------------------------------------------------------
  // ★【バグ完全修理】Sunの初期速度（X, Y, Z）をUIから強制執行！
  // -----------------------------------------------------------------
  // 生まれたてホヤホヤの太陽（bodies[0]）をしっかりホールド！
  const sun = bodies[0];
  if (sun && sun.name === "Sun") {
    // HTMLから数値入力ボックスの要素をそれぞれ召喚するわ
    const inputX = document.getElementById("sunVxInput");
    const inputY = document.getElementById("sunVyInput");
    const inputZ = document.getElementById("sunVzInput");
        // UIに値が存在していれば、太陽の速度ベクトル（vx, vy, vz）に一斉に注入！
    if (inputX) sun.vx = Number(inputX.value);
    if (inputY) sun.vy = Number(inputY.value);
    if (inputZ) sun.vz = Number(inputZ.value);
  }

  // ★ 3. UIの値が100%反映された「究極の初期状態」をスロット0に即時保存！
  // これでリセット直後にセーブデータをロードされても、指定した速度が絶対に維持されるわ！
  saveUniverse(0);

  /* =========================================================
   リセットボタンのクリック演出（これは独立したイベント配線側へ）
   ========================================================= */
resetBtn.addEventListener("click", () => {
  // 1. 時間を止めて宇宙を初期化
  simulationState.running = false;
  generateBodies();
  turnCount = 0;
  if (typeof updateTurnCountDisplay === "function") updateTurnCountDisplay();

  // 2. ボタンのクリック演出（200ms後にステルスに戻す規律）
  resetBtn.classList.add("toggle-on");
  setTimeout(() => {
    resetBtn.classList.remove("toggle-on");
    resetBtn.classList.add("toggle-off");
  }, 200);
});


/* =========================================================
   独立関数：彗星の召喚アルゴリズム（独立した関数として外に配置）
   ========================================================= */
function addComet() {
  // (あんたの美しいスイングバイ外積計算ロジック...)
}
}



/* ========================================================
   宇宙管制盤：軌跡レンダリング独立制御マトリクス（完全版）
======================================================== */

// 1. 太陽軌跡ボタン：自分のことだけを考える
// 1. 太陽軌跡ボタン：他の天体と同じ規律で純粋にトグルする
sunTrailBtn.onclick = () => {
  // 🚨「Only」という排他フラグをやめ、シミュレーション状態のフラグをピュアに反転させる
  simulationState.ui.showSunTrail = !simulationState.ui.showSunTrail;
    // もし描画側が「settings.showSunTrail」を見ている可能性も考慮し、両方同期させて防衛
  if (typeof settings !== "undefined") {
      settings.showSunTrail = simulationState.ui.showSunTrail;
  }

  // ボタンのアクティブ状態の見た目を同期
  sunTrailBtn.classList.toggle("active", simulationState.ui.showSunTrail);
  sunTrailBtn.classList.toggle("toggle-on", simulationState.ui.showSunTrail);
};
// 2. 惑星軌跡ボタン：究極の一体化ビルド
planetTrailBtn.onclick = () => {
  // ① 内部フラグをまずガチッと反転させる
  const isShow = !simulationState.ui.showPlanetTrail;
  simulationState.ui.showPlanetTrail = isShow;

  // ② その反転した「絶対の正解（isShow）」をすべてのクラスに一斉に執行！
  planetTrailBtn.classList.toggle("active", isShow);
  planetTrailBtn.classList.toggle("toggle-on", isShow);
  planetTrailBtn.classList.toggle("toggle-off", !isShow);
};

// 3. 彗星軌跡ボタン：自分のことだけを考える
cometTrailBtn.onclick = () => {
  // ※彗星用の内部フラグ（例: settings.showCometTrail）に合わせてね
  settings.showCometTrail = !settings.showCometTrail;
  cometTrailBtn.classList.toggle("active", settings.showCometTrail);
};



/* =======================================================
   ★ Names 表示 ON/OFF（3状態フルテンローテーション仕様）
   ======================================================= */
const namesBtn = document.getElementById("showNames");
if (namesBtn) {
    namesBtn.addEventListener("click", () => {
        // 1. 新しい状態管理変数 nameMode を安全にインクリメント (0:OFF, 1:惑星, 2:彗星, 3:すべて)
        if (simulationState.ui.nameMode === undefined) {
            simulationState.ui.nameMode = 0;
        }
        simulationState.ui.nameMode = (simulationState.ui.nameMode + 1) % 4;

        // 2. 既存の showNames フラグも「0以外ならON」として同期させてジェンガの崩壊を防ぐ！
        simulationState.ui.showNames = (simulationState.ui.nameMode !== 0);
                // 👑 【調律】文字はいじらず、光（クラス）のON/OFFだけで支配する！
        namesBtn.classList.toggle("toggle-on", simulationState.ui.showNames);
        namesBtn.classList.toggle("toggle-off", !simulationState.ui.showNames);
    });
}


/* =========================================================
   Sun Mass & Object Mass リアルタイム完全同期マトリクス
========================================================= */
const sunMassSlider = document.getElementById("sunMass");
const sunMassInput  = document.getElementById("sunMassInput");

if (sunMassSlider && sunMassInput) {
  function syncSunMass(v) {
      let val = Number(v);

      if (isNaN(val) || val <= 0) {
      val = 1; // 太陽の質量が完全に消失するのを防ぐ最低防衛ライン
    }

    // 2. スライダーと入力ボックスの見た目を完全連動
    sunMassSlider.value = v;
    sunMassInput.value  = v;

    // 3. リアルタイムに大宇宙の太陽（bodies[0]）の質量を書き換え！
    if (bodies[0]) {
      bodies[0].mass = val;
                 bodies[0].size = massToSize(val) * 0.5;
      bodies[0].hitSize = bodies[0].size * SUN_HIT_SCALE;
    }
  }

  // 二重定義をパージし、この美しい同期関数を両方のインプットに配線！
  sunMassSlider.oninput = e => syncSunMass(e.target.value);
  sunMassInput.oninput  = e => syncSunMass(e.target.value);
}

// 固定質量チェックボックスの挙動を「ねじれなし」で完全同期
const elUseFixedObjMass = document.getElementById("useFixedObjMass");
if (elUseFixedObjMass) {
  elUseFixedObjMass.onchange = e => {
    // ユーザーがチェックを入れたら true、外したら false。データとUIの完全なる規律の一致よ！
    settings.useFixedObjMass = e.target.checked;
  };
}

/* ============================
   Body Count（スライダー + 数値入力）
============================ */
const bodyCountSlider = document.getElementById("bodyCount");
const bodyCountInput  = document.getElementById("bodyCountInput");
const bodyCountLabel  = document.getElementById("bodyCountLabel");

function syncBodyCount(v) {
  initialBodyCount = Number(v);
  bodyCountSlider.value = v;
  bodyCountInput.value = v;
  bodyCountLabel.textContent = v;
}

bodyCountSlider.oninput = e => syncBodyCount(e.target.value);
bodyCountInput.oninput  = e => syncBodyCount(e.target.value);



/* ============================
   speed（時間倍率）双方向同期
============================ */
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

/* ============================
   軌跡3兄弟 ON/OFF（フルテン・ノンテキスト上書き仕様）
============================ */
cometTrailBtn.onclick = () => {
  simulationState.ui.showCometTrail = !simulationState.ui.showCometTrail;
  cometTrailBtn.classList.toggle("toggle-on", simulationState.ui.showCometTrail);
  cometTrailBtn.classList.toggle("toggle-off", !simulationState.ui.showCometTrail);
};

planetTrailBtn.onclick = () => {
  simulationState.ui.showPlanetTrail = !simulationState.ui.showPlanetTrail;
  planetTrailBtn.classList.toggle("toggle-on", simulationState.ui.showPlanetTrail);
  planetTrailBtn.classList.toggle("toggle-off", !simulationState.ui.showPlanetTrail);
};

// 👑 【追加】太陽の軌跡ボタンも全く同じ鉄の規律でここに並べる！
sunTrailBtn.onclick = () => {
  simulationState.ui.showSunTrail = !simulationState.ui.showSunTrail; // お手元の変数名（showSunTrail等）に合わせてください
  sunTrailBtn.classList.toggle("toggle-on", simulationState.ui.showSunTrail);
  sunTrailBtn.classList.toggle("toggle-off", !simulationState.ui.showSunTrail);
};

/* ---------------------------------------------------------
   ▼▼▼ settings 拡張 UI（追加パラメータ） ▼▼▼
--------------------------------------------------------- */

/* ============================
   G倍率（テキストボックス同期）
============================ */
const gravityInput = document.getElementById("gravityInput");

if (gravityInput) {
  gravityInput.oninput = e => {
    const v = Number(e.target.value);
    gravitySlider.value = v;
    settings.gravityMultiplier = v;
  };
}

gravitySlider.oninput = e => {
  const v = Number(e.target.value);
  gravityInput.value = v;
  settings.gravityMultiplier = v;
};

/* ============================
   初期速度（テキストボックス同期）
============================ */
const spawnVelInput = document.getElementById("spawnVelInput");

if (spawnVelInput) {
  spawnVelInput.oninput = e => {
    const v = Number(e.target.value);
    spawnVelSlider.value = v;
    settings.spawnVelocityMultiplier = v;
  };
}

spawnVelSlider.oninput = e => {
  const v = Number(e.target.value);
  spawnVelInput.value = v;
  settings.spawnVelocityMultiplier = v;
};

/* ============================
   軌跡の長さ倍率
============================ */
const trailLenSlider = document.getElementById("trailLenSlider");
if (trailLenSlider) {
  trailLenSlider.oninput = e => {
    settings.trailLengthMultiplier = Number(e.target.value);
  };
}

/* ============================
   軌跡の色モード
============================ */
const trailColorSelect = document.getElementById("trailColorSelect");
if (trailColorSelect) {
  trailColorSelect.onchange = e => {
    settings.trailColorMode = e.target.value;
  };
}

/* ============================
   N体閾値
============================ */
const nbodyThresholdInput = document.getElementById("nbodyThreshold");
if (nbodyThresholdInput) {
  nbodyThresholdInput.oninput = e => {
    settings.fullGravityThreshold = Number(e.target.value);
  };
}
/* ============================
   EPS²（ソフトニング）
============================ */
const eps2Input = document.getElementById("eps2Input");
if (eps2Input) {
  eps2Input.oninput = e => {
    settings.eps2 = Number(e.target.value);
  };
}
/* ============================
   生成パラメータ（minMass / maxMass / minDist / maxDist）
============================ */
const spawnMinMass = document.getElementById("spawnMinMass");
const spawnMaxMass = document.getElementById("spawnMaxMass");
const spawnMinDist = document.getElementById("spawnMinDist");
const spawnMaxDist = document.getElementById("spawnMaxDist");

if (spawnMinMass) spawnMinMass.oninput = e => settings.spawnSettings.minMass = Number(e.target.value);
if (spawnMaxMass) spawnMaxMass.oninput = e => settings.spawnSettings.maxMass = Number(e.target.value);
if (spawnMinDist) spawnMinDist.oninput = e => settings.spawnSettings.minDist = Number(e.target.value);
if (spawnMaxDist) spawnMaxDist.oninput = e => settings.spawnSettings.maxDist = Number(e.target.value);


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

  const fullGravity = (bodies.length <= settings.fullGravityThreshold);

 // =======================================================
  //  物理層：Sun-only 重力（太陽解放＆完全対等モデル）
  // =======================================================
  if (!fullGravity) {
    //  エラー防止のための安全弁：もしUI側に変数がない場合でもバグらない規律
    // simulationState.camera.isSunPhysicallyFixed など、お使いの固定フラグに置き換えてもOKよ！
    const isSunFixed = (typeof isSunPhysicallyFixed !== "undefined") ? isSunPhysicallyFixed : false;

    //  【核心の規律】太陽（i=0）も含めて、お互いが受ける力を計算するために「1本のループ」で全天体をフラットに処理！
    for (let i = 1; i < bodies.length; i++) {
      const b = bodies[i];

      const dx = sun.x - b.x;
      const dy = sun.y - b.y;
      const dz = sun.z - b.z;

      const r2 = dx*dx + dy*dy + dz*dz + settings.eps2;
      const r = Math.sqrt(r2);
            // 物理法則の分母（rの3乗。ゼロ除算によるNaNを徹底防衛）
      if (r === 0) continue;
      const f = (G * settings.gravityMultiplier) / (r * r * r);

      // ① 惑星・彗星（b）が太陽から受ける加速（従来通り）
      const accelX = f * dx * sun.mass * dt;
      const accelY = f * dy * sun.mass * dt;
      const accelZ = f * dz * sun.mass * dt;

      b.vx += accelX;
      b.vy += accelY;
      b.vz += accelZ;

      // ② 【新世界：作用・反作用の法則】太陽（sun）も、相手の質量（b.mass）に応じて「全く同じ力」で引っ張り返される！
      // ただし、UI側で「太陽位置：固定」が選ばれている間は、太陽への加算だけを安全に防空スキップするわ。
      if (!isSunFixed) {
        // 向きは逆（マイナス）になるわ。これがニュートン力学の美しさよ！
        sun.vx -= f * dx * b.mass * dt;
        sun.vy -= f * dy * b.mass * dt;
        sun.vz -= f * dz * b.mass * dt;
      }
    }
  }

  // ===============================
  // N-body Gravity（対称力計算）
  // ===============================
  const ax = new Array(bodies.length).fill(0);
  const ay = new Array(bodies.length).fill(0);
  const az = new Array(bodies.length).fill(0);

  if (fullGravity) {
    for (let i = 0; i < bodies.length; i++) {
      const A = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const B = bodies[j];

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;

        const r2 = dx * dx + dy * dy + dz * dz + settings.eps2;
        const r = Math.sqrt(r2);
        const f = (G * settings.gravityMultiplier) / (r * r * r);

        ax[i] += f * B.mass * dx;
        ay[i] += f * B.mass * dy; // dyに統一してねじれを完全防止
        az[i] += f * B.mass * dz;

        ax[j] -= f * A.mass * dx;
        ay[j] -= f * A.mass * dy;
        az[j] -= f * A.mass * dz;
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
}

/* ============================
   軌跡・軌道判定
============================ */
function updateTrails(dt) {
  const sun = bodies[0];
  if (!sun) return;

  for (let b of bodies) {
    const sx = b.x - sun.x;
    const sy = b.y - sun.y;
    const sz = b.z - sun.z;
    const distFromSun = Math.sqrt(sx*sx + sy*sy + sz*sz);
    b.distance = distFromSun;

    // 1. 描画カラー（距離依存）
    if (b.name !== "Sun") {
      const t = Math.min(1, distFromSun / 2000);
      const rCol = Math.floor(255 * (1 - t));
      const gCol = Math.floor(255 * (1 - t * 0.5));
      const bCol = Math.floor(255 * t);
      b.drawColor = `rgb(${rCol},${gCol},${bCol})`;
    } else {
      b.drawColor = "white";
    }

    // 2. 周回判定（軌道エネルギー計算）
    if (b.name !== "Sun") {
      if (b.isOrbiting === undefined) b.isOrbiting = false;

      const dx = b.x - sun.x;
      const dy = b.y - sun.y;
      const dz = b.z - sun.z;
      const r2 = dx*dx + dy*dy + dz*dz + settings.eps2;
      const r = Math.sqrt(r2);

      const dvx = b.vx - sun.vx;
      const dvy = b.vy - sun.vy;
      const dvz = b.vz - sun.vz;
      const v2 = dvx*dvx + dvy*dvy + dvz*dvz;

      const E = 0.5 * v2 - (G * settings.gravityMultiplier * sun.mass) / r;

      if (!b.isOrbiting && E < 0) b.isOrbiting = true;

      if (b.type !== "comet" && !b.isOrbiting) {
        b.trail = [];
      }
    } else {
      b.isOrbiting = true;
    }

    // 3. 軌跡の長さ（limit）の決定
    let limit;
    if (b.name === "Sun") {
      limit = 2000 * settings.trailLengthMultiplier;
    } else if (b.isOrbiting) {
      limit = 800 * settings.trailLengthMultiplier;
    } else {
      limit = Math.min(
        600 * settings.trailLengthMultiplier,
        Math.max(40, Math.sqrt(distFromSun) * 8 * settings.trailLengthMultiplier)
      );
    }

    // 4. ハイブリッドデータ構造への格納（2Dキャッシュ付き）
    if (!b.trail) b.trail = [];

    const rCurrent = rotate3D(b);
    const prCurrent = project3D(rCurrent.x, rCurrent.y, rCurrent.z);

    b.trail.push({
      wx: b.x, wy: b.y, wz: b.z,
      sx: prCurrent.x, sy: prCurrent.y
    });

    while (b.trail.length > limit) b.trail.shift();
  }
}



/**
 * OrbitCam の角度更新（太陽強制ロックオン・車載特化版）
 */
function updateOrbitCam(dt) {
  if (!camera.isOrbitCam) return;

  // 👑 【救済】この宣言が消えていたためエラーになっていました。しっかりと再配備！
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
 * ※SyntaxErrorを永久追放し、あらゆるカメラ移動を検知する完全無欠版！
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
  if (simulationState.camera.followSun) {
    let targetIndex = camera.targetBodyIndex;
    if (!bodies[targetIndex]) targetIndex = 0; // ロスト時は太陽（0）を緊急確保
    const target = bodies[targetIndex];
    if (target) {
      const rTarget = rotate3D(target);
      const pTarget = project3D(rTarget.x, rTarget.y, rTarget.z);

      // 🌟 ターゲットを常に画面中央（W/2, H/2）にガチホールド！
      camera.offsetX = (W / 2 - pTarget.x);
      camera.offsetY = (H / 2 - pTarget.y);
    }
  }

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

  // 自動回転のスイッチを強制的にOFFにする
  window.isAutoRotateEnabled = false;
  if (typeof camToggleBtn !== 'undefined' && camToggleBtn) {
    camToggleBtn.textContent = "自動回転: OFF";
    camToggleBtn.classList.remove("active");
  }

  camera.orbitTheta = camera.rotY;
  camera.orbitPhi   = camera.rotX;
  camera.isOrbitCam = true;
}

/**
 * OrbitCam 停止（自由視点への安全な帰還 ＆ 軌跡キャッシュクリア版）
 */
function deactivateOrbitCam() {
  camera.isOrbitCam = false;
  camera.targetBodyIndex = 0; // 注視点を太陽へ戻す
  camera.orbitRadius = BASE_DISTANCE; // カメラの距離を初期値に戻す

  // 🌟 視点切り替え時の2D/3Dの軌跡キャッシュを全天体一斉にフラッシュ！
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
      // あなたのコードの「軌跡配列の変数名」に合わせてここを調整しなさい！
      // 例：b.trail や b.history、b.path など
      if (b.trail && Array.isArray(b.trail)) {
        b.trail = []; // 過去の幻影（古い座標キャッシュ）を完全に消去するわ！
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
    // 必要であれば、画面中心座標などの定数もここで即座に再計算して同期しなさい！
  // centerX = canvas.width / 2;
  // centerY = canvas.height / 2;
});




/* ============================
   ナラティブ（クリーンアップ版）
============================ */
function updateNarrative(dt) {
 }

/* ============================
   Utility / Save / Load
============================ */
function saveUniverse(slot) {
  const data = {
    settings: structuredClone(settings),
    // セーブ時に現在の死亡スタッツも一緒に内包して保存してあげる優しさ
    stats: typeof stats !== 'undefined' ? structuredClone(stats) : null,
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
  const loadedSettings = structuredClone(data.settings);
  Object.assign(settings, loadedSettings);

  // ロード時に過去の死亡スタッツがあれば完全に復元
  if (data.stats && typeof stats !== 'undefined') {
    Object.assign(stats, data.stats);
  }

  bodies.length = 0;
  for (const b of data.bodies) {
    bodies.push({
      ...b,
      trail: []
    });
  }

  const sunIndex = bodies.findIndex(b => b.name === "Sun");
  if (sunIndex > 0) {
    const sun = bodies.splice(sunIndex, 1)[0];
    bodies.unshift(sun);
  }




  // =====================================
  // UIの同期執行
  // =====================================
  document.getElementById("objMass").value = settings.objMass;
  document.getElementById("objMassInput").value = settings.objMass;
  document.getElementById("useFixedObjMass").checked = settings.useFixedObjMass;
  document.getElementById("spawnMinMass").value = settings.spawnSettings.minMass;
  document.getElementById("spawnMaxMass").value = settings.spawnSettings.maxMass;
  document.getElementById("spawnMinDist").value = settings.spawnSettings.minDist;
  document.getElementById("spawnMaxDist").value = settings.spawnSettings.maxDist;
  document.getElementById("gravitySlider").value = settings.gravityMultiplier;
  document.getElementById("speedSlider").value = settings.simSpeed;
  document.getElementById("speedLabel").textContent = settings.simSpeed.toFixed(1);
  document.getElementById("eps2Input").value = settings.eps2;
  document.getElementById("nbodyThreshold").value = settings.fullGravityThreshold;

  // HUD & 死亡統計表示の完全同期
  updateBodyCountDisplay();
  updateTurnCountDisplay();
  if (typeof updateStatsUI === 'function') updateStatsUI();

  console.log("Universe Loaded:", slot);
}

/* =========================================================
   1. メイン描画コントロール（旧 renderScene の再構築・完全独立版）
========================================================= */
function renderScene() {
  // キャンバスの初期化（描画層の基本規律）
  ctx.clearRect(0, 0, W, H);

  const sun = bodies[0];
  if (!sun) return;

  // 背景の固定星空を描画（無限遠の空間表現）
  if (typeof drawBackgroundStars === "function") drawBackgroundStars();

  // 画家アルゴリズム（Z深度ソート）：奥にある天体から順に処理するための配列生成
  const sortedBodies = bodies
    .map(b => ({ b, r: rotate3D(b) }))
    .sort((a, b) => a.r.z - b.r.z);

  // ---------------------------------------------------------
  // 【第1階層ループ】天体の「軌跡」「尾」「本体」を奥から順にレンダリング
  // ---------------------------------------------------------
  for (const obj of sortedBodies) {
    const pr = project3D(obj.r.x, obj.r.y, obj.r.z);
    if (!pr.visible) continue;

    // 安全版カラーの取得
    const trailColor = getTrailColor(obj.b, sun);
    const screenSize = calculateScreenSize(obj.b, pr);

    // 各パーツを描画
    drawBodyTrails(obj.b, trailColor);
    drawCometTail(obj.b, sun);
    drawBodyCore(obj.b, pr, sun, screenSize);

    // ✨【完全なる物理同期】天体本来の3D情報を含んだ針を、その場でガッチリ生やす！
    if (window.showAngularMomentum && obj.b !== sun) {
      drawAngularMomentumVectorDirect2D(obj.b, sun, pr);
    }
  }

 // ---------------------------------------------------------
  // 【第2階層ループ】★HUD・名前ラベルの「二段レンダリング（3状態フィルタ仕様）」
  // ---------------------------------------------------------
  if (simulationState.ui.showNames) {
    // 現在の表示モードを安全に取得（未定義ならデフォルトで3:すべて表示）
    const mode = simulationState.ui.nameMode !== undefined ? simulationState.ui.nameMode : 3;

    for (const obj of sortedBodies) {
      // 天体のタイプによって描画をスキップする冷徹な防空論理
      if (mode === 1 && obj.b.type !== "obj") continue;   // 惑星のみモードの時は惑星以外パス
      if (mode === 2 && obj.b.type !== "comet") continue; // 彗星のみモードの時は彗星以外パス
      // mode === 3 のときはSunを含む全天体をスルーパスして描画

      const pr = project3D(obj.r.x, obj.r.y, obj.r.z);
      if (!pr.visible) continue;

      const screenSize = calculateScreenSize(obj.b, pr);
            // 🌟【脳汁アライメント】：もし可能なら、drawBodyLabel関数に渡す色やテキストを
      // obj.b.type === "comet" のときだけ「彗星専用カラー（赤など）」に変えると視覚の奥行きが化けるわよ！
      drawBodyLabel(obj.b, pr, screenSize);
    }
  }

  // ---------------------------------------------------------
  // 【第3階層システムHUD】宇宙の全体状況を最前面にオーバーレイ
  // ---------------------------------------------------------
// 💡 あんたのメイン描画関数の終端セクター
  drawGravityCenterOfTop2(bodies);
    // フラグが真の時だけ、左側集中ストリームを毎フレーム焼き付ける
  if (isDeveloperHUDActive) {
    drawScreenHUD();
  }
}

/**
 * 天体の3D角運動量を物理的に正しく計算し、完全追従するリアル3Dベクトル描画
 * ★【離心率(e)に応じた科学的カラーマッピング＆テキスト追従・可変長調律版】
 */
function drawAngularMomentumVectorDirect2D(b, sun, pr) {
  if (!b || !sun || !pr || isNaN(pr.x) || isNaN(pr.y)) return;

  // 1. 太陽中心の位置ベクトル r (相対位置)
  const rx = b.x - sun.x;
  const ry = b.y - sun.y;
  const rz = b.z - sun.z;

  // 2. 太陽中心の速度ベクトル v (相対速度)
  const vx = b.vx - sun.vx;
  const vy = b.vy - sun.vy;
  const vz = b.vz - sun.vz;

  // 3. 角運動量ベクトル L = r × v
  const Lx = ry * vz - rz * vy;
  const Ly = rz * vx - rx * vz;
  const Lz = rx * vy - ry * vx;

  // 実際の角運動量の大きさ（絶対値）
  const mag = Math.sqrt(Lx*Lx + Ly*Ly + Lz*Lz);
  if (mag === 0 || isNaN(mag)) return;

  // =========================================================
  // 🧮 針の長さの数理的丸め（可変長スケーリング ＆ 防空クランプ）
  // =========================================================
  // 平方根で爆発的な値の増大をなだらかに圧縮しつつ、1.2倍の係数で調整
  let dynamicScale = Math.sqrt(mag) * 1.2;

  // 画面の視認性を守るため、針の長さを最低15px〜最大180pxの範囲に丸め込む（クランプ）
  dynamicScale = Math.max(15, Math.min(180, dynamicScale));

  // 単位ベクトル（長さ1）にした後、丸め済みの可変長スケールを乗算
  const nx = (Lx / mag) * dynamicScale;
  const ny = (Ly / mag) * dynamicScale;
  const nz = (Lz / mag) * dynamicScale;

  // 4. 【核心の規律】太陽相対3D空間での回転・投影
  const bRot = rotate3D({ x: b.x, y: b.y, z: b.z });
  const vRot = rotate3D({ x: b.x + nx, y: b.y + ny, z: b.z + nz });

  const pBase = project3D(bRot.x, bRot.y, bRot.z);
  const pTip  = project3D(vRot.x, vRot.y, vRot.z);

  if (!pBase.visible || !pTip.visible) return;

  // 5. 画面上でのベクトル差分
  const dx = pTip.x - pBase.x;
  const dy = pTip.y - pBase.y;

  const startX = pr.x;
  const startY = pr.y;
  const endX = startX + dx;
  const endY = startY + dy;

  // =========================================================
  // 🧮 天体力学に基づく「離心率(e)」のリアルタイム高速検算
  // =========================================================
  const r_len = Math.sqrt(rx*rx + ry*ry + rz*rz);
  let ecc = 0;
  if (r_len > 0) {
    const v2 = vx*vx + vy*vy + vz*vz;
    const r_dot_v = rx*vx + ry*vy + rz*vz;
    const mu = (typeof G !== "undefined" ? G : 1) * (sun.mass || 1500);

    const ex = (v2 * rx - r_dot_v * vx) / mu - rx / r_len;
    const ey = (v2 * ry - r_dot_v * vy) / mu - ry / r_len; // タイポ修復済
    const ez = (v2 * rz - r_dot_v * vz) / mu - rz / r_len; // タイポ修復済
    ecc = Math.sqrt(ex*ex + ey*ey + ez*ez);
  }

  // =========================================================
  // 🎨 離心率の科学的カラーマッピング
  // =========================================================
  let eccColor = "#00ff88"; // デフォルト（エメラルド）
    if (ecc < 0.05) {
    eccColor = "#00bcff";   // 🟦 0.0 ~ 0.05: 完全調和（ディープブルー）
  } else if (ecc < 0.20) {
    eccColor = "#00ff88";   // 🟩 0.05 ~ 0.2: 標準楕円（エメラルドグリーン）
  } else if (ecc < 0.60) {
    eccColor = "#ffff00";   // 🟨 0.2 ~ 0.6: 乱調楕円（イエロー）
  } else if (ecc < 1.00) {
    eccColor = "#ff9900";   // 🟧 0.6 ~ 1.0: 彗星軌道（アンバー/オレンジ）
  } else {
    eccColor = "#ff0044";   // 🟥 1.0以上: 特異点・無限追放（ブラッドレッド）
  }

  // 7. レンダリング執行 (針の描画 ── 決定カラーを適用)
  ctx.save();
  ctx.strokeStyle = eccColor;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 矢印ヘッドの描画
  const angle = Math.atan2(endY - startY, endX - startX);
  const headSize = 5;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headSize * Math.cos(angle - Math.PI / 6), endY - headSize * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headSize * Math.cos(angle + Math.PI / 6), endY - headSize * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = eccColor;
  ctx.fill();

  // =========================================================
  // 📝 針の先端にテキストを焼き付ける
  // =========================================================
  ctx.fillStyle = eccColor; // 文字色も針と完全同期
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
    ctx.fillText(`e:${ecc.toFixed(2)}`, endX + 4, endY - 2);

  ctx.restore();
}


/**
 * 第1位と第2位の個体間における引力の中心（重心）を計算・描画する
 */
function drawGravityCenterOfTop2(passedBodies) {
  if (!window.showBarycenter) return;

  const currentBodies = passedBodies || window.bodies;
  if (!currentBodies || currentBodies.length < 2) return;

  const sortedBodies = [...currentBodies]
    .filter(b => b !== null && b !== undefined)
    .sort((a, b) => {
      const massA = parseFloat(a.mass !== undefined ? a.mass : (a.m !== undefined ? a.m : 0));
      const massB = parseFloat(b.mass !== undefined ? b.mass : (b.m !== undefined ? b.m : 0));
      return massB - massA;
    });

  if (sortedBodies.length < 2) return;

  const b1 = sortedBodies[0];
  const b2 = sortedBodies[1];

  const m1 = parseFloat(b1.mass !== undefined ? b1.mass : (b1.m !== undefined ? b1.m : 0));
  const m2 = parseFloat(b2.mass !== undefined ? b2.mass : (b2.m !== undefined ? b2.m : 0));
  const totalMass = m1 + m2;

  if (totalMass <= 0 || isNaN(totalMass)) return;

  const wx = (m1 * b1.x + m2 * b2.x) / totalMass;
  const wy = (m1 * b1.y + m2 * b2.y) / totalMass;
  const wz = (m1 * b1.z + m2 * b2.z) / totalMass;

  const rp = rotate3D({ x: wx, y: wy, z: wz });
  const pp = project3D(rp.x, rp.y, rp.z);

  ctx.save();

  const rp1 = rotate3D(b1);
  const pp1 = project3D(rp1.x, rp1.y, rp1.z);
  const rp2 = rotate3D(b2);
  const pp2 = project3D(rp2.x, rp2.y, rp2.z);

  if (pp1.visible && pp2.visible) {
    ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pp1.x, pp1.y);
    ctx.lineTo(pp2.x, pp2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!pp.visible || isNaN(pp.x) || isNaN(pp.y)) {
    ctx.restore();
    return;
  }

  ctx.save();
  const size = 12;
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 2;
    ctx.beginPath();
  ctx.moveTo(pp.x - size, pp.y); ctx.lineTo(pp.x + size, pp.y);
  ctx.moveTo(pp.x, pp.y - size); ctx.lineTo(pp.x, pp.y + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const name1 = b1.name || "Star1";
  const name2 = b2.name || "Star2";

  const elName = document.getElementById("barycenterNameDisplay");
  const elPos  = document.getElementById("barycenterPosDisplay");
  const elMass = document.getElementById("barycenterMassDisplay");

  if (elName) elName.textContent = `Barycenter: ${name1} + ${name2}`;
  if (elPos)  elPos.textContent = `Barycenter Pos: X:${pp.x.toFixed(1)} Y:${pp.y.toFixed(1)}`;
  if (elMass) elMass.textContent = `Mass 1st ${name1}:${m1.toFixed(1)} / 2nd ${name2}:${m2.toFixed(1)}`;

  ctx.restore();
}

/**
 * 天体の3Dパースペクティブおよび対数スケーリングを適用した画面サイズを返す
 */
function calculateScreenSize(b, pr) {
  const depth = pr.depth || 1;

  if (b.name === "Sun") {
    const sunBaseSize = 25.0;
    return Math.max(4.0, (sunBaseSize * camera.zoom) / depth);
  }
  if (b.name === "Goliath" || b.mass >= settings.sunMass * 0.9) {
    const goliathBaseSize = 20.0;
    return Math.max(4.0, (goliathBaseSize * camera.zoom) / depth);
  }
  const logScale = 1.8 * Math.log10((b.mass || 1) + 1) + (b.size || 1);
  return Math.max(1.0, (logScale * camera.zoom) / depth);
}



/**
 * 太陽からの距離に応じた多様な天体色（寒暖ハイブリッド配色）を計算
 */
function getCelestialColor(b, sun) {
  const dx = b.x - sun.x;
  const dy = b.y - sun.y;
  const dz = b.z - sun.z;
  const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

  // 0.0〜1.0 に正規化（基準距離 2500）
  const t = Math.min(1.0, d / 2500.0);

  // 天体の質量をシード値にして、色相にわずかな個体差（多様性）を与えるわ
  const variety = (b.mass ? Math.floor(b.mass * 123) % 20 : 0) - 10;

  // 太陽に極めて近い内惑星（t < 0.25）は、熱を帯びた「暖色・ゴールド系」にする演出よ！
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
//  エラーゼロ防衛：Sun相対座標の安全な抽出マトリクス
// =======================================================
function getTargetCenterOffset() {
  // bodies[0] が存在し、かつ NaN になっていないか厳格にチェック
  const sun = (window.bodies && window.bodies[0]);
    if (sun && !isNaN(sun.x) && !isNaN(sun.y) && !isNaN(sun.z)) {
    return { x: sun.x, y: sun.y, z: sun.z };
  }
    // もし太陽がバグる、または消滅していたら、宇宙の中心 (0,0,0) を返してフリーズを防ぐ規律
  return { x: 0, y: 0, z: 0 };
}

function drawBodyTrails(b, trailColor) {
  const isPlanet = simulationState.ui.showPlanetTrail && b.type !== "comet" && b.name !== "Sun" && b.trail && b.trail.length > 2;
  const isComet = simulationState.ui.showCometTrail && b.type === "comet" && b.trail && b.trail.length > 2;
  const isSun = simulationState.ui.showSunTrail && b.name === "Sun" && b.trail && b.trail.length > 2;

  if (!isPlanet && !isComet && !isSun) return;

  const totalPoints = b.trail.length;
  const center = getTargetCenterOffset();
  // =========================================================
  // 核心：カメラ変更時、またはデータ不在時のみ【1点につき1回だけ】3D投影
  // =========================================================
  const isDragging = (typeof dragging !== "undefined" && dragging);

  if (cameraChanged || !b.trail[0] || b.trail[0].sx === undefined){
   for (let i = 0; i < totalPoints; i++) {
    const p = b.trail[i];
    const relX = p.wx - center.x;
    const relY = p.wy - center.y;
    const relZ = p.wz - center.z;

    const rp = rotate3D({ x: relX, y: relY, z: relZ });
    const prp = project3D(rp.x, rp.y, rp.z);
    p.sx = prp.x;
    p.sy = prp.y;
    p.visible = prp.visible;
    }
  }

  // (以下、線の太さ定義や ctx.save()、およびお好みのフェード描画ループへ続く...)
  // 天体が画面外（カメラの真後ろ）ならループそのものを事前に蹴り出す（太陽は無条件救済）
  if (!isSun && b.trail[totalPoints - 1] && b.trail[totalPoints - 1].visible === false) {
    return;
  }

  ctx.save();
  let baseLineWidth = 0.5;
  if (isPlanet) {
    const baseWidth = b.isOrbiting ? 1.2 : 0.8;
    baseLineWidth = baseWidth * (0.75 + camera.zoom * 0.15);
    ctx.strokeStyle = trailColor;
  } else if (isComet) {
    ctx.strokeStyle = b.color || "#00ffff";
  } else if (isSun) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  }

  // =========================================================
  //  あんたのこだわり：古い部分（前方）から新しい部分（後方）へ滑らかにフェード
  // =========================================================
  // drawBodyTrails 内のループ部分の修正
for (let i = 0; i < totalPoints - 1; i++) {
    const p1 = b.trail[i];
    const p2 = b.trail[i + 1];

    if (p1.visible === false || p2.visible === false) continue;

    const progress = i / totalPoints;
    ctx.lineWidth = baseLineWidth * progress;
    ctx.globalAlpha = progress;

    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
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

  const tailLength = Math.min(1500, 12000 / d) * (1 + b.size * 3);
  const brightness = Math.min(1, 4000 / d);
  const particles = 25 + Math.floor(55 * brightness);

  const tColor = Math.min(1, d / 6000);
  const baseR = (180 + (255 - 180) * tColor) | 0;
  const baseG = (220 + (255 - 220) * tColor) | 0;
  const baseB = 255;

  ctx.save();
  // 描画負荷軽減のために極力パスをクリーンに保ちつつループ
  for (let i = 0; i < particles; i++) {
    const t = i / particles;
    const fade = (1 - t) * brightness;

    const px = b.x + nx * tailLength * t;
    const py = b.y + ny * tailLength * t;
    const pz = b.z + nz * tailLength * t;

    const rp = rotate3D({ x: px, y: py, z: pz });
    const pp = project3D(rp.x, rp.y, rp.z);

    ctx.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.25 * fade})`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, (1 + b.size * 2) * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 天体本体の球体（および太陽・Goliathの特有グラデーション）を描画する
 */
function drawBodyCore(b, pr, sun, screenSize) {
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
    ctx.fillStyle = getCelestialColor(b, sun);

    // 高速スイングバイ時の輝き表現
    const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy + b.vz*b.vz) || 0;
    if (speed > 60) {
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = Math.min(8, speed / 12);
    }
  }
    ctx.fill();
  ctx.restore();
}

/**
 * HUD・個別天体ラベル描画（背後に半透明の黒幕を敷く視認性改善版）
 */
function drawBodyLabel(b, pr, screenSize) {
  ctx.save();
  ctx.font = "12px sans-serif";
    const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy + b.vz*b.vz) || 0;
  let label = `${b.name} | V: ${speed.toFixed(2)} /sec`;
  if (b.name !== "Sun" && b.distance !== undefined) {
    label += ` | D: ${b.distance.toFixed(1)}`;
  }
  if (b.isOrbiting) {
    label += " [STB]";
  }
    const textWidth = ctx.measureText(label).width;
  const lx = pr.x + screenSize + 4;
  const ly = pr.y - 2;

  // ★プロのHUD視認性改善：文字の背景に薄い黒の「座布団」を敷いて、星空や軌跡と被っても確実に読ませるわ！
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(lx - 2, ly - 11, textWidth + 4, 14);

  // 文字本体の描画
  ctx.fillStyle = "white";
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

/**
 * 画面上部に固定配置される総合情報HUDを描画する（純粋なGetter表現）
 */

function drawScreenHUD() {
  if (typeof ctx === 'undefined' || !ctx) return;
    ctx.save();
    // ==========================================
  // ⚙️ 将来のサイズ変更に1秒で追従する動的タイポグラフィ
  // ==========================================
  const fontSize = 14; // ★ここを 11 や 12 に書き換えるだけで、すべてが自動で縮小・最適化されるわ！
    ctx.font = `${fontSize}px 'Consolas', 'Courier New', monospace`;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
    const pX = 20;                        // 左端マージン
  let currentY = fontSize + 20;         // 開始Y座標（フォントサイズに応じて自動アジャスト）
  const lineHeight = Math.round(fontSize * 1.45); // フォントサイズに黄金比率で連動する動的行間
    // 헬パー関数：DOMから安全に文字列を抽出する
  const getDOMText = (id) => {
    const el = document.getElementById(id);
    return el ? (el.innerText || el.textContent) : null;
  };

  // ------------------------------------------
  // 📡 ブロック1：天体生態系＆演算ループ
  // ------------------------------------------
  const bodyText = getDOMText("bodyCountDisplay");
  if (bodyText && bodyText.trim() !== "") {
    ctx.fillStyle = "white";
    ctx.fillText(bodyText, pX, currentY); currentY += lineHeight;
  }

  const turnText = getDOMText("turnCountDisplay");
  if (turnText && turnText.trim() !== "") {
    ctx.fillStyle = "#e0e6ed"; // プラチナシルバー
    ctx.fillText(turnText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック2：【重力重心マトリクス】
  // ------------------------------------------
  const bNameText = getDOMText("barycenterNameDisplay");
  if (bNameText && bNameText.trim() !== "") {
    ctx.fillStyle = "#00ffcc"; // シアン
    ctx.fillText(bNameText, pX, currentY); currentY += lineHeight;
  }

  const bPosText = getDOMText("barycenterPosDisplay");
  if (bPosText && bPosText.trim() !== "") {
    ctx.fillStyle = "#a3ffee"; // 淡いシアン
    ctx.fillText(bPosText, pX, currentY); currentY += lineHeight;
  }

  const bMassText = getDOMText("barycenterMassDisplay");
  if (bMassText && bMassText.trim() !== "") {
    ctx.fillStyle = "#ff99cc"; // マゼンタピンク
    ctx.fillText(bMassText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック3：【太陽物理パラメータ】
  // ------------------------------------------
  const sunSpeedText = getDOMText("sunSpeedDisplay");
  if (sunSpeedText && sunSpeedText.trim() !== "") {
    ctx.fillStyle = "#ffffaa"; // 鈍いイエロー
    ctx.fillText(sunSpeedText, pX, currentY); currentY += lineHeight;
  }

  // ------------------------------------------
  // 📡 ブロック4：【マトリクス生死統計カウンタ】
  // ------------------------------------------
  const alive = getDOMText("statAlive") || "0";
  const escaped = getDOMText("statEscaped") || "0";
  const collided = getDOMText("statCollided") || "0";
  const removed = getDOMText("statRemoved") || "0";
  const nans = getDOMText("statNaN") || "0";

  ctx.fillStyle = "white";
  ctx.fillText(`Alive: ${alive} | Escaped: ${escaped} | Collided: ${collided} | Removed: ${removed}`, pX, currentY);
  currentY += lineHeight;

  // 例外（NaN）の監視。0でなければ烈火の警告
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
  currentY += Math.round(lineHeight * 0.5); // カテゴリの区切りとして半行分の空行を自動生成

  const simTime = getDOMText("statSimTime");
  if (simTime && simTime.trim() !== "") {
    ctx.fillStyle = "#00ffff"; // 宇宙年齢：鮮烈シアン
    ctx.fillText(simTime, pX, currentY); currentY += lineHeight;
  }

  const runTime = getDOMText("statRunTime");
  if (runTime && runTime.trim() !== "") {
    ctx.fillStyle = "#ffaa00"; // 稼働時間：アンバー
    ctx.fillText(runTime, pX, currentY); currentY += lineHeight;
  }

  const realTime = getDOMText("statRealTime");
  if (realTime && realTime.trim() !== "") {
    ctx.fillStyle = "#00ff00"; // 現実時刻：グリーン
    ctx.fillText(realTime, pX, currentY);
  }

  ctx.restore();
}


function initBackgroundStars() {
  BACKGROUND_STARS = [];
  // 150個の固定星を天球（3D球面座標）にランダム散布
  for (let i = 0; i < 150; i++) {
    BACKGROUND_STARS.push({
      theta: Math.random() * Math.PI * 2,          // 経度方向の回転
      phi: Math.acos(Math.random() * 2 - 1),       // 緯度方向の回転（極での密集を防ぐ均等配置よ）
      size: Math.random() * 1.5 + 0.5,             // 星のきらめきの物理サイズ
      brightness: Math.random() * 0.4 + 0.6        // 星の初期輝度
    });
  }
}

/**
 * 背景星空の具体的な描画（無限遠投影ロジック）
 */
(function() {
  // 外部から絶対に汚染されないプライベートな固定配列
  let starsInstance = [];

  function ensureStarsInitialized() {
    if (starsInstance.length > 0) return;

  // 【初期化ループ内の調律コード：周期ノイズルート】
for (let i = 0; i < 30000; i++) {
  const theta = Math.random() * Math.PI * 2;
    let u = Math.random() * 2 - 1;
    // 経度（theta）に応じて、u の分布幅をダイナミックに変調（モジュレーション）させる
  // これにより、特定の経度では星が中央に激しく凝縮し、別の経度ではバラけるという「うねり」が生まれる
  const wave = Math.sin(theta * 8); // 細かく分割
if (Math.random() > Math.abs(wave) * 0.95) { // 徹底的に間引く
  u = u * (1 - Math.abs(wave) * 0.1); // 圧縮はあえてせず、丸く散らす
}

  const phi = Math.asin(u);

  // （あとは同じように wx, wy, wz を計算して push するだけよ！）

      // 【初期化側の調律イメージ：ここへ3D座標を最初からトーストしておく】
starsInstance.push({
  theta: theta,
  phi: phi,
  // 👑 三角関数の計算は宇宙創生時の「この1回」だけで執行終了！
  wx: Math.cos(theta) * Math.cos(phi),
  wy: Math.sin(phi),
  wz: Math.sin(theta) * Math.cos(phi),
  // 👑【極小化】最大でも1ピクセル未満。大半は0.1〜0.4pxの針の先のような極小の点へ
  size: Math.random() * 0.6 + 0.5,
    // 👑【微光化】最大輝度を0.75に抑え、下限を0.15へ。深宇宙の無限の奥行きを偽装
  brightness: Math.random() * 0.4 + 0.15

});
    }
  }

/**
   * 背景星空の具体的な描画（上下左右360度・完全全天球ホライズン・超軽量3Dマトリクス版）
   */
  window.drawBackgroundStars = function() {
    ensureStarsInitialized();

    ctx.save();

    // カメラの回転角（サイン・コサイン）を事前キャッシュ（これは全星で共通だからここで正解）
    const cosX = Math.cos(camera.rotX);
    const sinX = Math.sin(camera.rotX);
    const cosY = Math.cos(camera.rotY);
    const sinY = Math.sin(camera.rotY);

    const cx = W / 2;
    const cy = H / 2;
    const fov = 500; // ループ外へクランプして無駄な代入を抑制

    for (let i = 0; i < starsInstance.length; i++) {
      const star = starsInstance[i];

      // 1. 👑【極限の引き算】不変の3D絶対座標（wx, wy, wz）をオブジェクトからダイレクトにGetter！
      // 毎フレーム2万回走っていた三角関数（Math.sin / cos）のCPUオーバーヘッドを完全消滅（除霊）完了。
      const wx = star.wx;
      const wy = star.wy;
      const wz = star.wz;

      // 2. カメラの回転（ヨー：rotY / ピッチ：rotX）を適用
      // ヨー回転（Y軸まわり）
      const x1 = wz * sinY + wx * cosY;
      const z1 = wz * cosY - wx * sinY;
               // ピッチ回転（X軸まわり）
      const y2 = wy * cosX - z1 * sinX;
      const z2 = wy * sinX + z1 * cosX;

      // 3. カメラの前方（z2 > 0）にいる星だけをスクリーンへ投影
      if (z2 > 0) {
        const sx = cx + (x1 * fov) / z2; // x2 は x1 と等価なため直接代入して変数消費を引き算
        const sy = cy + (y2 * fov) / z2;

        // 画面の上下左右すべての可視領域をカバー（カリングガード）
        if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
          // 小数点のブレを排除してクッキリ高速に整数描画（ビット演算の規律）
          ctx.fillRect(sx | 0, sy | 0, star.size, star.size);
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
    updatePhysics(dt);
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
    updateNarrative(dt);
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
   【追加】軌跡カラー取得（安全版互換レイヤー）
   ========================================================= */
function getTrailColor(b, sun) {
  // 設定されているカラーモードに応じて、軌跡の色を動的に決定する規律よ
  if (settings.trailColorMode === "pure") {
    return b.color || "rgba(255, 255, 255, 0.5)";
  }

  // 太陽（基準天体）がない場合はフォールバック
  if (!sun) return b.color || "white";

  // 太陽からの3D距離を計算
  const dx = b.x - sun.x;
  const dy = b.y - sun.y;
  const dz = b.z - sun.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

  // 3Dシミュレーションの最大描画スコープ（S.maxDist）を基準に正規化
  const maxD = (settings.spawnSettings && settings.spawnSettings.maxDist) || 600;
  const t = Math.min(1.0, dist / maxD);

  // 距離に応じた美しいグラデーションカラー（中心は白熱、遠方は冷徹な宇宙のシアン）
  const rCol = 180 + (255 - 180) * t;
  const gCol = 220 + (255 - 220) * t;
  const bCol = 255;

  return `rgb(${rCol|0}, ${gCol|0}, ${bCol|0})`;
}


/* ========================================================
   ★ フェーズ2: カメラプリセット設定関数（UI・キー連動用・完全クリーン版）
   ======================================================== */
function applyCameraPreset(presetName) {
  // 1. マウス平行移動（右ドラッグ）のオフセットを中央（0）に完全リセット！
  camera.offsetX = 0;
  camera.offsetY = 0;
    // 2. カメラの注視点を宇宙の中心（0,0,0）にリセット
  camera.pos.x = 0;
  camera.pos.y = 0;

  switch (presetName) {
    case 'equator': // 太陽赤道面ビュー（真横から平面軌道を観察）
      camera.pos.z = -800; // 標準距離
      camera.rotX = 0.0;   // ピッチゼロ（真横）
      camera.rotY = 0.0;   // ヨー正面
      camera.zoom = 1.0;   // 等倍
      console.log("Preset: 太陽赤道面ビュー");
      break;

    case 'polar': // 極ビュー（太陽の真上から軌道平面を完璧に見下ろす）
      camera.pos.z = -800;
      // ジンバルロック制限（Math.PI/2 - 0.01）のギリギリで真上を向かせる
      camera.rotX = Math.PI / 2 - 0.01;
      camera.rotY = 0.0;
      camera.zoom = 1.0;
      console.log("Preset: 極ビュー（北極俯瞰）");
      break;

    case 'overview': // 【新設計！】遠方全体俯瞰（立体感溢れる斜め上アングル）
      camera.pos.z = -1200; // 宇宙全体を視野に収めるために少し引く
      camera.rotX = 0.7;    // 上空約40度から見下ろす
      camera.rotY = 0.7;    // 横方向にも約40度回転させて見事な立体感を出すわ！
      camera.zoom = 0.7;    // 視野を少し広くする
      console.log("Preset: 遠方全体俯瞰ビュー");
      break;
  }
}

// ========================================================
//  宇宙管制盤：UI診断・本体ロジック完全分離システム
// ========================================================

(function() {
    // 1. 【UI_MAPの完全網羅】提示されたHTML内のすべての操作・統計系ID（全28個）
    const UI_MAP = [
        // --- システム・時間操作 ---
        { id: "startBtn",           name: "時間開始（Q）" },
               { id: "resetBtn",           name: "宇宙リセット（E）" },
        { id: "consoleTestBtn",     name: "コンソール診断ボタン" },
                              // --- 軌跡レンダリングフィルタ ---
       // 👑 【除霊】直書きの日本語「name」をパージし、表面のフルテン文字に同期
{ id: "cometTrailBtn",  en: "CMT I", ja: "彗星 I" },
{ id: "planetTrailBtn", en: "PLN O", ja: "惑星 O" },
{ id: "sunTrailBtn",   en: "SUN P", ja: "太陽 P" },
                // --- ディスプレイ・表示トグル ---
       // 👑 【除霊】直書き日本語をパージし、表面のフルテン文字に同期
{ id: "showNames", en: "NAME N", ja: "名前 N" },
        //{ id: "showTrail",          name: "軌跡表示トグル" },
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
                // --- 宇宙自転・カメラ操作 ---
        { id: "cameraRotateSpeed",  name: "宇宙自動回転スライダー" },
        { id: "rotateSpeedInput",   name: "宇宙自動回転数値入力" },
     { id: "btnToggleRotate", en: "AUTO", ja: "自動" },
       // 👑 【調律】直書き日本語の「name:」を完全に抹殺し、3文字コードへ統一
{ id: "camEquatorBtn",  en: "EQT", ja: "赤道" },
{ id: "camPolarBtn",    en: "PLR", ja: "極域" },
{ id: "camOverviewBtn", en: "OVW", ja: "俯瞰" },
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

    // ========================================================
    // 規律1：DOMが完全に構築されてから儀式を始める（包み込み）
    // ========================================================
    document.addEventListener("DOMContentLoaded", () => {
        initializeUniverseControlCenter();
    });

    function initializeUniverseControlCenter() {
        // コンソール診断ボタンそのものの紐付け
        const testBtn = document.getElementById("consoleTestBtn");
        if (testBtn) {
            testBtn.onclick = function() {
                executeConsoleSelfTest();
                setTimeout(() => {
                    runDOMConnectionCheck();
                    attachUIWatchersAndLogics();
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
    // 規律2 ＆ 4-B：【本体ロジック ＆ 多重登録防止】
    // 既存ボタンの挙動を破壊せず、純粋な変数操作・宇宙連動のみを行う
    // ========================================================
    function attachUIWatchersAndLogics() {
        for (const ui of UI_MAP) {
            const el = document.getElementById(ui.id);
            if (!el) continue;

            // 規律2：多重登録防止（2回目以降の診断ボタン押下時は処理をスキップ）
            if (el.dataset.uiWatchAttached) continue;
            el.dataset.uiWatchAttached = "true";

            // --- INPUT / SELECT 系のイベント仕込み ---
            if (el.tagName === "INPUT" || el.tagName === "SELECT") {
                const eventType = el.type === "checkbox" ? "change" : "input";
                                el.addEventListener(eventType, (e) => {
                    const currentVal = el.type === "checkbox" ? el.checked : e.target.value;
                                        // 1. 診断ログの出力
                    logUIActivity(ui, currentVal, "change");
                                        // 2. 本体ロジック（実際の宇宙への反映）
                    executeInputCoreLogic(ui.id, currentVal);
                });
            }

            // --- BUTTON 系のイベント仕込み ---
            if (el.tagName === "BUTTON") {
                el.addEventListener("click", () => {
                    // 1. 診断ログの出力
                    logUIActivity(ui, null, "click");
                                        // 2. 本体ロジック（実際の宇宙への反映）
                    executeButtonCoreLogic(ui.id, el);
                });
            }
        }
    }

    // --------------------------------------------------------
    // 本体ロジック専用：INPUT / SLIDER の値を宇宙の物理変数へ注入
    // --------------------------------------------------------
    function executeInputCoreLogic(id, val) {
        const numVal = parseFloat(val);
                switch (id) {
            case "cameraRotateSpeed":
            case "rotateSpeedInput":
                if (typeof camera !== "undefined") {
                    camera.autoRotateSpeed = numVal;
                }
                break;
            // 他のスライダーの値をリアルタイムに物理シミュ側に反映させたい場合は、ここにケースを足していけるで
        }
    }

 // ========================================================
    // 宇宙管制盤：BUTTON が押された時のフラグ反転・関数実行
    // ========================================================
    function executeButtonCoreLogic(id, element) {
        switch (id) {
         case "btnToggleRotate":
    window.isAutoRotateEnabled = !window.isAutoRotateEnabled;
    if (window.UI_DEBUG) console.log(`🛸 [本体連動] window.isAutoRotateEnabled ──> ${window.isAutoRotateEnabled}`);
        if (element) {
        // 👑 【鉄の規律・完全上書き】
        if (window.isAutoRotateEnabled) {
            // ON：通常立体を剥ぎ取り、烈火のオレンジを強制ブースト！
            element.classList.add("toggle-on");
            element.classList.remove("toggle-off");
        } else {
            // OFF：オレンジを剥ぎ取り、グレーの通常立体へ強制消灯！
            element.classList.add("toggle-off");
            element.classList.remove("toggle-on");
        }
    }
        if (typeof updateButtonLabels === "function") updateButtonLabels();
    break;

         case "toggleBaryBtn":
    window.showBarycenter = !window.showBarycenter;
    if (window.UI_DEBUG) console.log(`🌌 [表示連動] window.showBarycenter ──> ${window.showBarycenter}`);
        // 👑 【調律】activeなどの不要なクラスを排除し、現在のtoggle-on / toggle-offの2択規律へ強制同期
    if (element) {
        if (window.showBarycenter) {
            element.classList.add("toggle-on");
            element.classList.remove("toggle-off");
        } else {
            element.classList.add("toggle-off");
            element.classList.remove("toggle-on");
        }
    }
    break;

            case "startBtn":
                if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = true;
                break;

            case "stopBtn":
                if (typeof window.isTimeProgressing !== "undefined") window.isTimeProgressing = false;
                break;

            // 👑 【完全覚醒：スコープの壁を越えた三位一体リセット】
            case "resetBtn":
    // 1. 変数を確実にゼロへ
    if (typeof simulationState !== "undefined") {
        simulationState.elapsedTime = 0;
    }
    window.realAccumulatedTime = 0;

    // 🌟【重要】リセットした「今」を基準点にしないと、次のフレームで時間がワープするわ！
    if (typeof lastTime !== "undefined") {
        lastTime = performance.now();
    }

    // 2. 天体の再生成
    if (typeof generateBodies === "function") {
        generateBodies();
    }
        // 3. 即座にUIに「0」を叩き込む
    if (typeof updateSimTimeUI === "function") {
        updateSimTimeUI();
    }
    break;
        }
    }
})(); // 👈 【宇宙管制盤】のクローズ境界線


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
// キーボードもマウスも、全員この関数を呼び出すように強制統一するわよ！
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
   "toggleBaryBtn":     { text: "BARY", en: "BARY", ja: "重心" },
   "toggle-momentum-btn": { text: "L-VEC", en: "L-VEC", ja: "角運動量" },
  // 👑 【調律】「-TRK」も括弧も完全パージ。表面は冷徹な記号で固定
"cometTrailBtn":  { text: "CMT I", en: "CMT I", ja: "彗星 I" },
"planetTrailBtn": { text: "PLN O", en: "PLN O", ja: "惑星 O" },
"sunTrailBtn":    { text: "SUN P", en: "SUN P", ja: "太陽 P" },
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

   // case "m":
     // safeToggleCheckbox("showTrail"); // Trail (M) チェックボックスの反転・同期
     // break;

    default:
      // 未定義のキーは宇宙の静寂を乱さないよう、そのままスルーするわ
      break;

// === バリセンター表示トグル（B） ===
    case "b":
      safeClick("toggleBaryBtn");
      break;

  }
});



loop();
