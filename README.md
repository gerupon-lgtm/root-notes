# ROOT NOTES（ルート・ノーツ）

SIKUMI NOTES | 04。音と三角形の比をつなぐパズル。© SIKUMI LAB

開発中。資料は `docs/` にあります。

- `docs/要件定義書_ROOT_NOTES.md`：仕様の正典（v0.10）
- `docs/実装指示書_ROOT_NOTES.md`：実装の進め方
- `docs/request-codex-character-ROOT.md`：キャラクターデザインの依頼書
- `docs/prototypes/`：試作（1ファイルのHTML。参考用）
- `docs/構想たたき台_ROOT_NOTES.md`：初期の構想（経緯の参考）
- `docs/design/`：段階ごとの設計メモ

## 開発の始め方

外部の部品（npm のパッケージ）は使いません。Node だけで動きます（Node 24 で確認）。

| 命令 | 中身 |
|---|---|
| `npm test` | 自動テスト（`node --test`） |
| `npm run check` | すべての .js の構文の確認 |
| `npm run dev` | 開発用サーバー。http://localhost:5174/ で開く（同じWi-Fiのスマホからも開ける） |

版数の正典は `package.json` の version です。画面に出す版（`src/version.js`）がずれると、テストが落ちます。

## 進み具合

| 段階 | 内容 | 状態 |
|---|---|---|
| 0 | 土台（フォルダ構成、テスト、版数表示、© 表示）、前作から移す部品の調査 | 実装済み・未公開 |
