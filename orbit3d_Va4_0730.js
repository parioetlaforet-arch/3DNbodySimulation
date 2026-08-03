/* ---------------------------------------------------------
   3D N-body Simulation — settings 対応 完全版
   Part 1: Settings / Init / Camera / Projection / Input
--------------------------------------------------------- */

let BACKGROUND_STARS = [];

let targetHistory = [];

// 💡 0:非表示（規律通り、起動時は完全にオフ。ストイックホワイト起動のトリガー）
let lvecMode = 0;


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
// 🎥 カメラ初期旋回ベクトル（DAW的初期モジュレーション：0.0005）
// =========================================================
let cameraRotateSpeed = 0.0005;        // 💡 起動時から極小スローで空間を回転させる
let isAutoRotateEnabled = true;       // 💡 自動回転のマスターフラグを最初からONに拘束

// （※もしシステムが window オブジェクト経由で参照している場合の防衛線）
window.cameraRotateSpeed = 0.0005;
window.isAutoRotateEnabled = true;

/* =========================================================
   Part 1: settings（GitHubPages公開・ストイック目利き特化版）
   ========================================================= */
const settings = {
  gravityMultiplier: 1.0,
  simSpeed: 2.5,                  // 知的な速度感
  spawnVelocityMultiplier: 0.95,  // 綺麗な初期楕円を生む黄金比
  trailLengthMultiplier: 1.2,
  trailColorMode: "eccentricity", // 離心率バインド
  fullGravityThreshold: 200,
  eps2: 36,                       // 衝突・スイングバイの安全限界 (ε = 6.0)

  objMass: 1.0,
  useFixedObjMass: false,
  initialBodyCount: 24,           // 💡 UIの初期値 (QTY: 24) と同期
  spawnSettings: {
    minMass: 10.0,
    maxMass: 100.0,               // 10倍の質量幅へ拡張
    massPower: 2.0,               // ベキ乗分布バイアス（Zipfの法則）
    sizeScale: 0.7,               // 物理衝突サイズの倍率
    renderSizeScale: 1.0,         // 描画サイズの倍率
    minDist: 120,                 // 太陽近傍の余白確保
    maxDist: 800,                 // ★ここにカンマ（,）を追加！
    direction: "chaos"            // ★最後の行として追加
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
    nameMode: 0,
    showCometTrail: true,
    showPlanetTrail: true,
    showSunTrail: false,

    // 「L-VEC / Target Lock」グループと同期する状態変数
    showLVec: 0,                // lvecMode (0: OFF, 1: TOTAL, 2: INDIVIDUAL+HUD)
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


/* ============================
   UI ボタン定義（必須）
============================ */
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const sunTrailBtn    = document.getElementById("sunTrailBtn");
const cometTrailBtn  = document.getElementById("cometTrailBtn"); // 💡 これが彗星(comet)ボタン
const planetTrailBtn = document.getElementById("planetTrailBtn"); // 💡 これが通常天体(obj/planet)ボタン

// 🎯【追加】初期起動時、内部データ(true)とUIボタンのLED（クラス名）を完全強制バインド！
// 通常天体(obj)ボタンを点灯
if (planetTrailBtn) {
    planetTrailBtn.classList.add("toggle-on", "active");
    planetTrailBtn.classList.remove("toggle-off");
}

// 彗星(comet)ボタンを点灯
if (cometTrailBtn) {
    cometTrailBtn.classList.add("toggle-on", "active");
    cometTrailBtn.classList.remove("toggle-off");
}

// 太陽軌跡ボタンはデータ側が false（非表示）なので、安全のため明確に消灯ホールド
if (sunTrailBtn) {
    sunTrailBtn.classList.add("toggle-off");
    sunTrailBtn.classList.remove("toggle-on", "active");
}


// ---------------------------------------------------------
//  カメラ自動巡航 UIコントロール同期システム（初期旋回0.0005拘束版）
// ---------------------------------------------------------
const camSpeedSlider = document.getElementById("cameraRotateSpeed");
const camSpeedInput  = document.getElementById("rotateSpeedInput");
const camSpeedLabel  = document.getElementById("rotateSpeedVal");
const camToggleBtn   = document.getElementById("btnToggleRotate");

// 👑 起動時のマスターモジュレーション（LFO）を強制バインド
window.isAutoRotateEnabled = true;
window.cameraRotateSpeed = 0.0005;

// 🎨 UI側のスライダーや入力ボックスの初期数値も「0.0005」へ強制流し込み
if (camSpeedSlider) camSpeedSlider.value = 0.0005;
if (camSpeedInput)  camSpeedInput.value = 0.0005;
if (camSpeedLabel)  camSpeedLabel.textContent = "0.0005";

// 🎛️ ボタンの見た目も最初から「ON（アクティブ）」へ反転執行
if (camToggleBtn) {
    camToggleBtn.classList.add("toggle-on", "active");
    camToggleBtn.classList.remove("toggle-off");
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
// 宇宙管制盤：プリセット・データ構造（ストイック調律・完全版）
// ========================================================
const DEBUG_PRESETS = {
    // 🪐 1. 安定軌道（ストイック目利き・基準宇宙）
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
            eps2Input: 25,                              // 激しいスイングバイを許容
            cameraRotateSpeed: 0.001                    // ダイナミックな視点旋回
        },
        physics: () => {
            // 💡 内部配列・数量バッファを 64 へアライメント
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
                settings.sunFixed = false; // 太陽自体も重力相互作用で揺さぶられる！
            }

            // 💡 トグルボタンの連動（彗星トレイルと重心表示をONにして空間を線で満たす）
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

            // 🎥 カメラ旋回同期＆自動回転ボタン表示制御
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
            // 💡 内部配列・数量バッファの同期
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
                settings.sunFixed = false; // 連星運動のため太陽の固定を解除！
            }

            // ⚡【 Goliath 強制召喚ロジック 】
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

            // 💡 トグルボタン連動：共通重心（Barycenter）、惑星軌道、および【SUN1軌跡】をON！
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

            // 🎥 カメラ旋回同期＆自動回転ボタン表示制御
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
            bodyCount: 6,          bodyCountInput: 6,    // 幾何学解析に最適な少数精鋭
            sunMass: 2200,        sunMassInput: 2200,   // 主星
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 1.5,         objMassInput: 1.5,
            useFixedObjMass: false,
            gravitySlider: 1.0,   gravityInput: 1.0,    // 標準重力定数
            spawnVelSlider: 0.82, spawnVelInput: 0.82,  // 加減速が際立つ綺麗な高偏平楕円
            speedSlider: 2.0,     speedInput: 2.0,      // 解析数値をじっくり追えるクロック
            eps2Input: 16,
            cameraRotateSpeed: 0.0002                    // 幾何学構造を崩さない静かな超微速旋回
        },
        physics: () => {
            // 💡 内部配列・数量バッファの同期（少数精鋭 6基）
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
                settings.sunFixed = true; // 基準枠固定（純粋な解析のため）
            }

           // 💡 L-VEC モードを【 Mode 2 (個別解析HUD + 面積レーダー) 】へ強制アライメント
            window.lVecMode = 2;
            if (typeof lvecMode !== "undefined") lvecMode = 2; // let lvecMode 側も同時に書き換え

            // 💡 トグルボタン連動：L-VECボタンと惑星軌道のみをON
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

            // 🎥 カメラ旋回同期＆自動回転ボタン表示制御
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


// 🌌 4. 究極の純粋N体シム（5000天体・質量分散・全エフェクトOFF・全宇宙俯瞰）
    preset4: {
        name: "PRST: 4 (純粋N体・5000天体自己重力崩壊)",
        ui: {
            bodyCount: 5000,       bodyCountInput: 5000, // 5000基の巨大クラスタ
            sunMass: 1.0,         sunMassInput: 1.0,    // 特別な主星は作らず同等化
            sunVxSlider: 0.0,     sunVxInput: 0.0,
            sunVySlider: 0.0,     sunVyInput: 0.0,
            sunVzSlider: 0.0,     sunVzInput: 0.0,
            objMass: 1.0,         objMassInput: 1.0,
            useFixedObjMass: false,                      // 質量ランダム化を有効化
            gravitySlider: 1.0,   gravityInput: 1.0,    // 万有引力定数
            spawnVelSlider: 0.15, spawnVelInput: 0.15,  // 超低速初速（静寂と溜め）
            speedSlider: 3.0,     speedInput: 3.0,
            eps2Input: 80,                              // 5000体の近接衝突・跳ね飛び防止
            cameraRotateSpeed: 0.0003                   // 全体を静かに俯瞰する超微速視点
        },
        physics: () => {
            if (typeof initialBodyCount !== "undefined") window.initialBodyCount = 5000;
                        if (window.settings) {
                settings.gravityMultiplier = 1.0;
                settings.spawnVelocityMultiplier = 0.15;
                settings.simSpeed = 3.0;
                settings.eps2 = 80;
                settings.sunFixed = false; // 完全自由空間

                // 🌌 半径 10,000 の空間全体へばらまく
                if (settings.spawnSettings) {
                    settings.spawnSettings.minDist = 100;
                    settings.spawnSettings.maxDist = 10000;
                }
            }

            // 💡 5000基のリセット＆バッファ確保
            if (typeof resetUniverse === "function") {
                resetUniverse(5000);
            } else if (window.bodies) {
                window.bodies.length = 5000;
            }

            // ⚡【 5000体に 0.1 〜 100 のランダム質量を付与 】
            if (window.bodies && Array.isArray(window.bodies)) {
                window.bodies.forEach((b) => {
                    if (!b) return;
                    // 0.1 〜 100 の指数的ランダム質量（軽天体が多数、重天体が数個）
                    const randMass = parseFloat((0.1 + Math.pow(Math.random(), 3) * 99.9).toFixed(2));
                                        b.mass = randMass;
                    b.trail = []; // 過去の軌跡を完全消去
                                        if (typeof massToSize === "function") {
                        b.size = massToSize(randMass) * 0.4;
                    }
                });
            }

            // 💡 【全エフェクト・軌跡・HUDを完全OFF！】
            const allBtns = ['toggle-momentum-btn', 'planetTrailBtn', 'cometTrailBtn', 'sunTrailBtn', 'toggleBaryBtn'];
            allBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    if (btn.classList.contains('toggle-on') || btn.classList.contains('active')) {
                        btn.click();
                    }
                    btn.classList.add('toggle-off');
                    btn.classList.remove('toggle-on', 'active');
                }
            });

            window.lVecMode = 0;
            if (typeof lvecMode !== "undefined") lvecMode = 0;

            // 📷【 カメラ超広角アライメント（半径10,000俯瞰設定）】
            if (typeof camera !== "undefined") {
                camera.orbitRadius = 14000; // 距離を14,000まで引き伸ばす
                camera.zoom = 0.22;         // ズームを落として半径10000全画面収容
                camera.offsetX = 0;
                camera.offsetY = 0;
                camera.rotX = 0.6;          // 斜め上からの見易い鳥瞰角度
                camera.rotY = 0.5;
            }

            // 🎥 カメラ微速自動回転の起動
            if (typeof syncCameraRotateSpeed === "function") syncCameraRotateSpeed(0.0003, true);
            window.isAutoRotateEnabled = true;

            const camToggleBtn = document.getElementById("btnToggleRotate");
            if (camToggleBtn) {
                camToggleBtn.classList.add("toggle-on", "active");
                camToggleBtn.classList.remove("toggle-off");
            }

            if (window.UI_DEBUG) console.log("🌌 [PRST: 4] 広角カメラ(Radius:14000)同期・5000天体純粋N体シムが開始されました。");
        }
    },
};

