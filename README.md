# MAGIC WORLD

8비트 픽셀 감성의 판타지 RPG 브라우저 게임입니다. [Phaser 4](https://phaser.io/) + TypeScript + Vite 기반으로, 그래픽 에셋 없이 코드로 픽셀아트를 그려 넣은 것이 특징입니다.

![tech](https://img.shields.io/badge/Phaser-4.x-blue) ![tech](https://img.shields.io/badge/TypeScript-7.x-3178c6) ![tech](https://img.shields.io/badge/Vite-8.x-646cff) ![tech](https://img.shields.io/badge/Bun-ready-f472b6)

## 특징

- **코드로 그린 픽셀아트** — 이미지 에셋 없이 `src/pixelart.ts`에서 스프라이트·타일을 전부 생성
- **3개 필드 + 턴제 전투** — 마을(월드맵), 던전, 숲을 탐험하고 몬스터와 턴제 전투
- **성장 시스템** — 최대 Lv 30, HP/MP/ATK/DEF 스탯, 검·방패 → 미스릴 장비 티어
- **몬스터 도감(베스티어리)** — 슬라임, 고블린, 늑대, 박쥐, 말벌, 거미, 오크 + 보스(킹 슬라임, 트롤 킹, 모스 골렘 등)
- **콘텐츠** — 상점, 낚시 미니게임, 보물상자(던전 3개 + 숲 4개), 업적 13종
- **마을 랭킹판** — 레벨 도달 기록 영구 저장 Top-10 리더보드 (세이브 삭제와 무관하게 유지)
- **낮/밤 사이클**, 미니맵, 대화창, 상태 HUD
- **WebAudio 사운드** — BGM/SFX, 탭 전환 시 자동 suspend/resume
- **localStorage 세이브** — 언제든 저장/복원 (`Ctrl+S`)

## build / run

[Bun](https://bun.sh) 필요.

```bash
bun install

# 개발 서버 (http://localhost:5199)
bun run dev --port 5199 --strictPort

# 프로덕션 빌드 (tsc + vite build → dist/)
bun run build

# 빌드 결과 미리보기
bun run preview
```

## deploy

`main` 브랜치에 push하면 GitHub Actions가 빌드해 GitHub Pages로 자동 배포
