# 宮城県内 防災カメラポータルサイト

宮城県内の防災用ライブカメラ映像を、地図上で一覧確認できるポータルサイトです。

## 使い方

### 基本操作

1. `index.html` をダブルクリックしてブラウザで開く（Chrome / Edge 推奨）
2. 地図上のマーカーをクリック → モーダルウィンドウで詳細を確認
3. 右側のカメラ一覧からも閲覧可能
4. 「配信元を開く」ボタンで公式カメラページにアクセス

### フィルター機能

ヘッダーのボタンでカテゴリ別に表示/非表示を切り替えできます：

| カテゴリ | 色 | 内容 |
|:---|:---|:---|
| 河川 | 🔵 青 | 北上川・旧北上川・江合川等の河川カメラ |
| 道路 | 🟡 黄 | 三陸沿岸道路のICカメラ |
| 海岸 | 🔷 シアン | 金華山灯台等 |
| 市街地 | 🟢 緑 | 復興モニタリング・市議会カメラ |
| その他 | 🟣 紫 | イベントカメラ等 |

### 検索機能

右側パネル上部の検索ボックスで、カメラ名で絞り込みができます。

### 自動更新

- 静止画カメラは **10分間隔** で自動更新されます
- ヘッダー右側にカウントダウンタイマーが表示されます
- YouTube等の動画配信カメラは自動更新の対象外です

## 動作要件

- **インターネット接続**（地図タイル・CDNの読み込みに必要）
- **モダンブラウザ**（Chrome、Edge、Firefox の最新版を推奨）
- Python環境は **不要** です

## カメラの追加・編集

### 方法1: cameras.js を直接編集

`js/cameras.js` を開き、`CAMERA_DATA` 配列にカメラ情報を追加します。

```javascript
{
  id: "river_999",              // ユニークなID
  name: "○○川 △△観測所",       // 表示名
  category: "river",            // river | road | coast | city | other
  lat: 38.XXXX,                 // 緯度
  lng: 141.XXXX,                // 経度
  imageUrl: "",                 // 静止画の直リンクURL（取得可能な場合）
  sourceUrl: "https://...",     // 配信元ページのURL
  streamType: "static",         // static | youtube | stream
  youtubeId: "",                // YouTube配信の場合、動画ID
  description: "カメラの説明",   // 説明文
  operator: "管理者名"           // 管理機関名
}
```

### 方法2: Python スクリプトで生成

```bash
python tools/generate_cameras.py
```

`tools/generate_cameras.py` 内の `CAMERAS` リストを編集してから実行すると、
`js/cameras.js` が自動生成されます。

## ファイル構成

```
ishinomaki_bousai_camera/
├── index.html              # メインページ
├── css/
│   └── style.css           # スタイルシート
├── js/
│   ├── app.js              # アプリケーションロジック
│   └── cameras.js          # カメラデータ
├── tools/
│   └── generate_cameras.py # データ生成スクリプト（開発用）
└── README.md               # このファイル
```

## 注意事項

- カメラ画像の直リンクURLは、配信元の仕様変更により利用不可になる場合があります
- 大元のカメラサーバーに過度な負荷をかけないよう、更新間隔は10分を厳守しています
- 座標は概算値を使用しています。正確な位置への修正が必要な場合は `cameras.js` を編集してください

## ライセンス・クレジット

- 地図データ: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- 地図ライブラリ: [Leaflet.js](https://leafletjs.com/) v1.9.4
- アイコン: [Font Awesome](https://fontawesome.com/) 6
- フォント: [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)
