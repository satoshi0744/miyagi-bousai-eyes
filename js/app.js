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

  // ■ 水系・地域グループの完全定義判定関数（「その他河川」を完全撤廃し全294台を各圏域へ所属）
  // ■ 水系・地域グループの完全定義判定関数（GPS座標と水系実態による厳密12グループ）
  function getGroupForCamera(camera) {
    const name = camera.name || '';
    const desc = camera.description || '';
    const op = camera.operator || '';
    const text = `${name} ${desc} ${op}`;
    const category = camera.category || 'other';
    const lat = typeof camera.lat === 'number' ? camera.lat : 0;
    const lng = typeof camera.lng === 'number' ? camera.lng : 0;

    // 1. 道路カメラ
    if (category === 'road' || name.includes('IC') || name.includes('三陸沿岸')) {
      return { id: 'group_road', title: '🚗 道路・三陸沿岸道路IC', icon: 'fa-road', order: 12, defaultOpen: false };
    }

    // 2. 岩手県（北緯39度以北、または岩手県明記）
    if (text.includes('[岩手県]') || lat >= 39.00) {
      return { id: 'group_iwate', title: '🏔️ 岩手県：北上川上流・中流域', icon: 'fa-mountain-sun', order: 1, defaultOpen: false };
    }

    // 3. 気仙沼・南三陸圏（三陸北部：lat >= 38.75 かつ lng >= 141.35）
    if (lat >= 38.75 && lng >= 141.35) {
      return { id: 'group_kesennuma', title: '🌊 気仙沼・南三陸圏：津谷川・八瀬川・沿岸水系', icon: 'fa-fish', order: 2, defaultOpen: false };
    }

    // 4. 栗原圏（県北西部：lat >= 38.68 かつ lng < 141.18）
    if (lat >= 38.68 && lng < 141.18) {
      return { id: 'group_kurihara', title: '🌊 栗原圏：迫川上流・二迫川水系', icon: 'fa-water', order: 3, defaultOpen: false };
    }

    // 5. 登米圏（県北東部：北上川登米・迫川下流・東和町等）
    if (lat >= 38.58 && lng >= 141.15 && (lat >= 38.68 || lng < 141.38) &&
        !text.includes('石巻') && !name.includes('大沢川') && !name.includes('植立山') && !name.includes('月浜') &&
        !name.includes('江合川') && !name.includes('出来川') && !text.includes('美里') && !text.includes('涌谷') &&
        !name.includes('神取橋') && !name.includes('佳景山')) {
      return { id: 'group_tome', title: '🌊 登米圏：迫川下流・北上川登米水系', icon: 'fa-water', order: 4, defaultOpen: false };
    }

    // 6. 石巻圏：旧北上川水系（神取橋・佳景山・鹿又・開北橋・日和大橋）
    if (name.includes('旧北上川') || name.includes('日和山') || name.includes('住吉') || name.includes('神取橋') || name.includes('内海橋') || name.includes('石巻大橋') || name.includes('鹿又') || name.includes('佳景山') || name.includes('真野川')) {
      return { id: 'group_kyu_kitakami', title: '🌊 石巻圏：旧北上川水系', icon: 'fa-water', order: 8, defaultOpen: false };
    }

    // 7. 石巻圏：北上川下流・東部沿岸水系（新北上川本流＋大沢川、加茂川、皿貝川、中島川、高木川、月浜沢川、植立山など）
    if (text.includes('石巻') || (text.includes('女川') && !name.includes('美女川')) || name.includes('北上川') || name.includes('飯野川') || name.includes('釜谷') || name.includes('福地') ||
        name.includes('大沢川') || name.includes('皿貝川') || name.includes('中島川') || name.includes('加茂川') || name.includes('高木川') || name.includes('馬鞍川') || name.includes('内の原') || name.includes('月浜') || name.includes('植立山') ||
        (lng >= 141.22 && lat >= 38.40)) {
      return { id: 'group_kitakami', title: '🌊 石巻圏：北上川下流・東部沿岸水系', icon: 'fa-water', order: 9, defaultOpen: false };
    }

    // 8. 東松島：鳴瀬川下流・河口沿岸水系（中東部河口域：lng >= 141.12 かつ lng < 141.22）
    if (text.includes('東松島') || (text.includes('鳴瀬') && lat < 38.45 && lng >= 141.12) || name.includes('東名運河') || name.includes('鞍坪') || name.includes('小野橋') || name.includes('若針') || name.includes('竹谷') ||
        (lng >= 141.12 && lng < 141.22 && lat >= 38.36 && lat < 38.46)) {
      return { id: 'group_naruse_east', title: '🌊 東松島：鳴瀬川下流・河口沿岸水系', icon: 'fa-water', order: 7, defaultOpen: false };
    }

    // 9. 大崎・加美圏（県中西部：江合川・鳴瀬川上流水系、美里町・涌谷町域を含む）
    if (text.includes('江合川') || text.includes('多田川') || text.includes('大江川') || text.includes('新江合') || text.includes('出来川') || text.includes('田尻川') || text.includes('美女川') || text.includes('名鰭') || text.includes('鶴田川') || text.includes('新堀川') ||
        text.includes('美里') || text.includes('小牛田') || text.includes('涌谷') || text.includes('古川') || text.includes('岩出山') || text.includes('加美') || text.includes('色麻') ||
        (lat >= 38.45 && lat < 38.68 && lng >= 140.70 && lng < 141.25 &&
         !text.includes('大郷') && !text.includes('石巻') && !text.includes('登米') && !name.includes('吉田川') && !name.includes('善川') && !name.includes('竹林川'))) {
      return { id: 'group_osaki_kami', title: '🌊 大崎・加美圏：江合川・鳴瀬川上流水系', icon: 'fa-water', order: 5, defaultOpen: false };
    }

    // 10. 吉田川水系（黒川・大和・大郷：内陸西部）
    if (name.includes('吉田川') || name.includes('善川') || name.includes('竹林川') || name.includes('粕川') ||
        text.includes('大郷') || text.includes('大和') ||
        (lat >= 38.38 && lat < 38.48 && lng >= 140.85 && lng < 141.12 && !text.includes('松島'))) {
      return { id: 'group_yoshida', title: '🌊 吉田川中上流：黒川・大和・大郷水系', icon: 'fa-water', order: 6, defaultOpen: false };
    }

    // 11. 仙南圏（県南部：lat < 38.12、白石川・阿武隈川水系、亘理、岩沼河口、遠刈田・蔵王）
    if (lat < 38.12 || text.includes('白石') || text.includes('角田') || text.includes('大河原') || text.includes('柴田') || text.includes('丸森') || text.includes('七ヶ宿') || text.includes('阿武隈') || text.includes('亘理') || text.includes('遠刈田') || text.includes('蔵王')) {
      return { id: 'group_sennan', title: '🌊 仙南圏：白石川・阿武隈川水系', icon: 'fa-water', order: 11, defaultOpen: false };
    }

    // 12. 仙台・仙塩圏（名取川・七北田川・砂押川・仙台市・塩竈・多賀城・松島）
    return { id: 'group_sendai', title: '🌊 仙台・仙塩圏：名取川・七北田川水系', icon: 'fa-building-flag', order: 10, defaultOpen: false };
  }

  // ■ 川の流れ順（上流→下流）ソート用ヘルパー関数群
  // 2点間の直線距離（km）を計算（ヒュベニの公式）
  function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || typeof lat2 !== 'number' || typeof lng2 !== 'number') return 0;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  }

  // カメラ配列を「物理ピン座標基準（上流→下流・河口から遠い順）」にソート
  function sortCamerasByRiverFlow(cameras, groupId) {
    if (!cameras || cameras.length <= 1) return cameras;

    // お気に入りグループはユーザー順序を保持するためソート対象外
    if (groupId === 'group_fav') {
      return cameras;
    }

    // 1. 岩手県：北上川本流（盛岡→花巻→奥州→平泉→一関：北から南へ緯度降順）
    if (groupId === 'group_iwate') {
      return [...cameras].sort((a, b) => (b.lat || 0) - (a.lat || 0));
    }

    // 2. 気仙沼・南三陸圏：北から南へ緯度降順（八瀬川→鹿折川→松川→面瀬川→津谷川）
    if (groupId === 'group_kesennuma') {
      return [...cameras].sort((a, b) => (b.lat || 0) - (a.lat || 0));
    }

    // 3. 栗原圏：鳴子ダム水系 ➡ 迫川・栗原支流水系
    if (groupId === 'group_kurihara') {
      const damCams = [];
      const riverCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        if (n.includes('ダム') || n.includes('鳴子') || n.includes('轟') || n.includes('中野') || n.includes('川渡')) {
          damCams.push(c);
        } else {
          riverCams.push(c);
        }
      });
      // ダム水系：西から東（経度昇順）
      damCams.sort((a, b) => (a.lng || 0) - (b.lng || 0));
      // 迫川支流水系：下流合流点（若柳方面: 38.730, 141.150）から遠い順（上流→下流）
      const refKurihara = { lat: 38.7300, lng: 141.1500 };
      riverCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refKurihara.lat, refKurihara.lng) - calculateDistanceKm(a.lat, a.lng, refKurihara.lat, refKurihara.lng));
      return [...damCams, ...riverCams];
    }

    // 4. 登米圏：北上川本流（岩之沢〜登米〜豊里） ➡ 迫川・登米支流水系
    if (groupId === 'group_tome') {
      const mainCams = [];
      const branchCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        if (n.includes('北上川') || n.includes('登米大橋') || n.includes('米谷') || n.includes('錦桜橋') || n.includes('岩之沢樋門') || n.includes('脇谷水門') || n.includes('豊里大橋')) {
          mainCams.push(c);
        } else {
          branchCams.push(c);
        }
      });
      // 本流：北から南へ緯度降順（上流→下流）
      mainCams.sort((a, b) => (b.lat || 0) - (a.lat || 0));
      // 支流：合流点（38.5973, 141.1693）から遠い順（上流→下流）
      const refTome = { lat: 38.5973, lng: 141.1693 };
      branchCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refTome.lat, refTome.lng) - calculateDistanceKm(a.lat, a.lng, refTome.lat, refTome.lng));
      return [...mainCams, ...branchCams];
    }

    // 5. 大崎・加美圏：江合川水系 ➡ 鳴瀬川上流水系
    if (groupId === 'group_osaki_kami') {
      const eaiCams = [];
      const naruseCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        if (n.includes('鳴瀬川') || n.includes('桜舘') || n.includes('百間堀') || n.includes('志田橋') || n.includes('野田橋') || n.includes('中流堰') || n.includes('木間塚') || n.includes('上地')) {
          naruseCams.push(c);
        } else {
          eaiCams.push(c);
        }
      });
      // 江合川系：下流合流部（美里・涌谷: 38.5244, 141.1772）から遠い順（鳴子・岩出山上流 ➡ 古川 ➡ 美里・涌谷）
      const refEai = { lat: 38.5244, lng: 141.1772 };
      eaiCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refEai.lat, refEai.lng) - calculateDistanceKm(a.lat, a.lng, refEai.lat, refEai.lng));
      // 鳴瀬川系：下流合流部（上地・松山: 38.4403, 141.1122）から遠い順（加美町上流 ➡ 色麻 ➡ 三本木 ➡ 松山）
      const refNaruse = { lat: 38.4403, lng: 141.1122 };
      naruseCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refNaruse.lat, refNaruse.lng) - calculateDistanceKm(a.lat, a.lng, refNaruse.lat, refNaruse.lng));
      return [...eaiCams, ...naruseCams];
    }

    // 6. 吉田川中上流：吉田川本流 ➡ 善川・竹林川等支流
    if (groupId === 'group_yoshida') {
      const mainCams = [];
      const branchCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        if (n.includes('吉田川') || n.includes('三川合流') || n.includes('粕川') || n.includes('桧和田') || n.includes('身洗川水門') || n.includes('大郷大橋') || n.includes('品井沼') || n.includes('内浦')) {
          mainCams.push(c);
        } else {
          branchCams.push(c);
        }
      });
      const refYoshida = { lat: 38.4403, lng: 141.1122 };
      mainCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refYoshida.lat, refYoshida.lng) - calculateDistanceKm(a.lat, a.lng, refYoshida.lat, refYoshida.lng));
      branchCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refYoshida.lat, refYoshida.lng) - calculateDistanceKm(a.lat, a.lng, refYoshida.lat, refYoshida.lng));
      return [...mainCams, ...branchCams];
    }

    // 7. 東松島：鳴瀬川河口（38.3756, 141.1728）から遠い順（上流→下流）
    if (groupId === 'group_naruse_east') {
      const refNaruseEast = { lat: 38.3756, lng: 141.1728 };
      return [...cameras].sort((a, b) => calculateDistanceKm(b.lat, b.lng, refNaruseEast.lat, refNaruseEast.lng) - calculateDistanceKm(a.lat, a.lng, refNaruseEast.lat, refNaruseEast.lng));
    }

    // 8. 石巻圏：旧北上川水系（河口 38.4150, 141.3125 から遠い順＝上流神取橋 ➡ 下流河口）
    if (groupId === 'group_kyu_kitakami') {
      const refKyu = { lat: 38.4150, lng: 141.3125 };
      return [...cameras].sort((a, b) => calculateDistanceKm(b.lat, b.lng, refKyu.lat, refKyu.lng) - calculateDistanceKm(a.lat, a.lng, refKyu.lat, refKyu.lng));
    }

    // 9. 石巻圏：北上川下流・東部沿岸水系（本流 ➡ 沿岸・支流）
    if (groupId === 'group_kitakami') {
      const mainCams = [];
      const coastCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        if (n.includes('北上川') || n.includes('飯野川') || n.includes('福地') || n.includes('新北上') || n.includes('釜谷') || n.includes('樫崎') || n.includes('植立山')) {
          mainCams.push(c);
        } else {
          coastCams.push(c);
        }
      });
      // 本流：河口（38.5658, 141.4437）から遠い順（上流→下流）
      const refKitakami = { lat: 38.5658, lng: 141.4437 };
      mainCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refKitakami.lat, refKitakami.lng) - calculateDistanceKm(a.lat, a.lng, refKitakami.lat, refKitakami.lng));
      // 沿岸・支流：北から南へ緯度降順
      coastCams.sort((a, b) => (b.lat || 0) - (a.lat || 0));
      return [...mainCams, ...coastCams];
    }

    // 10. 仙台・仙塩圏：西（山側上流）から東（海側河口）へ経度昇順
    if (groupId === 'group_sendai') {
      return [...cameras].sort((a, b) => (a.lng || 0) - (b.lng || 0));
    }

    // 11. 仙南圏：白石川水系 ➡ 阿武隈川本流
    if (groupId === 'group_sennan') {
      const shiroishiCams = [];
      const abukumaCams = [];
      cameras.forEach(c => {
        const n = c.name || '';
        const lat = c.lat;
        const lng = c.lng;
        // 七ヶ宿町全域（lat < 38.02 && lng < 140.56）や白石川流域キーワード
        if ((typeof lat === 'number' && typeof lng === 'number' && lat < 38.02 && lng < 140.60) ||
            n.includes('七ヶ宿') || n.includes('白石') || n.includes('材木岩') || n.includes('小原') || n.includes('大河原') || n.includes('柴田') ||
            n.includes('遠刈田') || n.includes('蔵王') || n.includes('松川') || n.includes('ダム') || (c.operator && c.operator.includes('七ヶ宿'))) {
          shiroishiCams.push(c);
        } else {
          abukumaCams.push(c);
        }
      });
      // 白石川：合流点（柴田町槻木: 38.0667, 140.8250）から遠い順（七ヶ宿上流 ➡ 柴田下流）
      const refShiroishi = { lat: 38.0667, lng: 140.8250 };
      shiroishiCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refShiroishi.lat, refShiroishi.lng) - calculateDistanceKm(a.lat, a.lng, refShiroishi.lat, refShiroishi.lng));
      // 阿武隈川：河口（岩沼・亘理: 38.0520, 140.9220）から遠い順（丸森上流 ➡ 亘理河口下流）
      const refAbukuma = { lat: 38.0520, lng: 140.9220 };
      abukumaCams.sort((a, b) => calculateDistanceKm(b.lat, b.lng, refAbukuma.lat, refAbukuma.lng) - calculateDistanceKm(a.lat, a.lng, refAbukuma.lat, refAbukuma.lng));
      return [...shiroishiCams, ...abukumaCams];
    }

    // 12. 道路：北から南へ緯度降順
    if (groupId === 'group_road') {
      return [...cameras].sort((a, b) => (b.lat || 0) - (a.lat || 0));
    }

    return cameras;
  }

  // ■ サトシスタイル3層整流化ソート（主要本流:上流➡河口 ＋ 支流:地域別ジグザグ北➡南 ＋ 道路:末尾）
  function extractKp(name) {
    const m = (name || '').match(/(-?\d+(?:\.\d+)?)\s*(?:km|ｋｍ|k[RL]|ｋ[RL]|k|ｋ|KP|ＫＰ)/i);
    return m ? parseFloat(m[1]) : null;
  }

  function sortCamerasSatoshiStyle(cameraList) {
    if (!cameraList || cameraList.length <= 1) return cameraList;

    const DISTANCE_THRESHOLD_KM = 3.5;

    // 1. 全カメラを水系ベースで抽出
    const mainShin = [];
    const mainKyu = [];
    const mainEaiNaruse = [];
    const roads = [];
    const others = [];

    cameraList.forEach(c => {
      const n = c.name || '';
      const cat = c.category || '';
      const op = c.operator || '';
      
      if (cat === 'road' || n.includes('IC') || n.includes('三陸沿岸') || n.includes('東部道路')) {
        roads.push(c);
      } else if ((n.includes('北上川') && !n.includes('旧北上川')) || n.includes('飯野川') || n.includes('福地水門') || n.includes('新北上大橋') || n.includes('釜谷水門') || n.includes('樫崎') || n.includes('脇谷水門') || n.includes('豊里大橋') || n.includes('登米大橋') || n.includes('米谷大橋') || n.includes('錦桜橋') || n.includes('岩之沢樋門') || n.includes('[岩手県]') || n.includes('植立山') || n.includes('橋浦') || n.includes('入釜谷')) {
        mainShin.push(c);
      } else if (n.includes('旧北上川') || n.includes('神取橋') || n.includes('鹿又') || n.includes('佳景山') || n.includes('石巻大橋') || n.includes('住吉') || n.includes('日和山') || n.includes('日和大橋') || n.includes('内海橋') || n.includes('運河交流館')) {
        mainKyu.push(c);
      } else if (n.includes('江合川') || n.includes('涌谷大橋') || n.includes('明治水門') || n.includes('江合橋') || n.includes('鳴瀬川') || n.includes('鳴瀬大橋') || n.includes('野田橋') || n.includes('志田橋') || n.includes('中流堰') || n.includes('木間塚') || n.includes('小野橋') || n.includes('鳴瀬堰')) {
        mainEaiNaruse.push(c);
      } else {
        others.push(c);
      }
    });

    // 2. 本流のソート (KP または 河口からの距離)
    const refShin = { lat: 38.566, lng: 141.444 }; // 釜谷水門
    mainShin.sort((a, b) => {
      const kpA = extractKp(a.name); const kpB = extractKp(b.name);
      if (kpA !== null && kpB !== null) return kpB - kpA;
      return calculateDistanceKm(b.lat, b.lng, refShin.lat, refShin.lng) - calculateDistanceKm(a.lat, a.lng, refShin.lat, refShin.lng);
    });

    const refKyu = { lat: 38.415, lng: 141.313 }; // 河口
    mainKyu.sort((a, b) => {
      const kpA = extractKp(a.name); const kpB = extractKp(b.name);
      if (kpA !== null && kpB !== null) return kpB - kpA;
      return calculateDistanceKm(b.lat, b.lng, refKyu.lat, refKyu.lng) - calculateDistanceKm(a.lat, a.lng, refKyu.lat, refKyu.lng);
    });

    const refNaruse = { lat: 38.376, lng: 141.173 }; // 河口
    mainEaiNaruse.sort((a, b) => {
      const kpA = extractKp(a.name); const kpB = extractKp(b.name);
      if (kpA !== null && kpB !== null) return kpB - kpA;
      return calculateDistanceKm(b.lat, b.lng, refNaruse.lat, refNaruse.lng) - calculateDistanceKm(a.lat, a.lng, refNaruse.lat, refNaruse.lng);
    });

    // 3. その他カメラを近接（3.5km以内）なら編入、遠方なら独立地域ブロックへ
    const insertShin = [], insertKyu = [], insertEaiNaruse = [], independent = [];
    
    others.forEach(c => {
      const dShin = mainShin.length > 0 ? Math.min(...mainShin.map(m => calculateDistanceKm(c.lat, c.lng, m.lat, m.lng))) : Infinity;
      const dKyu = mainKyu.length > 0 ? Math.min(...mainKyu.map(m => calculateDistanceKm(c.lat, c.lng, m.lat, m.lng))) : Infinity;
      const dEaiNaruse = mainEaiNaruse.length > 0 ? Math.min(...mainEaiNaruse.map(m => calculateDistanceKm(c.lat, c.lng, m.lat, m.lng))) : Infinity;
      
      const minDist = Math.min(dShin, dKyu, dEaiNaruse);
      
      if (minDist <= DISTANCE_THRESHOLD_KM) {
        if (minDist === dShin) insertShin.push(c);
        else if (minDist === dKyu) insertKyu.push(c);
        else insertEaiNaruse.push(c);
      } else {
        independent.push(c);
      }
    });

    // 挿入用ヘルパー関数
    function insertOneNearest(sorted, cam) {
      if (sorted.length === 0) { sorted.push(cam); return; }
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < sorted.length; i++) {
        const d = calculateDistanceKm(cam.lat, cam.lng, sorted[i].lat, sorted[i].lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const nearCam = sorted[bestIdx];
      if (bestIdx === 0) {
        if ((cam.lat || 0) > (nearCam.lat || 0)) sorted.splice(0, 0, cam); else sorted.splice(1, 0, cam);
      } else if (bestIdx === sorted.length - 1) {
        if ((cam.lat || 0) < (nearCam.lat || 0)) sorted.push(cam); else sorted.splice(bestIdx, 0, cam);
      } else {
        if ((cam.lat || 0) >= (nearCam.lat || 0)) sorted.splice(bestIdx, 0, cam); else sorted.splice(bestIdx + 1, 0, cam);
      }
    }

    function insertNearestNeighbors(sorted, unsorted) {
      unsorted.sort((a, b) => (b.lat || 0) - (a.lat || 0));
      for (const cam of unsorted) insertOneNearest(sorted, cam);
    }

    insertNearestNeighbors(mainShin, insertShin);
    insertNearestNeighbors(mainKyu, insertKyu);
    insertNearestNeighbors(mainEaiNaruse, insertEaiNaruse);

    // 4. 独立地域ブロックと道路の処理（緯度順＝北から南へ）
    independent.sort((a, b) => (b.lat || 0) - (a.lat || 0));
    roads.sort((a, b) => (b.lat || 0) - (a.lat || 0));

    // 結合して返す (新北上川 -> 旧北上川 -> 江合・鳴瀬川 -> 独立地域 -> 道路)
    return [...mainShin, ...mainKyu, ...mainEaiNaruse, ...independent, ...roads];
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
    initFavRegistrationModal(); // 圏域別お気に入り一括登録モーダルの初期化
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
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    if (state.favorites.has(cameraId)) {
      state.favorites.delete(cameraId);
    } else {
      state.favorites.add(cameraId);
    }
    saveFavorites();
    updateFavoriteUI(cameraId);

    // お気に入り専用タブ表示中の場合のみ、解除されたカードの除去のためリストを再描画
    // その場合でもスクロール位置を退避・復元して画面が動くのを完全に防止
    if (state.favoriteOnlyFilter) {
      const listContainer = document.getElementById('camera-list');
      const savedScrollTop = listContainer ? listContainer.scrollTop : 0;
      renderSidebarList();
      if (listContainer) {
        listContainer.scrollTop = savedScrollTop;
      }
    }
  }

  // ■ 水系ごとの一括お気に入り登録/解除
  function toggleBatchFavorite(groupId, event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    // 該当グループの全カメラを抽出
    let groupCameras = CAMERA_DATA.filter(c => {
      const g = getGroupForCamera(c);
      return g && g.id === groupId;
    });

    if (groupCameras.length === 0) return;

    // 川の流れ・座標順（上流→下流）に整列
    groupCameras = sortCamerasByRiverFlow(groupCameras, groupId);

    // 登録カメラ数をカウント
    const favCount = groupCameras.filter(c => state.favorites.has(c.id)).length;

    if (favCount > 0) {
      // 1台でも登録されていれば一括解除（ユーザーの解除意図を最優先）
      groupCameras.forEach(c => state.favorites.delete(c.id));
    } else {
      // 0台なら一括登録（川の流れ順で確実に追加）
      groupCameras.forEach(c => state.favorites.add(c.id));
    }

    saveFavorites();
    updateFavoriteBadge();

    // スクロール位置を保持したままリストを再描画（一括ボタン、各カードの星、最上部のお気に入りグループを完全同期）
    const listContainer = document.getElementById('camera-list');
    const savedScrollTop = listContainer ? listContainer.scrollTop : 0;
    renderSidebarList();
    if (listContainer) {
      listContainer.scrollTop = savedScrollTop;
    }

    // 地図上のピンもお気に入りスタイルに連動
    groupCameras.forEach(c => {
      const isFav = state.favorites.has(c.id);
      const marker = state.markers[c.id];
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
    });
  }
  window.__toggleBatchFavorite = toggleBatchFavorite;

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


  // ■ 選択管内のフォーカスとアコーディオン展開（全圏域カメラ自動フィット＆先頭スクロール）
  function applyAreaFocusAndExpand(area) {
    if (!state.map) return;

    const areaGroupMap = {
      'sennan': ['group_sennan'],
      'sendai': ['group_sendai', 'group_yoshida'],
      'osaki': ['group_osaki_kami'],
      'kurihara': ['group_kurihara'],
      'tome': ['group_tome'],
      'ishinomaki': ['group_kyu_kitakami', 'group_kitakami', 'group_naruse_east'],
      'kesennuma': ['group_kesennuma']
    };

    const targetGroups = areaGroupMap[area] || [];

    // 1. 地図のカメラ群への最適フォーカス（fitBounds）
    if (area === 'all') {
      state.map.flyTo(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM, { animate: true, duration: 1.0 });
    } else if (targetGroups.length > 0 && typeof CAMERA_DATA !== 'undefined' && typeof L !== 'undefined') {
      // 該当エリアのグループに属するカメラの座標を収集
      const targetCams = CAMERA_DATA.filter(c => {
        const g = getGroupForCamera(c);
        return targetGroups.includes(g.id) && typeof c.lat === 'number' && typeof c.lng === 'number';
      });

      if (targetCams.length > 0) {
        const bounds = L.latLngBounds(targetCams.map(c => [c.lat, c.lng]));
        state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true, duration: 1.0 });
      } else {
        const areaCoords = {
          'sennan': [38.0495, 140.7307],
          'sendai': [38.1208, 140.9141],
          'osaki': [38.5611, 141.0796],
          'kurihara': [38.7002, 141.1183],
          'tome': [38.7002, 141.1183],
          'ishinomaki': [38.5464, 141.1688],
          'kesennuma': [38.7932, 141.4951]
        };
        if (areaCoords[area]) {
          state.map.flyTo(areaCoords[area], 11.5, { animate: true, duration: 1.0 });
        }
      }
    } else {
      const areaCoords = {
        'sennan': [38.0495, 140.7307]
      };
      if (areaCoords[area]) {
        state.map.flyTo(areaCoords[area], 11.5, { animate: true, duration: 1.0 });
      }
    }

    // 2. アコーディオンは閉じた状態（▼）を維持し、サイドバーを先頭にスクロール（手動操作優先）
    if (area !== 'all' && targetGroups.length > 0) {
      // 全グループの開閉状態を完全リセット（Fail-Closedにより全11グループが例外なく閉じる）
      state.accordionStates = {};
      renderSidebarList(); // サイドバーの再描画

      // スクロール位置を先頭にリセット
      setTimeout(() => {
        const listEl = document.getElementById('camera-list');
        if (listEl) {
          listEl.scrollTop = 0;
        }
        const firstGroupEl = document.querySelector(`.accordion-group[data-group-id="${targetGroups[0]}"]`);
        if (firstGroupEl) {
          firstGroupEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
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
      const hasImgPreview = Boolean(camera.imageUrl);
      const isStream = camera.streamType === 'youtube' || camera.streamType === 'stream';
      let popupImgHtml = '';

      if (hasImgPreview) {
        // ① 最新静止画像プレビュー（静止画およびハイブリッド動画カメラ）
        const streamBadge = isStream ? `<span style="position: absolute; top: 4px; right: 4px; background: rgba(139, 92, 246, 0.9); color: #ffffff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fa-solid fa-video"></i> 動画配信中</span>` : '';
        popupImgHtml = `
          <div style="position: relative; margin-bottom: 6px;">
            <img src="${camera.imageUrl}" class="hover-popup-img" alt="${camera.name}" onerror="this.src='https://via.placeholder.com/210x115/1e293b/475569?text=Camera+Preview'">
            ${streamBadge}
            <div style="font-size: 11px; color: ${isStream ? '#c4b5fd' : '#38bdf8'}; margin-top: 5px; text-align: center; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> クリックで右列カメラをハイライト
            </div>
          </div>
        `;
      } else {
        // ② 画像なし動画カメラ（完全動画専用型）
        popupImgHtml = `
          <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 6px; padding: 10px 8px; text-align: center; margin: 4px 0 6px 0;">
            <div style="font-size: 12px; color: #c4b5fd; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px;">
              <i class="fa-solid fa-video"></i> ライブ動画配信中
            </div>
            <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> クリックで右列カメラをハイライト
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

  // ■ サイドバーカードHTML生成（全カメラ統一テキスト1行表示）
  // Phase 1改修: 静止画プレビューを廃止しホーム画面を軽量化。地図ピンポップアップの画像は変更なし。
  function renderCameraCard(camera, isFavMode = false) {
    const category = camera.category || 'other';
    const categoryLabel = CONFIG.CATEGORY_LABELS[category] || 'その他';
    const isFav = state.favorites.has(camera.id);
    const dragHandleHtml = isFavMode
      ? `<span class="fav-drag-handle" title="ドラッグして並べ替え" onclick="event.stopPropagation();"><i class="fa-solid fa-grip-vertical"></i></span>`
      : '';
    const draggableAttr = isFavMode ? 'draggable="true"' : '';

    // 右端バッジ: maintenance / 動画 / 静止画（配信元リンク）で表示を分ける
    let rightBadgeHtml = '';
    if (camera.status === 'maintenance') {
      rightBadgeHtml = `<span style="font-size: 11px; color: #9ca3af; display: inline-flex; align-items: center; gap: 3px; background: rgba(156,163,175,0.15); border: 1px solid rgba(156,163,175,0.3); border-radius: 4px; padding: 2px 6px;">
        <i class="fa-solid fa-wrench"></i> 調整中
      </span>`;
    } else if (camera.streamType === 'youtube' || camera.streamType === 'stream') {
      rightBadgeHtml = `<a href="${camera.sourceUrl}" target="_blank" onclick="event.stopPropagation();" style="font-size: 11px; color: #c4b5fd; font-weight: 500; display: inline-flex; align-items: center; gap: 3px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 4px; padding: 2px 6px; text-decoration: none;">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> 動画
      </a>`;
    } else {
      rightBadgeHtml = `<a href="${camera.sourceUrl}" target="_blank" onclick="event.stopPropagation();" style="font-size: 11px; color: #7dd3fc; font-weight: 500; display: inline-flex; align-items: center; gap: 3px; background: rgba(14,165,233,0.12); border: 1px solid rgba(14,165,233,0.3); border-radius: 4px; padding: 2px 6px; text-decoration: none;">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> 配信元
      </a>`;
    }

    return `
      <div class="camera-card camera-card-compact ${isFavMode ? 'fav-sortable-card' : ''} ${camera.status === 'maintenance' ? 'maintenance' : ''}"
           data-camera-id="${camera.id}" data-category="${category}" data-operator="${camera.operator || ''}" ${draggableAttr}
           style="padding: 8px 12px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
          ${dragHandleHtml}
          <button type="button" class="fav-btn ${isFav ? 'active' : ''}" data-camera-id="${camera.id}"
                  title="${isFav ? '登録解除（★）' : 'カメラ登録（★）'}" onclick="event.preventDefault(); event.stopPropagation();" style="flex-shrink: 0;">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
          </button>
          <span class="card-name" style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${camera.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span class="category-badge badge-${category}" style="font-size: 10px; padding: 2px 6px;">${categoryLabel}</span>
          ${rightBadgeHtml}
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
    const actionsBar = document.getElementById('fav-actions-bar');

    if (btnAll) {
      btnAll.addEventListener('click', () => {
        if (!state.favoriteOnlyFilter) return;
        state.favoriteOnlyFilter = false;
        btnAll.classList.add('active');
        if (btnOnly) btnOnly.classList.remove('active');
        if (actionsBar) actionsBar.style.display = 'none';
        renderSidebarList();
      });
    }

    if (btnOnly) {
      btnOnly.addEventListener('click', () => {
        if (state.favoriteOnlyFilter) return;
        state.favoriteOnlyFilter = true;
        btnOnly.classList.add('active');
        if (btnAll) btnAll.classList.remove('active');
        if (actionsBar) actionsBar.style.display = 'flex';
        renderSidebarList();
      });
    }

    // サイドバー整列ボタン
    const sortSidebarBtn = document.getElementById('btn-sort-fav-sidebar');
    if (sortSidebarBtn) {
      sortSidebarBtn.addEventListener('click', () => {
        if (state.favorites.size <= 1 || typeof CAMERA_DATA === 'undefined') return;
        const favMap = new Map(CAMERA_DATA.map(c => [c.id, c]));
        const currentFavs = Array.from(state.favorites).map(id => favMap.get(id)).filter(Boolean);
        const sorted = sortCamerasSatoshiStyle(currentFavs);
        state.favorites = new Set(sorted.map(c => c.id));
        saveFavorites();
        renderSidebarList();

        const origHtml = sortSidebarBtn.innerHTML;
        sortSidebarBtn.innerHTML = '<i class="fa-solid fa-check"></i> 完了';
        sortSidebarBtn.style.color = '#34d399';
        setTimeout(() => {
          sortSidebarBtn.innerHTML = origHtml;
          sortSidebarBtn.style.color = '';
        }, 1200);
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
        updateFavRegModalCounts();
      }
    });
  }

  // ■ 圏域別お気に入り一括登録モーダルの初期化＆リアルタイム同期
  function initFavRegistrationModal() {
    const modal = document.getElementById('fav-reg-modal-overlay');
    const openBtn = document.getElementById('btn-open-fav-reg-modal');
    const closeBtn = document.getElementById('fav-reg-modal-close');
    const doneBtn = document.getElementById('fav-reg-btn-close');
    const selectArea = document.getElementById('fav-reg-area-select');
    const container = document.getElementById('fav-reg-groups-container');

    if (!modal || !openBtn) return;

    // モーダルを開く（現在選択中の管内エリアと完全自動連動）
    openBtn.addEventListener('click', () => {
      const defaultArea = state.favorites.size > 0 ? 'registered' : (state.activeAreaFilter || 'all');
      if (selectArea) {
        selectArea.value = defaultArea;
      }
      renderFavRegGroups(defaultArea);
      updateFavRegModalCounts();
      modal.classList.add('active');
    });

    // モーダルを閉じる
    const closeModal = () => modal.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // 圏域プルダウン切り替え
    if (selectArea) {
      selectArea.addEventListener('change', () => {
        renderFavRegGroups(selectArea.value);
      });
    }

    // 圏域から対象水系グループを取得する定義（7大圏域完全対応）
    const AREA_GROUP_MAP = {
      ishinomaki: ['group_kyu_kitakami', 'group_kitakami', 'group_naruse_east'],
      tome: ['group_tome'],
      kurihara: ['group_kurihara'],
      osaki: ['group_osaki_kami'],
      kesennuma: ['group_kesennuma'],
      sendai: ['group_sendai', 'group_yoshida'],
      sennan: ['group_sennan'],
      iwate: ['group_iwate'],
      road: ['group_road']
    };

    // モーダル内の水系グループ＆カメラリスト動的生成
    function renderFavRegGroups(selectedArea) {
      if (!container || typeof CAMERA_DATA === 'undefined') return;

      // カメラを全グループに分類
      const allGroups = {};
      CAMERA_DATA.forEach(camera => {
        const g = getGroupForCamera(camera);
        if (!allGroups[g.id]) {
          allGroups[g.id] = { ...g, cameras: [] };
        }
        allGroups[g.id].cameras.push(camera);
      });

      // 各水系内を上流→下流順にソート
      Object.keys(allGroups).forEach(gid => {
        allGroups[gid].cameras = sortCamerasByRiverFlow(allGroups[gid].cameras, gid);
      });

      // 選択圏域に応じた表示グループの決定
      let targetGroupIds = [];
      if (selectedArea === 'registered') {
        const favCams = CAMERA_DATA.filter(c => state.favorites.has(c.id));
        if (favCams.length === 0) {
          container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">現在登録されているカメラはありません。</div>`;
          return;
        }
        allGroups['group_registered'] = {
          id: 'group_registered',
          title: '★ 現在登録中のカメラ',
          cameras: sortCamerasSatoshiStyle(favCams)
        };
        targetGroupIds = ['group_registered'];
      } else if (selectedArea === 'all') {
        targetGroupIds = Object.keys(allGroups).sort((a, b) => allGroups[a].order - allGroups[b].order);
      } else {
        targetGroupIds = AREA_GROUP_MAP[selectedArea] || [];
      }

      if (targetGroupIds.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">該当する水系・カメラがありません</div>`;
        return;
      }

      let html = '';
      targetGroupIds.forEach(gid => {
        const group = allGroups[gid];
        if (!group || group.cameras.length === 0) return;

        const totalCams = group.cameras.length;
        const favCams = group.cameras.filter(c => state.favorites.has(c.id)).length;
        const isAllChecked = totalCams > 0 && favCams === totalCams;

        html += `
          <div class="fav-reg-group-card" data-group-id="${group.id}">
            <div class="fav-reg-group-header">
              <label class="fav-reg-group-label-wrap">
                <input type="checkbox" class="group-master-chk" data-group-id="${group.id}" ${isAllChecked ? 'checked' : ''}>
                <span>${group.title}</span>
                <span class="fav-reg-group-count">${favCams} / ${totalCams} 台</span>
              </label>
              <button type="button" class="fav-reg-expand-btn" data-group-id="${group.id}" title="個別カメラ一覧を展開">
                <span class="expand-text">個別展開</span>
                <i class="fa-solid fa-chevron-down expand-icon"></i>
              </button>
            </div>
            <div class="fav-reg-camera-list" id="fav-reg-cam-list-${group.id}">
              ${group.cameras.map(c => `
                <label class="fav-reg-camera-item">
                  <input type="checkbox" class="cam-single-chk" data-group-id="${group.id}" data-camera-id="${c.id}" ${state.favorites.has(c.id) ? 'checked' : ''}>
                  <span style="font-weight: 500;">${c.name}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // 一部選択（indeterminate）状態の初期反映
      targetGroupIds.forEach(gid => {
        const group = allGroups[gid];
        if (!group) return;
        const totalCams = group.cameras.length;
        const favCams = group.cameras.filter(c => state.favorites.has(c.id)).length;
        const masterChk = container.querySelector(`.group-master-chk[data-group-id="${gid}"]`);
        if (masterChk) {
          masterChk.indeterminate = (favCams > 0 && favCams < totalCams);
        }
      });

      bindFavRegEvents(allGroups);
    }

    // イベントバインド
    function bindFavRegEvents(allGroups) {
      // 個別カメラ一覧の展開・折りたたみ
      container.querySelectorAll('.fav-reg-expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const gid = btn.getAttribute('data-group-id');
          const list = document.getElementById(`fav-reg-cam-list-${gid}`);
          const icon = btn.querySelector('.expand-icon');
          const text = btn.querySelector('.expand-text');
          if (list) {
            list.classList.toggle('open');
            const isOpen = list.classList.contains('open');
            if (icon) {
              icon.classList.toggle('fa-chevron-down', !isOpen);
              icon.classList.toggle('fa-chevron-up', isOpen);
            }
            if (text) text.textContent = isOpen ? '閉じる' : '個別展開';
          }
        });
      });

      // 親水系一括チェック操作（「-」一部選択状態からのクリックは確実に全解除する）
      container.querySelectorAll('.group-master-chk').forEach(chk => {
        let wasIndeterminate = false;
        chk.addEventListener('mousedown', () => {
          wasIndeterminate = chk.indeterminate;
        });

        chk.addEventListener('click', (e) => {
          const gid = chk.getAttribute('data-group-id');
          const group = allGroups[gid];
          if (!group) return;

          const favCount = group.cameras.filter(c => state.favorites.has(c.id)).length;
          const totalCount = group.cameras.length;

          // 直前が一部選択（「-」）状態、または一部登録されている場合は「全解除」を最優先
          let shouldCheckAll = false;
          if (wasIndeterminate || (favCount > 0 && favCount < totalCount)) {
            shouldCheckAll = false; // 全解除
          } else if (favCount === 0) {
            shouldCheckAll = true;  // 全登録
          } else {
            shouldCheckAll = false; // 全選択状態からクリックされたので全解除
          }

          chk.checked = shouldCheckAll;
          chk.indeterminate = false;
          wasIndeterminate = false;

          group.cameras.forEach(c => {
            if (shouldCheckAll) {
              state.favorites.add(c.id);
            } else {
              state.favorites.delete(c.id);
            }
            updateFavoriteUI(c.id);
          });

          // 子チェックボックスも同期
          const childChks = container.querySelectorAll(`.cam-single-chk[data-group-id="${gid}"]`);
          childChks.forEach(child => {
            child.checked = shouldCheckAll;
          });

          saveFavorites();
          renderSidebarList();
          updateGroupHeaderCount(gid, group.cameras);
          updateFavRegModalCounts();
        });
      });

      // 個別カメラチェック操作
      container.querySelectorAll('.cam-single-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const cid = chk.getAttribute('data-camera-id');
          const gid = chk.getAttribute('data-group-id');
          const group = allGroups[gid];

          if (chk.checked) {
            state.favorites.add(cid);
          } else {
            state.favorites.delete(cid);
          }
          updateFavoriteUI(cid);

          // 親水系チェックボックスの判定（全選択/半選択/未選択）
          if (group) {
            const masterChk = container.querySelector(`.group-master-chk[data-group-id="${gid}"]`);
            const favCams = group.cameras.filter(c => state.favorites.has(c.id)).length;
            const totalCams = group.cameras.length;

            if (masterChk) {
              masterChk.checked = (favCams === totalCams);
              masterChk.indeterminate = (favCams > 0 && favCams < totalCams);
            }
            updateGroupHeaderCount(gid, group.cameras);
          }

          saveFavorites();
          renderSidebarList();
          updateFavRegModalCounts();
        });
      });
    }

    function updateGroupHeaderCount(gid, cameras) {
      const card = container.querySelector(`.fav-reg-group-card[data-group-id="${gid}"]`);
      if (!card) return;
      const countEl = card.querySelector('.fav-reg-group-count');
      if (countEl) {
        const favCount = cameras.filter(c => state.favorites.has(c.id)).length;
        countEl.textContent = `${favCount} / ${cameras.length} 台`;
      }
    }
  }

  function updateFavRegModalCounts() {
    const countEl = document.getElementById('fav-reg-count');
    if (countEl) countEl.textContent = state.favorites.size;
  }

  // ■ カメラカード・お気に入りボタンの共通イベントバインド
  function bindCameraListEvents(container) {
    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
              登録カメラがありません
            </div>
            <div style="font-size: 12px; line-height: 1.6;">
              地図上のピンやカメラカードの「★」アイコンをクリックすると、ここに登録カメラが直接表示されます。
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
        title: '★ 登録カメラ',
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
        group.cameras = sortCamerasByRiverFlow(group.cameras, group.id);
        totalVisible += group.cameras.length;
      }

      // Fail-Closed設計: 明示的にユーザーがクリックして true にしたもの以外は100%閉じる（初期値・未定義による意図せぬ自動オープンを完全防止）
      const isOpen = state.accordionStates[group.id] === true;

      const isAllFav = group.cameras.length > 0 && group.cameras.every(c => state.favorites.has(c.id));
      const batchFavBtnHtml = group.id !== 'group_fav' ? `
        <button type="button" class="batch-fav-btn ${isAllFav ? 'active' : ''}" data-group-id="${group.id}" title="${isAllFav ? '水系のカメラを一括解除' : '水系のカメラを一括登録'}" onclick="event.stopPropagation(); window.__toggleBatchFavorite('${group.id}', event);">
          <i class="fa-${isAllFav ? 'solid' : 'regular'} fa-star"></i>
          <span>一括</span>
        </button>
      ` : '';

      html += `
        <div class="accordion-group ${isOpen ? 'open' : ''}" data-group-id="${group.id}">
          <div class="accordion-header" onclick="document.dispatchEvent(new CustomEvent('toggle-accordion', {detail: '${group.id}'}))">
            <div class="accordion-title">
              <i class="fa-solid ${group.icon}"></i>
              <span>${group.title}</span>
              <span class="group-count-badge">${group.cameras.length}台</span>
            </div>
            <div class="accordion-header-actions" style="display: flex; align-items: center; gap: 6px;">
              ${batchFavBtnHtml}
              <i class="fa-solid fa-chevron-down accordion-arrow"></i>
            </div>
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
    state.accordionStates[gId] = !state.accordionStates[gId];
    const groupEl = document.querySelector(`.accordion-group[data-group-id="${gId}"]`);
    if (groupEl) {
      groupEl.classList.toggle('open', !!state.accordionStates[gId]);
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

    const isStream = camera.streamType === 'stream' || camera.streamType === 'youtube';

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
        <button type="button" class="fav-btn modal-fav-btn ${isFav ? 'active' : ''}" data-camera-id="${camera.id}" title="${isFav ? '登録解除（★）' : 'カメラ登録（★）'}" onclick="event.preventDefault(); event.stopPropagation();">
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
      } else if (camera.imageUrl) {
        const streamNotice = isStream
          ? `<div style="font-size: 11px; color: #c4b5fd; background: rgba(30, 27, 75, 0.85); padding: 4px 10px; border-radius: 4px; margin-bottom: 6px; border: 1px solid rgba(139, 92, 246, 0.4); display: flex; align-items: center; justify-content: space-between; gap: 8px; width: calc(100% - 20px); max-width: 500px; box-sizing: border-box;">
               <span><i class="fa-solid fa-camera"></i> 配信元最新画像（現在）</span>
               <a href="${camera.sourceUrl}" target="${isFav ? '_blank' : 'bousai_camera_preview'}" style="color: #a78bfa; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                 🎥 動画を見る <i class="fa-solid fa-arrow-up-right-from-square"></i>
               </a>
             </div>`
          : `<div style="font-size: 11px; color: var(--accent); background: rgba(15, 23, 42, 0.8); padding: 4px 8px; border-radius: 4px; margin-bottom: 6px; border: 1px solid var(--border);">
               <i class="fa-solid fa-camera"></i> ピン選択時点の配信元最新画像を表示しています
             </div>`;

        imageArea.innerHTML = `
          <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;">
            ${streamNotice}
            <img src="${camera.imageUrl}" alt="${camera.name}" style="max-height: calc(100% - 32px); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          </div>`;
      } else if (isStream) {
        // タイプB: ライブ動画・参照型（画像がない場合）
        imageArea.innerHTML = `
          <div class="modal-placeholder" style="color: var(--text-primary); display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem; background: var(--bg-tertiary);">
            <i class="fa-solid fa-video" style="font-size: 3.5rem; color: #8b5cf6;"></i>
            <p style="font-size: 1.15rem; font-weight: bold; line-height: 1.5; margin: 0;">
              「${camera.name}」はライブ動画・配信元参照カメラです
            </p>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">
              配信元サイト（公式サイト）でリアルタイム映像をご覧いただけます。
            </p>
            <a href="${camera.sourceUrl}" target="${isFav ? '_blank' : 'bousai_camera_preview'}" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); margin-top: 10px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 公式サイトでライブ映像を再生する
            </a>
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
      const btnText = isStream ? '<i class="fa-solid fa-video"></i> 公式動画配信サイトを開く' : '<i class="fa-solid fa-external-link"></i> 配信元サイトを開く';
      const btnStyle = isStream ? 'background: linear-gradient(135deg, #7c3aed, #8b5cf6);' : '';
      actions.innerHTML = `
        <a href="${camera.sourceUrl}" target="${isFav ? '_blank' : 'bousai_camera_preview'}" class="btn-modal-source" style="${btnStyle}">
          ${btnText}
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
          <div class="hover-popup-hint" style="color: ${levelColor};"><i class="fa-solid fa-chart-line"></i> クリックでリアルタイム水位・断面図を表示</div>
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
    
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      if (window.openSystemGuide) {
        window.openSystemGuide();
      } else if (modal) {
        modal.classList.add('active');
      }
    });
    
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
    
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
          const header = groupEl ? groupEl.querySelector('.accordion-header') : null;
          if (card && listContainer) {
            const listRect = listContainer.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            // スティッキーヘッダー実測高さ＋安全マージン（8px）で動的オフセットを算出（潜り込み完全防止）
            const headerHeight = header ? header.getBoundingClientRect().height : 59;
            const headerOffset = headerHeight + 8;
            const isVisible = (cardRect.top >= listRect.top + headerOffset - 2) && (cardRect.bottom <= listRect.bottom);
            if (!isVisible) {
              // スムーズスクロール進行中やアコーディオン展開直後でもズレない数学的絶対スクロール位置計算
              const targetScrollTop = Math.max(0, listContainer.scrollTop + (cardRect.top - listRect.top) - headerOffset);
              listContainer.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              });
            }
            card.classList.add('card-highlight');
            setTimeout(() => card.classList.remove('card-highlight'), 2000);
          }
        }, 180);
      }
    };

    // クリック・タップ時の挙動: カメラはサイドバー連動、水位観測所は新タブで水位・断面図を表示
    marker.on('click', (e) => {
      if (e && e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }

      state.activeMarkerId = markerId;
      smartOpenTooltip();

      if (station) {
        // 水位観測所の場合: カメラと異なりサイドバーにリストがないため、新タブでリアルタイム水位経過表・断面図を開く
        openWaterLevelModal(station);
      } else {
        // カメラの場合: サイドバーのアコーディオンを開き、該当カメラへスムーズスクロール＆ハイライト
        syncSidebar();
      }
    });

    // マウスホバー時（PC）: 地図上に小さなプレビューを表示するのみ（サイドバーは勝手に開かない）
    marker.on('mouseover', (e) => {
      // スマホのタップ時に発生する疑似mouseoverによる即時遷移を防ぐため、PCの純粋なマウス操作時のみアクティブ化する
      const isMousePointer = e && e.originalEvent && (e.originalEvent.pointerType === 'mouse' || (e.originalEvent.pointerType === undefined && e.originalEvent.type === 'mouseover'));
      if (isMousePointer && !L.Browser.mobile) {
        state.activeMarkerId = markerId;
      }
      smartOpenTooltip();
    });

    // ポップアップカード自体がタップ/クリックされた時も新タブまたはモーダルを開く
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
          if (station) {
            openWaterLevelModal(station);
          } else {
            syncSidebar();
          }
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
    const localFetchDateEl = document.getElementById('hazard-local-fetch-date');

    if (!toggleBtn || !dropdown || !state.map) return;

    let currentHazardLayer = null;
    let activeHazardType = 'none';

    // 手元取得日の更新と表示
    function updateFetchDateDisplay(newDateStr) {
      if (!localFetchDateEl) return;
      let dateStr = newDateStr || localStorage.getItem('ishinomaki_hazard_fetch_date');
      if (!dateStr) {
        const now = new Date();
        dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem('ishinomaki_hazard_fetch_date', dateStr);
      }
      localFetchDateEl.textContent = dateStr;
    }
    updateFetchDateDisplay();

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

    // ハザード情報の最新化（リフレッシュ）
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem('ishinomaki_hazard_fetch_date', dateStr);
        updateFetchDateDisplay(dateStr);

        if (currentHazardLayer) {
          // タイル再描画の実行
          if (currentHazardLayer.redraw) {
            currentHazardLayer.redraw();
          } else if (currentHazardLayer.eachLayer) {
            currentHazardLayer.eachLayer(l => { if (l.redraw) l.redraw(); });
          }
          const origText = refreshBtn.innerHTML;
          refreshBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> 更新完了';
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
