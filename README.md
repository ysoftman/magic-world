# MAGIC WORLD

8비트 픽셀 감성의 판타지 RPG 브라우저 게임입니다. [Phaser 4](https://phaser.io/) + TypeScript + Vite 기반으로, 그래픽 에셋 없이 코드로 픽셀아트를 그려 넣은 것이 특징입니다.

![tech](https://img.shields.io/badge/Phaser-4.x-blue) ![tech](https://img.shields.io/badge/TypeScript-7.x-3178c6) ![tech](https://img.shields.io/badge/Vite-8.x-646cff) ![tech](https://img.shields.io/badge/Bun-ready-f472b6)

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