// ========================================================
// 🛸 神の意志を無視する：Goliath / Obj 動的強制生成コマンド
// ========================================================
function spawnGoliathForce() {
    if (!bodies || bodies.length === 0) {
        console.error(" [召喚失敗] 宇宙に中心星（Sun）が存在しません。");
        return;
    }

    const sun = bodies[0];
    const S = settings.spawnSettings;
        const targetMinDist = S?.minDist || 300;
    const targetMaxDist = S?.maxDist || 1200;
    const currentG       = (typeof G !== "undefined") ? G : 1.0;

    // UIのコントロールユニットから「タイプ」と「指定質量」をリアルタイム取得
    const elType = document.getElementById("injectType");
    const elMassInput = document.getElementById("injectMassInput");
        const selectedType = elType ? elType.value : "obj";
    const customMass = elMassInput ? parseFloat(elMassInput.value) : 5.0;

    // 【聖域：完璧な3次元幾何学配置ロジック（絶対保持）】
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const r = targetMinDist + Math.random() * (targetMaxDist - targetMinDist);

    const x = r * Math.cos(angle1) * Math.sin(angle2);
    const y = r * Math.sin(angle1) * Math.sin(angle2);
    const z = r * Math.cos(angle2);

    // 🌌 【聖域：ケプラー回転速度ベースの物理演算（絶対保持）】
    const dist = Math.sqrt(x*x + y*y + z*z) || 1;
    const vBase = Math.sqrt(currentG * settings.gravityMultiplier * sun.mass / dist);
        // カオス逆回り要素の判定（10%の確率で逆周りベクトルへ変調）
    const side = Math.random() < 0.1 ? -1 : 1;
    const v = vBase * (settings.spawnVelocityMultiplier || 1.0) * (0.6 + 0.4 * (targetMaxDist / dist));
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

    // 🪐 生成データの分岐アライメント（既存のデータ構造に完全同化）
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
            size: massToSize(customMass) * 0.3,
            color: "#ff00ff",
            name: "Goliath",
            type: "planet",
            trail: []
        };
        console.log(`%c [特異点観測] 異分子『Goliath』(M:${customMass.toFixed(1)}) 配置完了。重力場が歪むわよ！`, "color: #ff00ff; font-weight: bold;");
    } else {
        const t = Math.min(1, dist / (targetMaxDist || 1200));
        const sizeScale = 0.7;
        const size = massToSize(customMass) * (0.15 + Math.random() * 0.15) * (1 - 0.5 * t) * sizeScale;

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

    // 🚀 現役の宇宙配列へインジェクションを執行
    bodies.push(newBody);
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

// 2. ★【大改造開通】巡回式マルチ・バリセンターボタンの配線
  const baryBtn = document.getElementById("toggleBaryBtn");
  if (baryBtn) {
      // 🌟【超強力アジャスト】古いステルス配線を根こそぎ完全パージする禁忌のハック！
      // ボタンのクローン（複製）を作って差し替えることで、裏で登録されていた古いイベントリスナーを100%全消去します。
      const cleanBaryBtn = baryBtn.cloneNode(true);
      baryBtn.parentNode.replaceChild(cleanBaryBtn, baryBtn);

      // 👑 新しく生まれ変わったクローンボタンに対して、中央管制関数だけを「単一配線」する！
      cleanBaryBtn.addEventListener("click", function() {
          executeButtonCoreLogic("toggleBaryBtn", this);
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
  // 新設された camera.orbitRadius を純粋に「加算」して奥行きを確定させる
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
let initialBodyCount = 24;


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

  // 👑 【特権ハック】：F12の戦術HUDがアクティブの時だけ、XYZの座標をサイバーに結合
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

 /* -------------------------------------------------------
   彗星の初期追加（宇宙の創生時）：オールトの雲プロトコル
   ------------------------------------------------------- */
// 1万ターン周期を1000ターンに1回拝むために、定員を「10個」に拡張する
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
      // これにより、太陽のド真ん中への激突を回避し、鋭い螺旋を描いてスイングバイする規律になる
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

    console.log(" 観測開始：Sunと同等の質量を持つ異分子『Goliath』が配置された");
  }

  // 太陽のワープ暴走を防ぐ重心調整
  if (typeof adjustSunVelocity === "function") {
    adjustSunVelocity();
  }
}


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
      直交ベクトル（スイングバイ用・完璧なコード）
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
    const slantRatio = 0.03; //  これが極上の「かすり Uターン」を生む規律

    vx = (nx * fallRatio + ox * slantRatio) * speed;
    vy = (ny * fallRatio + oy * slantRatio) * speed;
    vz = (nz * fallRatio + oz * slantRatio) * speed;

  } else {
    /* -------------------------------------------------------
        ★ 70% → 大楕円を描く本物のスイングバイ
       ------------------------------------------------------- */
    // 脱出速度の 75%〜92%（ランダム）の速度を与えることで、
    // 宇宙へ逃げ切る一歩手前の「超長大な楕円軌道」を自動生成する
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
   * ★ リアル彗星のカラーリング（ジカルボン蛍光発光・個体差アジャスト）
   * ------------------------------------------------------- */
  // 現実の頭部（コマ）を支配する516nm付近の青緑〜エメラルドグリーンを完全再現。
  // G（緑）を高輝度（220〜255）にロックし、RとBを絶妙に揺らすことで、
  // 「白みがかった淡い緑」から「神秘的なディープシアン」までの個体差を安全に創出。
  const rColor = Math.floor(40  + Math.random() * 80);  // 40 〜 120 （緑を引き立てる隠し味）
  const gColor = Math.floor(220 + Math.random() * 35);  // 220 〜 255（ジカルボンの圧倒的支配項）
  const bColor = Math.floor(140 + Math.random() * 80);  // 140 〜 220（シアン・青緑へのグラデーション幅）
  const cometColor = `rgb(${rColor}, ${gColor}, ${bColor})`;

  bodies.push({
    x, y, z,
    vx, vy, vz,
    mass,
    size: coreSize,
    color: cometColor,
    type: "comet",
    name: "Comet" + bodies.filter(b => b.type === "comet").length,
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
    // 👍 日本語が「停止 (Q)」なら、英語も「PAUSE (Q)」に整列させておくと完璧
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
    // 3. ターン数の巻き戻しとUI更新（あなたのコードをそのまま活かす）
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
  // これでリセット直後にセーブデータをロードされても、指定した速度が絶対に維持される！
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
  // (スイングバイ外積計算ロジック...)
}
}



/* ========================================================
   宇宙管制盤：軌跡レンダリング独立制御マトリクス（完全版）
======================================================== */

// 1. 太陽軌跡ボタン：自分のことだけを考える
// 1. 太陽軌跡ボタン：他の天体と同じ規律で純粋にトグルする
sunTrailBtn.onclick = () => {
  // 「Only」という排他フラグをやめ、シミュレーション状態のフラグをピュアに反転させる
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
  // ※彗星用の内部フラグ（例: settings.showCometTrail）に合わせて
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
    // ユーザーがチェックを入れたら true、外したら false。データとUIの完全なる規律の一致
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
  simulationState.ui.showSunTrail = !simulationState.ui.showSunTrail;
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
// ★追加: selectタグなので input ではなく change イベントで取得
if (spawnDirection) spawnDirection.onchange = e => settings.spawnSettings.direction = e.target.value;

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
  // 💡 針のエンジンで計算され、天体に記憶された「渋い離心率カラー」を直撃ロード！
  // まだ針の計算が走っていない初期フレーム等のフォールバックとして、上品なインディゴブルーを配備。
  const finalColor = b.eccColor || "#ffffff";

  return finalColor;
}


/* ============================
   軌跡・軌道判定（サーモグラフィ完全統合版）
============================ */
function updateTrails(dt) {
  const sun = bodies[0];
  if (!sun) return;

  // グローバル定数Gの安全な確保（エラー防止ガード）
  const currentG = (typeof G !== 'undefined') ? G : (settings.G || 1.0);

  for (let b of bodies) {
    const sx = b.x - sun.x;
    const sy = b.y - sun.y;
    const sz = b.z - sun.z;
    const distFromSun = Math.sqrt(sx*sx + sy*sy + sz*sz);
    b.distance = distFromSun;

    // 1. 描画カラーの事前サンプリング（サーモグラフィを最優先規律へアライメント）
    if (b.name !== "Sun") {
      b.drawColor = getThermalColor(b, 150.0);
    } else {
      b.drawColor = "rgba(255, 255, 255, 0.9)"; // 太陽は常に白
    }

    // 2. 周回判定（軌道エネルギー計算）
    if (b.name !== "Sun") {
      if (b.isOrbiting === undefined) b.isOrbiting = false;

      const r2 = sx*sx + sy*sy + sz*sz + settings.eps2;
      const r = Math.sqrt(r2);

      const dvx = b.vx - sun.vx;
      const dvy = b.vy - sun.vy;
      const dvz = b.vz - sun.vz;
      const v2 = dvx*dvx + dvy*dvy + dvz*dvz;

      const E = 0.5 * v2 - (currentG * settings.gravityMultiplier * sun.mass) / r;

      if (!b.isOrbiting && E < 0) b.isOrbiting = true;

      if (b.type !== "comet" && !b.isOrbiting) {
        b.trail = [];
      }
    } else {
      b.isOrbiting = true;
    }




// =====================================================================
    // 🛰️ 【観察者心理同期型：動的トレイルアジャスター】
    // =====================================================================
   let densityMultiplier = 1.0;
    const count = bodies.length;

    if (count >= 300) {
      densityMultiplier = 0.3;
    } else {
      densityMultiplier = 1.0;
    }

    // 3. 軌跡の長さ（limit）の決定
    let limit;
    if (b.name === "Sun") {
      limit = 2000 * settings.trailLengthMultiplier * densityMultiplier;
    } else if (b.isOrbiting) {
      limit = 800 * settings.trailLengthMultiplier * densityMultiplier;
    } else {
      limit = Math.min(
        600 * settings.trailLengthMultiplier * densityMultiplier,
        Math.max(40, Math.sqrt(distFromSun) * 8 * settings.trailLengthMultiplier * densityMultiplier)
      );
    }

   // 4. ハイブリッドデータ構造への格納
    if (!b.trail) b.trail = [];

    const rCurrent = rotate3D(b);
    const prCurrent = project3D(rCurrent.x, rCurrent.y, rCurrent.z);

    b.trail.push({
      wx: b.x, wy: b.y, wz: b.z,
      sx: prCurrent.x, sy: prCurrent.y
    });

    // 👑【動的軌跡リミッター】天体数に応じて過去の記憶保持数を自動伸縮！
    const totalCount = bodies.length;
    let maxTrailLength = 500; // 🎯 天体が少ない時のオリジナルの長さ（本来のゆったりした軌跡）

    if (totalCount > 3000) {
      maxTrailLength = 10;   // 3000個超：超極小（毛玉爆発を強力ガード）
    } else if (totalCount > 1500) {
      maxTrailLength = 25;   // 1500個超：短め
    } else if (totalCount > 500) {
      maxTrailLength = 50;   // 500個超：中くらい
    }

    // 決定した上限値で古い過去記憶をパージ
    while (b.trail.length > maxTrailLength) {
      b.trail.shift();
    }


    // =====================================================================
    // 少ない星を詳細に観察するための絶対規律
    // =====================================================================
   // 観察者心理とクリアな視認性の両立を目指す新しい規律
    if (count <= 15) {
      if (b.isOrbiting) {
        limit = 800;
      } else {
        limit = Infinity;
      }
    }

    // 制限を基準に、古い軌跡をシフトアウト
    while (b.trail.length > limit) b.trail.shift();
  }
} // ── ここで updateTrails が完璧に閉じ、余分な化石カッコを完全にパージ！

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

// ★追加: もし設定が存在しなければ "chaos" を初期値として補填しつつUIに反映
  const dirEl = document.getElementById("spawnDirection");
  if (dirEl) {
    if (!settings.spawnSettings.direction) settings.spawnSettings.direction = "chaos";
    dirEl.value = settings.spawnSettings.direction;
  }

const nbodyThreshold = document.getElementById("nbodyThreshold");
if (nbodyThreshold) {
  nbodyThreshold.oninput = e => {
    settings.fullGravityThreshold = Math.max(1, Number(e.target.value));
  };
}


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
   1. メイン描画コントロール（自動順応・段階的軽量化対応版）
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
  // 【第4階層】システムHUD
  // ---------------------------------------------------------
  drawGravityCenterOfTop2(sortedBodies);

  if (isDeveloperHUDActive) {
    drawScreenHUD();
  }
}



/**
 * 天体の3D角運動量を物理的に正しく計算し、完全追従するリアル3Dベクトル描画
 * 👑【テキスト動的スキップ対応版】
 */
function drawAngularMomentumVectorDirect2D(b, sun, pr, hideText = false) {
  if (!b || !sun || !pr || isNaN(pr.x) || isNaN(pr.y)) return;

  const SENSITIVITY  = 1.5;
  const MIN_LENGTH   = 0;
  const MAX_LENGTH   = 1000;

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

  const mag = Math.sqrt(Lx*Lx + Ly*Ly + Lz*Lz);
  if (mag === 0 || isNaN(mag)) return;

  let dynamicScale = Math.sqrt(mag) * SENSITIVITY;
  dynamicScale = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, dynamicScale));

  const nx = (Lx / mag) * dynamicScale;
  const ny = (Ly / mag) * dynamicScale;
  const nz = (Lz / mag) * dynamicScale;

  // 3D空間の投影
  const bRot = rotate3D({ x: b.x, y: b.y, z: b.z });
  const vRot = rotate3D({ x: b.x + nx, y: b.y + ny, z: b.z + nz });

  const pBase = project3D(bRot.x, bRot.y, bRot.z);
  const pTip  = project3D(vRot.x, vRot.y, vRot.z);

  if (!pBase.visible || !pTip.visible) return;

  const dx = pTip.x - pBase.x;
  const dy = pTip.y - pBase.y;

  const startX = pr.x;
  const startY = pr.y;
  const endX = startX + dx;
  const endY = startY + dy;

  // 離心率(e)のリアルタイム計算
  const r_len = Math.sqrt(rx*rx + ry*ry + rz*rz);
  let ecc = 0;
  if (r_len > 0) {
    const v2 = vx*vx + vy*vy + vz*vz;
    const r_dot_v = rx*vx + ry*vy + rz*vz;
    const mu = (typeof G !== "undefined" ? G : 1) * (sun.mass || 1500);

    const ex = (v2 * rx - r_dot_v * vx) / mu - rx / r_len;
    const ey = (v2 * ry - r_dot_v * vy) / mu - ry / r_len;
    const ez = (v2 * rz - r_dot_v * vz) / mu - rz / r_len;
    ecc = Math.sqrt(ex*ex + ey*ey + ez*ez);
  }

  // 離心率カラー
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
 * ★【九龍城・立体座標完全同期 ＆ トグル主権絶対復権版】
 */
