/**
 * みやぎライブEyes - 総合利用ガイド（取扱説明書）モーダルコンポーネント
 * 
 * 初めての利用者の認知プロセスに基づき、
 * 「公的機関の観測網を一元集約し、地域の状況を俯瞰的に一覧で見渡す」という大前提・目的を最上位に据え、
 * 4つの目的別タブで各ツールの役割と操作方法を体系的に解説します。
 */
(function() {
  'use strict';

  const GUIDE_HTML = `
  <div class="modal-overlay system-guide-overlay" id="system-guide-overlay">
    <div class="modal-content system-guide-modal">
      
      <!-- ヘッダー -->
      <div class="system-guide-header">
        <div class="system-guide-title">
          <i class="fa-solid fa-book-open-reader" style="color: #38bdf8;"></i>
          <span>みやぎライブEyes 総合利用ガイド</span>
        </div>
        <button class="modal-close" id="system-guide-close" aria-label="ガイドを閉じる">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 4大目的別タブバー -->
      <div class="system-guide-tabs" role="tablist">
        <button class="guide-tab-btn active" data-tab="tab-purpose" role="tab" aria-selected="true">
          <i class="fa-solid fa-bullseye"></i>
          <span>1. 目的と基本ツール</span>
        </button>
        <button class="guide-tab-btn" data-tab="tab-river" role="tab" aria-selected="false">
          <i class="fa-solid fa-water"></i>
          <span>2. 川の流れ順の秘密</span>
        </button>
        <button class="guide-tab-btn" data-tab="tab-fav" role="tab" aria-selected="false">
          <i class="fa-solid fa-star"></i>
          <span>3. 定点監視ボード＆2画面</span>
        </button>
        <button class="guide-tab-btn" data-tab="tab-legend" role="tab" aria-selected="false">
          <i class="fa-solid fa-circle-info"></i>
          <span>4. 凡例・出典・免責</span>
        </button>
      </div>

      <!-- タブコンテンツ領域 -->
      <div class="system-guide-body">

        <!-- ==================== タブ 1: 目的と基本ツール ==================== -->
        <div class="guide-tab-panel active" id="tab-purpose" role="tabpanel">
          
          <!-- 大前提・目的コールアウト -->
          <div class="guide-premise-card">
            <div class="guide-premise-badge">
              <i class="fa-solid fa-shield-halved"></i> ポータルの大前提と目的
            </div>
            <h3 class="guide-premise-title">
              公的機関の観測網を一元集約し、「地域の今」を俯瞰的・一覧で見渡す
            </h3>
            <p class="guide-premise-text">
              河川カメラや水位計は<strong>国土交通省（河川事務所）や宮城県</strong>、道路カメラは<strong>国道事務所や土木事務所</strong>、気象警報は<strong>気象庁</strong>……と、有益な防災情報はそれぞれの公的機関の別々のウェブサイトに分散しています。<br>
              災害や台風・豪雨の際、複数の行政サイトを別々に開いて調べるのは時間がかかり、地域全体の水害・道路リスクを素早く把握することは極めて困難でした。<br>
              <strong>「みやぎライブEyes」は、これら公的機関が公開する約300箇所の観測データを機関の枠を越えて1画面に統合。探す手間をゼロにし、鳥の目で地域の状況を俯瞰的に一覧で見渡すために作られた定点見守りポータルです。</strong>
            </p>
          </div>

          <!-- ホーム画面の2大ビュー -->
          <h4 class="guide-section-title">
            <i class="fa-solid fa-desktop" style="color: #38bdf8;"></i> ホーム画面の2大ビュー（俯瞰と一覧の連携）
          </h4>
          <div class="guide-grid-2col">
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #38bdf8;"><i class="fa-solid fa-map-location-dot"></i></div>
              <div class="guide-card-body">
                <strong>① 対話型俯瞰マップ（空間把握）</strong>
                <p>全県約300箇所のピンを鳥の目で一望。国土地理院のハザードマップ（洪水・土砂・津波）と重ね合わせて、危険エリアとカメラ位置を地理的に把握できます。</p>
              </div>
            </div>
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #f59e0b;"><i class="fa-solid fa-list-check"></i></div>
              <div class="guide-card-body">
                <strong>② 水系別サイドバー（一覧把握）</strong>
                <p>各河川水系ごとにカメラが整理された一覧。上流から下流へ順に並び、カメラ名検索や水系ごとの一括開閉・登録が素早く行えます。</p>
              </div>
            </div>
          </div>

          <!-- 最初の一手：圏域絞り込み -->
          <h4 class="guide-section-title">
            <i class="fa-solid fa-filter" style="color: #10b981;"></i> 最初の一手：上部の「エリア選択」で自地域に集中
          </h4>
          <div class="guide-flow-box">
            <div class="guide-flow-step">
              <div class="guide-flow-badge">初期状態</div>
              <div class="guide-flow-desc">
                <strong>全県域（約300台）</strong><br>
                宮城県全域を鳥の目で広く俯瞰する状態
              </div>
            </div>
            <div class="guide-flow-arrow">
              <i class="fa-solid fa-arrow-right"></i>
            </div>
            <div class="guide-flow-step highlight">
              <div class="guide-flow-badge highlight">エリア選択後</div>
              <div class="guide-flow-desc">
                <strong>対象圏域（約30〜40台）に集中！</strong><br>
                自地域（石巻・登米・仙台等）に絞り込まれ、地図が自動ズーム＆動作が劇的に軽快化
              </div>
            </div>
          </div>
          <p class="guide-caption">
            ※画面上部の「エリア選択」ボタンからいつでも切り替え可能。関係のない遠方のカメラに埋もれず、自地域の監視に集中できます。
          </p>

          <!-- 観測データの種別と危険度 -->
          <h4 class="guide-section-title">
            <i class="fa-solid fa-eye" style="color: #ec4899;"></i> 観測データの種別と危険度の見分け方
          </h4>
          <div class="guide-legend-grid">
            <div class="guide-legend-item">
              <div class="guide-legend-badge badge-river"><i class="fa-solid fa-camera"></i></div>
              <div class="guide-legend-detail">
                <strong>河川カメラ（静止画）</strong>
                <span>国交省・県管理。約10〜15分ごとに最新画像が自動更新。川の水位や護岸の様子を確認。</span>
              </div>
            </div>
            <div class="guide-legend-item">
              <div class="guide-legend-badge badge-road"><i class="fa-solid fa-video"></i></div>
              <div class="guide-legend-detail">
                <strong>道路カメラ（静止画）</strong>
                <span>国道・主要県道。豪雨時のアンダーパス冠水、冬期の峠部積雪・路面凍結状況を確認。</span>
              </div>
            </div>
            <div class="guide-legend-item">
              <div class="guide-legend-badge badge-stream"><i class="fa-solid fa-play"></i></div>
              <div class="guide-legend-detail">
                <strong>ライブ動画配信（YouTube等）</strong>
                <span>滑らかなリアルタイム連続映像。濁流の勢いや波立ちをダイナミックに確認。</span>
              </div>
            </div>
            <div class="guide-legend-item alert-danger-item">
              <div class="guide-legend-badge badge-danger"><i class="fa-solid fa-water"></i></div>
              <div class="guide-legend-detail">
                <strong style="color: #f87171;">🚨 水位観測所：赤色の波紋アラート（最重要！）</strong>
                <span>平常（緑）➡ 注意（黄）➡ <strong>危険（赤・常時波紋発光）</strong>の3段階変化。地図上で赤い波紋が脈動しているピンは「今まさに氾濫の危険がある場所」です。最優先で現場状況を確認してください。</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ==================== タブ 2: 川の流れ順の秘密 ==================== -->
        <div class="guide-tab-panel" id="tab-river" role="tabpanel">
          
          <div class="guide-premise-card" style="border-left-color: #38bdf8;">
            <div class="guide-premise-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">
              <i class="fa-solid fa-water"></i> なぜ五十音順ではないのか？
            </div>
            <h3 class="guide-premise-title">
              カメラはすべて「上流から下流（河口）」へ川の流れ順に自動整列
            </h3>
            <p class="guide-premise-text">
              本システムのサイドバー一覧は、五十音順や市町村名順ではありません。<br>
              <strong>すべてのカメラが、最上流から河口に向かって「川が流れる物理的な順序」で厳密に配置されています。</strong>
            </p>
          </div>

          <h4 class="guide-section-title">
            <i class="fa-solid fa-clock-rotate-left" style="color: #38bdf8;"></i> 防災上の必然性：濁流の到達を時系列で追跡・予測する
          </h4>
          <p class="guide-p">
            河川の水害は、以下の確固たる物理プロセスを辿って発生します：
          </p>

          <div class="guide-flow-timeline">
            <div class="timeline-node">
              <div class="timeline-badge">1. 上流</div>
              <div class="timeline-box">
                <strong>上流域での集中豪雨・ダム放流</strong>
                <p>山間部や上流で水位計・カメラが急激な水位上昇を検知（例: 登米・栗原など）。</p>
              </div>
            </div>
            <div class="timeline-connector"><i class="fa-solid fa-arrow-down"></i> 数時間かけて下流へ濁流が流下</div>
            <div class="timeline-node">
              <div class="timeline-badge" style="background: #0284c7;">2. 中流</div>
              <div class="timeline-box">
                <strong>中流域へのピーク到達・支川合流</strong>
                <p>上流の水が押し寄せ、堤防への負荷が増大（例: 桃生、鳴瀬川中流など）。</p>
              </div>
            </div>
            <div class="timeline-connector"><i class="fa-solid fa-arrow-down"></i> さらに数時間〜半日後、河口へ</div>
            <div class="timeline-node">
              <div class="timeline-badge" style="background: #1e3a8a;">3. 河口</div>
              <div class="timeline-box">
                <strong>下流・河口域への到達（満潮との複合リスク）</strong>
                <p>上流の水が河口に達し、海潮とぶつかって水位がピークに達する（例: 釜谷河口など）。</p>
              </div>
            </div>
          </div>

          <div class="guide-callout-info">
            <i class="fa-solid fa-lightbulb" style="color: #f59e0b; font-size: 18px;"></i>
            <div>
              <strong>現場での活かし方</strong><br>
              リストを<strong>「上から下へとスクロールしてカメラ画像を順に見ていく」だけで、「今どこまで濁流が到達しているか」「下流があと何時間後に危険になるか」を直感的に予測・警戒</strong>できます。本システムは単なる一覧表ではなく、「川の時系列変化を可視化する防災タイムライン」です。
            </div>
          </div>

        </div>

        <!-- ==================== タブ 3: 定点監視ボード＆2画面 ==================== -->
        <div class="guide-tab-panel" id="tab-fav" role="tabpanel">

          <div class="guide-premise-card" style="border-left-color: #f59e0b;">
            <div class="guide-premise-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;">
              <i class="fa-solid fa-star"></i> 自分専用の防災管制室
            </div>
            <h3 class="guide-premise-title">
              登録カメラだけの最新静止画を、大画面タイルで一括常時監視
            </h3>
            <p class="guide-premise-text">
              「毎回300台の中から探すのは大変」「見たいカメラだけをタブを開かずに並べたい」――その要望に応えるのが<strong>「登録カメラ監視ボード（favorites.html）」</strong>です。
            </p>
          </div>

          <h4 class="guide-section-title">
            <i class="fa-solid fa-hand-pointer" style="color: #f59e0b;"></i> ① カメラ登録はワンクリック
          </h4>
          <div class="guide-grid-2col">
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #f59e0b;"><i class="fa-solid fa-star"></i></div>
              <div class="guide-card-body">
                <strong>個別にピン留め（★）</strong>
                <p>各カメラカードや地図ピンの詳細にある「★（星）」を押すだけで登録。ブラウザに自動保存されます。</p>
              </div>
            </div>
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #38bdf8;"><i class="fa-solid fa-layer-group"></i></div>
              <div class="guide-card-body">
                <strong>水系まるごと一括登録（⭐一括）</strong>
                <p>水系ヘッダーにある「⭐一括」ボタンを押せば、その川の上流から下流までの全カメラを瞬時に一括登録できます。</p>
              </div>
            </div>
          </div>

          <h4 class="guide-section-title">
            <i class="fa-solid fa-table-cells" style="color: #38bdf8;"></i> ② 定点監視ボードの特長
          </h4>
          <ul class="guide-feature-list">
            <li>
              <i class="fa-solid fa-check" style="color: #10b981;"></i>
              <div><strong>複数タブの乱立を根絶</strong>：何枚もブラウザタブを開く必要がなく、登録した全カメラの最新静止画が1画面の大きなタイル状に一覧表示されます。</div>
            </li>
            <li>
              <i class="fa-solid fa-check" style="color: #10b981;"></i>
              <div><strong>約10分の自動巡回更新</strong>：バックグラウンドで全カメラ画像が自動再取得され、放置したままでも常に最新の現場状況が保たれます。</div>
            </li>
            <li>
              <i class="fa-solid fa-check" style="color: #10b981;"></i>
              <div><strong>直感的なドラッグ＆ドロップ並べ替え</strong>：カード上部のグリップをつかんで、自分が最も注視したい順序へ自由に並び替えられます。</div>
            </li>
          </ul>

          <h4 class="guide-section-title">
            <i class="fa-solid fa-map" style="color: #ec4899;"></i> ③ フロート型ミニマップ連動 ＆ 2画面マルチモニター対応
          </h4>
          <div class="guide-grid-2col">
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #f59e0b;"><i class="fa-solid fa-location-crosshairs"></i></div>
              <div class="guide-card-body">
                <strong>画像ホバーで地図の位置を即座に明示</strong>
                <p>カメラ画像にマウスを乗せると、右下のミニマップ上の該当ピンがゴールドに発光・拡大！「この画像が川のどの地点か」が地理的に一目瞭然です。ピンクリックで該当カードへ自動スクロールします。</p>
              </div>
            </div>
            <div class="guide-card">
              <div class="guide-card-icon" style="color: #38bdf8;"><i class="fa-solid fa-up-right-from-square"></i></div>
              <div class="guide-card-body">
                <strong>🖥️ 2画面マルチモニター対応（別窓ポップアウト）</strong>
                <p>マップ右上の「⧉（別窓）」ボタンを押すと、地図が独立ウィンドウとして切り離されます。サブモニターに広域地図、メイン画面にカメラ群を並べるプロ仕様の2画面監視が可能です。</p>
              </div>
            </div>
          </div>

        </div>

        <!-- ==================== タブ 4: 凡例・出典・免責 ==================== -->
        <div class="guide-tab-panel" id="tab-legend" role="tabpanel">

          <h4 class="guide-section-title">
            <i class="fa-solid fa-map-pin" style="color: #38bdf8;"></i> 地図アイコン・マーカー凡例一覧
          </h4>
          <table class="guide-table">
            <thead>
              <tr>
                <th style="width: 70px;">アイコン</th>
                <th>名称・種別</th>
                <th>更新間隔・仕様</th>
                <th>役割・確認ポイント</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-river"></span></td>
                <td><strong>河川カメラ</strong></td>
                <td>約10〜15分（静止画）</td>
                <td>河川水位、堤防・護岸の浸食、橋脚への流木漂着の確認</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-road"></span></td>
                <td><strong>道路カメラ</strong></td>
                <td>約10〜15分（静止画）</td>
                <td>道路冠水、アンダーパス冠水、冬期の峠部積雪・凍結</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-stream"></span></td>
                <td><strong>動画カメラ</strong></td>
                <td>常時（リアルタイム）</td>
                <td>YouTube配信等の連続ライブ映像。流速や水流の激しさを確認</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-station-normal"></span></td>
                <td><strong>水位観測所（平常）</strong></td>
                <td>約10分（数値データ）</td>
                <td>水防団待機水位未満の安全な状態</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-station-warning"></span></td>
                <td><strong>水位観測所（注意）</strong></td>
                <td>約10分（数値データ）</td>
                <td>氾濫注意水位に到達した警戒状態</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-station-danger"></span></td>
                <td><strong style="color:#ef4444;">水位観測所（危険・アラート）</strong></td>
                <td>約10分（常時波紋発光）</td>
                <td>避難判断水位・氾濫危険水位に達した重大状態。地図上で赤い波紋が脈動</td>
              </tr>
              <tr>
                <td style="text-align: center;"><span class="guide-dot dot-offline"></span></td>
                <td><strong>調整中・休止中</strong></td>
                <td>-</td>
                <td>機器点検、回線障害、冬季休止中の観測所</td>
              </tr>
            </tbody>
          </table>

          <h4 class="guide-section-title" style="margin-top: 24px;">
            <i class="fa-solid fa-building-columns" style="color: var(--text-secondary);"></i> データ出典・情報提供元
          </h4>
          <p class="guide-p" style="font-size: 12px; color: var(--text-secondary);">
            本システムで表示されるカメラ画像・動画・水位情報等の著作権は、各公的情報提供元に帰属します。本システムは各機関が公開するオープンデータおよびウェブサイトを参照・統合し、地域防災の利便性向上のために集約・可視化しています。<br>
            ・国土交通省「川の防災情報」 / 北上川下流河川事務所 / 仙台河川国道事務所<br>
            ・国土交通省・国土地理院「ハザードマップポータルサイト」（洪水・土砂・津波オープンデータ重畳）<br>
            ・宮城県 公式ウェブサイト（河川課・道路課）<br>
            ・気象庁 防災気象情報
          </p>

          <div class="guide-disclaimer-box">
            <strong>【免責事項・利用上の注意】</strong><br>
            本ポータルは宮城県内の防災情報閲覧の補助を目的とした非公式見守りツールであり、掲載映像・情報の即時性や完全性を法的に保証するものではありません。<br>
            配信元の仕様変更や点検により、予告なく画像が取得できなくなる場合があります。<br>
            <strong>実際の災害時における避難判断や緊急行動にあたっては、必ず各自治体が発令する公式な避難指示および一次情報をご確認ください。</strong>
          </div>

          <div class="guide-copyright">
            &copy; 2026 みやぎライブEyes Project. All rights reserved.
          </div>

        </div>

      </div>

      <!-- フッター（閉じるボタン） -->
      <div class="system-guide-footer">
        <button type="button" class="guide-close-btn" id="system-guide-bottom-close">
          <i class="fa-solid fa-check"></i> ガイドを閉じて利用を開始する
        </button>
      </div>

    </div>
  </div>
  `;

  // 初期化
  let isInitialized = false;

  function initSystemGuide() {
    if (isInitialized) return;
    if (document.getElementById('system-guide-overlay')) {
      isInitialized = true;
      return;
    }

    const container = document.createElement('div');
    container.innerHTML = GUIDE_HTML;
    document.body.appendChild(container.firstElementChild);

    bindGuideEvents();
    isInitialized = true;
  }

  // イベントバインド
  function bindGuideEvents() {
    const modal = document.getElementById('system-guide-overlay');
    const closeTopBtn = document.getElementById('system-guide-close');
    const closeBottomBtn = document.getElementById('system-guide-bottom-close');
    const tabBtns = document.querySelectorAll('.guide-tab-btn');

    if (!modal) return;

    // 閉じる操作
    const closeModal = () => modal.classList.remove('active');
    if (closeTopBtn) closeTopBtn.addEventListener('click', closeModal);
    if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    // タブ切り替え
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        switchTab(targetId);
      });
    });
  }

  // タブ切り替えロジック
  function switchTab(targetId) {
    const tabBtns = document.querySelectorAll('.guide-tab-btn');
    const tabPanels = document.querySelectorAll('.guide-tab-panel');

    tabBtns.forEach(btn => {
      const isMatch = btn.getAttribute('data-tab') === targetId;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === targetId);
    });

    // タブ切り替え時にスクロールを最上部へ
    const body = document.querySelector('.system-guide-body');
    if (body) body.scrollTop = 0;
  }

  // グローバル公開API
  window.openSystemGuide = function(targetTabId) {
    initSystemGuide();

    // 既存の概要モーダル等が開いていれば閉じる（競合防止）
    const infoModal = document.getElementById('info-modal-overlay');
    if (infoModal) infoModal.classList.remove('active');
    const boardInfoModal = document.getElementById('board-info-modal-overlay');
    if (boardInfoModal) boardInfoModal.classList.remove('active');

    const modal = document.getElementById('system-guide-overlay');
    if (!modal) return;

    if (targetTabId) {
      switchTab(targetTabId);
    } else {
      switchTab('tab-purpose'); // デフォルトは第1タブ
    }

    modal.classList.add('active');
  };

  // DOMContentLoaded時の安全な準備
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemGuide);
  } else {
    initSystemGuide();
  }
})();
