/**
 * 石巻圏 リアルタイム定点観測ビューア - メインアプリケーションロジック
 */

(function() {
  'use strict';

  // ■ 設定定数
  const CONFIG = {
    MAP_CENTER: [38.550, 141.150],
    MAP_ZOOM: 10,
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10分
    CATEGORY_COLORS: {
      river: '#3b82f6',
      road: '#0284c7', // 警戒色(黄色・赤)と被らない視認性の高い水色/ターコイズ
      coast: '#06b6d4',
      city: '#10b981',
      other: '#a78bfa'
    },
    CATEGORY_LABELS: {
      river: '河川',
      road: '道路',
      coast: '海岸',
      city: '市街地',
      other: 'その他'
    },
    CATEGORY_ICONS: {
      river: 'fa-water',
      road: 'fa-road',
      coast: 'fa-anchor',
      city: 'fa-building',
      other: 'fa-video'
    },
    FAV_STORAGE_KEY: 'ishinomaki_fav_cameras'
  };

  // ■ 水系・地域グループの定義判定関数
  function getGroupForCamera(camera) {
    const name = camera.name || '';
    const desc = camera.description || '';
    const category = camera.category || 'other';

    if (category === 'road' || name.includes('IC') || name.includes('三陸沿岸')) {
      return { id: 'group_road', title: '🚗 道路・三陸沿岸道路IC', icon: 'fa-road', order: 10, defaultOpen: false };
    }

    if (name.includes('[岩手県]')) {
      return { id: 'group_iwate', title: '🏔️ 岩手県：北上川上流・中流域', icon: 'fa-mountain-sun', order: 9, defaultOpen: false };
    }

    // 石巻圏：旧北上川水系
    if (name.includes('旧北上川') || name.includes('日和山') || name.includes('住吉') || name.includes('神取橋') || name.includes('内海橋') || name.includes('脇谷') || name.includes('石巻大橋') || name.includes('真野川') || name.includes('大森')) {
      return { id: 'group_kyu_kitakami', title: '🌊 石巻圏：旧北上川水系', icon: 'fa-water', order: 2, defaultOpen: true };
    }

    // 石巻圏：北上川下流
    if (name.includes('北上川') && (name.includes('飯野川') || name.includes('福地') || name.includes('釜谷') || name.includes('新北上') || name.includes('下流') || name.includes('樫崎') || name.includes('橋浦'))) {
      return { id: 'group_kitakami', title: '🌊 石巻圏：北上川下流', icon: 'fa-water', order: 3, defaultOpen: true };
    }

    // 石巻圏・東松島：鳴瀬・吉田川下流
    if (name.includes('鳴瀬') || name.includes('吉田川') || name.includes('東名運河') || name.includes('鞍坪') || name.includes('小野橋') || name.includes('入釜谷') || name.includes('出来川') || name.includes('中島川') || name.includes('加茂川') || name.includes('内の原') || name.includes('高木川') || name.includes('大沢川') || name.includes('皿貝川')) {
      return { id: 'group_naruse', title: '🌊 石巻圏・東松島：鳴瀬川・吉田川・運河', icon: 'fa-water', order: 4, defaultOpen: true };
    }

    // 登米・栗原・迫川
    if (name.includes('登米') || name.includes('栗原') || name.includes('迫川') || name.includes('錦桜') || name.includes('若柳') || name.includes('山吉田')) {
      return { id: 'group_tome_kurihara', title: '🌊 登米・栗原・迫川水系（上流域）', icon: 'fa-water', order: 5, defaultOpen: false };
    }

    // 大崎・加美・江合川
    if (name.includes('大崎') || name.includes('加美') || name.includes('古川') || name.includes('美里') || name.includes('涌谷') || name.includes('江合川') || name.includes('三本木') || name.includes('野田橋')) {
      return { id: 'group_osaki_kami', title: '🌊 大崎・加美・江合川水系（上流域）', icon: 'fa-water', order: 6, defaultOpen: false };
    }

    // 気仙沼・南三陸
    if (name.includes('気仙沼') || name.includes('南三陸') || name.includes('志津川') || name.includes('津谷') || name.includes('本吉')) {
      return { id: 'group_kesennuma', title: '🌊 気仙沼圏', icon: 'fa-fish', order: 7, defaultOpen: false };
    }

    // 仙台・仙塩・県南
    if (name.includes('仙台') || name.includes('名取') || name.includes('塩竈') || name.includes('松島') || name.includes('七北田') || name.includes('阿武隈') || name.includes('岩沼') || name.includes('亘理')) {
      return { id: 'group_sendai', title: '🌊 仙台・仙塩・県南エリア', icon: 'fa-building-flag', order: 8, defaultOpen: false };
    }

    return { id: 'group_other_river', title: '🌊 その他河川・観測所', icon: 'fa-water', order: 11, defaultOpen: false };
  }

  // ■ 状態管理
  const state = {
    cameras: [],
    waterLevelStations: [],
    map: null,
    layers: {},
    markers: {},
    activeCategoryFilters: new Set(['river', 'road', 'coast', 'city', 'other']),
    activeOperatorFilter: 'all',
    activeAreaFilter: localStorage.getItem('ishinomaki_area_filter') || 'all',
    favorites: new Set(),
    favoriteOnlyFilter: false, // お気に入りカメラのみ表示フラグ
    searchQuery: '',
    accordionStates: {},
    isMapCollapsed: false,
    activeMarkerId: null, // 現在ポップアップが開いているマーカーの識別ID
    refreshTimer: null,
    countdownTimer: null,
    nextRefreshTime: null
  };

  // DOMContentLoaded で初期化
  document.addEventListener('DOMContentLoaded', initApp);

  // ■ 初期化メイン関数
  function initApp() {
    // ★ グローバルディスパッチャの定義 ★
    window.__triggerMarkerAction = function(targetId) {
      if (!targetId) return;
      if (targetId.startsWith('water_')) {
        const stationNo = targetId.replace('water_', '');
        const station = WATER_LEVEL_STATIONS.find(s => (s.stationNo || s.name) === stationNo);
        if (station) openWaterLevelModal(station);
      } else {
        openModal(targetId);
      }
    };

    loadFavorites();
    initMap();
    initMarkers();
    initSidebarAccordion();
    initSidebarResizer();
    initFavoriteFilterBar(); // お気に入り切り替えバーの初期化
    initHazardMapControl(); // ハザードマップ重ね合わせコントロールの初期化
    initMapToggle();
    initBottomTabs();
    initAreaFilter();
    initFilters();
    initSearch();
    initModal();
    initInfoModal();
    initTimerTooltip(); // タイマー注記ツールチップの初期化
    fetchWeatherAlerts(); // 気象警報・注意報データのリアルタイム取得
    startAutoRefresh();
    updateStatusBar();

    // 起動時の初期エリアフォーカスとアコーディオン展開
    setTimeout(() => {
      if (state.map) {
        state.map.invalidateSize();
      }
      applyAreaFocusAndExpand(state.activeAreaFilter);
    }, 500); // マーカー描画後
  }

  // ■ お気に入りの読み込み・保存
  function loadFavorites() {
    try {
      const saved = localStorage.getItem(CONFIG.FAV_STORAGE_KEY);
      if (saved) {
        state.favorites = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('お気に入りデータの読み込みに失敗しました:', e);
      state.favorites = new Set();
    }
    updateFavoriteBadge();
  }

  function saveFavorites() {
    try {
      localStorage.setItem(CONFIG.FAV_STORAGE_KEY, JSON.stringify(Array.from(state.favorites)));
    } catch (e) {
      console.warn('お気に入りデータの保存に失敗しました:', e);
    }
    updateFavoriteBadge();
  }

  // お気に入り件数バッジの更新
  function updateFavoriteBadge() {
    const badge = document.getElementById('fav-badge-count');
    if (badge) {
      badge.textContent = state.favorites.size;
    }
  }

  function toggleFavorite(cameraId, event) {
    if (event) event.stopPropagation();
    if (state.favorites.has(cameraId)) {
      state.favorites.delete(cameraId);
    } else {
      state.favorites.add(cameraId);
    }
    saveFavorites();
    updateFavoriteUI(cameraId);
    renderSidebarList();
  }

  function updateFavoriteUI(cameraId) {
    const isFav = state.favorites.has(cameraId);
    document.querySelectorAll(`.fav-btn[data-camera-id="${cameraId}"]`).forEach(btn => {
      if (isFav) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-star"></i>';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-regular fa-star"></i>';
      }
    });

    // 地図上のピン（マーカー）をお気に入りスタイルに連動
    const marker = state.markers[cameraId];
    if (marker) {
      const el = marker.getElement();
      if (el) {
        if (isFav) {
          el.classList.add('marker-favorite');
        } else {
          el.classList.remove('marker-favorite');
        }
      }
    }
  }


  // ■ 地図の初期化
  function initMap() {
    state.map = L.map('map', { zoomControl: false }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    L.control.zoom({ position: 'topright' }).addTo(state.map);

    // ハザードマップ用専用ペインの作成（ベース地図の上、マーカーピンの下に配置）
    state.map.createPane('hazardPane');
    state.map.getPane('hazardPane').style.zIndex = 350;

    // カテゴリ別レイヤーグループの作成
    state.layers = {
      river: L.layerGroup().addTo(state.map),
      road: L.layerGroup().addTo(state.map),
      water_level: L.layerGroup().addTo(state.map)
    };

    // ズームレベル連動（広域表示時のコンパクトドット化）
    function updateZoomClass() {
      const currentZoom = state.map.getZoom();
      const container = state.map.getContainer();
      if (currentZoom < 12) {
        container.classList.add('zoom-low');
      } else {
        container.classList.remove('zoom-low');
      }
    }

    state.map.on('zoomend', updateZoomClass);
    updateZoomClass(); // 初期状態の判定

    // 地図の何もない場所をクリック/タップした際はアクティブマーカーを解除
    state.map.on('click', () => {
      state.activeMarkerId = null;
    });

    initWaterLevelMarkers(); // 水位観測所マーカーの配置
  }

  // ■ 地図折りたたみトグルの初期化
  function initMapToggle() {
    const mapToggleBtn = document.getElementById('map-toggle-btn');
    const mapToggleText = document.getElementById('map-toggle-text');
    const mapToggleIcon = document.getElementById('map-toggle-icon');
    const mapWrapper = document.getElementById('map-wrapper');
    const mainContent = document.getElementById('main-content');

    if (!mapToggleBtn || !mapWrapper || !mainContent) return;

    mapToggleBtn.addEventListener('click', () => {
      state.isMapCollapsed = !state.isMapCollapsed;

      if (state.isMapCollapsed) {
        mapWrapper.classList.add('collapsed');
        mainContent.classList.add('map-is-collapsed');
        if (mapToggleText) mapToggleText.textContent = '地図を表示';
        if (mapToggleIcon) {
          mapToggleIcon.classList.remove('fa-map-location-dot');
          mapToggleIcon.classList.add('fa-map');
        }
      } else {
        mapWrapper.classList.remove('collapsed');
        mainContent.classList.remove('map-is-collapsed');
        if (mapToggleText) mapToggleText.textContent = '地図を隠す';
        if (mapToggleIcon) {
          mapToggleIcon.classList.remove('fa-map');
          mapToggleIcon.classList.add('fa-map-location-dot');
        }
        // トランジション完了後に地図のサイズを再計算
        setTimeout(() => {
          if (state.map) state.map.invalidateSize();
        }, 350);
      }
    });
  }

  // ■ エリア（広域圏）の判定ロジック（7圏域）
  function getAreaForCamera(camera) {
    const text = (camera.name || '') + ' ' + (camera.description || '') + ' ' + (camera.operator || '') + ' ' + (camera.city || '') + ' ' + (camera.address || '');
    
    // 気仙沼圏
    if (text.includes('気仙沼') || text.includes('南三陸') || text.includes('本吉')) return 'kesennuma';
    // 登米圏
    if (text.includes('登米') || text.includes('津山') || text.includes('豊里') || text.includes('米山') || text.includes('中田') || text.includes('東和') || text.includes('南方') || text.includes('石越')) return 'tome';
    // 栗原圏
    if (text.includes('栗原') || text.includes('若柳') || text.includes('築館') || text.includes('高清水') || text.includes('瀬峰') || text.includes('金成') || text.includes('志波姫') || text.includes('鶯沢') || text.includes('花山')) return 'kurihara';
    // 大崎圏
    if (text.includes('大崎') || text.includes('古川') || text.includes('三本木') || text.includes('松山') || text.includes('鹿島台') || text.includes('田尻') || text.includes('岩出山') || text.includes('鳴子') || text.includes('加美') || text.includes('色麻') || text.includes('涌谷') || text.includes('美里')) return 'osaki';
    // 石巻圏
    if (text.includes('石巻') || text.includes('東松島') || text.includes('女川') || text.includes('牡鹿') || text.includes('矢本') || text.includes('鳴瀬') || text.includes('河南') || text.includes('桃生') || text.includes('北上') || text.includes('雄勝')) return 'ishinomaki';
    // 仙南圏（大河原）
    if (text.includes('大河原') || text.includes('白石') || text.includes('角田') || text.includes('蔵王') || text.includes('七ヶ宿') || text.includes('村田') || text.includes('柴田') || text.includes('川崎') || text.includes('丸森')) return 'sennan';
    // 仙台圏（それ以外の大半）
    if (text.includes('仙台') || text.includes('名取') || text.includes('岩沼') || text.includes('亘理') || text.includes('山元') || text.includes('塩竈') || text.includes('多賀城') || text.includes('松島') || text.includes('七ヶ浜') || text.includes('利府') || text.includes('富谷') || text.includes('大和') || text.includes('大郷') || text.includes('大衡')) return 'sendai';
    
    return 'all'; // 判別不能な場合はすべて表示に含める
  }

  // ■ エリアフィルターの初期化
  function initAreaFilter() {
    const btn = document.getElementById('area-select-btn');
    const modal = document.getElementById('area-modal-overlay');
    const closeBtn = document.getElementById('area-modal-close');
    const options = document.querySelectorAll('.area-option-btn');
    const currentText = document.getElementById('current-area-text');
    
    if (!btn || !modal) return;
    
    // 初期テキストの設定
    const initialOption = Array.from(options).find(opt => opt.getAttribute('data-area') === state.activeAreaFilter);
    if (initialOption && currentText) {
      currentText.textContent = initialOption.textContent.split('（')[0]; // カッコ以降を省略
      options.forEach(o => o.classList.remove('active'));
      initialOption.classList.add('active');
    }

    btn.addEventListener('click', () => {
      modal.classList.add('active');
    });
    
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const area = opt.getAttribute('data-area');
        state.activeAreaFilter = area;
        localStorage.setItem('ishinomaki_area_filter', area);
        
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        if (currentText) currentText.textContent = opt.textContent.split('（')[0];
        
        modal.classList.remove('active');
        applyAllFilters(); // マーカーとリストを再描画

        // エリアに応じたフォーカスとアコーディオン展開を実行
        setTimeout(() => {
          applyAreaFocusAndExpand(area);
        }, 150);
      });
    });
  }


  // ■ 選択管内のフォーカスとアコーディオン展開
  function applyAreaFocusAndExpand(area) {
    if (!state.map) return;
    
    // 1. 地図の中心を合同庁舎へ移動
    const areaCoords = {
      'sennan': [38.0495, 140.7307],
      'sendai': [38.2784, 140.8673],
      'osaki': [38.5665, 140.9745],
      'kurihara': [38.7381, 141.0194],
      'tome': [38.6578, 141.2764],
      'ishinomaki': [38.4407, 141.2573],
      'kesennuma': [38.8881, 141.5698]
    };
    
    if (areaCoords[area]) {
      state.map.flyTo(areaCoords[area], 11.5, { animate: true, duration: 1.0 });
    } else if (area === 'all') {
      state.map.flyTo(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM, { animate: true, duration: 1.0 });
    }
    
    // 2. 該当エリアのグループ（アコーディオン）を自動展開
    if (area !== 'all') {
      const areaGroupMap = {
        'sennan': [], // 仙南圏は現状河川カメラなし
        'sendai': ['group_sendai'],
        'osaki': ['group_osaki_kami'],
        'kurihara': ['group_tome_kurihara'],
        'tome': ['group_tome_kurihara'],
        'ishinomaki': ['group_kyu_kitakami', 'group_kitakami', 'group_naruse'],
        'kesennuma': ['group_kesennuma']
      };
      const targetGroups = areaGroupMap[area] || [];
      if (targetGroups.length > 0) {
        // 他のグループは閉じ、対象グループのみ開く
        Object.keys(state.accordionStates).forEach(groupId => {
           state.accordionStates[groupId] = targetGroups.includes(groupId);
        });
        targetGroups.forEach(groupId => {
           state.accordionStates[groupId] = true;
        });
        renderSidebarList(); // サイドバーの再描画（アコーディオン状態反映）
      }
    }

    // 選択されたエリアに連動して気象警報バーも更新
    fetchWeatherAlerts(area);
  }

  // ■ すべてのフィルター（カテゴリー、管理者、エリア、検索）を地図マーカーに適用
  function applyAllFilters() {
    renderSidebarList(); // サイドバーの更新

    // 地図のマーカーを更新
    if (!state.map || !CAMERA_DATA) return;
    
    CAMERA_DATA.forEach(camera => {
      const marker = state.markers[camera.id];
      if (!marker) return;

      const category = camera.category || 'other';
      const operator = camera.operator || '';
      const area = getAreaForCamera(camera);
      
      const matchesCategory = state.activeCategoryFilters.has(category);
      let matchesOperator = state.activeOperatorFilter === 'all' || 
                           (state.activeOperatorFilter === 'mlit' && operator.includes('国土交通省')) || 
                           (state.activeOperatorFilter === 'miyagi' && operator.includes('宮城県'));
      const matchesArea = true; // 全カメラを常時表示保持し、エリア選択時はフォーカス＆アコーディオン展開のみ行う
      
      const layerGroup = state.layers[category];
      if (layerGroup) {
        if (matchesCategory && matchesOperator && matchesArea) {
          if (!layerGroup.hasLayer(marker)) {
            layerGroup.addLayer(marker);
          }
        } else {
          if (layerGroup.hasLayer(marker)) {
            layerGroup.removeLayer(marker);
          }
        }
      }
    });
  }

  // ■ ボトムタブの初期化（スマホ用）
  function initBottomTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const mainContent = document.getElementById('main-content');
    
    if (tabs.length === 0 || !mainContent) return;
    
    // 初期状態設定（スマホ時用クラス）
    mainContent.classList.add('show-map');
    mainContent.classList.remove('show-list');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // アクティブ状態の切り替え
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const target = tab.getAttribute('data-tab');
        if (target === 'map') {
          mainContent.classList.add('show-map');
          mainContent.classList.remove('show-list');
          // 地図のサイズ再計算
          setTimeout(() => {
            if (state.map) state.map.invalidateSize();
          }, 300);
        } else if (target === 'list') {
          mainContent.classList.add('show-list');
          mainContent.classList.remove('show-map');
        }
      });
    });
  }

  // ■ マーカーアイコンの作成
  function createMarkerIcon(camera) {
    const category = camera.category || 'other';
    const status = camera.status;
    
    // タイプB（動画・ライブ配信・静止画なし）の判定
    const isTypeB = camera.streamType === 'youtube' || camera.streamType === 'stream' || !camera.imageUrl;

    let color = isTypeB ? '#8b5cf6' : (CONFIG.CATEGORY_COLORS[category] || CONFIG.CATEGORY_COLORS.other); // タイプBは紫色
    let iconClass = isTypeB ? 'fa-video' : 'fa-camera'; // タイプA: カメラ📷, タイプB: ビデオカメラ📹
    
    // メンテナンス中の場合はグレーアウト
    if (status === 'maintenance') {
      color = '#9ca3af'; // グレー
    }
    
    // お気に入り登録済みかどうかの判定
    const isFav = state.favorites && state.favorites.has(camera.id);

    return L.divIcon({
      className: `custom-marker ${isFav ? 'marker-favorite' : ''}`,
      html: `<div class="marker-wrapper">
               <div class="marker-icon marker-${category}" style="background-color: ${color};" title="${isTypeB ? '📹 ライブ動画・参照' : '📷 静止画（即時写真）'}">
                 <i class="fa-solid ${iconClass}" style="color: white; font-size: 10px;"></i>
               </div>
             </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -10]
    });
  }

  // ■ マーカーの初期化
  function initMarkers() {
    Object.keys(CONFIG.CATEGORY_LABELS).forEach(category => {
      state.layers[category] = L.layerGroup().addTo(state.map);
    });

    if (typeof CAMERA_DATA === 'undefined') {
      console.error('CAMERA_DATA が定義されていません。');
      return;
    }

    CAMERA_DATA.forEach(camera => {
      const category = camera.category || 'other';
      
      // 画像が存在するかどうかの判定（youtubeの場合は別扱い）
      const hasImage = !!camera.imageUrl || (camera.streamType === 'youtube' && !!camera.youtubeId);
      
      const marker = L.marker([camera.lat, camera.lng], {
        icon: createMarkerIcon(camera),
        title: camera.name
      });
      
      const categoryLabel = CONFIG.CATEGORY_LABELS[category] || 'その他';
      const isTypeB = camera.streamType === 'youtube' || camera.streamType === 'stream' || !camera.imageUrl;
      let popupImgHtml = '';

      if (isTypeB) {
        // ① ビデオ（動画カメラ）UI
        popupImgHtml = `
          <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 6px; padding: 10px 8px; text-align: center; margin: 4px 0 6px 0;">
            <div style="font-size: 12px; color: #c4b5fd; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px;">
              <i class="fa-solid fa-video"></i> ライブ動画配信中
            </div>
            <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fa-solid fa-video"></i> タップ／クリックで配信元サイトで映像を表示
            </div>
          </div>
        `;
      } else if (camera.imageUrl) {
        // ② 静止画カメラ UI
        popupImgHtml = `
          <div style="position: relative; margin-bottom: 6px;">
            <img src="${camera.imageUrl}" class="hover-popup-img" alt="${camera.name}" onerror="this.src='https://via.placeholder.com/210x115/1e293b/475569?text=Camera+Preview'">
            <div style="font-size: 11px; color: #38bdf8; margin-top: 5px; text-align: center; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fa-solid fa-camera"></i> タップ／クリックで詳細・拡大
            </div>
          </div>
        `;
      }

      const popupContent = `
        <div class="hover-popup">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding-bottom: 5px;">
            <div style="font-weight: 700; font-size: 13px; color: #ffffff; text-align: left; line-height: 1.3;">
              ${camera.name}
            </div>
            <span class="category-badge badge-${category}" style="flex-shrink: 0; font-size: 10px; padding: 2px 6px;">
              ${categoryLabel}
            </span>
          </div>
          ${popupImgHtml}
          <div style="font-size: 10px; color: #94a3b8; margin-top: 6px; display: flex; align-items: center; gap: 4px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 4px;">
            <i class="fa-solid fa-user-shield"></i> ${camera.operator || '管理者情報'}
          </div>
        </div>
      `;

      // 初期化時に1度だけTooltipをバインド（DOM要素を解体・破壊しない）
      const tooltip = L.tooltip({
        direction: 'top',
        interactive: true,
        className: 'custom-smart-tooltip',
        offset: [0, -10]
      }).setContent(popupContent);
      marker.bindTooltip(tooltip);

      // 全マーカー共通のホバー・クリック・離脱・ホバー維持イベントをバインド
      setupTooltipHoverEvents(marker, camera);

      if (state.layers[category]) {
        // 初期状態ではフィルターを適用した結果に基づいてレイヤーに追加するか決めるため、ここでは追加しない
        // applyAllFilters() が後に呼ばれることで正しい状態になる
      }
      
      state.markers[camera.id] = marker;
    });

    // 初期化時にすべてのマーカーにフィルターを適用して地図に配置する
    setTimeout(applyAllFilters, 100);

    // 各圏域の合同庁舎マーカーを常に地図上に表示
    const govBuildings = [
      { name: "仙南圏（大河原合同庁舎）", lat: 38.0495, lng: 140.7307 },
      { name: "仙台圏（仙台合同庁舎）", lat: 38.2784, lng: 140.8673 },
      { name: "大崎圏（大崎合同庁舎）", lat: 38.5665, lng: 140.9745 },
      { name: "栗原圏（栗原合同庁舎）", lat: 38.7381, lng: 141.0194 },
      { name: "登米圏（登米合同庁舎）", lat: 38.6578, lng: 141.2764 },
      { name: "石巻圏（石巻合同庁舎）", lat: 38.4407, lng: 141.2573 },
      { name: "気仙沼圏（気仙沼合同庁舎）", lat: 38.8881, lng: 141.5698 }
    ];
    govBuildings.forEach((b) => {
      const govIcon = L.divIcon({
        className: 'gov-marker',
        html: `<div style="background-color: #ef4444; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"><i class="fa-solid fa-building-flag" style="color: white; font-size: 12px;"></i></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const m = L.marker([b.lat, b.lng], { icon: govIcon, title: b.name, zIndexOffset: 1000 }).addTo(state.map);
      m.bindPopup(`<div style="font-size: 13px; font-weight: bold; text-align: center; color: #ef4444;"><i class="fa-solid fa-building-flag"></i> ${b.name}</div>`);
    });

    document.addEventListener('open-camera-modal', (e) => {
      openModal(e.detail);
    });
  }

  // ■ サイドバーカードHTML生成
  function renderCameraCard(camera, isFavMode = false) {
    const category = camera.category || 'other';
    const categoryLabel = CONFIG.CATEGORY_LABELS[category] || 'その他';
    const categoryIcon = CONFIG.CATEGORY_ICONS[category] || 'fa-video';
    const isFav = state.favorites.has(camera.id);
    const dragHandleHtml = isFavMode ? `<span class="fav-drag-handle" title="ドラッグして並べ替え" onclick="event.stopPropagation();"><i class="fa-solid fa-grip-vertical"></i></span>` : '';
    const draggableAttr = isFavMode ? 'draggable="true"' : '';
    
    let previewHtml = '';
    const isTypeB = camera.streamType === 'youtube' || camera.streamType === 'stream' || !camera.imageUrl;
    
    // ビデオ（動画配信型）カメラは画像がないため、1行のコンパクトなリンクカードとして表示（無駄なスペースを削減）
    if (isTypeB && camera.status !== 'maintenance') {
      return `
        <div class="camera-card camera-card-compact ${isFavMode ? 'fav-sortable-card' : ''}" data-camera-id="${camera.id}" data-category="${category}" data-operator="${camera.operator || ''}" ${draggableAttr} style="padding: 8px 12px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
            ${dragHandleHtml}
            <button class="fav-btn ${isFav ? 'active' : ''}" data-camera-id="${camera.id}" title="お気に入り登録" onclick="event.stopPropagation();" style="flex-shrink: 0;">
              <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
            </button>
            <span class="card-name" style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${camera.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <span class="category-badge badge-${category}" style="font-size: 10px; padding: 2px 6px;">${categoryLabel}</span>
            <span style="font-size: 11px; color: #c4b5fd; font-weight: 500; display: inline-flex; align-items: center; gap: 3px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 4px; padding: 2px 6px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 動画
            </span>
          </div>
        </div>
      `;
    }

    if (camera.status === 'maintenance') {
      previewHtml = `<div class="card-placeholder" style="color: #9ca3af;">
        <i class="fa-solid fa-wrench"></i>
        <span>現在調整中・休止中</span>
      </div>`;
    } else if (camera.imageUrl) {
      previewHtml = `<img src="${camera.imageUrl}" class="live-image" data-base-src="${camera.imageUrl}" alt="${camera.name}" onerror="this.onerror=null; this.outerHTML='<div class=\\'card-placeholder\\' style=\\'color: #ef4444;\\'><i class=\\'fa-solid fa-triangle-exclamation\\'></i><span>画像取得エラー</span></div>';">`;
    } else {
      previewHtml = `<div class="card-placeholder">
        <i class="fa-solid ${categoryIcon}"></i>
        <span>配信元で確認</span>
      </div>`;
    }

    return `
      <div class="camera-card ${camera.status === 'maintenance' ? 'maintenance' : ''} ${isFavMode ? 'fav-sortable-card' : ''}" data-camera-id="${camera.id}" data-category="${category}" data-operator="${camera.operator || ''}" ${draggableAttr}>
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; flex: 1;">
            ${dragHandleHtml}
            <span class="card-name">${camera.name}</span>
          </div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-camera-id="${camera.id}" title="お気に入り登録">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
          </button>
          <span class="category-badge badge-${category}">${categoryLabel}</span>
        </div>
        <div class="card-preview">
          ${previewHtml}
        </div>
        <div class="card-info">
          <span class="card-operator"><i class="fa-solid fa-user-shield"></i> ${camera.operator || '管理者不明'}</span>
          ${camera.description ? `<span class="card-desc">${camera.description}</span>` : ''}
        </div>
        <div class="card-actions">
          <a href="${camera.sourceUrl}" target="${isFav ? '_blank' : 'bousai_camera_preview'}" class="btn-source" onclick="event.stopPropagation();">
            配信元を開く <i class="fa-solid fa-external-link"></i>
          </a>
        </div>
      </div>
    `;
  }

  // ■ サイドバーアコーディオンの生成と更新
  function initSidebarAccordion() {
    renderSidebarList();

    const toggleBtn = document.getElementById('sidebar-toggle');
    const toggleIcon = document.getElementById('toggle-icon');
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    
    if (toggleBtn && toggleIcon && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (resizer) resizer.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
          toggleIcon.classList.remove('fa-chevron-right');
          toggleIcon.classList.add('fa-chevron-left');
        } else {
          toggleIcon.classList.remove('fa-chevron-left');
          toggleIcon.classList.add('fa-chevron-right');
        }
        setTimeout(() => {
          if (state.map) state.map.invalidateSize();
        }, 300);
      });
    }
  }

  // ■ お気に入りフィルター切り替えバーの初期化
  function initFavoriteFilterBar() {
    const btnAll = document.getElementById('fav-filter-all');
    const btnOnly = document.getElementById('fav-filter-only');

    if (btnAll) {
      btnAll.addEventListener('click', () => {
        if (!state.favoriteOnlyFilter) return;
        state.favoriteOnlyFilter = false;
        btnAll.classList.add('active');
        if (btnOnly) btnOnly.classList.remove('active');
        renderSidebarList();
      });
    }

    if (btnOnly) {
      btnOnly.addEventListener('click', () => {
        if (state.favoriteOnlyFilter) return;
        state.favoriteOnlyFilter = true;
        btnOnly.classList.add('active');
        if (btnAll) btnAll.classList.remove('active');
        renderSidebarList();
      });
    }

    updateFavoriteBadge();

    // 別タブ（favorites.html等）でのお気に入り更新をリアルタイム同期
    window.addEventListener('storage', (e) => {
      if (e.key === CONFIG.FAV_STORAGE_KEY) {
        loadFavorites();
        updateFavoriteBadge();
        if (typeof CAMERA_DATA !== 'undefined') {
          CAMERA_DATA.forEach(camera => updateFavoriteUI(camera.id));
        }
        renderSidebarList();
      }
    });
  }

  // ■ カメラカード・お気に入りボタンの共通イベントバインド
  function bindCameraListEvents(container) {
    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-camera-id');
        toggleFavorite(id, e);
      });
    });

    container.querySelectorAll('.camera-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-camera-id');
        openModal(id);
      });

      card.addEventListener('mouseenter', () => {
        const id = card.getAttribute('data-camera-id');
        const marker = state.markers[id];
        if (marker) {
          marker.setZIndexOffset(2000);
          const el = marker.getElement();
          if (el) el.classList.add('marker-active');
        }
      });

      card.addEventListener('mouseleave', () => {
        const id = card.getAttribute('data-camera-id');
        const marker = state.markers[id];
        if (marker) {
          marker.setZIndexOffset(0);
          const el = marker.getElement();
          if (el) el.classList.remove('marker-active');
        }
      });
    });
  }

  // ■ お気に入りカードのドラッグ＆ドロップ並べ替えイベントバインド
  function bindFavDragAndDrop(container) {
    let draggedCard = null;

    container.querySelectorAll('.fav-sortable-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-camera-id'));
        setTimeout(() => card.classList.add('is-dragging'), 0);
      });

      card.addEventListener('dragend', () => {
        if (draggedCard) {
          draggedCard.classList.remove('is-dragging');
          draggedCard = null;
        }
        container.querySelectorAll('.fav-sortable-card').forEach(c => {
          c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggedCard || draggedCard === card) return;

        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          card.classList.add('drag-over-top');
          card.classList.remove('drag-over-bottom');
        } else {
          card.classList.add('drag-over-bottom');
          card.classList.remove('drag-over-top');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedCard || draggedCard === card) return;

        const isTop = card.classList.contains('drag-over-top');
        card.classList.remove('drag-over-top', 'drag-over-bottom');

        if (isTop) {
          card.parentNode.insertBefore(draggedCard, card);
        } else {
          card.parentNode.insertBefore(draggedCard, card.nextSibling);
        }

        // 新しい並び順を取得して保存
        const newOrder = Array.from(container.querySelectorAll('.fav-sortable-card'))
          .map(c => c.getAttribute('data-camera-id'))
          .filter(Boolean);

        // state.favorites を新しい順序で再構築
        state.favorites = new Set(newOrder);
        saveFavorites();
      });
    });
  }


  // ■ サイドバーリストの描画（アコーディオン構造 / お気に入り優先提示）
  function renderSidebarList() {
    const listContainer = document.getElementById('camera-list');
    if (!listContainer || typeof CAMERA_DATA === 'undefined') return;

    // お気に入りフィルターが有効な場合：お気に入りカメラのみを最上部から直接提示（ドラッグ並べ替え対応）
    if (state.favoriteOnlyFilter) {
      const favOrder = Array.from(state.favorites);
      const favMap = new Map(CAMERA_DATA.map(c => [c.id, c]));
      const q = state.searchQuery.toLowerCase();

      const favCameras = favOrder.map(id => favMap.get(id)).filter(camera => {
        if (!camera) return false;
        if (q === '') return true;
        const operator = camera.operator || '';
        return camera.name.toLowerCase().includes(q) ||
          (camera.description && camera.description.toLowerCase().includes(q)) ||
          operator.toLowerCase().includes(q);
      });

      const noResults = document.getElementById('no-results');
      if (noResults) noResults.style.display = 'none';

      if (favCameras.length === 0) {
        listContainer.innerHTML = `
          <div class="fav-empty-hint" style="text-align: center; padding: 40px 16px; color: var(--text-secondary);">
            <i class="fa-regular fa-star" style="font-size: 36px; color: #f59e0b; opacity: 0.6; margin-bottom: 12px; display: block;"></i>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              お気に入りカメラがありません
            </div>
            <div style="font-size: 12px; line-height: 1.6;">
              地図上のピンやカメラカードの「★」アイコンをクリックすると、ここにお気に入りのカメラが直接表示されます。
            </div>
          </div>
        `;
        updateSidebarCount(0);
        return;
      }

      listContainer.innerHTML = `
        <div class="fav-direct-list" style="padding-top: 4px;">
          ${favCameras.map(c => renderCameraCard(c, true)).join('')}
        </div>
      `;

      bindCameraListEvents(listContainer);
      bindFavDragAndDrop(listContainer);
      updateSidebarCount(favCameras.length);
      return;
    }

    const groups = {};
    
    if (state.favorites.size > 0) {
      groups['group_fav'] = {
        id: 'group_fav',
        title: '★ お気に入りカメラ',
        icon: 'fa-star',
        order: 1,
        cameras: []
      };
    }

    CAMERA_DATA.forEach(camera => {
      const category = camera.category || 'other';
      const operator = camera.operator || '';
      const area = getAreaForCamera(camera);

      const matchesCategory = state.activeCategoryFilters.has(category);
      let matchesOperator = true;
      if (state.activeOperatorFilter === 'mlit') {
        matchesOperator = operator.includes('国土交通省');
      } else if (state.activeOperatorFilter === 'miyagi') {
        matchesOperator = operator.includes('宮城県');
      }
      
      const matchesArea = true; // 全カメラを常時表示保持し、エリア選択時はフォーカス＆アコーディオン展開のみ行う

      const q = state.searchQuery.toLowerCase();
      const matchesSearch = q === '' ||
        camera.name.toLowerCase().includes(q) ||
        (camera.description && camera.description.toLowerCase().includes(q)) ||
        operator.toLowerCase().includes(q);

      if (!matchesCategory || !matchesOperator || !matchesArea || !matchesSearch) {
        return;
      }

      if (state.favorites.has(camera.id) && groups['group_fav']) {
        groups['group_fav'].cameras.push(camera);
      }

      const gMeta = getGroupForCamera(camera);
      if (!groups[gMeta.id]) {
        groups[gMeta.id] = { ...gMeta, cameras: [] };
      }
      groups[gMeta.id].cameras.push(camera);
    });

    if (groups['group_fav'] && groups['group_fav'].cameras.length > 0) {
      const favOrder = Array.from(state.favorites);
      groups['group_fav'].cameras.sort((a, b) => favOrder.indexOf(a.id) - favOrder.indexOf(b.id));
    }

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[a].order - groups[b].order);

    let html = '';
    let totalVisible = 0;

    sortedGroupKeys.forEach(gKey => {
      const group = groups[gKey];
      if (group.cameras.length === 0) return;

      if (group.id !== 'group_fav') {
        totalVisible += group.cameras.length;
      }

      const isOpen = state.accordionStates[group.id] !== undefined
        ? state.accordionStates[group.id]
        : (group.defaultOpen !== false);

      html += `
        <div class="accordion-group ${isOpen ? 'open' : ''}" data-group-id="${group.id}">
          <div class="accordion-header" onclick="document.dispatchEvent(new CustomEvent('toggle-accordion', {detail: '${group.id}'}))">
            <div class="accordion-title">
              <i class="fa-solid ${group.icon}"></i>
              <span>${group.title}</span>
              <span class="group-count-badge">${group.cameras.length}台</span>
            </div>
            <i class="fa-solid fa-chevron-down accordion-arrow"></i>
          </div>
          <div class="accordion-body">
            ${group.cameras.map(c => renderCameraCard(c)).join('')}
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    // イベントバインド
    bindCameraListEvents(listContainer);

    const noResults = document.getElementById('no-results');
    if (noResults) {
      noResults.style.display = totalVisible === 0 && (groups['group_fav'] ? groups['group_fav'].cameras.length === 0 : true) ? 'block' : 'none';
    }

    updateSidebarCount(totalVisible);
    updateStatusBarDisplay(totalVisible);
  }

  document.addEventListener('toggle-accordion', (e) => {
    const gId = e.detail;
    state.accordionStates[gId] = state.accordionStates[gId] === false ? true : false;
    const groupEl = document.querySelector(`.accordion-group[data-group-id="${gId}"]`);
    if (groupEl) {
      groupEl.classList.toggle('open');
    }
  });

  function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn[data-category]');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = e.currentTarget.getAttribute('data-category');
        
        if (state.activeCategoryFilters.has(category)) {
          state.activeCategoryFilters.delete(category);
          e.currentTarget.classList.remove('active');
          if (state.layers[category]) {
            state.map.removeLayer(state.layers[category]);
          }
        } else {
          state.activeCategoryFilters.add(category);
          e.currentTarget.classList.add('active');
          if (state.layers[category]) {
            state.map.addLayer(state.layers[category]);
          }
        }
        
        renderSidebarList();
      });
    });

    const opBtns = document.querySelectorAll('.operator-btn');
    opBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        opBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.activeOperatorFilter = e.currentTarget.getAttribute('data-operator');
        renderSidebarList();
      });
    });
  }

  function initSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSidebarList();
      });
    }
  }

  function updateSidebarCount(visibleCount) {
    const sidebarCount = document.getElementById('sidebar-count');
    if (sidebarCount) {
      const total = typeof CAMERA_DATA !== 'undefined' ? CAMERA_DATA.length : 0;
      sidebarCount.textContent = `${visibleCount} / ${total} 台`;
    }
  }

  function updateStatusBarDisplay(visibleCount) {
    const countDisplay = document.querySelector('.camera-count');
    if (countDisplay) {
      const total = typeof CAMERA_DATA !== 'undefined' ? CAMERA_DATA.length : 0;
      countDisplay.textContent = `表示 ${visibleCount} / 全 ${total} 台`;
    }
  }

  function initModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(cameraId) {
    const camera = CAMERA_DATA.find(c => c.id === cameraId);
    if (!camera) return;

    // ストリーム動画、または画像がないカメラの場合は、モーダルを開かず直接サイトに飛ぶ（2度手間の排除）
    const isStream = camera.streamType === 'stream' || camera.streamType === 'youtube';
    if ((isStream || !camera.imageUrl) && camera.sourceUrl) {
      const isFav = state.favorites.has(camera.id);
      // お気に入りカメラは独立した新タブ(_blank)、通常カメラは共通タブ(bousai_camera_preview)で開く（タブ無限増殖の防止）
      const targetWindow = isFav ? '_blank' : 'bousai_camera_preview';
      const previewWin = window.open(camera.sourceUrl, targetWindow);
      if (previewWin) {
        try { previewWin.focus(); } catch (e) {}
      }
      return;
    }

    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const category = camera.category || 'other';
    const categoryLabel = CONFIG.CATEGORY_LABELS[category] || 'その他';
    const categoryIcon = CONFIG.CATEGORY_ICONS[category] || 'fa-video';
    const isFav = state.favorites.has(camera.id);

    const title = document.getElementById('modal-title');
    if (title) {
      title.innerHTML = `
        <span>${camera.name}</span>
        <button class="fav-btn modal-fav-btn ${isFav ? 'active' : ''}" data-camera-id="${camera.id}" title="お気に入り登録" onclick="event.stopPropagation();">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
        </button>
      `;
      const mFavBtn = title.querySelector('.modal-fav-btn');
      if (mFavBtn) {
        mFavBtn.addEventListener('click', (e) => toggleFavorite(camera.id, e));
      }
    }

    const imageArea = document.getElementById('modal-image');
    if (imageArea) {
      if (camera.status === 'maintenance') {
        imageArea.innerHTML = `
          <div class="modal-placeholder" style="color: #9ca3af;">
            <i class="fa-solid fa-wrench"></i>
            <span>現在、機器調整中または休止中のため映像を取得できません。</span>
          </div>`;
      } else if (camera.streamType === 'stream' || camera.streamType === 'youtube') {
        // タイプB: ライブ動画・参照型（ダミー画像を出さず案内カードを表示）
        imageArea.innerHTML = `
          <div class="modal-placeholder" style="color: var(--text-primary); display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem; background: var(--bg-tertiary);">
            <i class="fa-solid fa-video" style="font-size: 3.5rem; color: #8b5cf6;"></i>
            <p style="font-size: 1.15rem; font-weight: bold; line-height: 1.5; margin: 0;">
              「${camera.name}」はライブ動画・配信元参照カメラです
            </p>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">
              配信元サイト（公式サイト）でリアルタイム映像をご覧いただけます。
            </p>
            <a href="${camera.sourceUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); margin-top: 10px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 公式サイトでライブ映像を再生する
            </a>
          </div>`;
      } else if (camera.imageUrl) {
        imageArea.innerHTML = `
          <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 11px; color: var(--accent); background: rgba(15, 23, 42, 0.8); padding: 4px 8px; border-radius: 4px; margin-bottom: 6px; border: 1px solid var(--border);">
              <i class="fa-solid fa-camera"></i> ピン選択時点の配信元最新画像を表示しています
            </div>
            <img src="${camera.imageUrl}" alt="${camera.name}" style="max-height: calc(100% - 28px);">
          </div>`;
      } else {
        imageArea.innerHTML = `
          <div class="modal-placeholder">
            <i class="fa-solid ${categoryIcon}"></i>
            <span>静止画または動画ストリーム</span>
            <a href="${camera.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn-source" style="margin-top: 15px; display: inline-block; background: var(--accent); color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
              <i class="fa-solid fa-external-link"></i> 配信元サイトを開いて映像を確認
            </a>
          </div>`;
      }
    }

    const details = document.getElementById('modal-details');
    if (details) {
      details.innerHTML = `
        <div class="modal-detail-row">
          <span class="modal-detail-label">カテゴリ</span>
          <span class="modal-detail-value">
            <span class="category-badge badge-${category}">${categoryLabel}</span>
          </span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">管理者</span>
          <span class="modal-detail-value">${camera.operator || '不明'}</span>
        </div>
        ${camera.description ? `
        <div class="modal-detail-row">
          <span class="modal-detail-label">説明・設置場所</span>
          <span class="modal-detail-value">${camera.description}</span>
        </div>` : ''}
        <div class="modal-detail-row">
          <span class="modal-detail-label">配信形式</span>
          <span class="modal-detail-value">${camera.streamType === 'youtube' ? 'YouTube Live' : camera.streamType === 'stream' ? '動画ストリーム' : '静止画（定期更新）'}</span>
        </div>
      `;
    }

    const actions = document.getElementById('modal-actions');
    if (actions) {
      actions.innerHTML = `
        <a href="${camera.sourceUrl}" target="${isFav ? '_blank' : 'bousai_camera_preview'}" class="btn-modal-source">
          <i class="fa-solid fa-external-link"></i> 配信元サイトを開く
        </a>
      `;
    }

    overlay.classList.add('active');

    if (state.map && !state.isMapCollapsed) {
      state.map.flyTo([camera.lat, camera.lng], 14, { duration: 0.8 });
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  function startAutoRefresh() {
    state.nextRefreshTime = Date.now() + CONFIG.REFRESH_INTERVAL;
    state.refreshTimer = setInterval(refreshImages, CONFIG.REFRESH_INTERVAL);
    state.countdownTimer = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function refreshImages() {
    const images = document.querySelectorAll('.live-image');
    images.forEach(img => {
      const baseSrc = img.getAttribute('data-base-src');
      if (baseSrc) {
        img.src = baseSrc;
      }
    });

    state.nextRefreshTime = Date.now() + CONFIG.REFRESH_INTERVAL;
    updateStatusBar();
  }

  function updateTimer() {
    const timerText = document.getElementById('timer-text');
    const progressBar = document.getElementById('timer-progress');
    if (!state.nextRefreshTime) return;

    const remainingMs = Math.max(0, state.nextRefreshTime - Date.now());
    if (timerText) {
      timerText.textContent = `次回更新: ${formatCountdown(remainingMs)}`;
    }
    if (progressBar) {
      const percent = Math.min(100, Math.max(0, (1 - remainingMs / CONFIG.REFRESH_INTERVAL) * 100));
      progressBar.style.width = `${percent}%`;
    }
  }

  function updateStatusBar() {
    const lastUpdate = document.querySelector('.last-update');
    if (lastUpdate) {
      lastUpdate.textContent = `最終更新: ${formatTime(new Date())}`;
    }
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // ■ 水位観測所（◯）マーカーの配置とホバー・クリック連携
  function initWaterLevelMarkers() {
    if (typeof WATER_LEVEL_STATIONS === 'undefined' || !state.layers['water_level']) return;

    WATER_LEVEL_STATIONS.forEach(station => {
      // 警戒レベル・水防水位に応じた動的カラー判定
      let levelColor = '#10b981'; // デフォルト: 正常(緑)
      let levelText = '平常水位 (正常)';
      let levelBadgeClass = 'warning-none';
      let stationClass = 'station-normal';
      let tagHtml = ''; // ユーザー要望により常時表示タグは一旦非表示

      if (station.level === 'danger' || station.status === 'danger') {
        levelColor = '#ef4444'; // 氾濫危険・避難判断 (赤)
        levelText = '氾濫危険水位超過 (レベル3〜4相当)';
        levelBadgeClass = 'warning-danger';
        stationClass = 'station-danger';
        // tagHtml = `<div class="always-visible-alert-tag danger-tag">🚨 ${shortName}【氾濫危険】</div>`;
      } else if (station.level === 'warning' || station.status === 'warning') {
        levelColor = '#f59e0b'; // 氾濫注意 (黄)
        levelText = '氾濫注意水位超過 (レベル2相当)';
        levelBadgeClass = 'warning-caution';
        stationClass = 'station-warning';
        // tagHtml = `<div class="always-visible-alert-tag warning-tag">⚠️ ${shortName}【氾濫注意】</div>`;
      } else if (station.status === 'maintenance' || station.status === 'inactive') {
        levelColor = '#9ca3af'; // 欠測・調整中 (灰)
        levelText = 'データ調整中';
      }

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-wrapper" style="position: relative;">
                 ${tagHtml}
                 <div class="marker-icon water-level-marker-icon ${stationClass}" style="background: ${levelColor} !important;" title="${station.name}">
                   <i class="fa-solid fa-droplet" style="color: white; font-size: 10px;"></i>
                 </div>
               </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([station.lat, station.lng], { icon: customIcon });

      const popupContent = `
        <div class="hover-popup">
          <div class="hover-popup-title" style="color: ${levelColor};">💧 ${station.name}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin: 4px 0;">${station.riverName}</div>
          <div style="margin: 4px 0;"><span class="weather-badge ${levelBadgeClass}">${levelText}</span></div>
          <div class="hover-popup-hint" style="color: ${levelColor};"><i class="fa-solid fa-chart-line"></i> タップ／クリックで断面図・リアルタイム水位・予測を表示</div>
        </div>
      `;

      // 水位観測所初期化時に1度だけTooltipをバインド
      const waterTooltip = L.tooltip({
        direction: 'top',
        interactive: true,
        className: 'custom-smart-tooltip',
        offset: [0, -10]
      }).setContent(popupContent);
      marker.bindTooltip(waterTooltip);

      // 全マーカー共通のホバー・クリック・離脱・ホバー維持イベントをバインド（水位観測所にも完全適用）
      setupTooltipHoverEvents(marker, null, true, station);

      state.layers['water_level'].addLayer(marker);
    });
  }

  // ■ 気象庁防災情報データ（040000.json）から気象警報・注意報を取得・描画する関数（エリア連動）
  async function fetchWeatherAlerts(activeArea) {
    if (!activeArea) activeArea = state.activeAreaFilter || 'ishinomaki';
    const alertBar = document.getElementById('weather-alert-bar');
    if (!alertBar) return;

    // エリアごとの対象市町村定義
    const AREA_CITIES = {
      'ishinomaki': [
        { code: '0420200', name: '石巻市' },
        { code: '0421400', name: '東松島市' },
        { code: '0458100', name: '女川町' }
      ],
      'sendai': [
        { code: '0410001', name: '仙台市東部' },
        { code: '0410002', name: '仙台市西部' },
        { code: '0420300', name: '塩竈市' },
        { code: '0420700', name: '名取市' },
        { code: '0420900', name: '多賀城市' },
        { code: '0421100', name: '岩沼市' },
        { code: '0421600', name: '富谷市' }
      ],
      'osaki': [
        { code: '0421501', name: '大崎市東部' },
        { code: '0421502', name: '大崎市西部' },
        { code: '0444500', name: '加美町' },
        { code: '0450500', name: '美里町' },
        { code: '0444400', name: '色麻町' },
        { code: '0450100', name: '涌谷町' }
      ],
      'kurihara': [
        { code: '0421301', name: '栗原市東部' },
        { code: '0421302', name: '栗原市西部' }
      ],
      'tome': [
        { code: '0421200', name: '登米市' }
      ],
      'kesennuma': [
        { code: '0420500', name: '気仙沼市' },
        { code: '0460600', name: '南三陸町' }
      ],
      'sennan': [
        { code: '0420600', name: '白石市' },
        { code: '0420800', name: '角田市' },
        { code: '0432100', name: '大河原町' },
        { code: '0430100', name: '蔵王町' },
        { code: '0430200', name: '七ヶ宿町' },
        { code: '0432200', name: '村田町' },
        { code: '0432300', name: '柴田町' },
        { code: '0432400', name: '川崎町' },
        { code: '0434100', name: '丸森町' }
      ],
      'all': [
        { code: '0420200', name: '石巻市' },
        { code: '0410001', name: '仙台市東部' },
        { code: '0410002', name: '仙台市西部' },
        { code: '0421501', name: '大崎市東部' },
        { code: '0421301', name: '栗原市東部' },
        { code: '0421200', name: '登米市' },
        { code: '0420500', name: '気仙沼市' },
        { code: '0420600', name: '白石市' }
      ]
    };

    const targetCities = AREA_CITIES[activeArea] || AREA_CITIES['ishinomaki'];

    try {
      const res = await fetch('https://www.jma.go.jp/bosai/warning/data/warning/040000.json', {
        cache: 'no-cache'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const warningNames = {
        '02': '暴風雪警報', '03': '大雨警報', '04': '洪水警報', '05': '暴風警報', '06': '大雪警報', '07': '波浪警報', '08': '高潮警報',
        '10': '大雨注意報', '12': '洪水注意報', '13': '風雪注意報', '14': '強風注意報', '15': '大雪注意報', '16': '波浪注意報', '17': '高潮注意報',
        '18': '融雪注意報', '19': '濃霧注意報', '20': '雷注意報', '21': '乾燥注意報', '22': '濃霧注意報', '23': '低温注意報',
        '32': '暴風雪特別警報', '33': '大雨特別警報', '35': '暴風特別警報', '36': '大雪特別警報', '37': '波浪特別警報', '38': '高潮特別警報'
      };

      const cityAlerts = {};

      // 気象庁JSON: data.areaTypes[].areas[] をパース
      if (data && data.areaTypes && Array.isArray(data.areaTypes)) {
        for (const at of data.areaTypes) {
          if (!at.areas || !Array.isArray(at.areas)) continue;
          for (const area of at.areas) {
            const matchedCity = targetCities.find(c => c.code === area.code);
            if (!matchedCity) continue;
            const activeList = [];
            if (area.warnings && Array.isArray(area.warnings)) {
              for (const w of area.warnings) {
                if (w.status === '解除') continue;
                if (warningNames[w.code]) {
                  const isDanger = ['02','03','04','05','06','07','08','32','33','35','36','37','38'].includes(w.code);
                  activeList.push({ name: warningNames[w.code], isDanger });
                }
              }
            }
            cityAlerts[matchedCity.name] = activeList;
          }
        }
      }

      let html = `<div style="font-weight: bold; color: var(--accent); margin-right: 8px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: pointer;" onclick="window.open('https://www.jma.go.jp/bosai/#area_type=offices&area_code=040000', '_blank', 'noopener,noreferrer')" title="宮城県全体の気象警報（気象庁）を開く"><i class="fa-solid fa-cloud-bolt"></i> 警報・注意報:</div>`;

      targetCities.forEach(city => {
        const alerts = cityAlerts[city.name] || [];
        const jmaCityUrl = `https://www.jma.go.jp/bosai/#area_type=class20s&area_code=${city.code}`;
        html += `<div class="weather-item" onclick="window.open('${jmaCityUrl}', '_blank', 'noopener,noreferrer')" style="cursor: pointer;" title="${city.name}の気象警報（気象庁）を開く">
          <span class="weather-area-name">${city.name}</span>`;
        if (alerts.length === 0) {
          html += `<span class="weather-badge warning-none">なし</span>`;
        } else {
          alerts.forEach(a => {
            const badgeClass = a.isDanger ? 'warning-danger' : 'warning-caution';
            html += `<span class="weather-badge ${badgeClass}">${a.name}</span>`;
          });
        }
        html += `</div>`;
      });

      alertBar.innerHTML = html;
    } catch (err) {
      console.warn('気象警報取得エラー:', err);
      // エラー時もバーを見やすく更新（読み込み中で止まらないようにする）
      alertBar.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 12px;">
        <i class="fa-solid fa-cloud-bolt"></i>
        <span>気象警報: 気象庁データの取得に失敗しました。</span>
        <a href="https://www.jma.go.jp/bosai/warning/#area_type=1&area_code=040000" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: underline;">気象庁で確認</a>
      </div>`;
    }
  }

  // ■ 水位観測所 大画面モーダル表示（特定局のリアルタイム水位経過表・断面図に直リンク）
  function openWaterLevelModal(station) {
    if (station.systemUrl) {
      window.open(station.systemUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const title = document.getElementById('modal-title');
    if (title) {
      title.innerHTML = `<span style="color: #10b981;">💧 ${station.name} — リアルタイム水位経過表・断面図</span>`;
    }

    const imageArea = document.getElementById('modal-image');
    if (imageArea) {
      imageArea.innerHTML = `
        <div class="modal-placeholder" style="color: var(--text-primary); display: flex; flex-direction: column; gap: 1.2rem; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem; background: var(--bg-tertiary);">
          <i class="fa-solid fa-chart-line" style="font-size: 3.5rem; color: #10b981;"></i>
          <p style="font-size: 1.2rem; font-weight: bold; line-height: 1.5;">
            「${station.name}」のリアルタイム水位グラフ・断面図を表示します
          </p>
          <a href="${station.systemUrl}" target="_blank" rel="noopener noreferrer" onclick="closeModal();" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; background: linear-gradient(135deg, #059669, #10b981); color: white; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 1.15rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1.0)'">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> 「${station.name}」の水位経過表・断面図（宮城県システム）を開く
          </a>
        </div>
      `;
    }

    const details = document.getElementById('modal-details');
    if (details) {
      details.innerHTML = `
        <div class="modal-detail-row">
          <span class="modal-detail-label">観測局名</span>
          <span class="modal-detail-value" style="font-weight: 700; color: #10b981;">${station.name} (${station.stationNo})</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">河川名</span>
          <span class="modal-detail-value">${station.riverName}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">所在地</span>
          <span class="modal-detail-value">${station.address}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">管理者</span>
          <span class="modal-detail-value">${station.operator}</span>
        </div>
      `;
    }

    const actions = document.getElementById('modal-actions');
    if (actions) {
      actions.innerHTML = ``;
    }

    overlay.classList.add('active');
  }

  // 独立したサブウィンドウ（ポップアップ画面）を起動する共通関数（グローバルに露出）
  window.openStationSubWindow = function(url) {
    const width = 960;
    const height = 720;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    window.open(
      url,
      'water_level_subwindow',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no`
    );
  };

  // ■ 使い方・凡例モーダルの初期化
  function initInfoModal() {
    const btn = document.getElementById('info-btn');
    const modal = document.getElementById('info-modal-overlay');
    const closeBtn = document.getElementById('info-modal-close');
    
    if (!btn || !modal) return;
    
    btn.addEventListener('click', () => {
      modal.classList.add('active');
    });
    
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  // ■ タイマー注記ツールチップの初期化
  function initTimerTooltip() {
    const icon = document.getElementById('timer-info-icon');
    const tooltip = document.getElementById('timer-tooltip-popup');

    if (!icon || !tooltip) return;

    let isTooltipActive = false;

    // ホバー時
    icon.addEventListener('mouseenter', () => {
      tooltip.classList.add('active');
    });

    icon.addEventListener('mouseleave', () => {
      if (!isTooltipActive) tooltip.classList.remove('active');
    });

    // クリック/タップ時（スマホ対応）
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      isTooltipActive = !isTooltipActive;
      if (isTooltipActive) {
        tooltip.classList.add('active');
      } else {
        tooltip.classList.remove('active');
      }
    });

    document.addEventListener('click', () => {
      isTooltipActive = false;
      tooltip.classList.remove('active');
    });
  }

  // ■ マーカー共通のスマートホバー・クリック・自動消去遅延バインド関数
  function setupTooltipHoverEvents(marker, camera = null, isWater = false, station = null) {
    const markerId = camera ? camera.id : (station ? 'water_' + (station.stationNo || station.name) : null);

    const smartOpenTooltip = () => {
      const currentTooltip = marker.getTooltip();
      if (!currentTooltip) return;

      const config = calculateSmartDirectionAndOffset(marker);
      const content = currentTooltip.getContent();
      const className = currentTooltip.options.className || 'custom-smart-tooltip';

      marker.unbindTooltip();
      marker.bindTooltip(content, {
        direction: config.direction,
        interactive: true,
        className: className,
        offset: config.offset
      }).openTooltip();
    };

    const syncSidebar = () => {
      if (camera) {
        const gMeta = getGroupForCamera(camera);
        state.accordionStates[gMeta.id] = true;
        const groupEl = document.querySelector(`.accordion-group[data-group-id="${gMeta.id}"]`);
        if (groupEl && !groupEl.classList.contains('open')) {
          groupEl.classList.add('open');
        }
        setTimeout(() => {
          const card = document.querySelector(`.camera-card[data-camera-id="${camera.id}"]`);
          const listContainer = document.getElementById('camera-list');
          if (card && listContainer) {
            const listRect = listContainer.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const isVisible = (cardRect.top >= listRect.top) && (cardRect.bottom <= listRect.bottom);
            if (!isVisible) {
              listContainer.scrollBy({
                top: cardRect.top - listRect.top - 20,
                behavior: 'smooth'
              });
            }
            card.classList.add('card-highlight');
            setTimeout(() => card.classList.remove('card-highlight'), 2000);
          }
        }, 150);
      }
    };

    // クリック・タップ時の挙動（スマホ：1回目でポップアップ展開、2回目で遷移 / PC：即遷移）
    marker.on('click', (e) => {
      if (e && e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }

      // すでにこのマーカーがアクティブ（ポップアップ表示中）だった場合 -> 2回目タップで遷移
      if (state.activeMarkerId === markerId) {
        window.__triggerMarkerAction(markerId);
      } else {
        // 初回タップ時 -> アクティブ状態にセットし、ポップアップを開く
        state.activeMarkerId = markerId;
        smartOpenTooltip();
        syncSidebar();
      }
    });

    // マウスホバー時（PC）
    marker.on('mouseover', (e) => {
      // スマホのタップ時に発生する疑似mouseoverによる即時遷移を防ぐため、PCの純粋なマウス操作時のみアクティブ化する
      const isMousePointer = e && e.originalEvent && (e.originalEvent.pointerType === 'mouse' || (e.originalEvent.pointerType === undefined && e.originalEvent.type === 'mouseover'));
      if (isMousePointer && !L.Browser.mobile) {
        state.activeMarkerId = markerId;
      }
      smartOpenTooltip();
      syncSidebar();
    });

    // ポップアップカード自体がタップ/クリックされた時も遷移を実行
    marker.on('tooltipopen', () => {
      const tooltip = marker.getTooltip();
      if (!tooltip) return;
      const tooltipEl = tooltip.getElement();
      if (tooltipEl) {
        L.DomEvent.disableClickPropagation(tooltipEl);
        tooltipEl.style.cursor = 'pointer';

        const handleTooltipTap = (e) => {
          if (e) {
            e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
          }
          window.__triggerMarkerAction(markerId);
        };

        tooltipEl.onclick = handleTooltipTap;
        tooltipEl.ontouchend = handleTooltipTap;
      }
    });
  }

  // ■ 画面上のピン位置から最適方向（top/bottom/left/right/四隅斜め）とオフセットを計算する全方向判定関数
  function calculateSmartDirectionAndOffset(marker) {
    if (!state.map || !marker) return { direction: 'top', offset: [0, -10] };
    const pt = state.map.latLngToContainerPoint(marker.getLatLng());
    const mapSize = state.map.getSize();

    const isTop = pt.y < 350;
    const isBottom = pt.y > mapSize.y - 250;
    const isLeft = pt.x < 220;
    const isRight = pt.x > mapSize.x - 220;

    // 四隅の斜め判定
    if (isTop && isLeft) {
      return { direction: 'right', offset: [15, 20] }; // 左上角 -> 右下斜め
    }
    if (isTop && isRight) {
      return { direction: 'left', offset: [-15, 20] }; // 右上角 -> 左下斜め
    }
    if (isBottom && isLeft) {
      return { direction: 'right', offset: [15, -20] }; // 左下角 -> 右上斜め
    }
    if (isBottom && isRight) {
      return { direction: 'left', offset: [-15, -20] }; // 右下角 -> 左上斜め
    }

    // 上下左右の単体判定
    if (isTop) {
      return { direction: 'bottom', offset: [0, 20] }; // 上端 -> 下向き
    }
    if (isBottom) {
      return { direction: 'top', offset: [0, -10] }; // 下端 -> 上向き
    }
    if (isLeft) {
      return { direction: 'right', offset: [15, 0] }; // 左端 -> 右向き
    }
    if (isRight) {
      return { direction: 'left', offset: [-15, 0] }; // 右端 -> 左向き
    }

    // デフォルト（中央部）
    return { direction: 'top', offset: [0, -10] };
  }

  // サイドバーのリサイズ機能
  function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      resizer.classList.add('is-resizing');
      
      // サイドバーのtransitionを一時的に無効化してスムーズに追従させる
      sidebar.style.transition = 'none';
      
      // 地図のポインターイベントを無効化してドラッグ中の誤操作を防ぐ
      const mapWrapper = document.getElementById('map-wrapper');
      if (mapWrapper) mapWrapper.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      // 画面右端からの距離を計算してサイドバーの幅とする
      let newWidth = document.body.clientWidth - e.clientX;
      
      // 最小幅・最大幅の制限
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 800) newWidth = 800;
      
      sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        resizer.classList.remove('is-resizing');
        sidebar.style.transition = ''; // CSSのtransitionを元に戻す
        
        const mapWrapper = document.getElementById('map-wrapper');
        if (mapWrapper) mapWrapper.style.pointerEvents = '';
        
        // リサイズ完了時にLeaflet地図を再描画（表示崩れ防止）
        if (state.map) {
          state.map.invalidateSize();
        }
      }
    });
  }

  // ■ 国土地理院ハザードマップ重ね合わせコントロールの初期化
  function initHazardMapControl() {
    const toggleBtn = document.getElementById('hazard-toggle-btn');
    const dropdown = document.getElementById('hazard-menu-dropdown');
    const container = document.getElementById('hazard-floating-control');
    const btnLabel = document.getElementById('hazard-btn-label');
    const legendPanel = document.getElementById('hazard-legend-panel');
    const refreshBtn = document.getElementById('hazard-refresh-btn');
    const infoBtn = document.getElementById('hazard-info-btn');
    const infoModal = document.getElementById('hazard-info-modal-overlay');
    const infoCloseBtn = document.getElementById('hazard-info-modal-close');

    if (!toggleBtn || !dropdown || !state.map) return;

    let currentHazardLayer = null;
    let activeHazardType = 'none';

    // 開閉トグル
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'flex';
      dropdown.style.display = isOpen ? 'none' : 'flex';
      container.classList.toggle('open', !isOpen);
    });

    // 画面外クリックでドロップダウンを閉じる
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
      container.classList.remove('open');
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // 利用規約・免責事項モーダルの開閉
    if (infoBtn && infoModal) {
      infoBtn.addEventListener('click', () => {
        dropdown.style.display = 'none';
        container.classList.remove('open');
        infoModal.classList.add('active');
      });
    }

    if (infoCloseBtn && infoModal) {
      infoCloseBtn.addEventListener('click', () => {
        infoModal.classList.remove('active');
      });
    }

    if (infoModal) {
      infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
          infoModal.classList.remove('active');
        }
      });
    }

    // 最新タイルの再取得（リフレッシュ）
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (currentHazardLayer) {
          // タイル再描画の実行
          if (currentHazardLayer.redraw) {
            currentHazardLayer.redraw();
          } else if (currentHazardLayer.eachLayer) {
            currentHazardLayer.eachLayer(l => { if (l.redraw) l.redraw(); });
          }
          const origText = refreshBtn.innerHTML;
          refreshBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> 最新化完了';
          setTimeout(() => {
            refreshBtn.innerHTML = origText;
            dropdown.style.display = 'none';
            container.classList.remove('open');
          }, 600);
        } else {
          dropdown.style.display = 'none';
          container.classList.remove('open');
        }
      });
    }

    // 凡例およびレイヤー定義
    const HAZARD_CONFIG = {
      none: {
        label: 'ハザード',
        active: false,
        legendHtml: ''
      },
      flood: {
        label: 'ハザード: 洪水',
        active: true,
        createLayer: () => L.tileLayer('https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png', {
          minZoom: 2,
          maxZoom: 17,
          opacity: 0.65,
          pane: 'hazardPane',
          attribution: '&copy; <a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html" target="_blank">国土地理院(洪水)</a>'
        }),
        legendHtml: `
          <div class="hazard-legend-title">
            <span>🌊 洪水浸水想定区域（想定最大規模）</span>
            <span class="hazard-legend-credit-link" title="利用規約・免責事項を確認">国土地理院 ℹ️</span>
          </div>
          <div class="hazard-legend-items">
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fef08a;"></span> 0.5m未満 (床下)</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fed7aa;"></span> 0.5〜3m (1階床上)</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fb923c;"></span> 3〜5m (2階床上)</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #c084fc;"></span> 5〜10m (水没)</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #7e22ce;"></span> 10m以上</span>
          </div>
        `
      },
      debris: {
        label: 'ハザード: 土砂',
        active: true,
        createLayer: () => {
          const doseki = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png', {
            minZoom: 2,
            maxZoom: 17,
            opacity: 0.7,
            pane: 'hazardPane'
          });
          const kyukeisha = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png', {
            minZoom: 2,
            maxZoom: 17,
            opacity: 0.7,
            pane: 'hazardPane',
            attribution: '&copy; <a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html" target="_blank">国土地理院(土砂)</a>'
          });
          return L.layerGroup([doseki, kyukeisha]);
        },
        legendHtml: `
          <div class="hazard-legend-title">
            <span>⛰️ 土砂災害警戒区域（土石流・急傾斜地）</span>
            <span class="hazard-legend-credit-link" title="利用規約・免責事項を確認">国土地理院 ℹ️</span>
          </div>
          <div class="hazard-legend-items">
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #facc15;"></span> 警戒区域 (イエローゾーン)</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #ef4444;"></span> 特別警戒区域 (レッドゾーン)</span>
          </div>
        `
      },
      tsunami: {
        label: 'ハザード: 津波',
        active: true,
        createLayer: () => L.tileLayer('https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png', {
          minZoom: 2,
          maxZoom: 17,
          opacity: 0.65,
          pane: 'hazardPane',
          attribution: '&copy; <a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html" target="_blank">国土地理院(津波)</a>'
        }),
        legendHtml: `
          <div class="hazard-legend-title">
            <span>🌊 津波浸水想定区域</span>
            <span class="hazard-legend-credit-link" title="利用規約・免責事項を確認">国土地理院 ℹ️</span>
          </div>
          <div class="hazard-legend-items">
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fef08a;"></span> 0.3m未満</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fed7aa;"></span> 0.3〜1m</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #fb923c;"></span> 1〜3m</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #f43f5e;"></span> 3〜5m</span>
            <span class="hazard-legend-item"><span class="hazard-color-box" style="background: #9333ea;"></span> 5m以上</span>
          </div>
        `
      }
    };

    // メニュー項目クリックイベント
    dropdown.querySelectorAll('.hazard-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const hazardType = item.getAttribute('data-hazard');
        const conf = HAZARD_CONFIG[hazardType];
        if (!conf) return;

        activeHazardType = hazardType;

        // アクティブ表示の切り替え
        dropdown.querySelectorAll('.hazard-menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // ボタン表示更新
        btnLabel.textContent = conf.label;
        if (conf.active) {
          toggleBtn.classList.add('active');
        } else {
          toggleBtn.classList.remove('active');
        }

        // 既存レイヤーの削除
        if (currentHazardLayer) {
          state.map.removeLayer(currentHazardLayer);
          currentHazardLayer = null;
        }

        // 新規レイヤーの追加と凡例更新
        if (conf.active && conf.createLayer) {
          currentHazardLayer = conf.createLayer();
          currentHazardLayer.addTo(state.map);
          legendPanel.innerHTML = conf.legendHtml;
          legendPanel.style.display = 'block';

          // 凡例内のクレジットクリックでモーダルを開く
          const creditLink = legendPanel.querySelector('.hazard-legend-credit-link');
          if (creditLink && infoModal) {
            creditLink.addEventListener('click', (ev) => {
              ev.stopPropagation();
              infoModal.classList.add('active');
            });
          }
        } else {
          legendPanel.style.display = 'none';
          legendPanel.innerHTML = '';
        }

        // ドロップダウンを閉じる
        dropdown.style.display = 'none';
        container.classList.remove('open');
      });
    });
  }

})();