function drawGravityCenterOfTop2(passedSortedBodies) {
  if (!window.showBarycenter) return;
  if (!passedSortedBodies || passedSortedBodies.length === 0) return;

  // 1. 質量を持った生存ノードのみを完全にフィルタリング
  const allValidNodes = [...passedSortedBodies]
    .filter(item => item && item.b)
    .map(item => {
      const m = parseFloat(item.b.mass !== undefined ? item.b.mass : (item.b.m !== undefined ? item.b.m : 0));
      return { item, m };
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
    const m = allValidNodes[i].m;
    if (!node || m <= 0 || isNaN(m)) continue;

    let rx = 0, ry = 0, rz = 0;
        // 👑 どんなオブジェクト構造が来ても絶対に死なない座標抽出マトリクス
    if (node.r && typeof node.r.x === 'number' && !isNaN(node.r.x)) { rx = node.r.x; ry = node.r.y; rz = node.r.z; }
    else if (typeof node.rx === 'number' && !isNaN(node.rx)) { rx = node.rx; ry = node.ry; rz = node.rz; }
    else if (typeof node.x === 'number' && !isNaN(node.x)) { rx = node.x; ry = node.y; rz = node.z; }
    // ── 🛡️【完全アライメント】body.x ではなく、構造体の実体である node.b.x へ厳格に修正 ──
    else if (node.b && typeof node.b.x === 'number' && !isNaN(node.b.x)) { rx = node.b.x; ry = node.b.y; rz = node.b.z; }
    else { continue; }

    sumMx += m * rx;
    sumMy += m * ry;
    sumMz += m * rz;
    totalMass += m;

    if (!isAllMode) {
      targetNodes.push({ body: node.b, rx: rx, ry: ry, rz: rz, mass: m });
    }
  }

  if (totalMass <= 0 || isNaN(totalMass)) return;

  const rotatedBaryX = sumMx / totalMass;
  const rotatedBaryY = sumMy / totalMass;
  const rotatedBaryZ = sumMz / totalMass;

  // 3. スクリーンへの透視投影
  const ppBary = project3D(rotatedBaryX, rotatedBaryY, rotatedBaryZ);
  if (!ppBary || isNaN(ppBary.x) || isNaN(ppBary.y)) return;

  const zScale = ppBary.scaleFactor * 0.5;
  ctx.save();

  // ドットライン（全天体モード時は完全非表示）
  if (!isAllMode) {
    ctx.strokeStyle = "rgba(0, 255, 192, 0.6)";
    ctx.lineWidth = Math.max(0.5, 1.5 * zScale);
    ctx.setLineDash([3 * zScale, 3 * zScale]);
    for (let i = 0; i < targetNodes.length; i++) {
      const node = targetNodes[i];
      const ppNode = project3D(node.rx, node.ry, node.rz);
      if (ppNode && !isNaN(ppNode.x) && !isNaN(ppNode.y)) {
        ctx.beginPath(); ctx.moveTo(ppBary.x, ppBary.y); ctx.lineTo(ppNode.x, ppNode.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // 4. 精密照準レティクルのスタンプ（全天体時は紫色の超巨大変調）
  const baseSize = isAllMode ? 48 : 16;
  const minSize  = isAllMode ? 24 : 4;
  const size = Math.max(minSize, baseSize * zScale);
  ctx.strokeStyle = isAllMode ? "#ff00ff" : "#ffff00";
  ctx.lineWidth = isAllMode ? 4 : Math.max(1, 3 * zScale);

  ctx.beginPath();
  ctx.moveTo(ppBary.x - size, ppBary.y); ctx.lineTo(ppBary.x + size, ppBary.y);
  ctx.moveTo(ppBary.x, ppBary.y - size); ctx.lineTo(ppBary.x, ppBary.y + size);
  ctx.stroke();

  ctx.lineWidth = isAllMode ? 2 : Math.max(1, 2 * zScale);
  ctx.beginPath(); ctx.arc(ppBary.x, ppBary.y, isAllMode ? 14 : Math.max(2, 7 * zScale), 0, Math.PI * 2); ctx.stroke();

  // 5. HUDデータ計器盤へのテキスト安全射出
  const elName = document.getElementById("barycenterNameDisplay");
  const elPos  = document.getElementById("barycenterPosDisplay");
  const elMass = document.getElementById("barycenterMassDisplay");

// ── 5. HUDデータ計器盤（DOM）へのテキスト安全射出（質量復旧版） ──
  if (elName) {
    elName.textContent = isAllMode ? `Barycenter (All-Body System Total): ${n} Active Stars Locked` : `Barycenter (${n}-Body): ` + targetNodes.map(n => n.body.name || "Unknown").join(" + ");
  }
    if (elPos) {
    let trueZ = rotatedBaryZ;
    if (trueZ > 1000) { trueZ -= 1200; } // Z軸カメラオフセット・パージの規律を維持
    elPos.textContent = `Barycenter Pos: X:${rotatedBaryX.toFixed(1)} Y:${rotatedBaryY.toFixed(1)} Z:${trueZ.toFixed(1)}`;
  }
    if (elMass) {
    // 🛡️【完全復旧配線】
    // 画面側の「Barycenter Mass: 」のラベルに同期するよう、現在ロックしている天体たちの総質量（totalMass）をダイレクトに射出！
    // 同時に、どの星が算入されているかのマトリクス文字列（names）も後ろに結合して視認性をブーストします。
    if (isAllMode) {
      elMass.textContent = `Barycenter Mass: ${totalMass.toFixed(1)} (System Total)`;
    } else {
      const massDetails = targetNodes.map(n => `${n.body.name || "Star"}:${n.mass.toFixed(1)}`).join(" / ");
      elMass.textContent = `Barycenter Mass: ${totalMass.toFixed(1)} [ ${massDetails} ]`;
    }
  }

  ctx.restore();
}

/**
 * 天体の3Dパースペクティブおよび対数スケーリングを適用した画面サイズを返す
 * 👑【完全修正】b.renderSize（描画演出サイズ）を優先参照し、物理サイズ(b.size)と完全分離！
 */
function calculateScreenSize(b, pr) {
  const depth = pr.depth || 1;

  // 1. 太陽（Sun）の固定描画サイズ
  if (b.name === "Sun") {
    const sunBaseSize = 25.0;
    return Math.max(4.0, (sunBaseSize * camera.zoom) / depth);
  }

  // 2. Goliath（巨大天体）の固定描画サイズ
  if (b.name === "Goliath" || b.mass >= (settings.sunMass || 1500) * 0.9) {
    const goliathBaseSize = 20.0;
    return Math.max(4.0, (goliathBaseSize * camera.zoom) / depth);
  }

  // 3. 一般天体（Obj / Comet）：renderSize（演出用半径）を最優先参照！
  // renderSize が設定されている場合は、質量対数スケールに代わって描画演出サイズをダイレクトに反映
  const baseVisualSize = (b.renderSize !== undefined) ? b.renderSize : (b.size || 1.0);
    // 質量による対数補正（質量の重量感を少し乗せる）
  const logScale = 1.2 * Math.log10((b.mass || 1) + 1) + baseVisualSize;
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

  // 天体の質量をシード値にして、色相にわずかな個体差（多様性）を与える
  const variety = (b.mass ? Math.floor(b.mass * 123) % 20 : 0) - 10;

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
// 👑 【完全防御】極小モード（isMinimalMode）または 天体数が2000超のときは軌跡を絶対に描画しない！
  if (bodies.length > 2000 || simulationState?.ui?.vectorFieldOnly) return;

const isPlanet = simulationState.ui.showPlanetTrail && b.type !== "comet" && b.name !== "Sun" && b.trail && b.trail.length > 2;
  const isComet = simulationState.ui.showCometTrail && b.type === "comet" && b.trail && b.trail.length > 2;
  const isSun = simulationState.ui.showSunTrail && b.name === "Sun" && b.trail && b.trail.length > 2;

  if (!isPlanet && !isComet && !isSun) return;

  const totalPoints = b.trail.length;
  const center = getTargetCenterOffset();

  ctx.save();

  // 線の基本スタイル設定
  if (isPlanet) {
    const baseWidth = b.isOrbiting ? 1.2 : 0.8;
    ctx.lineWidth = baseWidth * (0.1 + camera.zoom * 0.15);
    ctx.strokeStyle = b.drawColor || trailColor;
  } else if (isComet) {
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = b.color || "#00ffff";
  } else if (isSun) {
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  }

  // 軌跡の描画ループ（毎フレーム安全にカメラ変換を行う）
  for (let i = 0; i < totalPoints - 1; i++) {
    const p1 = b.trail[i];
    const p2 = b.trail[i + 1];

    if (!p1 || !p2) continue;

    // 太陽相対座標の計算
    const relX1 = p1.wx - center.x;
    const relY1 = p1.wy - center.y;
    const relZ1 = p1.wz - center.z;

    const relX2 = p2.wx - center.x;
    const relY2 = p2.wy - center.y;
    const relZ2 = p2.wz - center.z;

    // 3D回転 ＆ スクリーン投影
    const rp1 = rotate3D({ x: relX1, y: relY1, z: relZ1 });
    const prp1 = project3D(rp1.x, rp1.y, rp1.z);

    const rp2 = rotate3D({ x: relX2, y: relY2, z: relZ2 });
    const prp2 = project3D(rp2.x, rp2.y, rp2.z);

    // カメラの背後に隠れている点は描画スキップ
    if (!prp1.visible || !prp2.visible) continue;

    // 時間経過に応じたフェードアウト
    const progress = i / totalPoints;
    ctx.globalAlpha = progress;

    ctx.beginPath();
    ctx.moveTo(prp1.x, prp1.y);
    ctx.lineTo(prp2.x, prp2.y);
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

    ctx.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.25 * fade})`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, (1 + visualSize * 2) * (1 - t), 0, Math.PI * 2);
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
 * HUD・個別天体ラベル描画（背後に半透明の黒幕を敷く視認性改善＆未来予知統合版）
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
    label += " [STB]"; // 安定周回バインド
  }

  // =====================================================================
  // 🛰️ 【タクティカルHUD：未来予知の視覚執行】
  // =====================================================================
  if (b.willCollide && b.timeToCollision !== undefined) {
    label += ` [⚠️ COLLISION: ${b.timeToCollision.toFixed(1)}s]`;
  }

  const textWidth = ctx.measureText(label).width;
  const lx = pr.x + screenSize + 4;
  const ly = pr.y - 2;

  // ★プロのHUD視認性改善：座布団のサイズを16pxへ拡張し、下方向への文字はみ出しを完全防空！
  // 12pxのフォントに対し、上下に2pxずつの極上の余白を確約する規律。
  if (b.willCollide) {
    ctx.fillStyle = "rgba(255, 0, 50, 0.25)"; // ⚠️ 衝突寸前の天体は座布団を「警告の薄赤」へ緊急変色！
  } else {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";    // 通常時の静寂の黒
  }
  ctx.fillRect(lx - 2, ly - 12, textWidth + 4, 16);

  // 文字本体の描画カラーマッピング
  if (b.willCollide) {
    ctx.fillStyle = "#ff3344"; // 烈火のネオンレッド
  } else {
    ctx.fillStyle = "white";    // 通常ホワイト
  }
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
  const fontSize = 14;
  ctx.font = `${fontSize}px 'Consolas', 'Courier New', monospace`;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
    const pX = 20;                        // 左端マージン
  let currentY = fontSize + 20;         // 開始Y座標
  const lineHeight = Math.round(fontSize * 1.45); // 動的行間
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
  currentY += Math.round(lineHeight * 0.5);

  const simTime = getDOMText("statSimTime");
  if (simTime && simTime.trim() !== "") {
    ctx.fillStyle = "#00ffff"; // 宇宙年齢：鮮烈シアン
    ctx.fillText(simTime, pX, currentY); currentY += lineHeight;
  }

 const runTime = getDOMText("statRunTime");
  if (runTime && runTime.trim() !== "") {
    ctx.fillStyle = "#ffaa00"; // 稼働時間：アンバー
    ctx.fillText(runTime + " (Min)", pX, currentY); currentY += lineHeight;
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

  // （あとは同じように wx, wy, wz を計算して push するだけ）

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
            // 🌟【重要アジャスト】引数の「element」と完全に名前を同期させて、離脱バグを完全パージ！
            if (!element) break;

            // ① 現在のステージを取得（0: OFF, 2: 2体, 3: 3体, 4: 4体, 8: 8体, 15: 15体）
            let currentStage = parseInt(element.getAttribute("data-bary-stage")) || 0;

            // ② ステージのローテーション（0 ➔ 2 ➔ 3 ➔ 4 ➔ 8 ➔ 15 ➔ 0）
            if (currentStage === 0) {
                currentStage = 2;
                window.showBarycenter = true;
                window.barycenterTargetCount = 2;
                element.classList.add("toggle-on");
                element.classList.remove("toggle-off");
            } else if (currentStage === 2) {
                currentStage = 3;
                window.barycenterTargetCount = 3;
            } else if (currentStage === 3) {
                currentStage = 4;
                window.barycenterTargetCount = 4;
            } else if (currentStage === 4) {
                // 🌟 楽しさをブースト：中規模の覇権を握る「8体モード」を新設！
                currentStage = 8;
                window.barycenterTargetCount = 8;
            } else if (currentStage === 8) {
                // 🌟 本命：統治者が最も愛する「15体同時連動モード」へ！
                currentStage = 15;
                window.barycenterTargetCount = 15;
            } else {
                // 🌟 15体の極致を見たあと、カチッと押すと美しくOFF（0）へ帰還する
                currentStage = 0;
                window.showBarycenter = false;
                element.classList.add("toggle-off");
                element.classList.remove("toggle-on");
            }

            // ③ 属性の更新（targetElement ➔ element へ修正）
            element.setAttribute("data-bary-stage", currentStage.toString());

            // ④ 画面のボタンテキストを言語環境に合わせて動的強制変調（アライメント）
            const isJapanese = (document.getElementById("toggleLangBtn")?.innerText.includes("EN") === false);
            if (currentStage === 0) {
                element.innerText = isJapanese ? "重心: 全閉" : "BARY: OFF";
            } else {
                element.innerText = isJapanese ? `重心: ${currentStage}天体` : `BARY: ${currentStage}-BODY`;
            }

            console.log(`%c [重心幾何調律] モード変更 ──> Stage:${currentStage} (算出算入数: ${window.barycenterTargetCount}天体) / 表示フラグ: ${window.showBarycenter}`, "color: #00ffcc; font-weight: bold;");
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
 * 「周回軌道上の P/A」・「面積速度ピザ」・「エネルギー相互変換(K/U)」を描画する
 */
function drawLVecAreaRadar(bodies, sun, targetHistory) {
  if (!sun || bodies.length <= 1) return;

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

  if (!target) return;

 // ── 2. 🌌 真の近日点(P)・遠日点(A)のリアルタイム判定と固定 ──
  const curDx = target.x - sun.x;
  const curDy = target.y - sun.y;
  const curDz = target.z - sun.z;
  const curR = Math.sqrt(curDx * curDx + curDy * curDy + curDz * curDz);

  // 🛡️ トラック中の最大距離（遠日点スケール）を保持して、P点の誤作動を防ぐ
  if (!target.maxObservedR || curR > target.maxObservedR) {
    target.maxObservedR = curR;
  }

  if (target.lastR !== undefined) {
    const isApproaching = curR < target.lastR;

    // ① 近日点 P のピン留め（近づいていた状態から遠ざかり始めた瞬間）
    if (target.wasApproaching && !isApproaching) {
      // 👑 遠日点スケールの半分より内側にいる時だけ「本物の P 点」と認める！
      // これにより、遠日点付近での微小ノイズによる P 点の化けを 100% 遮断します。
      const safeThreshold = target.maxObservedR * 0.5;
      if (curR <= safeThreshold) {
        target.periPoint = {
          x: target.x, y: target.y, z: target.z,
          sunX: sun.x, sunY: sun.y, sunZ: sun.z
        };
      }
    }

    // ② 遠日点 A のピン留め（遠ざかっていた状態から近づき始めた瞬間）
    if (!target.wasApproaching && isApproaching) {
      // 制限なし！遠日点は素直に記録・更新する
      target.aphoPoint = {
        x: target.x, y: target.y, z: target.z,
        sunX: sun.x, sunY: sun.y, sunZ: sun.z
      };
      // 遠日点が確定したら最大距離の基準を最新値に更新
      target.maxObservedR = curR;
    }

    target.wasApproaching = isApproaching;
  } else {
    target.wasApproaching = true;
  }
  target.lastR = curR;

  // ── 履歴の更新（ピザ描画用） ──
  if (targetHistory.length > 0) {
    const last = targetHistory[targetHistory.length - 1];
    if (last.x !== target.x || last.y !== target.y || last.z !== target.z) {
      targetHistory.push({
        x: target.x, y: target.y, z: target.z,
        sunX: sun.x, sunY: sun.y, sunZ: sun.z
      });
    }
  } else {
    targetHistory.push({
      x: target.x, y: target.y, z: target.z,
      sunX: sun.x, sunY: sun.y, sunZ: sun.z
    });
  }

  if (targetHistory.length > 300) targetHistory.shift();

  ctx.save();

  // ── 3. 🍕 ネオンピザ残像の描画 ──
  if (targetHistory.length >= 10) {
    for (let i = 1; i < targetHistory.length; i++) {
      const prev = targetHistory[i - 1];
      const curr = targetHistory[i];

      const sunRot  = rotate3D({ x: curr.sunX, y: curr.sunY, z: curr.sunZ });
      const prevRot = rotate3D({ x: prev.x,    y: prev.y,    z: prev.z });
      const currRot = rotate3D({ x: curr.x,    y: curr.y,    z: curr.z });

      const pSun  = project3D(sunRot.x,  sunRot.y,  sunRot.z);
      const pPrev = project3D(prevRot.x, prevRot.y, prevRot.z);
      const pCurr = project3D(currRot.x, currRot.y, currRot.z);

      if (!pSun.visible || !pPrev.visible || !pCurr.visible) continue;

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

  // ── 4. 🔴/🔵 固定された「周回軌道上の P 点 / A 点」を描画 ──
  if (target.periPoint) {
    const rotP = rotate3D({ x: target.periPoint.x, y: target.periPoint.y, z: target.periPoint.z });
    const pProj = project3D(rotP.x, rotP.y, rotP.z);
    if (pProj.visible) {
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(pProj.x, pProj.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 68, 0, 0.95)";
      ctx.font = "bold 9px monospace";
      const pText = `P(${target.periPoint.x.toFixed(0)}, ${target.periPoint.y.toFixed(0)}, ${target.periPoint.z.toFixed(0)})`;
      ctx.fillText(pText, pProj.x + 6, pProj.y - 3);
    }
  }

  if (target.aphoPoint) {
    const rotA = rotate3D({ x: target.aphoPoint.x, y: target.aphoPoint.y, z: target.aphoPoint.z });
    const aProj = project3D(rotA.x, rotA.y, rotA.z);
    if (aProj.visible) {
      ctx.fillStyle = "#00d5ff";
      ctx.beginPath();
      ctx.arc(aProj.x, aProj.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0, 213, 255, 0.85)";
      ctx.font = "9px monospace";
      const aText = `A(${target.aphoPoint.x.toFixed(0)}, ${target.aphoPoint.y.toFixed(0)}, ${target.aphoPoint.z.toFixed(0)})`;
      ctx.fillText(aText, aProj.x + 6, aProj.y - 3);
    }
  }

  // ── 5. 📊 リアルタイム HUD パネル（エネルギー流転ゲージ統合版） ──
  const lockRot = rotate3D({ x: target.x, y: target.y, z: target.z });
  const pLock = project3D(lockRot.x, lockRot.y, lockRot.z);

  if (pLock.visible && targetHistory.length >= 2) {
    const curr = targetHistory[targetHistory.length - 1];
    const prev = targetHistory[targetHistory.length - 2];

    const rx = curr.x - curr.sunX;
    const ry = curr.y - curr.sunY;
    const rz = curr.z - curr.sunZ;
    const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;

    const vx = curr.x - prev.x;
    const vy = curr.y - prev.y;
    const vz = curr.z - prev.z;
    const vMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

    const cx = ry * vz - rz * vy;
    const cy = rz * vx - rx * vz;
    const cz = rx * vy - ry * vx;
    const areaVelocity = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);

    // ⚡【エネルギー相互変換の数値計算】
    const m = target.mass || 1.0;
    const gConst = (typeof G !== "undefined") ? G : 0.5;
    const sunM = sun.mass || 2000.0;

    const K = 0.5 * m * (vMag * vMag);               // 運動エネルギー
    const U_abs = (gConst * sunM * m) / rMag;        // 位置エネルギー（絶対値）
    const totalE_abs = K + U_abs || 1;
    const kRatio = Math.min(1, Math.max(0, K / totalE_abs)); // 運動エネルギーの比率 (0.0 ~ 1.0)

    const displayName = target.name || "INNER";
    const panelX = pLock.x + 8;
    let panelY = pLock.y + 12;

    // 📡 パネル枠サイズ（高さ88pxへ拡張し、エネルギーゲージを格納）
    const panelWidth = 170;
    const panelHeight = 88;
    ctx.fillStyle = "rgba(0, 15, 8, 0.85)";
    ctx.fillRect(panelX - 2, panelY - 8, panelWidth, panelHeight);
    ctx.strokeStyle = "rgba(0, 255, 136, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 2, panelY - 8, panelWidth, panelHeight);

    // ① 天体名
    ctx.fillStyle = "rgba(0, 255, 136, 0.9)";
    ctx.font = "9px monospace";
    ctx.fillText(`${displayName} [TRACKING]`, panelX, panelY);

    // ② 距離 r ＆ 速度 v
    ctx.fillText(`r:${rMag.toFixed(1)}  v:${vMag.toFixed(2)}`, panelX, panelY += 11);

    // ③ 面積速度 dS/dt (CONST)
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`dS/dt : ${areaVelocity.toFixed(2)} [CONST]`, panelX, panelY += 13);

    // ④ 現在の立体進行座標 (XYZ)
    ctx.fillStyle = "rgba(0, 255, 136, 0.65)";
    ctx.font = "8px monospace";
    ctx.fillText(`POS: (${curr.x.toFixed(0)}, ${curr.y.toFixed(0)}, ${curr.z.toFixed(0)})`, panelX, panelY += 11);

    // ⑤ 近日点 P / 遠日点 A 座標
    ctx.fillStyle = "rgba(255, 100, 50, 0.85)";
    const pStr = target.periPoint ? `P(${target.periPoint.x.toFixed(0)},${target.periPoint.y.toFixed(0)},${target.periPoint.z.toFixed(0)})` : `P(--, --, --)`;
    ctx.fillText(pStr, panelX, panelY += 10);

    ctx.fillStyle = "rgba(0, 213, 255, 0.85)";
    const aStr = target.aphoPoint ? `A(${target.aphoPoint.x.toFixed(0)},${target.aphoPoint.y.toFixed(0)},${target.aphoPoint.z.toFixed(0)})` : `A(--, --, --)`;
    ctx.fillText(aStr, panelX, panelY += 10);

    // ⑥ ⚡【新規追加】エネルギー相互変換（K vs U）デュアルバー
    panelY += 12;
    const barWidth = 150;
    const barHeight = 4;
    const kWidth = barWidth * kRatio;

    // バー背景（位置エネルギー U: シアン/ブルー）
    ctx.fillStyle = "rgba(0, 150, 255, 0.6)";
    ctx.fillRect(panelX, panelY, barWidth, barHeight);

    // バー前景（運動エネルギー K: 烈火のオレンジ/レッド）
    ctx.fillStyle = "#ff3300";
    ctx.fillRect(panelX, panelY, kWidth, barHeight);

    // バー枠線
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.strokeRect(panelX, panelY, barWidth, barHeight);

    // エネルギー比率テキストラベル
    ctx.fillStyle = "#ffffff";
    ctx.font = "7px monospace";
    ctx.fillText(`ENG [K:${(kRatio * 100).toFixed(0)}% | U:${((1 - kRatio) * 100).toFixed(0)}%]`, panelX, panelY - 2);
  }

  ctx.restore();
}

// 🎯 現在名指しされているターゲット名（グローバルで保持）
window.selectedTargetName = "AUTO";

document.addEventListener("DOMContentLoaded", () => {
  // 1. 既存の L-VEC ボタンの切り替え処理（JS委任）
  const momentumBtn = document.getElementById("toggle-momentum-btn");
  if (momentumBtn) {
    momentumBtn.addEventListener("click", () => {
      // 0 -> 1 -> 2 -> 0 のサイクリック切替え（例）
      window.lVecMode = ((window.lVecMode || 0) + 1) % 3;
            // ボタンのクラス（ON/OFF見た目）の連動
      if (window.lVecMode === 0) {
        momentumBtn.className = "toggle-off";
      } else {
        momentumBtn.className = "toggle-on";
      }
      console.log("[L-VEC MODE]:", window.lVecMode);
    });
  }

  // 2. 名指しテキストボックス ＆ LOCKボタンの処理（JS委任）
  const targetInput = document.getElementById("targetInput");
  const targetBtn = document.getElementById("targetBtn");

 const applyTargetLock = () => {
    if (!targetInput) return;
    const val = targetInput.value.trim();
        if (val === "" || val.toUpperCase() === "AUTO") {
      window.selectedTargetName = "AUTO";
      targetInput.value = "AUTO";
    } else {
      // ユーザーが入力した文字をそのまま保持（検索側で大文字小文字を吸収します）
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

// === LVEC(V） ===
    case "v":
      safeClick("toggle-momentum-btn");
      break;


  }
});



loop();
