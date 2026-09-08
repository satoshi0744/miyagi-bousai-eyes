/**
 * みやぎライブEyes - クイックガイドツアー（動く自動スライド）コントローラー
 * 4ステップの自動送り・プログレスバー・一時停止・手動ナビゲーションを制御
 */
(function() {
  'use strict';

  const TOTAL_SLIDES = 4;
  const SLIDE_DURATION_MS = 5500; // 1スライドの表示時間（5.5秒）
  const TICK_INTERVAL_MS = 50;

  let currentSlide = 1;
  let isPlaying = true;
  let isHoverPaused = false;
  let progressMs = 0;
  let timerId = null;

  // ガイドモーダルのHTMLテンプレート
  const GUIDE_HTML = `
  <div class="modal-overlay guide-modal-overlay" id="guide-modal-overlay">
    <div class="modal-content guide-modal-content">
      <div class="guide-modal-header">
        <div class="guide-modal-title">
          <i class="fa-solid fa-graduation-cap" style="color: #38bdf8;"></i> みやぎライブEyes クイックガイド
        </div>
        <button class="modal-close" id="guide-modal-close" aria-label="閉じる">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- プログレスインジケーター（4分割バー） -->
      <div class="guide-progress-container" id="guide-progress-container">
        <div class="guide-progress-bar" data-step="1"><div class="guide-progress-fill" id="guide-fill-1"></div></div>
        <div class="guide-progress-bar" data-step="2"><div class="guide-progress-fill" id="guide-fill-2"></div></div>
        <div class="guide-progress-bar" data-step="3"><div class="guide-progress-fill" id="guide-fill-3"></div></div>
        <div class="guide-progress-bar" data-step="4"><div class="guide-progress-fill" id="guide-fill-4"></div></div>
      </div>

      <!-- スライド領域 -->
      <div class="guide-slides-wrapper" id="guide-slides-wrapper">
        
        <!-- スライド 1: 川の流れ順 ＆ 水系一括登録 -->
        <div class="guide-slide active" data-slide="1">
          <div class="guide-anim-stage">
            <div class="slide1-mock-group">
              <div class="slide1-mock-header">
                <span>🌊 北上川水系（上流 ➡ 下流）</span>
                <span class="slide1-mock-star"><i class="fa-solid fa-star"></i></span>
              </div>
              <div class="slide1-mock-items">
                <div class="slide1-mock-row"><span>📷 登米 130.9km</span><i class="fa-solid fa-star" style="color:#f59e0b;"></i></div>
                <div class="slide1-mock-row"><span>📷 桃生 21.0km</span><i class="fa-solid fa-star" style="color:#f59e0b;"></i></div>
                <div class="slide1-mock-row"><span>📷 釜谷 0.8km（河口）</span><i class="fa-solid fa-star" style="color:#f59e0b;"></i></div>
              </div>
            </div>
            <div class="anim-cursor" style="animation: cursorClickFav 3s infinite ease;">
              <i class="fa-solid fa-arrow-pointer" style="color:#ffffff; font-size:16px;"></i>
            </div>
          </div>
          <div class="guide-text-box">
            <span class="guide-step-badge">STEP 1 / 4</span>
            <h3 class="guide-slide-heading">🌊 川の流れ順 ＆ 水系一括登録</h3>
            <p class="guide-slide-desc">
              カメラはすべて<strong>上流から下流（河口）へ川の流れ順に自動整列</strong>されています。<br>
              水系ヘッダーの「⭐ボタン」を押すだけで、その水系の全カメラを一括してお気に入り登録できます。
            </p>
          </div>
        </div>

        <!-- スライド 2: 自分専用の監視ボード＆ドラッグ並べ替え -->
        <div class="guide-slide" data-slide="2">
          <div class="guide-anim-stage">
            <div class="slide2-mock-grid">
              <div class="slide2-mock-card">
                <div style="font-size:9px; color:#94a3b8;"><i class="fa-solid fa-grip-vertical"></i> 桃生</div>
                <div style="height:35px; background:#0f172a; border-radius:3px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-camera" style="color:#38bdf8; font-size:12px;"></i></div>
              </div>
              <div class="slide2-mock-card slide2-dragged">
                <div style="font-size:9px; color:#38bdf8;"><i class="fa-solid fa-grip-vertical"></i> 釜谷河口</div>
                <div style="height:35px; background:#0f172a; border-radius:3px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-camera" style="color:#f59e0b; font-size:12px;"></i></div>
              </div>
              <div class="slide2-mock-card">
                <div style="font-size:9px; color:#94a3b8;"><i class="fa-solid fa-grip-vertical"></i> 登米</div>
                <div style="height:35px; background:#0f172a; border-radius:3px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-camera" style="color:#38bdf8; font-size:12px;"></i></div>
              </div>
            </div>
          </div>
          <div class="guide-text-box">
            <span class="guide-step-badge">STEP 2 / 4</span>
            <h3 class="guide-slide-heading">📋 自分専用の定点監視ボード</h3>
            <p class="guide-slide-desc">
              お気に入りに登録したカメラだけを大画面グリッドで監視できます。<br>
              カード上部のグリップを掴んで<strong>直感的に自由な配置順へ並べ替え</strong>可能。約10分ごとに自動更新されます。
            </p>
          </div>
        </div>

        <!-- スライド 3: 自由自在なミニマップ -->
        <div class="guide-slide" data-slide="3">
          <div class="guide-anim-stage">
            <div class="slide3-mock-map">
              <div style="padding:4px 6px; background:#1e293b; font-size:9px; color:#e2e8f0; display:flex; justify-content:space-between;">
                <span>現在地マップ</span>
                <i class="fa-solid fa-up-right-from-square" style="color:#f59e0b; font-size:8px;"></i>
              </div>
              <div class="slide3-map-pin"></div>
              <div style="position:absolute; bottom:2px; right:2px; font-size:8px; color:#38bdf8;"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>
            </div>
          </div>
          <div class="guide-text-box">
            <span class="guide-step-badge">STEP 3 / 4</span>
            <h3 class="guide-slide-heading">🗺️ 自由自在なミニマップ</h3>
            <p class="guide-slide-desc">
              お気に入り画面右下のマップは<strong>ドラッグして画面内の好きな位置へ移動・拡大</strong>できます。<br>
              カードに触ると該当ピンが光り、ピンをクリックすると該当カードへ素早くスクロールします。
            </p>
          </div>
        </div>

        <!-- スライド 4: 2画面マルチモニター対応 -->
        <div class="guide-slide" data-slide="4">
          <div class="guide-anim-stage">
            <div class="slide4-parent-screen">
              <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">監視画面（メイン）</div>
              <div style="width:100%; height:45px; background:#0f172a; border-radius:4px; border:1px dashed #38bdf8; display:flex; align-items:center; justify-content:center; font-size:9px; color:#38bdf8;">
                カード群
              </div>
            </div>
            <div class="slide4-child-window">
              <div style="text-align:center;">
                <i class="fa-solid fa-map-location-dot" style="color:#f59e0b; font-size:18px;"></i>
                <div style="font-size:9px; color:#e2e8f0; margin-top:2px;">独立マップ（サブ）</div>
              </div>
            </div>
          </div>
          <div class="guide-text-box">
            <span class="guide-step-badge">STEP 4 / 4</span>
            <h3 class="guide-slide-heading">🖥️ 2画面マルチモニター対応</h3>
            <p class="guide-slide-desc">
              マップヘッダーの「⧉（別窓）」ボタンで<strong>独立ウィンドウとして切り離し</strong>可能！<br>
              サブディスプレイに地図を広げ、親画面とピンが完全双方向連動する広々とした監視環境が実現します。
            </p>
          </div>
        </div>

      </div>

      <!-- コントロールバー -->
      <div class="guide-controls">
        <button class="guide-ctrl-btn" id="guide-toggle-play" title="自動送りの一時停止/再開">
          <i class="fa-solid fa-pause" id="guide-play-icon"></i>
          <span id="guide-play-text">一時停止</span>
        </button>
        <div class="guide-nav-group" style="display: flex; gap: 8px;">
          <button class="guide-nav-btn" id="guide-prev-btn" title="前のスライドへ">
            <i class="fa-solid fa-chevron-left"></i> 前へ
          </button>
          <button class="guide-nav-btn primary" id="guide-next-btn" title="次のスライドへ">
            次へ <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
  `;

  let isInitialized = false;

  // 初期化関数
  function initGuideTour() {
    if (isInitialized) return;
    if (document.getElementById('guide-modal-overlay')) {
      isInitialized = true;
      return;
    }

    const container = document.createElement('div');
    container.innerHTML = GUIDE_HTML;
    document.body.appendChild(container.firstElementChild);
    bindEvents();
    isInitialized = true;
  }

  // イベント登録
  function bindEvents() {
    const modal = document.getElementById('guide-modal-overlay');
    const closeBtn = document.getElementById('guide-modal-close');
    const playBtn = document.getElementById('guide-toggle-play');
    const prevBtn = document.getElementById('guide-prev-btn');
    const nextBtn = document.getElementById('guide-next-btn');
    const progressBars = document.querySelectorAll('.guide-progress-bar');

    if (!modal) return;

    if (closeBtn) closeBtn.addEventListener('click', closeTour);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTour();
    });

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeTour();
      }
    });

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        updatePlayButtonUI();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        goToSlide(currentSlide === 1 ? TOTAL_SLIDES : currentSlide - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        goToSlide(currentSlide === TOTAL_SLIDES ? 1 : currentSlide + 1);
      });
    }

    // プログレスバー直接クリック
    progressBars.forEach(bar => {
      bar.addEventListener('click', () => {
        const step = parseInt(bar.getAttribute('data-step'), 10);
        if (step >= 1 && step <= TOTAL_SLIDES) {
          goToSlide(step);
        }
      });
    });

    // マウスホバー中の自動送り一時停止
    const wrapper = document.getElementById('guide-slides-wrapper');
    if (wrapper) {
      wrapper.addEventListener('mouseenter', () => {
        if (isPlaying) pauseTimer();
      });
      wrapper.addEventListener('mouseleave', () => {
        if (isPlaying) resumeTimer();
      });
    }
  }

  // ツアーを開く（グローバル公開）
  window.openGuideTour = function() {
    initGuideTour();

    // 既存の概要モーダル等が開いていれば閉じる（重複・レイヤー干渉防止）
    const infoModal = document.getElementById('info-modal-overlay');
    if (infoModal) infoModal.classList.remove('active');
    const boardInfoModal = document.getElementById('board-info-modal-overlay');
    if (boardInfoModal) boardInfoModal.classList.remove('active');

    const modal = document.getElementById('guide-modal-overlay');
    if (!modal) return;

    modal.classList.add('active');
    currentSlide = 1;
    isPlaying = true;
    isHoverPaused = false;
    progressMs = 0;
    updatePlayButtonUI();
    renderSlide(currentSlide);
    startTimer();
  };

  // ツアーを閉じる
  function closeTour() {
    const modal = document.getElementById('guide-modal-overlay');
    if (modal) modal.classList.remove('active');
    stopTimer();
  }

  // タイマー開始
  function startTimer() {
    stopTimer();
    progressMs = 0;
    timerId = setInterval(() => {
      if (!isPlaying || isHoverPaused) return;

      progressMs += TICK_INTERVAL_MS;
      const fillEl = document.getElementById(`guide-fill-${currentSlide}`);
      if (fillEl) {
        const percent = Math.min(100, (progressMs / SLIDE_DURATION_MS) * 100);
        fillEl.style.width = `${percent}%`;
      }

      if (progressMs >= SLIDE_DURATION_MS) {
        goToSlide(currentSlide === TOTAL_SLIDES ? 1 : currentSlide + 1);
      }
    }, TICK_INTERVAL_MS);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function pauseTimer() {
    isHoverPaused = true;
  }

  function resumeTimer() {
    isHoverPaused = false;
  }

  // スライドの直接移動
  function goToSlide(slideNum) {
    currentSlide = slideNum;
    progressMs = 0;
    renderSlide(currentSlide);
  }

  // スライドの描画更新
  function renderSlide(slideNum) {
    const slides = document.querySelectorAll('.guide-slide');
    slides.forEach(s => {
      const num = parseInt(s.getAttribute('data-slide'), 10);
      s.classList.toggle('active', num === slideNum);
    });

    // プログレスバーの更新
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const bar = document.querySelector(`.guide-progress-bar[data-step="${i}"]`);
      const fill = document.getElementById(`guide-fill-${i}`);
      if (!bar || !fill) continue;

      if (i < slideNum) {
        bar.classList.add('completed');
        fill.style.width = '100%';
      } else if (i === slideNum) {
        bar.classList.remove('completed');
        fill.style.width = '0%';
      } else {
        bar.classList.remove('completed');
        fill.style.width = '0%';
      }
    }
  }

  function updatePlayButtonUI() {
    const icon = document.getElementById('guide-play-icon');
    const text = document.getElementById('guide-play-text');
    if (!icon || !text) return;

    if (isPlaying) {
      icon.className = 'fa-solid fa-pause';
      text.textContent = '一時停止';
    } else {
      icon.className = 'fa-solid fa-play';
      text.textContent = '再生';
    }
  }

  // DOMContentLoaded時の初期バインド
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGuideTour);
  } else {
    initGuideTour();
  }
})();
