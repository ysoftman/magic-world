# Magic World 개발 규칙

## Dev 서버 관리

- dev 서버는 **항상 1개만** 띄운다. 포트는 5199 고정.
- 코드 수정 후에는 **기존 서버를 먼저 종료하고 새로 시작**한다:
  - 종료: `lsof -iTCP:5199-5206 -sTCP:LISTEN -P | awk 'NR>1 {print $2}' | sort -u | xargs kill`
  - 시작: `nohup bun run dev > /tmp/pwcheck/devserver.log 2>&1 &` (포트는 `scripts/dev.ts` 에 고정,
    이미 쓰이면 다른 포트로 가지 않고 실패한다)
- 여러 서버가 떠 있으면 사용자가 옛 탭/옛 코드를 볼 수 있어 혼란을 준다(실제 사례: hjkl 미동작 원인이 예전 탭의 예전 번들이었음).
- 사용자에게는 항상 `http://localhost:5199/` 한 URL만 안내한다.

## 커밋은 의미 단위로 그때그때

- 기능·수정·문서 한 단위가 끝나고 검증(`bunx tsc --noEmit`, `scripts/` 를 고쳤으면 `bunx tsc -p scripts --noEmit`, 수정 파일 `biome check --write`,
  그리드를 고쳤으면 `bun run check:art`, 효과음을 고쳤으면 `bun run check:sound`)을 통과하면 **그 단위만
  바로 커밋**한다. 한 커밋에 여러 기능을 섞지 않는다. 실제 사례: 한 세션의 작업이 60개 파일 커밋 하나로
  들어가, 400여 조각을 나눠 13개 커밋으로 다시 만들어야 했다.
- 이 저장소에서는 사용자가 이 방식을 미리 승인했다(2026-10-28). 그래서 커밋마다 확인을 받지
  않는다. **push 는 여전히 사용자 확인 뒤에** 한다.
- 메시지는 `commit` 스킬 규칙대로: 영어 소문자 동사로 시작하는 70자 이내 제목, 필요하면 짧은 본문,
  AI 트레일러 금지. `git add -A`/`.` 대신 파일을 지정하고, 한 파일에 다른 단위가 섞여 있으면 그
  조각만 올린다.
- 팀 모드에서는 **리더만 커밋**한다. 팀원은 git 쓰기 명령(add·commit·stash·checkout·reset)을
  쓰지 않고, 끝난 단위와 바꾼 파일을 보고한다. 동시에 같은 파일을 고치는 중이면 리더가 끝난
  단위의 조각만 올린다.

## 에이전트 스킬(Phaser 공식)

Phaser 4 API 를 쓰거나 고칠 때는 프로젝트에 설치된 Phaser 공식 스킬(`phaserjs/phaser` 저장소의
`skills/`, MIT)을 먼저 불러 참고한다. 실제 사례: `scene.start` 를 data 없이 부르면 이전 data 가
다시 쓰이는 동작과 Phaser 4.2.1 의 키 큐 재전달 버그를 추측으로 다루다 각각 두 번씩 걸렸다.

| 주제 | 스킬 |
| --- | --- |
| 키보드·마우스·터치·게임패드 입력 | `input-keyboard-mouse-touch` |
| 씬 시작·재시작·data 전달·병렬 씬 | `scenes` |
| BitmapText(PixelText)·웹폰트·줄바꿈 | `text-and-bitmaptext` |
| 화면 배율·FIT·선명도 | `scale-and-responsive` |
| tween·easing | `tweens` |
| 텍스처 굽기(RenderTexture/DynamicTexture) | `render-textures` |
| 필터·후처리 | `filters-and-postfx` |
| 사운드 | `audio-and-sound` |
| 애니메이션(anims)·구운 시트 재생 | `animations` |
| 카메라 fade·scroll·필터 | `cameras` |
| 이벤트·리스너(SHUTDOWN 등) | `events-system` |
| 시간·타이머(delayedCall·time) | `time-and-timers` |
| 도형(Rectangle 뒷판·Graphics) | `graphics-and-shapes` |
| Phaser 4 새 기능, v3 습관 피하기 | `v4-new-features`, `v3-to-v4-migration` |

- 설치는 저장소 루트에서 아래 명령으로 한다(사용자가 설치한 그대로). 출처와 내용 해시는
  `skills-lock.json` 에 남는다. `.claude` 가 개인 전역 gitignore 에 걸린 환경이면 스킬 파일은 git 에
  안 잡히니 체크아웃마다 다시 설치한다(README "Claude Code 스킬(선택)" 절).

  ```bash
  DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bunx skills add phaserjs/phaser -a claude-code --copy -y \
    -s input-keyboard-mouse-touch scenes text-and-bitmaptext scale-and-responsive tweens \
       render-textures filters-and-postfx audio-and-sound v4-new-features v3-to-v4-migration \
       animations cameras events-system time-and-timers graphics-and-shapes
  ```

- 효과음을 설계하거나 고칠 때는 `designing-retro-arcade-sound-kits`(abagames/agentic-gamedev-skills, MIT)를 먼저
  불러 그 절차(사운드 타깃 → 프로그램 → 예산·상대 음량·음계 검사)를 따른다("효과음 키트" 절). 설치는 Phaser
  스킬과 같은 형식이고, 출처와 내용 해시가 같은 `skills-lock.json` 에 남는다. 그 저장소 안 경로는
  `.agents/skills/` 지만 `-a claude-code` 가 `.claude/skills/` 로 복사한다.

  ```bash
  DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bunx skills add abagames/agentic-gamedev-skills \
    --skill designing-retro-arcade-sound-kits -a claude-code --copy -y
  ```

- 카메라 필터(`camera.filters`)는 화면 전체가 바뀌는 전환에만 쓴다. 실제 사례: 시험으로 카메라에 건
  Blocky 가 HUD 글자까지 모자이크로 만들었다. 필드 씬은 맵과 HUD 를 카메라 하나로 그리기 때문이다.
  그래서 지금은 조우 모자이크(`fx.ts` 의 `encounterOut`)에만 쓴다. 또 필터는 처음 쓸 때 셰이더를
  만드느라 한 프레임이 멈춘다(Blocky 213ms, 300ms 페이드의 대부분). 새 필터를 들이면
  `warmEncounterOut` 처럼 타이틀에서 화면이 바뀌지 않는 값(1px 블록)으로 한 프레임 미리 걸어 둔다.
- `scene.start`/`scene.restart` 에는 데이터가 없어도 `{}` 를 넘긴다. Phaser 는 데이터 없는 start 에
  지난번 데이터를 다시 준다(`node_modules/phaser/src/scene/Systems.js:742`,
  `if (data) settings.data = data`). 받는 쪽에서 비우는 곳(`takeFightSpot`, `EndingScene`)도 있지만,
  새 씬은 그걸 빠뜨리기 쉽다.
- 전체화면은 Phaser 의 `scale.startFullscreen()`/`toggleFullscreen()` 대신 `SettingsUI` 의
  `setFullscreen` 처럼 `document.documentElement` 에 `scale.fullscreen.request` 이름의 메서드로 직접
  요청하고, 끄기는 `scale.stopFullscreen()` 이다. 4.2.1 의 `startFullscreen` 은 요청의 promise 를
  버려 거부가 uncaught rejection 이 되고, `FULLSCREEN_FAILED` 를 내는 `fullscreenErrorHandler` 는
  부르는 곳이 없으며, 캔버스를 새 div 로 옮겨 그 div 를 보내서 게임 둘레가 검게 나온다(소스로 확인:
  `node_modules/phaser/src/scale/ScaleManager.js` 의 `startFullscreen`·`getFullscreenTarget`).
  루트로 요청해도 ScaleManager 가 fullscreenchange 를 받아 `isFullscreen`·화면 맞춤·
  `ENTER/LEAVE_FULLSCREEN` 은 그대로다. 요청은 사용자 동작(keydown, 클릭, 터치는 손을 뗄 때) 뒤에만
  되고 게임패드 버튼이나 오래된 터치 뒤의 `sendKey` 합성 키는 아니라서, 새 진입점에는
  `navigator.userActivation.isActive` 가드와 거부 토스트를 같이 둔다. ScaleManager 는 게임에 하나라
  씬 UI 가 건 리스너는 SHUTDOWN 에서 뗀다. Phaser 를 올리면 `startFullscreen` 이 promise 를
  처리하게 됐는지 다시 본다.
- 브라우저로 직접 확인하는 일은 ego lite(`ego-browser` 스킬)를 먼저 쓰고, 게임 내부에 닿거나 자동으로
  재야 하면 이 저장소 전용 `magic-world-playtest` 스킬을 쓴다("기타" 절).

## UI 텍스트가 패널/화면을 벗어나지 않는지 확인

패널·라벨·힌트 문구를 새로 넣거나 고칠 때는 **구현 시점에 폭을 계산해서** 확인한다.
(실제 사례: FARM 패널을 620px로 만들었는데 씨앗 안내 줄이 660px라 패널 밖으로 삐져나감)

- `Press Start 2P` 는 고정폭이고 글자 하나가 1em 이다. `retroStyle(n)` 텍스트의 폭은
  **`문자수 x n x PIXEL(4)` px** — 예: `retroStyle(6)` 26글자 = 26 x 24 = 624px. 소문자 `fi`·`fl`
  도 두 칸이다(Text 는 이 글꼴의 합자로 한 칸에 그려 폭과 줄바꿈이 한 글자씩 어긋났다).
- **긴 글은 `bodyStyle`, 짧은 글은 `retroStyle`.** 대화창 본문, 전투 메시지, 상점·가방·대장간·
  부엌의 INFO·msg 줄, 도움말 본문, 업적 설명, 퀘스트 상세는 `bodyStyle(22|33)`(Departure
  Mono)로 쓴다. 제목·HUD·메뉴·이름표·선택지·토스트·키 안내 줄은 `retroStyle` 그대로다. 실제
  사례: Press Start 2P 32px 다섯 줄은 행간이 없어 한 덩어리로 읽혔다.
- Departure Mono 도 고정폭이다. 글자 폭은 **`size x 7/11`** — `bodyStyle(33)` 21px,
  `bodyStyle(22)` 14px(`pixelart.ts` 의 `BODY_GLYPH_W`). 11px 격자라 22·33 만 정수배이고 다른
  크기는 점 굵기가 고르지 않다. 줄 높이는 13/11 em, 39 / 26px 로 retroStyle 보다 크고, 대문자는
  줄 위에서 9 / 6px 아래(악센트 자리)에서 시작하고, 내림획은 줄 바닥(39 / 26px)까지 내려온다.
  세로 여백은 이 값으로 계산한다.
  retroStyle(6·8) 줄을 33으로, (4·5) 줄을 22로 바꾸면 가로 폭은 늘 줄어든다.
- 글꼴은 `@fontsource/press-start-2p` 의 latin subset 과 같은 범위로 자른 Departure Mono
  (`src/assets/fonts/`, 자른 명령은 그 CSS 주석)를 번들로 쓴다(`src/main.ts` 의 CSS import,
  부팅 전에 두 글꼴을 최대 2초 기다리고, 그 뒤에 들어오면 아틀라스를 다시 굽는다). 아틀라스에는
  출력 가능한 ASCII 와 `—` 만 들어 있다(`pixelText.ts` 의 `CHARS`, 게임 문구와 이름 입력이 쓰는
  전부). 그 밖의 글자는 그려지지 않으니 새 문구는 이 범위 안 글자만 쓰고 ★ 는 쓰지 않는다.
  실제 사례: 예전 Google Fonts CDN 을 막으면 전 화면이 fallback 이 되어 `HOME` 이름표가 84→53px 로
  줄었다. 지금은 번들이라 오프라인에서도 같다.
- 확인 순서
  1. 그 텍스트가 그릴 수 있는 **가장 긴 문자열**로 계산한다. 몬스터/아이템 이름, 카운트다운
     (`12H00M`), 골드(`9999`) 같은 동적 값은 최대 길이 기준.
  2. `setOrigin` 을 반영해 좌/우 끝 좌표를 구한다 (0 = x부터, 0.5 = x ± w/2, 1 = x까지).
  3. 패널 안쪽 경계(`GAME_WIDTH / 2 ± PANEL_W / 2`)에서 **좌우 20px 이상** 남는지 본다.
     스크롤 고정(HUD/토스트) 텍스트는 `GAME_WIDTH` / `GAME_HEIGHT` 경계도 같이 본다.
  4. 세로도 같은 방법으로: 행 간격 x 행 수 + 제목/메시지/힌트 영역이 `PANEL_H` 안에 들어가야 한다.
- 넘치면 순서대로: 패널 폭을 키운다 → 문구를 줄인다 → 폰트 크기를 낮춘다.
  길이를 미리 알 수 없는 문구(획득/수확 메시지 등)는 `setWordWrapWidth(PANEL_W - 60, true)` +
  `setAlign("center")` 로 감싼다. 단, 줄바꿈이 아래 줄과 겹치지 않는 자리에서만.
- 새 패널은 실제 게임(`http://localhost:5199/`)에서 한 번 열어 눈으로도 확인한다.

### 글자 대비와 뒷판

가독성 점검(2026-10)에서 글자를 가장 읽기 어렵게 만든 건 폰트가 아니라 대비와 뒷판이었다.

- 흐린 글자(빈 칸·잠김·재고 0·키 안내 줄)는 `pixelart.ts` 의 `DIM_TEXT`(`#808096`, 패널
  `#0b0b2b` 위 4.96:1)를 쓴다. `#666666`(3.33:1)·`#444444`(1.97:1) 같은 더 어두운 회색은 새로
  쓰지 않는다 — 실제 사례: 업적 설명·재고 0 아이템 등 87줄이 WCAG 4.5:1 미만이었다.
- 패널 밖, 그림(맵·전투 배경) 위에 직접 놓이는 글자는 외곽선(`setStroke("#1a1028" 또는
  "#0b0b2b", 4)`)이나 뒷판(글자 뒤 Rectangle, 아래 "글자 그리기")을 단다. 실제 사례: 대화창
  이름표 `ELDER` 가 뒤의 `BLACKSMITH` 이름표와 섞였고, 전투 `Z:CONTINUE` 는 풀밭 위에서 1.4:1 이었다.
  그래서 패널·도움말·대화가 열려 있는 동안에는 맵 이름표를 전부 숨긴다(`sceneCommon` 의
  `whilePanelUp(scene, () => this.uiBlocking())`, 모든 필드 씬). 반투명 패널 뒤로 이름표가
  유령 글자처럼 비쳤기 때문이다. 새 필드 씬도 같은 줄을 넣는다.
- 같은 `whilePanelUp` 이 그동안 토스트도 붙잡는다. `!` 가 들어간 소식(업적·해금 팁·
  `MARKET DAY! ...`)은 패널이 닫힌 뒤 순서대로 나오고, 패널이 열릴 때 떠 있던 토스트는 내린다
  (소식은 다시 줄 맨 앞에, `SAVED` 같은 상태 줄은 버림). 패널 안에서 누른 키의 답(`SOUND: OFF`,
  `SLOT 1 CODE COPIED`, `INVALID CODE`)과 `SAVE FAILED: STORAGE FULL`·`STORAGE BLOCKED` 는 `!` 없는 상태 줄이라
  패널 위에 바로 보인다(수확·요리·구매 저장이 패널 안에서 일어난다). 실제 사례: 해금 팁
  `THE FOREST GATE IS OPEN!` 이 ITEMS 제목 위에 겹쳐 둘 다 못 읽었다. 그래서 소식 토스트에는
  `!` 를 넣고, 상태 줄에는 넣지 않는다.
- 반투명 패널 아래로 맵 이름표가 비치지 않게 한다(HUD 배경은 불투명 — 0.6 일 때 `HOME` 이 HUD 의
  일부처럼 `QA HOME` 으로 읽혔고, 0.92 에서도 비쳤다). HUD 띠(y 0..88)까지 올라오는 패널은
  배경을 불투명(alpha 1)으로 한다 — 0.95 에서 퀘스트 일지 제목 줄 뒤로 HUD 글자가 비쳤다.
- 그런 패널의 top 은 `StatusHud` 의 `PANEL_TOP_OVER_HUD`(8, HUD 두 줄을 다 덮음) 또는
  `PANEL_TOP_UNDER_HUD_ROW1`(40, 1행 y 14..34 와 2행 y 58..78 사이) 둘 중 하나로 둔다. 실제
  사례: top 28 인 업적·도감의 위 테두리가 HUD 1행을, top 61 인 상점이 2행을 가로로 잘라 글자
  윗부분만 패널 위로 비쳤다. 지금 배치는 업적·도감과 터치에서 위에 붙는 집·부엌·대장간·가방·
  상점이 8, 키보드 상점·랭킹·퀘스트가 40, 키보드 가방이 83(HUD 아래라 상관없음)이다.
- 필드의 지역 제목(`THE FOREST` 등)도 맵 위에 바로 놓이므로 `sceneCommon` 의
  `fadeAreaTitle` 이 외곽선을 달고, 입구의 `TOWN` 이름표는 제목이 사라진 뒤에 들어온다
  (`fadeInAfterAreaTitle`). 실제 사례: 밤 숲에서 외곽선 없는 초록 `THE FOREST` 가 나무 꼭대기에
  묻혔고, 제목이 사라지는 0.6초 동안 함께 들어오던 `TOWN` 이름표와 겹쳐 둘 다 반쯤 비쳤다.
- 터치 버튼 원판(`TouchControls` 의 `DISC_ALPHA` 0.5, 누르면 0.2)은 그 아래 맵 이름표의
  뒷판 역할도 한다. 실제 사례: 0.25 에서 새 게임 첫 화면의 `BLACKSMITH` 이름표가 D-pad 뒤로
  거의 그대로 비쳐 화살표와 섞였다(화살표 대비 약 2.7:1, 0.5 에서 약 5.5:1). 원판을 다시
  옅게 하지 않는다.
- 크기: Press Start 2P 는 8px 격자라 `retroStyle(n)` 의 짝수 n(16·24·32px)이 글자 픽셀이 고른
  정수배다. 홀수 n 은 글자 픽셀이 반 픽셀에 걸려(`retroStyle(5)`, 20px 는 2.5px) 2px·3px 이
  번갈아 나온다. 선명하고 2칸 획은 늘 5px 지만 1칸 획은 굵기가 다르다. 패널·HUD 폭이 5 에 맞춰져
  있어 그대로 두었다. 새로 만드는 줄은 4 또는 6을 쓴다.
- 글자 그리기: 글자는 `scene.add.pixelText(x, y, 글, retroStyle(n) | bodyStyle(n))`
  (`src/pixelText.ts` 의 `PixelText`, BitmapText)로 만든다. `scene.add.text` 는 쓰지 않는다. 두
  글꼴을 부팅 때 격자 크기(8px / 11px)로 한 번 읽어 켜짐/꺼짐 픽셀 아틀라스로 굽고 정수배로
  그려서, DPR·창 크기·브라우저 확대와 상관없이 글자 픽셀이 늘 게임 픽셀 블록이다(중간 밝기 픽셀
  0%). 글자마다 텍스처가 없어 setText 는 쿼드만 옮긴다. 실제 사례: 예전 Text 는 글자마다 캔버스
  텍스처였고, DPR2 에서 선명하게 하려고 3배로 구워 마을 Text 502개가 36.8MB(GPU 에 같은 양 더)였고
  20px 줄은 그래도 8.5% 가 회색 테두리였으며, 창이나 화면 배율이 바뀔 때마다 전부 다시 구웠다. 지금
  아틀라스는 격자 크기 두 장(31·43KB)에 정수배가 아닌 크기와 외곽선 조합마다 한 장(46~763KB)을
  처음 쓸 때 굽는다.
  - Text 와 같은 인자·메서드: `setText`, `text`(설정한 원문, 줄바꿈 전), `setColor`,
    `setStroke`, `setWordWrapWidth(w, advanced)`(Text 의 줄바꿈을 옮긴 것이라 결과가 같다),
    `getWrappedText`, `setAlign`, `setLineSpacing(px)`, `setFontSize`, `setStyle`, `setShadow`.
    상자·origin·줄 간격도 Text 와 같은 픽셀에 오고, 위치는 Text 처럼 정수 픽셀로 맞춘다.
  - 외곽선(`setStroke(색, 두께)`)은 두께/2 px 의 네모 외곽선을 아틀라스에 따로 굽고, 글자색이
    외곽선에도 곱해진다(`#1a1028` × 글자색, 같거나 더 어둡다). `setShadow` 는 외곽선까지 포함한
    글리프 전체를 그 색으로 밀어 그린다(blur 없음, 어느 DPR 에서나 적힌 오프셋 그대로).
  - 배경색·padding·crop 은 없다. 뒷판은 글자 뒤에 Rectangle 을 두고 글이 바뀌면 `setSize` 로
    맞추며, 누를 수 있는 칩이면 클릭 범위도 뒷판에 건다(`Shop` 의 `modeChipBack`, `DialogueBox`
    의 `namePlate`). 타자기는 `TypedText` 처럼 줄바꿈한 글의 앞부분을 `setText` 한다.
  - `width`/`height` 는 BitmapText 라 scale 이 곱해진 값이다. 글자를 찾는 코드는
    `instanceof PixelText`(type `"BitmapText"`)로 본다(`sceneCommon` 의 이름표 숨기기, 하네스의
    `audit()`).
- 화면 배율: 표시 크기는 `main.ts` 의 `scale.snap`(320x180)으로 그 배수까지 내려 잡는다. 그래서
  아트 1픽셀이 늘 정수 CSS px 이고, 맥북 DPR2 에서는 정확히 2배다. 실제 사례: 2.19배일 때 같은 글자
  획이 16·17·18 기기픽셀로 섞였다. 대가로 화면이 한 단계까지 작아진다(맥북 91%).

### 패널 키 안내 표기

패널의 키 안내 줄은 한 형식으로 쓴다. 실제 사례: 패널마다 `J/K: PICK`, `JK: PLOT`,
`HJKL: MOVE`, `ARROWS/HJKL: SELECT/ADJUST`, 전투의 `H/L/J/K:NAV` 가 섞여 있었다.

- `키: 동작` 묶음을 공백 3칸으로 잇는다. 예: `JK: MOVE   Z: COOK   ESC: CLOSE`.
- 이동 키는 그 패널에 실제로 걸린 vim 글자를 슬래시 없이 붙여 쓴다: 격자 `HJKL`, 한 줄
  목록 `JK`, 좌우 `HL`. 방향키는 늘 같이 동작하므로 적지 않는다(README 의 "방향키 / HJKL").
- 커서 이동의 동작 이름은 `MOVE` 다. 축마다 하는 일이 다르면 그 일을 쓴다: FARM
  `JK: PLOT   HL/TAB: SEED`, 설정 `JK: SELECT   HL: ADJUST`, 업적 `HL: PAGE`.
- 슬래시는 같은 동작의 대체 키에만 쓴다: `U/ESC: CLOSE`, `ESC/O: CLOSE`, `Z/CLICK: SET COMPANION`.
- 터치 줄은 방향 패드를 `D-PAD`(FARM 은 버튼 글자 `^v`·`<>`)로, 나머지는 화면 버튼 글자로
  쓰고, 그 높이에서 D-pad·Z·ESC 원판의 가로 범위를 피한다.
- 예외: 전투 화면은 메뉴(`A:FIGHT`)와 같은 좁은 표기라 콜론 뒤에 공백이 없고 묶음 사이는
  2칸이다(`HJKL:MOVE  Z:OK  ESC:BACK`). 도감은 맨 위 줄이 키 줄 겸 메시지 줄이다(동료 선택
  같은 답이 잠시 그 자리에 뜬다).
- 키 안내 줄은 `ui/Gamepad.ts` 의 `bindKeyHint(text, () => keyHint(키보드 줄, 터치 줄))` 로 쓴다. 패드를
  쓰는 동안은 같은 줄을 패드 표(FIELD/BATTLE/TITLE)에서 그 키를 보내는 버튼 이름으로 바꿔 쓰고(이동은
  `D-PAD`, 두 축이 다른 일이면 `^v`·`<>`, 보내는 버튼이 없는 묶음은 빠짐), 입력 방식이 바뀌면 다시 쓴다.
  패드 키가 키보드와 다르면 `pad` 에 바꿀 원문을 준다(상점 TAB → `B/U`). 문장 안의 키(`FORGE IT? Z/ESC`)는
  `keyNames`. 게임패드는 고려 대상이 아니므로(아래 "필드 씬 입력") 새 줄의 패드 표기 폭은 따로 재지 않는다.

### 밤·해질녘·새벽 표현

- 밤과 하늘빛은 `NightOverlay` 의 MULTIPLY 사각형 하나로 그린다(전투 배경도 `skyOverlay()` 로
  같은 규칙). 반투명 남색(NORMAL)을 덮지 않는다. 실제 사례: 0x1a1a4a@0.45 가 어두운 픽셀까지
  들뜨게 해 외곽선·눈·이름표 테두리가 흐렸다(잔디 대비 피부 2.88, 튜닉 1.41 → MULTIPLY 3.58,
  1.73). 카메라 필터는 HUD 까지 바꾸므로 쓰지 않는다.
- 밤 배율색(`NIGHT_CAST`)은 파랑이 초록의 1.3배를 넘지 않게 한다. 실제 사례: 0x9ea8ff 시안에서
  피부가 보라가 됐다. SkyStop 은 곱셈 배율이라 단계마다 다음 단계보다 밝게 두고(해질녘이 밤보다
  어두워지지 않게), 모든 시각에 피부 hue 가 따뜻한 쪽(8~31°)인지 잰다.
- 밤 배율색은 모든 씬에서 시계를 따라 올라온다(`NightOverlay` 의 `nightBlue` = max(ambient,
  darkness x NIGHT_RANGE)). 씬이 그 위에 더 얹는 gloom(ambient 를 넘는 range, `SNOW_EXTRA_GLOOM`)은
  회색으로 어둡게만 한다. 실제 사례: 겨울 숲은 19:45 에 배율색이 이미 다 차서 남은 보라 하늘과
  곱해져 피부가 345° 가 됐다. 정지점이나 배율색을 바꾸면 정시 표본이 아니라 0.1분 간격으로 모든
  씬 설정을 훑는다. 정시 21개 표본으로는 숲 19:52 의 0° 가 잡히지 않았다.
- multiply 는 밝은 픽셀을 덜 깎는다. 그래서 눈 바닥(설원, 겨울 마을·숲)과 마을 전투 하늘은 추가
  gloom 으로 예전 밤 밝기에 맞췄다. 밝은 바닥이나 하늘 배경을 새로 넣으면 밤 평균 밝기를 전/후로
  잰다.
- 불빛(`NightOverlay.addLights`)은 라이트맵으로 비춘다. 램프가 하나라도 있는 씬은 1280x720
  RenderTexture 에 밤 배율을 채우고 글로우를 ADD 로 더해 MULTIPLY 로 덮는다(씬당 +3.7MB, 램프 없는
  씬은 사각형 그대로). 빛 안의 그림은 제 색으로 돌아오고 검은 픽셀은 검게 남는다. 실제 사례: 그늘
  위에 바로 ADD 로 더하던 글로우가 대장간 빛 중간에서 검은 문 안쪽을 L* 4→16 으로 띄웠고(지금 5),
  화로 앞 얼굴의 피부↔눈 대비를 밤(6.1)보다 낮은 5.5 로 떨어뜨렸다(지금 8.5, 낮 12.0).
- 라이트맵은 그림을 낮 색까지만 돌려줘서, 그것만으로는 등불·창문이 꺼진 것처럼 보였다. 그래서 램프마다
  광원 자리에 반경 절반(`HALO_RADIUS`)의 ADD 후광을 남긴다.
- `air: true` 는 낮에도 거의 검은 바닥 위의 장식 빛(동굴·ABYSS 물웅덩이, ABYSS 계단)에만 쓴다. 그런
  바닥은 라이트맵이 되돌릴 색이 없어 빛이 사라진다(ABYSS 코어 ΔE 밤 3.4, 라이트맵 3.5). 새 빛은 아래
  그림이 낮에 밝으면 기본값(라이트맵), 낮에도 거의 검으면 `air` 로 둔다.
- 라이트맵 안 램프 위치는 RT 의 CALLBACK 에서 메인 카메라 스크롤로 맞춘다. 카메라 추적은 update 뒤
  preRender 에서 스크롤하므로, update 에서 맞추면 걷는 동안 최대 2.5px 뒤처진다.
- 새 빛을 넣으면 같은 자리 낮 그림과 비교해 얼굴 대비와 피부 hue 를 잰다. hue 8~31° 규칙은 하늘빛
  배율과 램프에 적용한다. 파란·보라 `air` 빛 안에서는 피부가 채도 0.04~0.07 의 보랏빛 회색(hue
  249~287°·349°)이 되는데, 물빛·계단빛의 색이라 그대로 둔다(결정).

### 맵 이름표(라벨)끼리 겹치는지도 확인

NPC/건물/입구 라벨은 전부 `setOrigin(0.5)` 이라 폭 `문자수 x n x 4`, 높이 약 `n x 4 x 1.3`
의 사각형이다. 새 지점(`*_POS`)을 추가하거나 옮길 때마다 **주변 라벨과 사각형이 겹치는지**
계산한다. 대화 반경(120px) 규칙과 별개로 따로 확인해야 한다 — 반경이 떨어져 있어도 긴
라벨끼리는 겹친다.

- 실제 사례: `FARM` 라벨이 한 줄 옆 `BOUNTY BOARD` 라벨과, `FOREST` 라벨이 한 타일 옆
  `GUARD` 라벨과 겹쳤다.
- 맵 경계도 같이 본다. 라벨 사각형이 `0 .. MAP_W * TILE` (세로는 `MAP_H * TILE`) 을 벗어나면
  안 된다 (실제 사례: 서쪽 끝의 `SNOW PASS` 라벨이 맵 밖으로 나감 → 표지판 좌표 기준으로 이동).
- 겹치면 표지판/라벨을 한 타일 위나 옆으로 옮긴다.
- 맵 맨 위 줄 근처 지점의 이름표는 `TownScene.labelY` 가 지점 아래로 뒤집는다. HUD 밑에
  숨지 않게 하려던 것인데, 카메라가 0행까지 보여 주게 된 뒤 뒤집기를 없애 봤더니 그 이름표가
  HUD 바로 아래 토스트 줄(y 100)에 놓여 `FARM`·`FISHING` 이 `MARKET DAY! SHOP ...` 토스트와
  한 문구로 섞였다. 그래서 뒤집기는 그대로 두고, 첫 화면의 HOME 말풍선 아래 깔리던 `FARM`
  표지판을 밭 남쪽 (5,4)(`overworldMap.ts` 의 `FARM_SIGN_POS`)로 옮겼다.
- 사각형이 겹치지 않아도 같은 줄(세로 범위가 겹침)에서 가로 간격이 2글자 폭(`2 x n x 4`)
  미만이면 두 이름표가 한 문구로 읽힌다. 고정폭이라 띄어쓰기가 정확히 1글자 폭이기 때문이다.
  실제 사례: `GUARD` 이름표와 `FOREST` 표지판 이름표가 같은 줄에서 18px 떨어져
  `GUARD FOREST` 로 읽혔다 → GUARD 를 숲 출구에서 4칸 안쪽(TownScene `guardPos`)으로 옮겼다.
  아래 AABB 검사 스크립트에서 이 간격도 같이 본다.
- 맵 위에 겹쳐 그리는 안내 그래픽(안내 화살표 등)은 이름표(깊이 11) 아래 깊이에 둔다. 실제
  사례: 안내 화살표(`GuideArrow`)가 깊이 91 에서 영웅 주위를 돌다 지나가는 이름표 글자를
  덮었다(CAVE 의 A, FISHING 의 H). 지금은 10.5 로 영웅·NPC(10) 위, 이름표(11)·밤 그늘(90)
  아래라 밤에는 이름표와 함께 어두워진다. 새 이름표도 11 로 둔다. 실제 사례: 동굴 ABYSS
  이름표가 9 라 계단 줄 위에 선 영웅 곁에서 출구를 가리키는 화살표가 `SS` 를 덮었다(지금 11).
  예외는 동굴·심연의 TOWN 표식(`sceneCommon` 의 `addTownExitLabel`, 영웅 아래 9)뿐인데, 화살표가
  닿을 수 없는 자리라 그대로 둔다.
- 확인 방법: `src/levels.ts` 의 `*_POS` 상수를 import 해서 라벨 사각형 목록을 만들고 AABB
  겹침을 검사하는 일회용 스크립트를 `/tmp/pwcheck/` 에 두고 `bun` 으로 돌린다. 라벨 목록은
  각 씬 `create()` 의 `.pixelText(...)` 호출이 원본이다.

## 오버월드 맵 레이아웃

- 마을 지형과 랜드마크 위치는 **`src/overworldMap.ts` 한 파일**에 있다. 이 파일만 바꾸면
  레이아웃 전체가 바뀐다 (`levels.ts` 는 여기서 읽어 쓴다).
- 게임 안에서 `F2` 로 맵 편집기를 열고 `X` 를 누르면 dev 서버가 이 파일을 **직접 덮어쓴다**
  (`scripts/dev.ts` 의 `/__map` 라우트, dev 전용). 저장 후 dev 서버가 리로드하고
  localStorage 편집본은 지워지므로 파일이 곧 정답이 된다.
- dev 서버가 없으면(빌드된 페이지) 같은 내용이 클립보드와 콘솔로 나온다.
- 손으로 고칠 때 주의: 랜드마크는 걸어갈 수 있는 타일 위여야 하고(집 앵커 제외), 상호작용
  지점끼리 120px 이상 떨어져야 하며, 이름표 겹침 규칙(위 섹션)도 함께 확인한다.
- 일을 맡은 NPC(ELDER·SHOP·BLACKSMITH·ARENA·GAMBLER·HUNTER, `levels.ts` 의
  `WORKPLACE_LANDMARKS`)는 등 뒤에 2x2 건물이 따라붙는다. 건물은 NPC 칸 바로 위 두 줄에
  서고, 왼쪽 열이 NPC 칸과 같은 열이다. 그래서 NPC 를 옮기면 그 2x2 도 풀밭이어야
  한다(길·나무·물·키 큰 풀·집 금지). 건물은 그 네 칸 전체가 막히므로 길을 끊지 않는지도
  본다. 칸 목록은 `workplaceCells()` 로 얻는다(보물 지도처럼 빈 칸을 고르는 코드도 이걸로
  피한다). 길 남쪽의 상인은 건물이 길 위에 서지 않도록 길에서 두 줄 아래에 둔다.
- 심연 관문(`ABYSS_GATE_POS`, 동굴 입구 동쪽)은 심연이 열린 뒤에만 그려지지만 EDITABLE_POS 라 풀 테두리·보물
  지도는 늘 비켜 간다. 타일 전체가 막히므로(48x64) 옮길 때 길을 끊지 않는지, 동굴에서 나온 자리(입구 두 칸
  아래)와 120px 이상인지 본다. 동굴 계단과 관문은 같은 질문(`sceneCommon` 의 `askAbyssDive`)을 쓴다. 관문 안에서
  도는 rift(`src/ui/abyssRift.ts`)도 `track` 으로 관문에 묶여 있어 F2 편집기에서 관문과 같이 옮겨진다.

## 필드 씬 입력(종료 확인·터치·게임패드)

- 타이틀로 나가기(Q)는 `sceneCommon` 의 `FieldKeys.takeQuitKey(this.dialogue, () => this.uiBlocking(),
  () => this.quit())`(안에서 `askQuitToTitle`)로 대화창에서 묻고, 씬의 `quit()` 은 `quitting = true` 뒤 `saveAndQuit(this)` 를 부른다. 실제
  사례: 예전에는 여섯 필드 씬이 각자 중앙 `QUIT TO TITLE? Y/N` 글자와 Y/N/ESC 리스너를 따로
  들고 있었고, 안내 화살표·도움말·조우·보물 파기·심연 계단 질문이 그 플래그를 씬마다 따로
  봤다. 지금은 대화창이 `uiBlocking()` 이라 영웅·패널 키가 멈추고 이름표도 숨으며, 저장 뒤
  타이틀로 가기까지의 700ms 는 `quitting` 하나로 막는다. 새 필드 씬도 DialogueBox 와 이 두
  줄(`takeQuitKey`, `quitting` 가드)을 넣는다.
- W 는 필드(숲·설원·동굴·심연·화산)에서 마을 HOME 문 앞으로 워프한다. `new FieldKeys(this, { warp: true })`
  로만 등록하고(마을은 HOME 이 마을 안이라 등록하지 않는다), update() 의 `takeQuitKey` 바로 뒤에서
  `takeWarpKey(() => this.uiBlocking() || 나가는 중 플래그, () => this.warpHome())` 로 받는다. `warpHome()` 은
  `askWarpHome(this, this.walk, this.dialogue, 플래그 세우기, done?)`(`WARP HOME?` YES/NO, ESC 는 NO)이고 YES 면
  `warpOut` 으로 사라진 뒤 `scene.start("Town", { fromWarp: true })` 다(데이터를 늘 새로 줘 지난 data 재사용이
  없다). 나가는 중 플래그(`exitingForest` 등)가 조우·출구·계절 전환을 막고 연출 동안은 `FieldKeys.leaving()` 이라
  다른 키가 안 먹는다. 마을은 `homeDoor()`(HOUSE_POS 에서 읽는 집 문 아래 칸)에 놓고 `WARP_IN_MS` 를 조우
  쿨다운에 얹은 채 `warpIn` 한다. 심연은 위 계단의 LEAVE 와 같이 `portalOnLeave` 로 포털을 남기고(`leaving` 콜백),
  `run = null`(`done`)로 런을 끝낸다. 터치 `MENU` 는 필드에서 W 까지 8개가 되어 원판을 r21·피치 46 으로 줄이고
  열을 474 에서 끝낸다(7개까지는 r24·피치 50, 대화창 480 위). 새 필드 씬은 같은 세 곳(키 등록·takeWarpKey·
  warpHome)과 도움말 줄 `["W", "WARP HOME"]` 을 넣는다.
- 필드 공통 키(S·CTRL+S·M·T·I·B·A·U·O·Q, 필드의 W)는 `sceneCommon` 의 `FieldKeys` 가 등록하고 큐에 담는다. 새 필드
  씬은 create() 에서 TouchControls 보다 먼저 `new FieldKeys(this)` 를 만들고(마을은 `{ toastY:
  STATUS_HUD_TOAST_Y }`), update() 에서 `takeSystemKeys(hud)` → `takeMapKey` → quitting
  가드 → `takeQuitKey` 순으로 부른다(마을은 T 를 가드 뒤, Q 다음에 읽는다). 이 키들의 `*Queued`
  플래그를 씬에 새로 만들지 않는다. 씬 전용 키(설원 Z, 마을 Z·SPACE·C·G·F2)만 씬이 직접 등록한다.
  실제 사례: 여섯 씬이 같은 키 등록·플래그·처리를 각자 들고 있어, 최근 커밋 150개 중 21개가 이 씬
  3개 이상을 함께 고쳤다. 공통 키를 더하려면 `FieldKey` 타입과 생성자를 고치고 TouchControls 의
  `MENU` 도 같이 본다.
- 키를 누른 채 씬이 바뀌면 새 씬의 Key 는 그 키의 반복 keydown(`e.repeat`)을 첫 DOWN 으로 받는다. 그래서
  `FieldKeys` 는 반복을 모두 버리고, 씬이 직접 등록하는 키도 `!e.repeat` 일 때만 큐에 담는다(마을 Z·SPACE·C·F2,
  설원 Z). 실제 사례: 출구나 전투 끝에 I 를 누르고 있으면 마을에 들어서자마자 가방이 열렸고, S·M 은 누른
  씬에서 HUD·소리를 끈 뒤 새 씬에서 도로 켰다.
- 맵 위에 뜨는 패널은 `sceneCommon` 의 `FieldPanels` 에 모은다. 새 필드 씬은 FieldKeys 다음에
  `this.panels = new FieldPanels(this, this.fieldKeys)` 를 만들고, 패널을 만드는 그 자리에서 `add` 한다.
  I·B·A·U·O 패널은 키와 함께(`this.panels.add(new InventoryUI(this), "I")`), 대화창·얼음 낚시·마을 상점처럼
  씬이 직접 여는 패널은 키 없이(`this.dialogue = this.panels.add(new DialogueBox(this, []))`) 넣는다.
  `uiBlocking()` 은 `this.panels.blocking()`(패널과 도움말), update() 의 막힌 분기는 영웅을 세운 뒤
  `this.panels.update()`(그 패널의 키로 닫기와 모든 패널의 update), 열기는 `if (this.panels.takeOpenKey())
  return;`, SHUTDOWN 은 `saveOnShutdown` 목록의 `this.panels` 다. add 순서가 만드는 순서이자 update 순서다. 패널은
  만들 때 키 리스너를 등록하므로 같은 키(ESC·Z·방향키)를 누가 먼저 듣는지가 이 순서로 정해지고, 마을은
  대화창이 먼저라 대화의 답으로 연 상점이 같은 프레임에 돈다. `add` 하지 않은 패널은 uiBlocking 에서
  빠진다. 실제 사례: 여섯 씬이 다섯 패널의 필드·생성·uiBlocking·닫기·update·열기·destroy 를 씬마다
  60줄 남짓 각자 들고 있었고, 마을 오버랩 콜백이 따로 들고 있던 그 목록의 사본은 BestiaryUI 를 빠뜨린
  적이 있다.
- 씬 전환이 시작되면(카메라 fadeOut: 전투·출구·계단·계절, 마을 휴식) `FieldKeys.leaving()` 이 참이 되어
  Q 와 패널 키는 큐에서 꺼내 버린다. 씬이 직접 받는 입력(도움말의 `blocked`, 보물 지도 Z, 설원 Z, 마을
  Z·C·HOME 말풍선 탭)도 `this.fieldKeys.leaving()` 을 같이 본다. 새 전환도 카메라를 fadeOut 하고 그
  끝에서 씬을 바꾼다. 실제 사례: 조우 페이드 300ms 안에 누른 I 는 가방을 연 채 전투로 넘어갔고, Q 는
  출구 페이드 위에 질문을 띄웠고, 설원 Z 는 페이드 중에 얼음 낚시를 열거나 보물을 파고 저장했다. 종료
  대기 700ms 는 페이드가 없어 각 씬의 `quitting` 이 막는다.
- 필드 씬마다 똑같던 나머지도 `sceneCommon` 의 도우미를 쓴다. 새 필드 씬은 이렇게 넣는다.
  - 토스트: create() 맨 앞에서(첫 SHUTDOWN 리스너가 되게) `this.toasts = new FieldToasts(this, { blocked: () =>
    this.uiBlocking() })`, update() 에서 `this.toasts.update(delta)`. 저장마다 SAVED 를, 1초마다 업적·해금
    팁·외형 해금 토스트를 낸다(패널이 열려 있으면 기다림). 씬이 직접 알리는 저장(새 기록, 계절 소식)은
    `this.toasts.quietSave()` 로 해서 SAVED 가 그 소식 뒤에 줄 서지 않게 한다. 마을은 `toastY:
    STATUS_HUD_TOAST_Y`·`tip: "town"`·대화 중에는 SAVED 를 보이는 `savedHeld`, 설원은 `tip: "snow"` 다.
  - 걷기: 씬 키를 등록하는 자리에서 `this.walk = new HeroWalk(this, this.player, { shadow, companion, weapon,
    shield })`, update() 에서 `const moving = this.walk.step(떠나는 중인지)`, 막힌 분기에서 `this.walk.halt()`,
    계절 전환처럼 세워서 돌려세울 때 `this.walk.idle()`.
  - 몬스터: `addRoamer(this, group, zone, kind, texture, boss)` 를 `this.roamers` 에 넣고, update() 의 모든
    분기(막힘·quitting 포함)에서 `wanderRoamers(this.roamers, delta)`.
  - 출구·계단: 씬 플래그를 세운 뒤 `walkOut(this, this.player, () => this.scene.start(...))`(200ms 페이드).
  - SHUTDOWN: create() 끝에서 `saveOnShutdown(this, [this.minimap, this.panels, this.night,
    this.companionFollower, help, this.touch])`. 저장한 뒤 차례로 destroy 한다. 마을은 그 바로 앞의 SHUTDOWN
    리스너에서 `GameState.pos` 를 적는다.
  실제 사례: 여섯 씬이 씬마다 업적 확인·SAVED 구독 40줄, 걷기 60줄, 로머 70줄 남짓과 출구 페이드를 각자
  들고 있었다. 패널 위의 SAVED 를 막는 조건이 심연에만 빠져 가방을 열어 둔 채 저장하면 SAVED 가 패널 위에
  떴고, 토스트 큐가 생긴 뒤 마을의 저장 플래그 주석만 고쳐져 다른 다섯 씬은 "SAVED 가 같은 Text 를
  덮어쓴다"는 옛 설명을 그대로 들고 있었다. 조우(쿨다운·굴림)는 굴리는 조건이 씬마다 달라(마을 키 큰 풀,
  심연 수호자 방·밤 없음, 출구 둘레 안전 상자) 씬에 남아 있다.
- 게임패드는 고려하지 않는다(사용자 결정, 2026-10-29). `src/ui/Gamepad.ts` 와 패드 표기는 있는 그대로
  두지만, 새 키·패널·전투 버튼에 패드 매핑·패드 표기·패드 검증을 하지 않는다. 패드 표에 없는 키는
  패드로 못 누르고 키 안내 줄의 패드 표기에서 그 묶음이 빠지는 것을 감수한다.
- 필드의 패널 키나 전투 키를 새로 만들면 터치도 같이 본다. 터치 오른쪽 세로 줄은
  `TouchControls` 의 `MENU`(씬이 등록한 키만 버튼이 됨)다. `sendKey` 로 키보드 이벤트를 합성해
  보내서 씬은 키보드만 처리하면 되지만, 표에 없는 키는 터치로 누를 방법이 없다. README 의 조작 표도
  같이 고친다.
- 맵 오른쪽 아래 모서리(카메라가 붙는 자리)에 지점을 두면 터치 원판(Z (1128,584) r52, ESC (1000,668) r40,
  D-pad (150,616)±64 r44)과 화면 좌표로 겹치는지 계산한다. 실제 사례: 동굴 ABYSS 계단의 보라 홈(화면
  y 636..648)이 ESC 밑에 있었다. 한 타일 내리면 ESC 는 비켜도 Z 밑에 상자가 남아(동굴 (22,14), 화산
  (21,13) 은 Z 한가운데), 터치에서는 동굴·화산·심연 카메라가 맵 아래로 두 타일(`TOUCH_CAMERA_FOOT`,
  128px) 더 내려간다(`boundCameraToMap(scene, w, h, true)`). 두 타일이어야 동굴·화산 상자와 동굴 계단이 두
  원판을 다 비키고(0 타일 3곳, 1 타일 동굴 상자 1곳이 걸림), 심연 계단·상자의 걸림도 2400개 층 중 34→7→0 이다.
  마을·숲·설원은 모서리에 지점이 없어 그대로다(새 지점을 두면 위 계산을 다시 한다).
- 전투 승리 결산은 say 한 번(2줄 x 54글자)이고, 레벨업·보물 지도·보스 줄만 따로 둔다. 전투 첫 줄은 Z 를
  기다리지 않고 메뉴와 함께 뜬다(BattleScene `type()`). 동료의 평범한 공격 줄은 읽을 시간을 위해 자동으로
  넘기지 않는다(결정). 실제 사례: 처치·골드·연승·획득·EXP·"Battle won!" 이 각각 Z 를 받아 SLIME 한 판이
  Z 8~10번이었다(지금 2~3번). 결산에 문구를 더하면 `victory()` 의 최악 길이 주석(4자리 수치·13글자
  이름)을 다시 잰다.
- 전투 메뉴에 버튼을 더하면 BattleScene `layoutMenu()` 위 폭 주석을 다시 잰다. 실제 사례: D:DEFEND
  하나로 두 줄 메뉴가 키보드 Lv18→Lv9 로, X:SKILL(Lv2)로 다시 Lv5(HEAL)로 당겨졌다. 전투 규칙을 바꾸면
  `scripts/sim-battle.ts` 의 같은 자리(cast·choose 등 BattleScene 을 옮긴 곳)도 고친다(실제 사례: CHAIN,
  DEFEND). 강타 예고(`BOSS_TELLS`)를 보스 아닌 몬스터에 붙일 때는 `chance` 로 확률을 낮추고, `mult` 는 지역
  입장 레벨에서 막지 않은 강타가 최대 HP 15~25% 가 되게 잰다(밤 x1.25 ATK 가 그대로 곱해진다).
- 전투 화면에는 `TouchControls` 가 없다(메뉴를 바로 탭한다). 그래서 전투에서 키(ESC 등)에만
  묶인 동작은 탭 경로를 함께 만든다. 실제 사례: 아이템 목록을 닫는 길이 ESC 뿐이라 터치에서는
  아이템을 쓰지 않고는 나올 수 없었고, 재고가 0 이면 전투가 멈췄다 → 지금은 목록 밖을 탭하면
  메뉴로 돌아간다(`BattleScene` 의 `closeItems`).
- 마을 TRAINING YARD(ARENA 관리인의 TRAIN, `src/practice.ts`)는 `Battle { practice }` 로 시작한다. HP/MP 는 매 프레임 채우고(`refillHero`), 적이 쓰러지면 `practiceVictory` 가 보상·집계 없이 `scene.restart` 로 무작위(`randomStep`, 방금 그 적은 빼고) 다른 적을 넣는다. 적 HP 는 `practiceHp`(원래의 10배와 영웅 공격력 x25 중 큰 쪽, 네 자리까지)이고 도감(`seenMonsters`)에는 올리지 않는다. 메뉴 C:FOE(`practiceFoe`, S:STEAL 자리, 스펠 첫 글자 F/H/I/B/W/N 과 안 겹침)가 원하는 적을 고르게 명단(`practiceEnemy`, 보스·거인 뺀 순서)의 다음 적으로 바꾸고, ESC:EXIT(`exitPractice`)만 끝낸다. 들어갈 때의 HP/MP·가방을 `endPracticeRun` 이 돌려놓아 힐·소모·비축에 못 쓴다. 식사 충전·휴식 효과·잡기·훔치기·밤 안내는 꺼진다. 새 전투 보상·집계를 `victory()` 에 더하면 `practice` 가 그 앞에서 빠지는지 본다. 관리인 첫 질문은 `ARENA`/`TRAIN` 둘이고 ESC 는 `escPick` 2 로 떠난다.
- 전투 SKILL 목록 안에서 X 를 한 번 더 누르면 Z 처럼 커서의 기술을 쓴다(`X X`). 목록이 마지막에 쓴 기술에서 열려서
  같은 기술의 반복이 두 번 누름이다. 키 안내는 `Z/X:OK` 다.
- 전투 SKILL 목록(X:SKILL, 첫 기술을 배우는 Lv2 부터)은 배우는 순서대로 3열 x 4행, 한 쪽 12개다(26개면 3쪽).
  4열은 긴 이름(DAGGER FLURRY 13글자, 12글자 넷)이 커서 넷과 1320px 라 화면에 안 들어가고, 4행이 자리
  전부다(BattleScene `SKILLS_PER_ROW` 위 주석). 그 4행이 아이템 목록의 설명 줄·키 안내 자리(y 474..598)를 써서,
  목록이 열린 동안 커서 기술의 `이름  MP  설명`(INFO, `bodyStyle(33)` 54글자, `battleRules.ts` 의
  `MoveBase.info`)과 키 안내는 메시지 창 안에 놓이고 전투 줄은 숨는다. 줄 끝의 H/L 이 쪽을 넘기고, 터치는 키
  안내 오른쪽 칩 `< 1/3 >` 의 왼쪽·오른쪽 절반을 탭한다. 커서는 `lastSkill` 로 다음 전투에도 마지막에 쓴 기술에
  남는다(저장하지 않아 새로고침하면 처음). 무기 기술의 MP 는 최대 MP 의 비율(`mpShare`, `skillCost`)이다. 실제
  사례: 고정 MP 였을 때 DOUBLE SLASH(Lv2, 2 MP)는 피해만 ATK 를 따라 커져 Lv30 에서 MP 당 FIGHT 보다 약 9 를 더
  줬다(주문은 약 1.5, `battleRules.ts` 의 SKILLS 위 주석). 새 스킬·기술은 `battleRules.ts` 의 이름 목록·`SKILLS`,
  `skillFx.ts`·`techFx.ts` 의 `SKILL_HITS`/`TECH_HITS`·`PLAYS`·`*_SHEET_KEYS`(기술은 `TECH_MELEE` 도),
  `skillSfx.ts` 의 `VOICES` 를 같이 맞춘다. 빠진 이름은 tsc 가, 대수(`VOICES` 의 `hits` 포함, `skillSfxHits`)나
  무기/마법 구분이 어긋나면 dev 빌드의 BattleScene 이 console.error 로 잡는다(타격음이 모자라면 마지막 것을
  되풀이한다).
  수치는 `bun run sim:battle --skill-table` 로 MP 당 이득을 기존 주문(제 레벨에서 FIGHT 대비 1.2~1.7)과
  견주고, `--skills` 를 `--greedy` 와 견줘 보스전 라운드를 본다.

## 작업 완료 후 중간 산출물 정리

- 작업 중 생성한 **중간 산출물**(디버그 스크린샷 png, 검증용 임시 파일, 임시 훅 등)은 작업이 끝나면 반드시 정리한다.
- 스크린샷/검증 산출물이 저장소 루트에 남지 않도록 확인하고, 필요 없어진 파일은 삭제하거나 `.gitignore`에 추가한다.
- 임시 디버그 훅(예: `Object.assign(window, { __game })`)은 커밋 전에 반드시 제거한다.
- `/tmp/pwcheck/` 등 임시 디렉터리의 파일은 저장소 정리 대상에서 제외한다.

## TODO.md

- 완료되지 않은(진행 중) 작업이나 앞으로 작업할 내용은 루트의 `TODO.md`에 기록한다.
- 작업을 완료하면 해당 항목을 `TODO.md`에서 삭제한다.

## 기타

- 빌드: `bun run build` (tsc + `scripts/build.ts` 의 `Bun.build` → dist/). Phaser 는 둘째 입구
  `src/vendor.ts` 덕에 따로 청크가 되어, 게임만 바꾼 배포에서는 해시가 그대로라 플레이어 캐시가
  남는다. dev 전용 코드는 `process.env.NODE_ENV !== "production"` 으로 가른다. Bun 은 dev 서버와
  빌드 양쪽에서 이 값을 상수로 바꿔 넣지만 `import.meta.env` 는 그대로 둬서, Vite 를 걷어낼 때
  `import.meta.env.DEV` 를 남긴 배포판이 마을 진입에서 죽었다.
- README "게임 기능" 절의 수치(아레나 상금 비율, 강타 상한, 주문 부가 효과 확률, 제작 장비·REFINE 수치,
  시간 배속, 심연·밤·HARD MODE 배율 등)는 코드 상수를 옮겨 적은 것이다. `battleRules.ts`·`arena.ts`·
  `abyss.ts`·`drops.ts`·`gameState.ts`·`home.ts`·`cooking.ts`·`events.ts` 의 상수를 바꾸면 같은 커밋에서
  README 의 그 줄도 고친다.
- 에셋/디버그 검증 스크립트는 `/tmp/pwcheck/`에 둔다 (png.mjs 디코더는 Paeth 필터 4 버그 수정본 사용)
- playwright 의 `page.evaluate` 에서 `scene.start(...)` 처럼 Phaser 객체를 돌려주는 호출은
  `void` 로 감싼다. 실제 사례: 반환값(ScenePlugin)을 직렬화하느라 evaluate 가 끝나지 않아
  게임패드 검증 스크립트가 타임아웃 없이 멈췄다.
- `biome check --write` 의 자동 수정은 `Object.prototype.hasOwnProperty.call(...)` 을
  `Object.hasOwn(...)` 으로 바꾸는데, tsconfig `lib` 이 ES2020 이라 `Object.hasOwn` 이 없어
  `tsc` 가 깨진다. 실제 사례: drops.ts 의 REFINE 키 검사 → `Object.keys(...).includes(key)` 로
  썼다. biome 뒤에는 반드시 `bunx tsc --noEmit` 을 다시 돌린다.
- Phaser 4.2.1 키 큐 재전달 버그: 한 게임 스텝 안에 키 이벤트가 3개 이상 오면
  KeyboardManager 가 앞의 이벤트를 같은 KeyboardEvent 로 다시 넘겨(`keydown` 리스너·Key
  `down` 모두) 키가 두세 번 처리됐다. 실제 사례: M 한 번에 음소거가 3번 토글됐고, 이름 입력에서
  "c'd" 가 "CC''D" 로 들어갔다. `src/keyboardQueueFix.ts` 를 main.ts 에서 게임 생성 전에 불러
  플러그인마다 이벤트를 한 번만 처리하게 보정한다. Phaser 를 올리면 이 보정이 아직 필요한지 다시
  확인한다(window 에 keydown 3개를 한 번에 보내 씬의 `keydown` 리스너가 각 1회만 받는지).
- `PixelText`(`src/pixelText.ts`)는 Phaser 4.2.1 BitmapText 의 공개되지 않은 부분에 기댄다:
  `_text`·`_dirty`·`_bounds`·`_displayOriginX` 필드, `getTextBounds` 가 크기를 잴 때 `text` 를
  읽는 것(그동안 줄바꿈한 글을 돌려준다), 프로토타입의 `renderWebGL`(정수 픽셀 스냅으로 감싼다)이
  `this` 없이 render step 으로 불리는 것, 글자 데이터의 `xAdvance` 와 아래에서부터 센 v 좌표. Phaser 를
  올리면 화면의 PixelText 마다 같은 설정의 Text 를 만들어 width·height·origin·줄바꿈이 같은지 비교하고,
  DPR1·2 스크린샷으로 위치·선명도가 그대로인지, 외곽선 글자와 그림자가 나오는지 다시 본다.
- Phaser 4.2.1 RenderTexture GL 텍스처 누수: `TextureSource.init` 이 렌더 텍스처 소스에 제 크기의
  GL 텍스처를 만들고, `DynamicTexture` 생성자가 그 자리에 DrawingContext 의 텍스처를 넣으면서 첫
  텍스처를 지우지 않아 RenderTexture 하나마다 텍스처 하나가 영영 남았다. 실제 사례: 마을·화산
  create() 마다 NightOverlay 라이트맵(1280x720)이 3.7MB 씩 쌓였다(마을 진입 6번에 15→20개, JS heap
  에는 안 보임). `src/renderTextureLeakFix.ts` 를 main.ts 에서 게임 생성 전에 불러 init 이 만든
  텍스처를 바로 지운다. Phaser 를 올리면 이 보정 없이 마을을 몇 번 restart 해 `renderer.glTextureWrappers`
  의 1280x720 개수가 그대로인지 본다.
- Phaser 4.2.1 CanvasPool 은 `pixelArt`(smoothing 끄기)에서 내주는 캔버스마다 `getContext('2d', {
  willReadFrequently: false })` 를 먼저 연다(`node_modules/phaser/src/display/canvas/CanvasPool.js` 의 `create`).
  캔버스의 종류는 첫 getContext 가 정해서, 뒤에서 `generateTexture`·`CanvasTexture` 가 read-frequently 를 달라고
  해도 GPU 캔버스로 남는다. GPU 캔버스는 읽기(getImageData, 다른 캔버스로의 drawImage)와 텍스처 등록(addCanvas)이
  그때 GPU 에 밀린 일만큼 기다린다. 실제 사례: battleHd·`footingOf`·statusFx `framePixels` 가 전투원 그림을 한 번
  읽는 데 3~30ms 씩 기다려 첫 전투 create 가 36~73ms, 이후 전투도 8~43ms 였다(지금 10~15ms·1~3ms, 헤드리스).
  그래서 그림(`makeTexture`)과 pixelfx 시트(fx.ts `sheetBaker`)는 `readableCanvas`(pixelart.ts)로 제 캔버스를
  만들고, 그림은 `texelsOf` 로 그 캔버스에서 바로 읽는다(새 캔버스에 drawImage 하면 그 캔버스가 GPU 캔버스라
  다시 기다린다). 그림만 옮겼을 때는 시트 등록이 오히려 느려져(Lv30 전투 warm 41장(기술 34 + 상태 7) 합 140~197→232~335ms,
  2040x132 한 장이 GPU 캔버스 24~48ms, read-frequently 1.3~1.6ms) 시트도 같이 옮겼다(지금 합 24ms). 그려지는
  GL 텍스처는 같다(텍스처를 FBO 로 읽어 비교: 시트 24장 중 23장 같고 shatter 134텍셀 ±1). 새 캔버스 텍스처도
  `textures.createCanvas` 대신 `readableCanvas` + `addCanvas` 로 만든다. Phaser 를 올리면 CanvasPool.create 가
  아직 false 로 여는지 보고, 전투 create 를 CDP 프로파일러로 떠 getImageData 가 다시 보이는지 본다.
- playwright 에서 드롭·포획을 강제하려고 `Math.random` 을 상수 함수(`() => 0.01`)로 덮으면,
  Phaser 가 텍스처 키 UUID 를 `Math.random` 으로 만들어서 모두
  `00000000-0000-4000-8000-000000000000` 이 된다. 그 결과 "Texture key already in use" 콘솔
  에러와 `Cannot read properties of null (reading 'context')` pageerror 가 나며 게임이 멈춘다
  (실제 사례: 4차 QA 의 KOI FEAST 드롭 강제). 강제가 필요하면 그 호출만 짧게 감싸거나 시드 있는
  의사난수로 바꾼다. 아니면 강제 없이 여러 판 돌린다.
- 여러 명이 동시에 소스를 고치는 중이면 dev 서버의 HMR 이 테스트 페이지를 통째로 다시 불러 전투
  도중 타이틀로 돌아간다. 테스트 페이지의 init script 에서 URL 이 `/_bun/hmr`
  인 WebSocket 을 가짜 객체(`EventTarget` + 빈 `send`/`close`)로 바꾸면 불러온 시점의 코드로
  끝까지 돈다. 저장소 코드는 건드리지 않는다.
- 브라우저가 필요하면 ego lite(`ego-browser` 스킬, `ego-browser nodejs` 로 스크립트를 돌린다)를 먼저
  쓴다. 화면을 보며 키를 눌러 확인하는 일(타이틀·패널·전투 흐름, 스크린샷 몇 장)이 대상이다. 작업은
  사용자 공간과 분리된 에이전트 전용 워크스페이스(`taskSpace("<작업 이름>")`, 하나만)에서 하고 사용자의
  탭·공간은 건드리지 않으며, 끝나면 `task.finish({ keep: [] })` 로 닫는다. 단 워크스페이스는 사용자와 같은
  브라우저 프로필을 써서 `localStorage` 를 함께 쓴다(실제 사례: 새 워크스페이스에서도 사용자의
  `magic-world-save-1` LV30 세이브가 보였다). 그래서 저장 슬롯·설정을 지우거나 덮어쓰지 않는다. 새
  게임은 빈 슬롯에서만 하고, 슬롯 고르기도 설정에 기억되니 끝에 원래 슬롯으로 되돌린다. 실제 사례:
  `page.keyboard` 키는 클릭 없이 캔버스 게임에 들어갔지만, 페이지 확대 110%(DPR 2.2)에서
  `page.screenshot()` 이 뷰포트 오른쪽·아래 1/11 을 잘랐다. 게임만 찍을 때는 캔버스
  `getBoundingClientRect()` 에 `outerWidth / innerWidth` 를 곱한 `clip` 을 준다(그때 1920x1080, 게임의
  1.5배). dev 번들은 게임 객체를 `window` 에 내놓지 않아 `page.evaluate` 로는 DOM 과 `localStorage` 까지만
  닿고, 페이지가 `/_bun/hmr` WebSocket 을 열어 두며 init script 가 없어 위 HMR 차단도 못 한다.
- ego lite 가 없거나 하네스만 되는 일(번들 패치로 GameState·씬에 닿기, HMR 차단, 세이브 주입, 헤드리스로
  여러 판 재기·화면 감사·1280x720 DPR1 픽셀 측정)은 `.claude/skills/magic-world-playtest` 의
  `scripts/harness.py`(python playwright)를 쓴다(위 playwright 함정들이 이미 들어 있다). 스모크:
  `python3 -I .claude/skills/magic-world-playtest/scripts/harness.py smoke`. `.claude` 가 개인 전역
  gitignore 에 걸린 환경이면 이 스킬 파일을 고칠 때 `git add -f` 로 올린다.

## 픽셀 그리드 검증 (`bun run check:art`)

`src/art/*.ts`(BootScene 이 부팅 때 굽는다)의 타일/스프라이트 그리드를 손대면 **커밋 전에
`bun run check:art`** 를 돌린다. 이 검사가 실제로 잡아낸 버그가 있어서
남겨둔 것이다 — `BAT_TILE` 이 3행만 17자라 텍스처가 68px 로 구워진 것,
`ICE_GOLEM_TILE` 이 팔레트에 없는 문자를 써서 2픽셀이 투명하게 빠진 것,
길 variation 2장이 위상이 접혀 바이트 단위로 중복된 것. 셋 다 아무것도
throw 하지 않고 그림만 조용히 틀리는 종류다.

그림은 영역별 파일에 있다: `tiles.ts`(지형 격자·팔레트), `tilesets.ts`(tiles16/shore16/road16 와
스킨 굽기, `*_SKIN`·`seasonSkin`·`battleBgKey`·`TILE_VARIANTS`), `hero.ts`, `npcs.ts`, `monsters.ts`,
`props.ts`, `icons.ts`, `landmarks.ts`, `forged.ts`(대장간 단련 장비, `Blacksmith` 는 굽기만 맡긴다), 전투용
HD 격자 `hdHero.ts`·`hdMonsters.ts`·`hdBosses.ts`. 격자·팔레트와 그것을 굽는 `bake*` 함수가 같은 파일에 있고
BootScene 은 순서대로 부르기만 한다. 씬이 쓰는 이름은 BootScene 이 다시 export 한다. 새 굽기는 그
파일의 `bake*` 안에 `makeTexture(this, "키", 격자, 팔레트)` 로 쓴다 — check:art 는 `this` 로 시작하는
호출만 읽어 격자와 팔레트 짝을 본다. 계산된 팔레트·변형 격자는 `scene` 인자로 구워 검사에서
뺀다(`drawLookPreviews`, `makeWorkplaceSnow`). 다른 파일이 쓰는 격자·팔레트는 `export const`.
같은 영역 파일 이름(`src/art/monsters.ts`)과 겹치는 게임 데이터 파일은 경로를 붙여 부른다
(`src/monsters.ts`).

검사 항목:

- 모든 그리드의 행 길이가 균일한지. `makeTexture` 는 `Math.max(행 길이)` 로
  텍스처 폭을 잡으므로 한 행만 길면 어긋난 텍스처가 나온다
- 그리드가 쓰는 문자가 짝지어진 팔레트에 있는지 (`.` 는 의도된 투명이라
  예외). 공유 그리드는 그것을 쓰는 **모든** 팔레트에 대해 검사한다
- 물 A/B 프레임이 같은 배치의 위상 차이인지 (`B[y] === A[(y+off)%16]`)
- 타일셋 텍스처 폭이 **2048px 이하**인지. 일부 모바일 GPU 의
  `GL_MAX_TEXTURE_SIZE` 하한이고 이 게임은 터치를 지원한다. `tiles16` 에
  타일을 계속 이어붙이면 여기서 걸린다
- 전환 타일이 코너 마스크 1..14 순서인지, 완전 불투명한지, 각 타일에 두
  지형 계열 색이 모두 있는지. 한쪽만 있으면 경계를 안 그리고 베이스 지형을
  지운다
- 오버레이 팔레트의 풀 톤이 `GRASS_PALETTE` 와 일치하는지. 어긋나면
  오버레이 경계에 이음선이 생긴다
- variation 타일끼리 바이트 중복이 없는지
- 지형(grass/path/tall/soil) 의 베이스 대비 **최대 명도차가 20 이하**인지.
  지형이 시끄러우면 그 위에 선 캐릭터가 묻힌다

밀도 상한은 **의도적으로 느슨하다.** 눈의 피로를 만드는 건 밀도가 아니라
대비다 — 잔잔한 시안들이 시끄러운 원본보다 오히려 표시 셀이 더 많았다.
밀도를 조였으면 그 수정 자체가 막혔을 것이다. 물은 상한 없이 보고만 한다
(거품은 흩뿌린 점이 아니라 형태로 읽힌다).

명도차 규칙은 지형 타일 자체만 본다. 계절 스킨처럼 지면색이 크게 바뀌면 그 위에
서는 스프라이트의 외곽 링 소실 — 외곽 링 픽셀 중 그 지면색과 RGB 거리 40 미만인
비율 — 을 봄 지면과 비교해 잰다. check:art 에는 없는 검사라 `/tmp/pwcheck/` 의
일회용 스크립트로 잰다. 실제 사례: 겨울 마을·숲이 설원 스킨을 쓰게 되자 몬스터
구역 덤불(청회색 `0xa2b4c4`) 위에서 WASP 의 옅은 파란 날개(`0x8ea2c6`)가 외곽의
38% 를 잃어, 덤불을 마른 세이지(`SNOW_TALL_PALETTE` 의 `0xaeb6a6`)로 바꿨다.

측정 정의: 링 소실 = 외곽 픽셀(투명 이웃이 있는 불투명 픽셀) 중 지면과 RGB 거리 40
미만인 비율, 가장자리 2px 소실 = 외곽 칸과 그 한 칸 안쪽이 모두 40 미만인 비율.

몬스터의 외곽선은 그 몬스터가 서는 필드 지면 전부와 RGB 거리 40 이상 떨어지게 한다.
실제 사례: 초록 SLIME 의 외곽(`0x11543c`)이 봄 풀(`0x1f5c42`)과 거리 약 17 이라 마을·숲
풀밭에서 테두리가 100% 사라졌다 → 전용 팔레트의 외곽 단계만 필드 지면 전부에서 소실 0% 가
되는 가장 덜 어두운 값으로 내렸다(`SLIME_PALETTE` 의 `o` `0x082419`, `WOLF_PALETTE`
`0x171c28`·`GOBLIN_PALETTE` `0x0d261a`·`MOSS_GOLEM_PALETTE` `0x151c17` 의 `K`). 어두운 전투
배경(동굴·ABYSS·화산)과 초록 지면 양쪽에서 40 이상 떨어지는 외곽색은 없어서 필드를
우선하고, 어두운 배경에서는 몸통과의 대비로 읽히는지 스크린샷으로 본다.

영웅도 같다. VIOLET 은 은발 램프의 어두운 단계(`0xaeb0c5`)가 머리 외곽인데 눈과 거리
40 안이라 눈밭에서 머리 위 테두리가 없었다. 은발 바탕(`h`)은 두고 외곽 단계 `d` 만 다른
외형의 외곽만큼 어두운 보라 회색(`0x4a4266`)으로 정했다(`HERO_LOOKS` 의 VIOLET `d`).
`heroLookPalette` 가 외형이 지정한 단계를 램프 계산 뒤에 펼쳐서 이긴다. 중간 밝기로 두면
문제가 밟힌 눈길이나 전투 배경으로 옮겨 갔다.

새 영웅 외형(`HERO_LOOKS`)을 넣으면 머리 외곽 `d` 가 모든 필드 지면·전투 배경과 갈라지는지
위 링 소실로 잰다. 업적 외형처럼 밝은 머리색이면 특히 그렇다. 실제 사례: GOLD 의 금갈색
외곽(`0x6b4a14`)이 숲 흙길(낙엽길)에서 47% 사라져, 짙은 갈색 `0x4a2e0a` 로 내렸다.

### 그리드는 기본으로 Scale2x(2px)로 구워진다

`pixelart.ts` 의 `drawRows`/`makeTexture` 는 16칸 그리드를 Scale2x 로 두 배
늘려 2px 칸으로 굽는다 (텍스처 크기는 그대로). 새 그리드도 자동으로
그렇게 되므로, 넣을 때 아틀라스(구운 텍스처를 2배로 늘어놓은 시트)로
결과를 눈으로 확인한다. 얼굴(눈이 비대칭·웃는 눈으로 바뀜), 1칸 점무늬,
가로 잔물결(사선 줄무늬로 바뀜)은 `keepBlocky(...)` 로 4px 그대로 두고,
지형 경계만 다듬을 전환 타일은 `smoothBoundaryOnly(계열, ...)` 를 쓴다. 등록은 그 격자가 있는 파일
최상위, 격자 정의 뒤에 둔다. 모듈을 불러올 때 등록되어 굽기보다 먼저 실행되고, 정의 앞에 두면
TDZ 로 부팅이 죽는다.
32칸(보스·거인은 48칸)으로 다시 그린 그리드는 `makeTexture(..., ART_PX)` 로 Scale2x 없이
굽고, check:art 가 32x32 또는 48x48 정사각인지 본다.

영웅·NPC·몬스터는 32칸 그리드이고, 보스·거인 5종(KING SLIME·TROLL KING·MOSS GOLEM·
GLACIER GOLEM·FLAME DRAKE)만 48칸이다. 몬스터 그리드 두 개는 여러 텍스처가
나눠 쓴다: `SLIME_32` (slime / goldSlime / magmaSlime), `GOBLIN_32`
(goblin / cursedGoblin). 그래서 그리드에 문자를 하나 더하면 그 그리드를 쓰는
팔레트 전부에 키가 있어야 한다 (check:art 가 잡는다). 희귀 변종도 tint 를
쓰지 않고 전용 팔레트·텍스처로 굽는다. 곱하기 tint 는 녹색 슬라임을 금색이
아니라 올리브색으로 만들었다. 반대로 보스·거인은 작은 몬스터 그리드를
키워 쓰지 않는다. TROLL KING·MOSS GOLEM 이 고블린 그리드를 키운 것이었을 때는
'큰 고블린'으로 읽혀서 전용 그리드로 바꿨다. KING SLIME 도 `SLIME_32` 를 빨갛게 칠한 것에서
왕관을 쓴 전용 48칸 격자로 바꿨다.

보스·거인의 48칸 격자는 96px 텍스처가 되고, 필드에서 1배(2px 칸, 보스 로머와 마을 TROLL KING)로
그린다. 전투에서는 아래 96칸 HD 격자를 2배(2px 칸, 192px)로 그린다. 실제 사례: 예전에는 32칸(64px)을 필드 1.5배(TROLL KING 1.6배)·
전투 3배로 키워 칸이 3px·6px 이었고, 둘레의 2px·4px 그림과 그 위 4px 이펙트보다 뭉툭했다. 그래서
보스를 크게 그릴 때는 배율이 아니라 칸 수를 늘린다. 64px 텍스처를 가정하던 곳(`addRoamer` 의 히트박스,
`BestiaryUI` 의 아이콘 배율)은 텍스처 폭에 맞춘다.

전투원은 전투용 HD 격자를 따로 쓴다. 영웅의 전투 프레임과 장비(`src/art/hdHero.ts`, 굽기는 `hero.ts` 의
bakeHero 가 외형이 바뀔 때마다 같이), 일반 몬스터(`hdMonsters.ts`)는 64칸, 보스·거인(`hdBosses.ts`)은 96칸이다.
`makeTexture(this, "<key>@hd", 격자, 원래 팔레트, 1)` 로 1텍셀=1칸, 원래 텍스처와 같은 크기로 굽고, 전투가
그대로 2배로 그려 한 칸이 2px 다. `battleTexture`(`src/battleHd.ts`)는 `<key>@hd` 가 있으면 그것을, 없으면
외곽선만 Scale2x 한 사본을 준다. HD 격자는 원래 격자의 정확한 2배 배치(실루엣·발·손·입 자리 같음, 외곽선
1칸)라 장비 겹치기·`footingOf`·숨결 `focus` 가 그대로 맞는다. 원래 팔레트 키를 그대로 쓰고, 새 색은 키를
더하기만 한다(필드 외곽 거리 규칙 때문에 기존 값은 바꾸지 않는다). check:art 가 HD 격자의 크기(64·96 정사각),
원래 격자의 2배인지, 같은 팔레트인지 본다. 필드는 32·48칸 그대로다. 실제 사례: 32칸을 2배로 그리던 전투는
4px 칸이라 2px 칸인 필드에서 넘어가면 그림이 갑자기 뭉툭해졌다. 새 몬스터나 장비를 넣으면 HD 격자도 같이
그린다(없으면 4px 사본으로 보인다).

아이템 아이콘은 `icon-<키>` 텍스처다(인벤토리·소재·요리 재료·요리 키, 보물 지도는
`icon-map`). 16칸 그리드를 기본 Scale2x 로 구워 64px 이 되고, 패널은 그 절반인
32px 로 그린다. 아이템 창·상점·대장간·KITCHEN 이 키 이름으로 텍스처를 찾으므로,
아이템이나 요리를 새로 넣으면 `src/art/icons.ts` 에 그 아이콘 격자·팔레트와 `bakeIcons` 의 한
줄을 함께 넣어야 한다. 빠지면
Phaser 의 missing 텍스처가 대신 뜬다. 장비 아이콘은 영웅 장비와 같은 팔레트
(`EQUIP_*_PALETTE`)로 칠해서 등급 색이 서로 맞는다.

## 전투·타이틀 배경 (`src/backdrops.ts`)

지역별 전투 배경(마을·숲은 계절 3종, 동굴, ABYSS, 설원, 화산)은 부팅 때 한 번
1280x720 텍스처로 굽는다. 원경·중경·근경을 2px 칸(`C` = `ART_PX`)으로 그린다. 필드 그림과 전투원의 전투
텍스처(`battleHd.ts`)도 화면에서 2px 칸이라, 멀어 보이게 하는 것은 칸 크기가 아니라 아래의 낮은 채도·대비다. 길이는
처음 그린 4px 단위(`P`)로 적혀 있어(lip 은 `P * 3`) 칸을 바꿔도 배치가 그대로이고, 한 칸짜리(테두리·디더 줄·별)만
`C` 다. 이음매 디더는 2px 세 줄(25·50·75%)이다. 실제 사례: 4px 칸일 때 필드(2px)에서 전투로 넘어가면 그림이 갑자기
뭉툭해졌다. 타이틀 배경(`title-bg`)도 같은 파일에서 같은
도우미로 그린다. 그쪽은 로고(y 168..264)·부제(350..432)·세이브 카드(455..555)·안내
줄(645..675)·버전 표시(오른쪽 위, x 1000 오른쪽·y 44 위) 뒤에 밝은 점을 두지 않는다. 고칠 때 지킬 것:

- 지평선은 y 440 이다. 전투 날씨(BattleWeather)는 그 위에 전부, 그 아래(y 472 까지)에는 가까운 빗방울·물보라만
  그린다. 전투원은 지평선의 밝은
  lip(440..452) 바로 아래 지면선에 발을 딛고 그림자를 단다(BattleScene `GROUND_Y` 456, 동료
  `COMPANION_GROUND_Y` 464, 나는 몬스터는 `FLY_LIFT` 64 위에 뜨고 그림자는 땅에). 발 위치는 텍스처의
  실제 불투명 아래 끝(`footingOf`)으로 맞춘다. 실제 사례: 적을 중심 좌표(y 280)로 세워 발이 지평선보다
  32px 이상 위에 있고 그림자도 없어, 몬스터 종류와 상관없이 모두 떠 보였다. 새 몬스터를 넣으면
  `src/monsters.ts` 의 `flying`(다리 없이 날개로 나는 것만)을 정한다.
- 바닥의 y 474..586 에는 전투 메뉴·힌트·아이템 목록이 흰색·연파랑 글자로 바로
  그려진다. 그래서 바닥은 어둡고 무늬가 없게 둔다. 풀·균열 같은 디테일은
  지평선 바로 아래(y 444..484)나 화면 양 끝에만 둔다. 처음 시안에서 화산 균열이
  메뉴 글자를 가로질렀다.
- 배경은 캐릭터보다 채도·대비가 낮아야 한다. 전투 띠(y 204..436, 캐릭터 자리
  제외)의 평균 chroma 가 캐릭터 평균(0.37)보다 낮고 명도 표준편차가 캐릭터
  최소(42)보다 낮은지 잰다. 영웅·적이 서는 자리(영웅 x 256..384, 적
  x 864..1056) 뒤에는 밝은 것을 두지 않는다.
  - 측정 정의: luma = 0.299R + 0.587G + 0.114B, chroma = (max − min) / 255, 띠 =
    y 204..436 에서 영웅 자리(x 256..384, y 336..464)·적 자리(x 864..1056,
    y 256..466, 그림자 포함) 제외, 표준편차는 모집단. 구운 텍스처를 `textures.getBase64` 로 받아
    원본 픽셀로 잰다. 캐릭터는 `hero-down-0` 과 `ENEMIES` 의 텍스처 20종(불투명
    픽셀)이고, 이 정의로 평균 chroma 0.366·최소 명도 std 42.1(`king`, KING SLIME)이
    나와 위의 0.37·42 와 맞는다. 42.1 은 옛 32칸 KING SLIME 으로 잰 값이고, 48칸 KING SLIME 은 47.8 로
    여전히 최소다. 기준 42 는 더 엄격한 쪽이라 그대로 둔다.
- 상태창 두 개(x 32..496, 784..1248 × y 24..200, 채움 0.85 라 배경 15% 가 비침)와 그
  사이 NIGHT/ARENA/ABYSS 안내(x 520..760 × y 40..116) 뒤에도 밝은 것을 두지 않는다.
  실제 사례: 마을 전투 배경의 해 후광이 영웅 창 MP 글자 뒤로 비쳤고, 큰 구름이 ARENA
  안내 뒤에 깔렸다 → 해를 두 창 사이 y 116..200 로 옮기고 작게 했다.
- 같은 이유로 원경이 하늘보다 밝으면 그 윤곽선도 상태창 뒤로 비친다. 실제 사례: 겨울 숲은
  먼 숲 벽이 하늘보다 밝고 소나무가 끝까지 눈에 덮여, 나무 윤곽이 두 창 뒤로 들쭉날쭉한
  띠로 비쳤다 → 겨울만 나무 꼭대기를 낮은 구름에 잠기게 했다(`ForestLook.fog`: 창 아래
  y 204 까지 하늘을 다시 칠하고 그 밑에 가장자리를 디더링한 안개 띠).
- 밤·날씨는 그리지 않는다. BattleScene 이 하늘 오버레이를, BattleWeather 가
  비·눈·재를 덮는다.
- 전투의 비·폭풍·눈·눈보라는 pixelfx weather 루프를 시트로 굽지 않고(12초 루프를 15fps 로 구우면 230KB
  프레임 180장) `src/ui/PixelWeather.ts` 가 15fps 로 320x118 CanvasTexture(4px 칸, y 0..472)에 바로 다시
  그린다. 이펙트 바닥을 지평선(y 440)에 두고 그 아래에는 front 층(가까운 빗방울·물보라)만 그린다. 실제 사례:
  back 층의 바닥(젖은 lip 줄·웅덩이 띠·눈 더미)이 지평선을 따라 밝은 줄을 그었다. 다시 그리기 한 번은 back
  층(폭풍은 두 띠) → front·합성·업로드로 여러 프레임에 나눈다. 화산재는 예전 Ambient 파티클과 스모그
  그대로다. pixelfx snow 에 재 팔레트를 입혀도 `snow.js` 가 정해 둔 WHITE(큰 눈송이 중심·눈 더미 꼭대기·
  반짝임)가 남기 때문이다.
- pixelfx 날씨 팔레트는 밤하늘용이다. 실제 사례: 낮 배경 위에서 먼 빗방울·눈송이가 하늘보다 어두워 먼지처럼
  보였다. 그래서 눈·눈보라는 늘, 비·폭풍은 마을과 겨울 숲에서 낮 팔레트(`RAIN_DAY` 등, 단계마다 그 하늘보다
  밝게)를 쓰고, 봄~가을 숲의 비·폭풍만 pixelfx 기본 팔레트다(나무 벽이 밤하늘만큼 어둡다). 반투명 볼륨(안개·
  비 장막·날리는 눈 장막)은 `haze`(0.15~0.35)로 줄여 그린다. 밤하늘용 세기 그대로면 밝은 배경을 절반쯤
  어둡게 했다. 이 볼륨이 예전 overcast·whiteout 틴트를 대신한다.
- pixelfx 날씨의 seed 는 바꾸지 않는다. seed 마다 노이즈 field(256x128, 15~38ms, 폭풍은 넷에 약 100ms)를
  굽고 비우지 않는 캐시에 넣어서, 새 seed 는 한 프레임을 멈추고 field 하나에 128KB 씩 영영 남긴다. 실제 사례:
  루프마다 새 seed 를 주자 50~70ms 멈춤과 누수가 생겼다. 어디서 시작할지는 seed 대신 루프 시각으로 고른다.
  같은 seed 의 field 는 타이틀이 미리 굽는다(`warmBattleWeather`, "전투 이펙트" 절의 타이틀 warm 항목). 거기서
  다 굽지 못한 것만 그 날씨의 첫 전투가 열릴 때 굽는다.
- 폭풍 번개는 늘 빛 0.3(`STORM_LIGHT`)으로 그리고, FLASHES 를 끄거나 reduced motion 이면 루프의 번개
  구간(`STORM_STRIKES`)을 건너뛴다(이펙트가 시각의 함수라 건너뛰기는 비용이 없다). 루프 시계는 1/15초 격자에
  맞춘다. 그래서 pixelfx 30fps 의 깜빡임 한 획이 한 번만 번쩍이고, 한 쌍(두 획, 또는 막 번개가 두 번
  밝아짐)이 0.5초 안에 두 번, 다음 쌍까지 3초라 1초에 최대 2번이다(필드 `addLightning` 과 같은 한도). 실제 사례: 격자에 맞추기 전에는 다시
  그리는 때가 깜빡임과 어긋나 한 획이 두 번 번쩍였다.
- 타이틀에는 pixelfx 이펙트를 두지 않는다(결정, 2026-11). 배경이 4px 칸이던 때 4px 로 잰 한 자리 루프(arcane-orb·waterfall·
  sunburst)는 288~544px 로 빈 자리(성 쪽 약 390x174)보다 컸다. 배경이 2px 가 된 뒤로는 이 근거를 다시 재야 하지만 아래 두
  근거는 그대로라 결정을 유지한다. 화면 전체 하늘
  루프는 움직이는 빛의 45~72% 가 로고·카드·메뉴 뒤에 깔린다(유성 44.5%, 오로라 45%, 반딧불 72%). 다시 그리기
  1.3~3.3ms 는 warm 이 도는 타이틀의 가장 긴 프레임(update 최대 18ms, 헤드리스)에 그대로 얹힌다.

## 전투 이펙트 (`src/fx.ts`, `src/statusFx.ts`)

전투 이펙트는 전부 pixelfx(커밋 고정 의존성, MIT) 이펙트를 코드로 구운 스프라이트 시트다. PNG 시트나
손그림 격자를 새로 넣지 않는다. 후보는 pixelfx 사본에서 `node tools/render.mjs <id>` 의 contact sheet 로
먼저 본다.

- 새 이펙트는 `fx.ts` 의 `PIXEL_SHEETS` 에 한 줄로 넣는다: 모듈(`import * as x from
  "pixelfx/fx/<범주>/<이름>"`), `opts`(팔레트·시드·이펙트 옵션), `span`, `frames`, `focus`(전투원 중심에
  놓일 이펙트 좌표, 앵커 기준), `directional`, `crop`. `playFx`·`loopFx`·`fxOn` 이 그대로
  쓴다. pixelfx 1px 이 아트 한 칸(전투 4px)이다. 전투 표(`PIXEL_SHEETS`·동료·스킬·기술)는 `res: 2`(`battleRes()`)로
  그 한 칸을 2x2 텍셀로 굽고 `fxSprite` 가 배율을 res 로 나눠, 화면 크기는 같고 계단은 전투원·배경과 같은 2px 다.
  2배 밀도 그리기는 `src/hiresPaint.ts` 가 그 프레임의 Painter 에만 변환을 덮어 한다. shade/each 로 그리는 도형(원·
  고리·호·빔·다각형)과 빛은 텍셀마다 계산하고, px 계열(불똥·sparkle·찍은 그림)은 칸 크기 2x2 블록을 반 칸 위치에
  두고(1텍셀로 찍으면 sparkle 십자가 점선으로 깨졌다), 불꽃·연기 퍼프(fire/_lib)는 칠한 칸에서 반지름을 추정해 텍셀
  원으로 다시 그린다. 실제 사례: 전투원·배경이 2px 칸이 된 뒤 4px 이펙트만 혼자 뭉툭했다. 대가로 전투 시트 텍스처와
  굽는 시간이 약 2~2.5배다(아래 warm 항목의 수치).
- `playFx` 는 시트를 주어진 ms 에 펼치므로 전투 속도는 그대로고 긴 이펙트는 빨라진다. 꼬리는 `span` 으로
  자르고, 프레임은 15fps 안팎이면 끊겨 보이지 않는다. 실제 사례: crit-hit 0.9초를 300ms 에 넣으려고
  0~0.6초만 샘플했고(뒤는 바닥에 누운 파편뿐), 처치·레벨업 시트를 30→15fps 로 낮춰 결산 시트 텍스처가
  5.9→4.3MB 가 됐다.
- `directional` 은 오른쪽을 향해 그려진 이펙트를 영웅 위에서 음수 scaleX 로 뒤집는다. `flipX` 는 프레임
  가운데를 축으로 돌아 중심에서 벗어난 원점이 움직인다.
- 바닥에 서는 이펙트(앵커가 발)는 `fxOn` 대신 `playFx(scene, key, sprite.x, GROUND_Y, ...)` 로 땅에 둔다.
  실제 사례: 처치 poof·금화를 적 중심에 두었더니 보스가 6px 칸(3배)이던 때 별과 동전이 적 창 안(y 140~200)까지
  올라갔고, 나는 적은 동전이 공중에서 튀었다.
- DEFEND 나 동료 ORC 의 BULWARK(GUARD)가 받아 낸 적의 일격(일반 공격과 CHG 뒤 강타)에는 영웅 발밑
  (`GROUND_Y`)에 `fx-block`(pixelfx impacts/shield-block, 적 쪽 반구)을 띄운다(`blockOn`). `guardHit` 이 돌려주는
  `braced` 로 가르고, WARD 가 받은 일격은 뺀다. WARD 는 제 거품이 있고, WARD 가 걸려 있으면 DEFEND·GUARD 는
  적용되지 않는다. 색은 DEFEND 라벨의 slate 회색 램프다(결정: WARD 의 파랑은 이미 WARD 를 뜻한다).
- 보스·거인도 다른 적과 같은 배율 2 로 그려서(96칸 HD 격자, 2px 칸) 이펙트는 어느 적 위에서나 같은 크기다. `playFx` 에 2 보다 큰
  배율을 넘기지 않는다. 실제 사례: 보스가 6px 칸(3배)이던 때 crit 의 고리(40칸)가 적 HP 막대를 가로질러, 그런
  시트만 4px 로 두는 `sameOnBoss` 를 따로 들고 있었다(보스를 48칸으로 다시 그린 뒤 걷어 냄).
- `crop` 은 빈 줄이나 떨어져 나온 조각을 잘라 낸다. 잘린 가장자리 8칸(`EDGE_FADE`, res 배 텍셀)은 글로우가 흐려지므로,
  그림이 같아야 하면 그만큼 여유를 두고 픽셀 비교로 확인한다. 실제 사례: NOVA 구슬은 앵커 바닥에 고인
  빛을 잘라 냈고(날아가는 동안 그 빛 줄이 메뉴 줄을 따라 지나갔다), fx-coins 는 1920x352 →
  2044x234(픽셀 동일)가 됐다.
- depth 층: 이펙트 시트 0(`playFx`·`StatusFx`), 주문 폭발 0.5(`SPELL_BURST_DEPTH`), 데미지 숫자 1,
  상태창 10(`STAT_DEPTH`), 힌트 30, STREAK/COMBO·NIGHT/ARENA/ABYSS 안내 120. 실제 사례: 몸을 다시
  칠하는 상태 시트가 같이 터진 주문 폭발을 가렸고, 높이 나는 적·보스 위의 불꽃이 적 창의 HP·WEAK 줄로
  올라갔다.
- 몸을 다시 그리는 actor 이펙트(화상·냉기·감전·독·빙결·묶인 적의 별·격노·HEAL·WARD)는 `fx.ts` 가 아니라
  `statusFx.ts` 의 `STATUS_SHEETS` 에 둔다. 전투원 텍스처를 pixelfx 의 `o.actor` 로 넘겨 전투원·이펙트별로
  굽고, 전투가 끝나면 지운다. 실제 사례: pixelfx 의 24x38 대역 인형으로 구우면 그 인형이 몬스터 위에
  그려졌다(불꽃이 인형 머리 높이에 떴다). 시트는 전투원의 지금 위치·scale 을 매 프레임 따라간다
  (`play(target, kind, ms)` 에 배율 인자가 없고, 격노의 박동으로 몸이 커지면 같이 커진다. 배율은 scale x ART_PX / res).
  - 전투원이 HD 텍스처(`<key>@hd`)로 그려지면 상태 시트도 `res: 2`·`trimFrames` 로 굽고, `hdBody` 가 몸을 HD 그림으로
    칠한다. 이펙트를 res 2 프레임에 한 번 그리고, 몸 색을 읽은 프레임에서만 몸 칸의 2x2 하위 텍셀마다 res 1·빛 없이
    네 번 더 그려 텍셀별로 합친다(`actorOf` 가 HD 하위 텍셀 색을 준다). soul-rise 도 영웅·무기·방패의 HD 텍셀로 같이
    굽는다. 실제 사례: 32칸 원본을 actor 로 넘기던 때는 화상·빙결이 도는 동안 4px 몸이 2px HD 위에 덮였다. HD 64칸을
    res 1 로 넘기면 몸은 맞지만 장식(서리 띠·눈송이·고드름)이 몸 대비 절반으로 작아져서 버렸다. 대가로 그 자리 굽기가
    늘었다(헤드리스: freeze 10.9→34.7ms, rage 6.8→30.6ms, 처치 시트 13~22→56~80ms). HD 실루엣과 32칸 마스크가
    다른 외곽 텍셀(가장자리 칸의 5% 이하)은 효과 색 계단이 남거나 덧칠되지 않는다. 이 방식은 이펙트가 `o.actor.pixels`
    를 인덱스로 읽고 draw/create 가 결정적이라는 데 기대므로 pixelfx 를 올리면 다시 비교한다. 천장 지우기(`fadeAboveCeiling`)는
    잘린 프레임에서도 같은 줄에서 자르도록 프레임마다 한다.
  - 머리 둘레를 도는 고리처럼 몸 뒤로 지나가는 이펙트는 `layered` 로 굽는다. `drawBack` 은 전투원 아래(같은
    깊이에서 `moveBelow`), `draw` 는 위에 한 장씩 따로 굽는다(create 없는 순수 이펙트만). 머리를 기준으로
    그리는 이펙트는 `trim` 으로 몸의 불투명 칸만 넘긴다. 실제 사례: 프레임 위 빈 줄 때문에 별 고리가 키 작은
    적의 머리 위에 떴다.
  - 한 번 보일 때는 `StatusFx.play`, 상태가 이어지는 동안은 `StatusFx.loop` 다(돌려받은 함수를 부르면 250ms
    페이드아웃). loop 는 실시간이라 BATTLE SPEED 를 따르지 않고, OS 의 reduced motion 이면 첫 프레임에
    멈춘다. 묶인 적(`stuck`)의 별은 BOLT 의 감전과 동료의 WEB SNARE 가 켜고(`showStun`), 적 턴의 stuck 줄을
    말한 뒤와 `victory` 에서 끈다(`hideStun`). stuck 을 켜는 길을 새로 만들면 `showStun` 도 부른다.
  - 격노(rage)는 보스·거인이 격노하는 순간 한 박동(750ms)만 보이고 루프하지 않는다(결정: 박동마다 몸을 다시
    칠해 타격의 흰 번쩍임과 기 모으기 색을 덮고, 6px 칸이던 보스에서 김과 선이 적 창으로 자꾸 올라갔다). 그래도
    올라가는 김과 선은 `ceiling`(칸이 아니라 화면 px, 발 456 위 234 = y 222) 위를 지운다. 실제 사례: 6px 칸이던
    FLAME DRAKE 의 김이 y 180(적 창은 y 200 까지)까지 올라갔다. FLASHES 를 끄거나 reduced motion 이면 glow 를
    줄여 굽는다(`soft`). pixelfx rage 는 바닥 균열을 seed 만으로 캐시해서 전투원마다 시드를 준다(`ownSeed`).
    실제 사례: 두 번째 보스가 첫 보스의 균열 위에 섰다.
  - 그 전투에서 나올 수 있는 상태 시트는 create 에서 `statusFx.warm` 으로 미리 나눠 굽는다(`warmSheets`).
    BattleScene `warmStatuses` 가 그 판의 주문·동료·적 특수기·저항 장신구로 나올 수 있는 것만 고른다(보스·거인의
    격노는 그때 보일 `ENRAGE_TINT` 로, 적의 독 틱은 `PSN_TINT` FILL 로). 전투원 프레임은 한 번만 읽어 시트끼리
    나눠 쓴다(`framePixels`). 다 굽기 전에 쓰이면 play·loop 가 남은 것을 그 자리에서 굽는다. 실제 사례: 별 두
    장의 첫 굽기 19~66ms(헤드리스 중앙 23ms)가 같은 턴 감전의 첫 굽기와 겹쳤고, 첫 BURN·CHILL·HEAL·WARD 는 그
    턴을 12~36ms 잡았다(warm 뒤 격노 0.5ms, 오프닝 최장 16.8ms).
  - 동료의 CHILL(FROST MOTH)이 걸리는 순간에는 냉기 시트를 보인다. CHILL 은 틱이 없어 그때만 보인다.
  - 적의 처치는 종·지역으로 가른다(BattleScene `deathOf`): 얼음 종은 spawn/shatter-death(`shatter`), 불 종은
    spawn/dissolve-burn(`dissolve`), ABYSS 의 나머지는 spawn/disintegrate(`disintegrate`, 보라), 그 밖은 fx-poof 다.
    셋은 `fells` 시트라 적 자신의 몸으로 굽고, 스프라이트(와 그림자)는 이펙트의 actorAlpha 대로 사라진다. 코인(fx-coins)은
    `breaks`(몸이 다 사라지는 시각, `breakOf`)에 떨어진다. 실제 사례: 처음엔 코인을 처치와 함께 띄웠더니 코인의 금빛
    섬광과 puff 가 아직 멀쩡한 몸을 가렸다. 나는 적은 `statusFx.hover` 로 몸을 `FLY_LIFT` 만큼 띄워 구워 파편이 땅에
    떨어진다. 새 처치 이펙트는 `fells`·`breaks`·`ceiling` 을 같이 정하고, `warmStatuses` 에서 맨 먼저(상태 시트보다도
    앞) warm 한다. 실제 사례: 끝에 두었더니 Lv30 은 기술 시트 34장(warm 1.2초) 뒤로 밀려, 첫 턴에 쓰러뜨린 YETI 의
    shatter(0.7초에 재생)를 그 자리에서 25ms 구웠다. HD 몸으로 굽게 된 뒤 상태 시트 뒤에 두었더니 0.55~0.77초에야
    준비돼 같은 처치가 약 80ms 를 구울 수 있었다(지금 0.13~0.25초에 준비, 상태 시트는 0.57~0.8초).
  - MOSS GOLEM 의 regen 은 `regrow`(nature/leaf-storm, layered, 이끼 초록 잎, 가을 금·빨강은 바람 공격처럼 읽혀 뺌)다.
    루프 조각을 한 번 보일 때는 `rise`(앞 페이드인)·`fade`(뒤 페이드아웃)를 같이 준다. 실제 사례: rise 없이 루프를 틀면 첫
    프레임부터 꽉 찬 나선이 튀어나왔다. regrow 는 leaf-storm 을 statusFx 의 `MOSS_SPIRAL` 로 옮겨 고리를 1.5배(22~36칸,
    4px 에서 90~144px)로 넓힌 복사본이다(효과에 반지름 옵션이 없음). pixelfx 를 올려도 따라오지 않는다. 실제 사례: 원본
    고리(15~24칸, 60~96px)는 반폭 94px 골렘의 몸 안에 몰려 잎이 몸에 붙은 것처럼 보였다.
- 전투에서 가방 아이템(POTION·HI-POTION·MPOTION·ETHER·ELIXIR)과 GOO HEAL 의 회복은 영웅 발밑(`GROUND_Y`)의 회복 고리다
  (`fx.ts` 의 fx-restore-hp/-mp/-all, holy/heal-aoe, BattleScene `ringOn`). 색은 필드 가방(InventoryUI `HEALS`)과 같아
  같은 아이템이 필드와 전투에서 같은 연출이다. 실제 사례: 씨앗 섬광의 글로우를 light 1 로 구우면 crop 에 잘려 밝은 풀밭
  위에 네모 판이 보였다(0.45s 부터, light 0.5).
- 숨결을 쓰는 보스 강타(FLAME DRAKE INFERNO·SALAMANDER FLAME SPIT·GLACIER GOLEM FROST BREATH)는 돌진 대신 `fx.ts` 의
  `fx-breath-fire`·`fx-spit-fire`·`fx-breath-frost`(pixelfx fire/fire-breath·ice/frost-breath, `soften`, directional)를
  입에서 영웅 쪽으로 뿜는다(BattleScene `BREATHS`·`breathOn`, 입 자리 `focus` 는 보스 격자와 배율 2 기준). 루프라 알파
  앞 20%·뒤 20% 로 페이드하고 피격은 300ms 뒤에 시작한다. 보스 격자를 다시 그리면 `focus` 를 다시 맞춘다.
- 돌 종(TROLL KING·MOSS GOLEM, BattleScene `PETRIFY_KIN`)의 처치는 `statusFx.ts` 의 `petrify`(status/petrified, `fells`,
  `breaks` 2.2)다. 이펙트의 석상 단계가 길어 `DEATH_FX_MS` 1800 에서 약 1.5배속이다. 심연에서도 disintegrate 보다 앞선다.
- 영웅이 쓰러지면(`defeat`·`arenaDefeat`) `soulFx.ts` 가 영웅 그림(외형·장비)으로 구운 spawn/soul-rise 를 2.2초에 재생한다
  (BattleScene `soulRise`, 기다리지 않아 귀환 흐름은 늦지 않다). 상태창 속으로 들어가지 않게 height 24·`CEILING` 234 로 잘랐다.
  시트는 영웅 HP 가 최대의 40% 이하면 기술 시트보다 먼저, 아니면 뒤에 warm 한다(`SOUL_WARM_HP`). 새 시트의 텍스처는 헤드리스로 숨결
  fire 0.70·spit 0.88·frost 0.87MB(타이틀 warm), 전투 중에만 petrify 1.58·soul-rise 1.08MB(HD 몸 전 재측정 안 함)다. 서리 숨결은 설원
  낮에 가장 옅지만 읽히고, 석상은 동굴·ABYSS·화산·설원·숲 어느 배경에서도 읽힌다. 모바일 GPU 의 첫 전투 프레임 시간은
  `TODO.md` 의 실기기 항목에서 잰다.
- FIGHT 의 일격(BattleScene `lunge`)은 뒤로 물러서며 무기를 들고(`WINDUP_MS`) 돌진해, 접촉하는 순간(`onContact`) 피해·이펙트·흔들림이 나고 짧게 멈춘 뒤(`HIT_STOP_MS`, 치명타 `CRIT_STOP_MS`) 돌아온다. 맞은 쪽은 x 로만 밀렸다 돌아온다(`recoil`, 숨쉬기·보스 박동과 안 겹치게). 적의 공격이 영웅을 칠 때도 영웅이 같이 밀린다. 몸 전체의 자세는 `strikeIn`(웅크리며 뒤로 기울고 무기를 들었다가 늘어나며 앞으로 기울어 돌진, 무기 잔상·`slashArc`)·`castPose`(주문형 스킬의 웅크림과 내지르기)·`poseRest`(원위치)가 하고, 무기 기술은 타마다 `meleeHit`(무기를 다시 휘두르고 영웅이 파고들며 적이 밀림)이다. 밀림은 `nudge` 가 늘 같은 원점으로 되돌려 빠른 연타에도 어긋나지 않는다(처음엔 상대값이라 이중 베기 뒤 적이 10px 밀린 채 남았다). 몸은 x·기울기·배율로만 움직여 숨쉬기(y)와 안 겹친다. 실제 사례: 예전에는 영웅이 제자리로 돌아온 뒤에야 피해가 났다.
- BOMB 은 `icon-bomb` 을 영웅 손에서 적 발밑으로 포물선으로 던지고(BattleScene `lobBomb`), 떨어진 자리(`GROUND_Y`)에서
  fx-bomb(explosions/grenade 의 BLOW 1.62s 이후만)이 터진다. 나는 적도 땅에서 터진다. 실제 사례: grenade 파편 줄기는
  원점 위 105칸(4px 에서 y 36)까지 올라가 적 창을 가로질렀다 → crop 위 58칸(y 224).
- 동료 스킬은 제 시트(`fx.ts` 의 `COMPANION_SHEETS`, BattleScene `SKILL_FX`·`skillFxOn`)로 fx-hit 를 대신한다(GOO HEAL·
  BULWARK·CHILL 은 원래 연출, FIREBALL 은 fx-fireball·fx-fire 를 동료 자리에서 던지고, PILFER 는 fx-coin 이 적에서 고블린
  자리로 튄다). 한 전투에 동료는 하나라 타이틀에서 굽지 않고 그 전투 create 가 `warmFx` 로 제 동료 것만 나눠 굽는다
  (첫 스킬은 빨라야 영웅 첫 턴 뒤). 위는 y 208(나는 적)·224(땅), 아래는 y 488(fx-bomb 과 같음)로 자른다. 적이 그
  안에 서는 고리·거미줄은 `layer` 로 뒤("back", 적 아래로 `moveBelow`)·앞을 따로 굽는다.
- SKILL 목록의 스킬·기술 시트는 `skillSheets.ts`·`techSheets.ts` 의 표를 `fx.ts` 의 `SHEETS` 에 펼쳐 넣고, 놓는 자리와
  맞는 순간(`onHit`)은 `skillFx.ts`·`techFx.ts` 가 정한다. 시트 표는 pixelfx·`sheetFx.ts`·`PixelSheet` 타입만 불러
  fx.ts 와 값이 돌지 않게 한다. crop 은 땅 기준 위 58칸·아래 8칸, 적 발 기준 위 46칸이다(`sheetFx.ts` 의 `around`,
  `GROUND_UP`·`FEET_UP`·`DOWN`). 같은 파일의 래퍼: `squeezeX`(길이가 정해진 빔의 가운데를 줄여 손~적 사이에 맞춤),
  `soften`(crop 가장자리 8칸의 솔리드 픽셀을 Bayer 디더로 녹임. 실제 사례: 연기·불꽃 머리가 y 224 에서 직선으로
  잘렸다), `half`(몸보다 훨씬 큰 효과를 반 크기로, 짝수 res 에서는 원해상도로 직접 그려 BLACK HOLE·implosion 의 선이
  2px 로 가늘다). 래퍼는 pixelfx painter 의 `frame` 필드와 createFx 안의 createFx 에 기대고, `hiresPaint.ts` 는 Painter
  메서드 목록, fire/_lib 의 solid·soft, explosions/_lib 의 cs/sn 항등 검사, shadow/_lib 의 cellX·`p.L` 에 기댄다.
  pixelfx 를 올리면 시트를 전·후 픽셀 비교로, 2배 밀도는 res 1 대 2 의 프레임별 ink 비·무게중심 이동(전에 0.86~1.31)으로
  다시 본다.
- 전투 시트는 `trimFrames` 로 프레임마다 그린 상자만 잘라 묶는다(GAP 1, Phaser 의 trimmed frame 이라 크기·origin 이
  같다). 2배 밀도에서 이것 없이는 Lv30 기술 34장이 약 83MB 였다(지금 51.9MB). `fx-sk-beam` 은 `skillFx` 가 frame 폭
  비율로 `setCrop` 하므로 끈다.
- 배운 기술의 시트는 그 세션 첫 전투 create 가 `warmStatuses` 에서 `warmFx` 로 굽고(Lv30 은 상태 시트와 함께 41장(기술 34 + 상태 7), 헤드리스 약 4.4초, p95
  9ms, 2배 밀도 전 1.2초) 세션 내내 남는다(기술 34장 51.9MB, 2배 밀도 전 24.5MB). 순서는 처치 시트 → 상태 시트 → 마지막에 쓴 기술(`lastSkill`) →
  동료 시트 → 나머지 기술을 learnLevel 높은 것부터다. 실제 사례: 배운 순서로 구웠더니 VOID·BLACK HOLE 이 1.1~1.2초에야
  들어와, 첫 턴에 바로 쓰면 그 자리에서 26~46ms 를 구웠다(지금 0.18~0.28초에 준비). `lastSkill` 은 페이지마다 비어서
  세션 첫 전투는 레벨 순서만 탄다. 대가로 낮은 레벨 기술(ARCANE BEAM 등)이 맨 뒤라 첫 턴에 쓰면 약 22ms 를 굽는다.
  중간 레벨 기술(예: METEOR, 6번째)은 준비가 0.5초 안팎이라 아주 빠른 첫 턴에는 여전히 약 24ms 를 그 자리에서 굽는다.
  (이 22·24ms 는 2배 밀도 전 수치다. 지금은 그 자리 굽기가 약 2.5배이고 가장 비싼 것은 VOID 116ms·숨결 114~144ms,
  Bun 벤치다. 필드에서 배운 기술 시트를 미리 굽는 것이 다음 완화책이다.)
  이 멈춤은 `pickSkill` 의 promise 체인(게임 스텝 밖)에서 나서 스텝 시간(prestep~postrender)에는 안 잡히고 rAF
  간격으로만 잡힌다.
- 그 밖의 시트는 타이틀에서 미리 굽는다. `warmBattleFx(scene, after)` 가 `PIXEL_SHEETS` 와 `after`(필드 생물의
  `CRITTER_SHEETS`)를 `warmSheets` 큐에 넣는다. 큐는 씬마다 하나라 여러 파일이 넣어도 그 씬 프레임마다
  8ms(`BAKE_BUDGET_MS`)를 나눠 쓰고, 비싼 시트는 여러 프레임에 나눠 굽는다. 다음 시트 프레임은 직전 프레임에 걸린
  시간이 남은 예산에 들어갈 때만 시작하고, `trimFrames` 시트의 묶기·업로드는 따로 한 스텝이다. 한 프레임에 시트는 최대 하나만
  완성한다. 타이틀의 전투 시트 warm 은 2배 밀도에서 약 2.6초(전 0.75초)이고 타이틀 첫 8초 p95 는 8.4~8.7ms 로 그대로다. 텍스처 등록·GL 업로드는 8ms 예산 밖이라 싼 시트 여럿이 한 프레임에 끝나면 그 프레임이 길어진다.
  실제 사례: 마을 첫 진입에서 create 가 넣은 패널·보물·낚시 시트 열 장이 한 프레임에 몇 장씩 끝나 그 프레임이
  32~49ms 였다(헤드리스). 대가로 큐는 시트마다 적어도 한 프레임을 쓴다. 캔버스를 따로 그려 마지막
  프레임까지 들어간 뒤에만 텍스처로 등록하므로 `textures.exists` 가 덜 구운 시트를 보는 일은 없다. 다
  굽기 전에 씬이 SHUTDOWN 되면 굽던 시트도 버리고, 다음에 필요한 쪽이 다시 굽는다. 다 굽기 전에 전투가
  시작되면 남은 전투 시트는 전투의 warm 큐로 넘어가고(`bakeBattleFx`), 그보다 먼저 쓰이는 시트만 그 자리에서 굽는다.
  실제 사례: 첫 전투 시작에서 한꺼번에 구울 때 첫 프레임이 100~140ms 멈췄다. 타이틀에 300ms 만 머물고 Continue 한 첫
  전투의 create 는 지금 20~21ms, 그 뒤 최장 프레임 13~14ms 다(헤드리스, game `prestep`~`postrender` 의 CPU 시간). 시트 하나를 한 프레임에 통째로 굽던 때는 나비
  시트 하나가 타이틀 프레임을 76ms 잡았다(지금 시트 조각 프레임 최대 약 10.5ms, 헤드리스). SHUTDOWN 에서 굽던
  시트를 끝까지 굽게 했을 때는 나비를 굽던 중에 누른 Continue 가 마을 첫 프레임을 146~158ms 로 만들었다
  (버리게 한 뒤 62~78ms, 시트가 다 있을 때 마을 첫 create 는 79~113ms).
  - 그 뒤 타이틀은 `warmBattleWeather(scene, idle)`(`src/ui/BattleWeather.ts`)로 전투 날씨의 노이즈 field 9장을
    굽는다. 한 장이 15~38ms 이고 쪼갤 수 없어서, 그 씬 프레임에서 POST_UPDATE 까지 이미 3ms(`BUSY_MS`) 넘게 일한
    프레임은 건너뛰고 한 프레임에 한 장만 굽는다. 큐가 끝났는지를 보는 게 아니라 그 프레임에 일한 시간을 본다.
    `warmSheets` 의 POST_UPDATE 가 먼저 돌아 8ms 조각을 쓰는 동안은 굽지 않으니 대개 시트 큐 뒤에 시작하지만,
    큐의 싼 시트 하나가 3ms 안에 끝난 프레임에는 같이 구울 수 있다(시트 등록이 싸진 뒤로는 9장 중 4장쯤이 시트 큐
    도중에 그렇게 들어가 그 프레임이 타이틀에서 가장 길다, 헤드리스 15~24ms). 게임이 시작되면(Continue 등, 타이틀의 `started`) `idle()` 이 거짓이 되어 멈춘다. 실제
    사례: 굽지 않으면 첫 비·폭풍·눈보라 전투의 create 가 57~105ms 였다(지금 24~39ms).
- 새 시트는 create 에서 `bakePixelSheet` 로 한꺼번에 굽지 않는다. `warmSheets(scene, 시트 표, done)` 에
  넣고 `done(key)` 뒤에 그 시트를 쓴다(이미 구운 키면 그 자리에서 불린다). 동기 `bakePixelSheet` 는 그
  프레임에 꼭 있어야 하는 곳(warm 이 못 구운 전투 시트의 첫 사용(`fxSprite`), `statusFx.ts` 의 첫 사용, warm 이 아직 못 구운 시트를
  `fieldFx.ts` 가 재생할 때)에만 쓴다. 텍스처 크기와 굽는 시간은 `span`·`frames`·`crop` 으로 줄인다.
  crop 은 텍스처만 줄이고 그리는 비용은 거의 줄이지 못한다. 실제 사례: 나비는 불투명 범위로 crop 해도 굽는
  시간이 23.3→22.9ms(bun 단독)였다. 비용 대부분이 날개 칠하기였다(critter-art 프로파일: butterfly.js 의
  `inPoly` 약 65%, `edgeDist` 12%, 먼지 `cycle` 2%).
- `fx.ts` 맨 위 `/*! pixelfx ... MIT License ... */` 줄은 지우지 않는다. Bun 은 minify 할 때 `/*!` 주석만
  남겨서, 배포 번들의 pixelfx 고지는 이 줄 하나다.

## 필드 생물 (`src/ui/Critters.ts`)

필드의 장식 생물도 pixelfx critters 를 구운 루프 시트다(`CRITTER_SHEETS`, Phaser anims 로 돌린다). 보기만
하는 것이라 몸·대화·전투가 없다. 씬 create 에서 `addCritters(scene, region, { level, avoid, labels })` 한
줄로 넣고, 정리는 그 씬의 SHUTDOWN 이 한다. 계절은 create 때 한 번(Ambient 처럼), 시각·날씨는 매 프레임
읽는다.

- 나오는 곳:
  - 나비: 마을·숲의 봄·여름 낮. 1~2마리(2마리면 파랑·주황 하나씩, 1마리면 둘 중 하나)가 world 좌표로
    떠돌고, 시야에서 멀리 벗어나면 반대편 바로 밖에서 다시 들어온다. 한 마리가 영웅보다 넓어(날개폭 74px)
    셋이면 떼로 읽혀 줄였다(결정). 밤(`nightFactor`)이나 비·폭풍 날에는 알파로 사라진다. 마을 Ambient 의
    파티클 나비는 이것으로 바꾸며 지웠다(두 나비가 섞이지 않게).
  - 새: 마을·숲 낮, 비 오는 날 빼고. 몇 초마다 새소리 큐와 같은 확률(`Ambient` 의 `seasonal().birds`, 겨울
    0.3)로 한 마리가 시야를 가로지른다. 오른쪽을 보고 그려져 있어 왼쪽으로 날 때는 음수 scaleX 로 뒤집는다.
    양 끝 y 는 HUD 띠 아래·터치 원판 위로 묶는다. 실제 사례: 비스듬히 오르던 새가 화면 y 75(HUD 띠 0~88 안)까지
    올라갔다.
  - 개구리: 마을·숲, 겨울 빼고, 밤에도 있다(밤 그늘이 어둡게 한다). 물과 상하좌우로 닿는 풀밭(`T_GRASS`)
    중 최대 2곳(3타일 간격)이고, 타일 해시 순서라 방문마다 같은 자리다. 상호작용 지점·출구·보물(`avoid`)에서
    2타일 떨어지고, 개구리 상자(`FROG_BOX`, 시트 crop 과 같은 상자)가 고정 이름표(`labels`)와 겹치지 않는
    칸만 고른다. 그래서 마을은 이름표가 다 생긴 뒤(Villagers 생성 옆)에 부르고, Villagers 와 같은
    `keepClear` 와 `fixedLabels` 를 넘긴다.
  - 도깨비불: ABYSS 에만, 늘 떠 있다. 빛이라 ADD 블렌드다.
- 배율: pixelfx 1px 이 아트 한 칸 `ART_PX`(2px)이다(`setScale(ART_PX)`, 영웅 32칸 격자와 같은 칸). 전투
  이펙트의 4px 과 다르다.
- 깊이: 개구리 5(지형·물체 2~3, 발자국 4, 보물 반짝임 4.5 위, 발걸음 먼지 6·표지판 9·영웅 10 아래), 나비·새
  11.5(`AMBIENT_DEPTH`, 날씨 파티클과 같은 층. 이름표 11 위, HOME 말풍선 12·밤 그늘 90 아래), 도깨비불
  90.5(`GLOW_DEPTH`, 반딧불처럼 밤 그늘 위, 지역 제목 95 아래). 나비·새는 날씨 파티클처럼 지나가는 것이라
  "맵 이름표" 절의 안내 그래픽 규칙(이름표 아래)에 들지 않는다.
- 몬스터와 헷갈릴 생물은 넣지 않는다. 숲의 밤에 띄운 도깨비불은 마을에 밤에만 나오는 희귀 몬스터 NIGHT
  WISP(`src/monsters.ts` 의 `wisp`)로 보여 쫓아갈 대상으로 읽힐 수 있어 숲에서 뺐다(결정, 숲의 밤에는
  반딧불이 있다). 같은 이유로 pixelfx critters 중 필드 몬스터와 같은 종(bat 은 동굴의 BAT, slime 은 SLIME)이나
  적으로 읽히는 것(ghost·flying-skull·eyeball)은 쓰지 않는다.
- 시트는 타이틀이 미리 굽고(`warmBattleFx` 의 `after`), 못 구운 것은 그 씬이 `warmSheets` 로 나눠 굽는다.
  종류마다 시트가 다 들어온 뒤에 나온다. 그때는 나비·도깨비불이 시야 안에서 알파 0 부터, 개구리는 1초
  페이드로 들어오고, 새는 그 뒤부터 날아간다. create 에서 한꺼번에 구우면 타이틀에서 바로 Continue 한 마을
  첫 프레임에 네 시트가 몰린다(처음 시트 표로 타이틀에서 잰 시트별 굽기 시간의 합 약 170ms, 헤드리스).
- 시트 값(팔레트·`frames`·`crop`)을 바꾸면 타이틀 warm 의 가장 긴 프레임과 critter 텍스처 합을 다시 잰다
  (`TODO.md` 의 실기기 항목).
- 숲의 맑은 낮(겨울 제외)에는 pixelfx weather/god-rays 빛줄기가 화면에 깔린다(`Ambient` 의 `addSunRays`). 10초
  루프라 시트로 굽지 않고 PixelWeather 처럼 15fps 로 320x180 캔버스(4px 칸)에 다시 그린다(`lightCanvas.ts`). 빛과 불투명 먼지만 ADD 로
  그리고(밤 배경용 어두운 공기·빔 몸통은 뺌), 캔버스 위 20행에서 서서히 들어와 HUD 를 숨겨도 선이 없다. 깊이 10.8 은
  영웅·보물(10~10.7) 위, 이름표·장비 11 아래(이름표 대비 그대로), 밤 그늘 90 아래다. 비·밤·겨울에는 다시 그리지 않는다.
  critters/fish-school 은 무리(약 4x2.5 타일)가 연못(마을 4x1, 숲 3x3)보다 크고 옆모습 수중 그림이라 넣지 않았다(결정).
- 마을 축제 밤(20~23시) 불꽃은 pixelfx explosions/firework-burst 다(NightSky 의 `addFireworks`). 불꽃마다 색
  (`FIREWORK_COLORS` 를 가운데 둔 7단 램프)과 seed 가 달라 시트로 굽지 않고, 첫 불꽃 때 만드는 640x280 캔버스(2px 칸)에
  20fps 로 다시 그린다. 숲 빛줄기와 같이 `lightCanvas.ts` 의 `addLightCanvas`(빛과 불투명 픽셀만 ADD, 반투명 색은 뺌)를
  쓴다. 터질 때 효과가 제 하늘을 밝혀 화면 전체 번쩍임은 없앴고, FLASHES 끄기·reduced motion 이면 light 0.35 다. 별이
  536px 까지 처져 veil 을 y 448 까지 늘렸다. 실제 사례: 겨울 눈 마을에서 흰 팝이 눈에 묻혔다.
- 맑은 밤의 별똥별(마을·숲·설원)은 pixelfx weather/shooting-stars 의 meteor() 하나를 옮긴 것이다(NightSky 의
  `drawMeteor`, 효과의 7가지 모양 `METEORS` 와 팔레트 그대로). 그 효과는 별밭·은하수와 10초에 별똥별 7개를 한 draw 로만
  그려서 별을 끌 수도, 하나만 뗄 수도 없다(필드에서는 별이 땅 위의 점으로 찍힌다). 2px 칸 320x240 캔버스를 떨어질
  때마다 하늘 어딘가에 둔다. 큰 별의 섬광은 FLASHES 꺼짐이나 reduced motion 이면 불꽃과 같은 light 0.35 다. 옮긴
  코드라 pixelfx 를 올려도 따라오지 않는다.
- 설원 오로라는 pixelfx weather/aurora 를 그대로 그리되, 320x180 하늘 중 행 -150..-80 의 띠만 2px 칸으로 쓴다. 왼쪽
  절반은 그대로, 오른쪽 절반은 거울로 5.3초 뒤 시각을 그리고, 가운데 28칸에서 함께 흐려진다(`upload` 의 `colAlpha`).
  실제 사례: 4px 한 장은 커튼 단이 화면 230~330px(영웅 자리)까지 내려왔고, 위 160px 만 자르면 보라 안개뿐이었다. 같은
  시각을 거울로 붙이면 밝은 광선이 465·815px 처럼 짝지어 보였다. 별밭은 `starless` 페인터가 뺀다. 이 페인터는 효과가
  별을 먼저 그리고 그 뒤에야 색 버퍼를 읽는 순서에 기대고, field 인자(seed x5+1, 옥타브 8·16·32)도 aurora.js 내부
  값이라 pixelfx 를 올리면 별이 다시 나오지 않는지 본다. 반쪽을 번갈아 그려 각 10fps 이고, 켜져 있는 동안 프레임당
  +0.6~0.7ms(헤드리스)다. 노이즈 field(23ms)는 밤이면서 맑을 때, 게임 스텝 시작(game PRE_STEP)부터 3ms 이하로 일한
  프레임에 한 번 굽는다. 실제 사례: 씬 PRE_UPDATE 기준이면 씬이 만든 프레임에 바로 스텝해 create 프레임에 겹쳐 31ms 가
  됐다.
- `lightCanvas.ts` 의 실시간 캔버스(숲 빛줄기·축제 불꽃·별똥별·오로라·엔딩 불꽃)는 `redrawLive(scene, stepMs, { draw,
  upload, active, maxMs })` 로 돌린다. 다시 그리기와 그 업로드를 두 프레임에 나누고, `draw(dt)` 의 dt 는 업로드 프레임까지
  센 실제 경과 시간이라 효과가 실시간으로 돈다. 실제 사례: 업로드 프레임을 빼고 세던 때 축제·엔딩 불꽃은 0.77배,
  빛줄기는 0.82배로 돌았고, 불꽃은 pop 소리(발사 420ms 뒤)보다 83~183ms 늦게 터졌다(지금 −17~+34ms). 새 실시간 효과도
  step 루프를 따로 쓰지 않고 이것을 쓴다.
- 동굴·심연의 물방울은 pixelfx water/drip 의 front 층만(종유석 `source: false`, back 층의 웅덩이 타원은 뺌) 구운 시트다
  (Ambient 의 `CAVE_DRIP`, 880x66 232KB). 동굴 create 에서 `warmFieldFx` 로 굽고 `playFieldFxOnce` 로 `ART_PX`·
  `AMBIENT_DEPTH` 에 튼다. 씬이 `addAmbient` 에 `{ level }` 을 넘기면 바닥·물웅덩이 칸에만 떨어지고, 물결 양 끝(±18칸)·
  아래(+5칸)도 바위가 아닌 자리만 고른다(`DRIP_RING`, 12번 안에 못 찾으면 그 차례는 건너뜀).
- 마을·숲 연못의 물결 고리도 같은 drip 이다(Ambient 의 `pondRing`). 착수 0.02초 전부터 고리가 다 사라질 때까지(0.77s)
  굽고, back 층의 웅덩이는 빼되 고리의 뒤쪽 절반은 drawBack 과 같은 식으로 직접 그린다(연못이 웅덩이 역할). 비 오는 날
  연못에 떨어진 빗방울은 전부 고리가 되고(땅은 예전처럼 2/5 물튀김), 맑은 날은 2.5~6초마다 물고기 고리와 작은 물소리가
  난다. 고리 전체(±22·±7칸, `POND_REACH`)가 물 칸 위인 자리만, 동시에 8개(`POND_RING_CAP`)까지, 깊이 3.5(물가 1~3 위,
  발자국 4·개구리 5 아래, 밤 그늘 아래)다. 색은 그 물에 맞춘다: 마을은 pixelfx 기본 WATER, 숲은 `FOREST_WATER_PALETTE`,
  겨울은 `SNOW_WATER_PALETTE` 계열(`POND_RAMPS`). 빛은 0.5 — 1 이면 착수점 둘레 웅덩이 빛이 crop 전체에 옅은 판으로 깔렸다.
  씬이 `addAmbient` 에 `{ level }` 을 넘겨야 나온다.

## 필드 소품 (`src/ui/propFx.ts`)

맵에 서 있는 불·물 소품도 pixelfx 루프 시트다(보기만 하는 것, 몸·대화 없음). `addProp(scene, fx, x, y, depth, phase)`
가 `warmSheets` 로 나눠 굽고 다 구운 뒤 600ms 페이드로 들어온다. 1px = `ART_PX`, `phase` 로 나란한 둘이 같이
움직이지 않게 한다.

- 동굴 출구 아치 양쪽 바위면의 횃불(fire/torch)은 깊이 9 로 아치 그림 뒤·TOWN 표식 앞에 넣어 연기가 표식 뒤로
  지나간다. 불꽃 자리에 라이트맵 램프(0xff9a3c, r96, 0.5)를 달아 동굴도 라이트맵(+3.7MB)을 쓴다. 실제 사례: `air`
  로 두면 문 안쪽이 갈색으로 뜨고 TOWN 이 주황으로 씻겼다.
- 화산 용암에는 nature/toxic-puddle 의 앞층(기포와 김. 웅덩이·글로우인 `drawBack` 은 뺌)을 용암 타일 팔레트로 구운 기포가
  용암 이웃 3면 이상인 타일마다 3타일 간격으로(지금 6곳, `lavaVents`) 돈다. 깊이 1.5 로 용암·물가 전환(1) 위, 바위(2)
  아래라 김은 바위 뒤로 간다. 빛은 따로 달지 않는다(용암 램프 안).
- 심연 수호자 방(5층마다)의 기둥 바위에는 수호자가 살아 있는 동안 shadow/shadow-flames 의 앞층(혀·튀는 불·불씨,
  drawBack 의 그을린 바닥과 연기는 뺌)이 탄다(propFx `PILLAR_FIRE`, AbyssScene). 쓰러뜨리고 돌아오면 방이 풀리며 불도
  없다. 바위 정수리(칸 중심 −14px)에 깊이 9 로 얹고, 불마다 보라 air 빛(r96, 0.3)을 단다. 바위·바닥이 낮에도 거의 검어
  라이트맵이 되돌릴 색이 없기 때문이다. 시트 1620x64, light 0.4(빛 번짐이 crop 가장자리에 닿지 않게).
- 마을 대장간 화덕에는 fire/campfire(불꽃 height 14, 장작은 대장간 팔레트의 탄 색)를 화덕 입구(그림 중심 기준 x +4..+52,
  y +12..+56) 크기로 잘라 얹었다. 장작 끝과 불끝이 입구 테두리에 잘려 안에서 타는 불로 읽힌다. `WORKPLACES` 의 `hearth`
  로 두어 F2 편집기에서 건물과 같이 움직이고(`track`), 깊이는 건물 그림과 같은 3(그림 다음에 추가), 빛은 기존 화덕 램프가
  맡는다.

## 필드·패널 순간 이펙트 (`src/ui/fieldFx.ts`)

보물 파기(`TreasureDig.ts`)의 흙먼지·상자, 낚시(`Fishing.ts`)의 물결·물보라·낚아챔 물기둥(water/geyser), 마을 패널의 순간 연출도 pixelfx
시트다. `FieldFx`
(`key`·`sheet`·한 번 도는 길이 `ms`·`loop`)로 적고 `playFieldFx`·`playFieldFxOnce` 로 재생한다(Phaser anims).

- 보물·낚시의 시트는 쓰는 쪽 생성자에서, 패널(`PanelFx`)의 시트는 그 패널을 열 때(`warm()`, 그 씬에서 한 번)
  `warmFieldFx(scene, ...)`(`warmSheets`)로 나눠 굽는다. 재생하는 순간에 아직 없을 때만 그 자리에서
  `bakePixelSheet` 로 굽는다. 패널 순간은 연 뒤 키를 몇 번 눌러야 오고, 열지 않는 패널의 시트(다섯 패널
  4.6MiB)는 올리지 않는다. 실제 사례: 마을 create 에서 다섯 패널의 시트를 함께 넣자 첫 진입에 32~49ms 프레임이
  났다. 연 직후 쓰면 그 자리 굽기가 한 번 난다(헤드리스): 세션 첫 FARM 을 열자마자 Z 로 심으면 15~20ms 한 번
  (BLOOM 을 목록 맨 앞에 둬서 한두 프레임 뒤면 이미 구워져 있다), BLACKSMITH·KITCHEN 은 Z 를 두 번 누른 뒤라 그
  전에 끝나고, WHEEL 은 스핀 800ms 동안 끝난다. 보물 파기는 그 지역에 지도가 있을 때만 warm 한다. 지도는
  전투에서만 생기므로, 지금 없으면 씬이 다시 시작되기 전에는 팔 일이 없다. 실제 사례: `FishingUI` 가 생성자에서
  시트를 동기로 굽던 때 마을 첫 프레임이 172ms 였다(`warmFieldFx` 로 옮긴 뒤 create 8~16ms).
- 배율과 깊이는 그리는 자리를 따른다.
  - 보물 파기: 필드 그림이라 pixelfx 1px 이 `ART_PX`(2px)이다. 상자 10.6, 흙먼지 10.7 이다. 영웅·NPC 10 과
    안내 화살표 10.5 위라 X 위에 선 영웅에게도 상자가 보이고, 이름표 11(검·방패도 11)과 밤 그늘 90 아래다.
    흙먼지가 상자 위라 상자가 먼지 속에서 나온다.
  - 낚시: 패널의 연못·찌가 화면 해상도 도형이라 1px(scale 1, scrollFactor 0)이다. 깊이 152.5 로 연못 152 위,
    찌와 `!` 153 아래다. 실제 사례: 2px 로 그리면 물결이 연못 테두리 밖으로 14px 나가고 물보라가 FISH CAUGHT
    줄까지 올라갔다.
- 심연의 두 입구에는 pixelfx `arcane/portal` 이 돈다(`src/ui/abyssRift.ts`, `addAbyssRift` 가 `warmSheets` 로 굽고
  들어오면 루프). 마을 ABYSS 관문의 고리 안에는 세워서(`GATE_RIFT`), 동굴 계단의 홈에는 눕혀서(`STAIR_RIFT`)
  두고, 관문 그림의 보라(`ABYSS_GATE_PALETTE`)로 칠한다. 실제 사례: 전에는 관문의 소용돌이가 멈춰 있었고 계단의
  회색 단이 둘레 바위 하나로 읽혔다.
  - 깊이: 관문 rift 9.5(관문 그림 9 위, 앞을 지나는 영웅 10 아래), 계단 rift 3.5(계단 3 위, 계단을 밟는 영웅
    아래)다. 둘 다 밤 그늘(90) 아래의 보통 블렌드다. 빛처럼 밤 그늘 위에 ADD 로 두면 영웅과 관문의 ABYSS
    이름표(11) 위에 그려진다. 관문은 보라 램프가 얼굴을 보라로 물들여 일부러 램프를 달지 않은 자리다. 밤
    multiply 아래서도 rift 테두리는 둘레에서 가장 밝고, 계단의 보라 빛은 원래 있던 `air` 빛이 맡는다.
  - 빛(light)은 0.4 로 굽는다. 실제 사례: 이펙트 기본값 1 에서는 알파 있는 색으로 구워진 빛이 관문 돌을 분홍으로
    씻었다. 이펙트가 rift 아래 바닥에 까는 빛 줄은 crop 으로 뺐다. 관문 밑동을 가로지르고 계단 밖까지 나갔다.
- 포탈을 쓰면(마을 관문·동굴 계단의 `askAbyssDive`, 심연의 아래 계단) 영웅이 `arcane/blink-out` 으로 흩어지고 다음 층에서
  `blink-in` 으로 모인다(`src/ui/warpFx.ts` 의 `warpOut`·`warpIn`, 소리 `warp-out`·`warp-in`). 일반 출구와 위 계단은 `walkOut`
  그대로다. 둘 다 몸(o.actor) 이펙트라 statusFx 처럼 영웅 그림으로 굽는다. 워프가 시작되면 영웅을 카메라 쪽으로 돌려 세우고
  (`HeroWalk.hold`) 정면 idle 프레임과 손의 장비(HeroGear "down")를 한 몸으로 읽어, 외형·장비 해시가 키다. 연출 동안
  `FieldKeys.leaving()` 이 참이라 Q·패널 키·Z 가 먹지 않는다. 동료는 효과가 그리지 않으니 out 의 빛이 모이는 동안 흐려지고,
  in 이 끝난 뒤 250ms 에 들어온다(`CompanionSprite.setAlpha`, 다음 씬은 새로 만들어 1 이다). out 820ms(끝 200ms 에 카메라 페이드), in 720ms, 깊이 10.6,
  빛 0.7(FLASHES 끄기·reduced motion 0.35). 관문·계단이 있는 씬 create 와 질문 때 `warmWarp` 로 굽고, 못 구웠으면 그 자리에서
  굽는다(시트 하나 6~9ms, 헤드리스).
- 패널 순간 연출은 `PanelFx` 로 재생한다: 대장간 FORGE·REFINE 과 집 BUILD 의 불똥(`SPARKS`), 행운의 바퀴
  DOUBLE·JACKPOT 의 금빛 버스트와 JACKPOT 색종이, 밭에 심을 때 피는 싹과 수확 버스트, 부엌 요리 완성 버스트,
  가방에서 회복 아이템을 쓸 때 아이콘 밑에 퍼지는 회복 고리(holy/heal-aoe, HP 초록·MP 파랑·ELIXIR 금색), 상점 구매의
  금빛 버스트(`GOLD_BURST`)와 판매 때 아이콘에서 돌며 떠오르는 금화(pickups/coin-spin), 도감에서 동료를 정할 때 그
  아이콘 위에서 뛰는 하트(status/charmed).
  화면에 고정(scrollFactor 0)하고, 패널을 닫으면 `clear()` 로 남은 재생을 지운다. 깊이 151.5 는 패널 바탕 151
  위, 글자·아이콘 152 아래라 글자가 늘 위에 온전히 남는다.
  - 배율은 효과가 패널 테두리 안에 머무는 쪽을 고른다. 아이콘 위나 줄 끝에 두는 것(대장간·집·밭 심기·초록
    수확·부엌·가방 회복)은 1px 로, 64px 그림을 절반으로 그린 아이콘과 같은 화면 해상도다. 행운의 바퀴와 황금 수확은 필드
    칸 2px(`ART_PX`)다. 닿는 거리만큼 패널 가장자리에서 떼어 둔다(집의 불똥은 오른쪽 끝에서 90px, 밭은 50px
    안). 실제 사례: 대장간 불똥을 2px 로 그리면 좌우 160px 까지 날아 패널 왼쪽 밖으로 나갔고, 밭의 꽃은 2px 에서
    두 줄과 씨앗 줄만큼 키가 컸다.
  - 흰 섬광이 있는 버스트는 흰 글자 줄이 아니라 줄 사이 틈에 중심을 둔다. 실제 사례: 행운의 바퀴 결과 줄
    위에 두었더니 섬광이 글자 뒤에서 처음 몇 프레임 동안 글자를 지웠다.
  - 글자 모양을 그리는 pixelfx 효과(status/sleep 의 Z 등)는 쓰지 않는다(결정).
  - 루프 이펙트를 한 번만 틀 때는 `FieldFx.fade`(앞·뒤 알파 ms)를 준다. 실제 사례: 하트 루프가 첫 프레임부터 꽉 찬
    하트로 튀어나오고 끝에서 잘렸다. 움직임을 더할 때는 `PanelFx.play` 가 돌려주는 스프라이트에 tween 을 건다(상점
    금화). 스프라이트가 destroy 되면(`clear()`) 그 tween 도 끊긴다.
  - 몸(o.actor)을 칠하는 actor 이펙트를 패널 아이콘에 쓸 때는 빈 actor(`eyes: []`, 빈 mask)를 넘겨 그 효과의 장식만
    굽는다(도감 하트, `BestiaryUI` 의 `HEARTS`). actor 의 높이가 장식의 높이를 정한다.
- 엔딩은 마을 ELDER 의 보상 없는 대화(`elderTalk`, `forestBoss` 이후) 끝의 RECALL 로 다시 본다. 대화창 선택지는 터치에서 둘까지라
  FLAME DRAKE 를 쓰러뜨렸으면 두 번째 질문(FOREST/VOLCANO)으로 나눴다. `watchEnding` 이 `{ epilogue, replay: true }` 로
  시작하고 EndingScene 은 저장·보상 없이 끝나면 `Town {}`(GameState.pos 그대로)으로 돌아간다. 마을 `turningSeason` 이
  페이드 동안의 움직임을 막는 같은 가드다.
- 엔딩(`EndingScene`)의 축하 불꽃도 pixelfx explosions/firework-burst 다. 마을 축제처럼 `addLightCanvas` 에 실시간으로
  그리되, 요약 양옆 빈 칸(`FIREWORK_BOX`, 모든 글자 줄에서 10px: MOSS GOLEM 278x262, 에필로그 330x316)에 한쪽 하나씩
  캔버스를 두고 1px 로 그린다. 60개 seed 로 잰 burst 의 범위(별과 12/255 넘는 빛)는 좌우 98·위 76·아래 149px
  (`BURST_REACH`)라 2px(392x450)로는 칸에 들어가지 않는다. 엔딩 문구나 요약 줄의 위치·폭을 바꾸면 `FIREWORK_BOX` 를
  다시 잰다. 쉘 램프(`shellRamp`)·다시 그리는 주기·수명·RISE·soft light 는 NightSky 의 export 를 같이 쓴다.

## 효과음 키트 (`src/sfxKit.ts`)

효과음은 전부 프로그램(데이터, 소리 단계 목록)이고 합성기 하나가 재생한다. 소리 파일은 없다
(`designing-retro-arcade-sound-kits` 스킬의 방식). 게임 코드는 이벤트 이름으로만 소리를 낸다: 기존 효과음은
`Sfx.attack()` 처럼 `Sfx.<이벤트>()`, 새 소리는 `Sfx.emit("tech:beam")`. 오실레이터를 직접 만드는 효과음은 새로
쓰지 않는다. BGM·날씨 bed·환경음·천둥은 `audio.ts` 에 그대로 있다.

- 효과음 프로그램을 더하거나 고치면 커밋 전에 `bun run check:sound` 를 돌린다. 대상은 `registerSfx` 로 등록하는
  모든 표다(`sfxKit.ts` 의 키트, `skillSfx.ts` 의 기술음). 스크립트가 `src` 에서 최상위 `registerSfx(표)` 줄을
  찾아 그 모듈을 Bun 으로 불러오므로, 표는 모듈 최상위에서 한 번 등록하고 그 모듈은 Phaser 를 값으로 import 하지
  않는다(못 불러오면 `did not load under Bun` 으로 실패한다).
- 검사 항목: id 가 키와 같음, 1..24 단계, SE 0.6초·징글 1.6초 이하, 한 줄 사운드 타깃(`target`), `pitch` 선언,
  같은 키를 두 표가 등록하지 않음(뒤의 것이 앞의 소리를 말없이 바꾼다). dev 빌드에서는 `registerSfx` 가 같은
  문제를 console.error 로도 낸다.
- 징글은 드문 장면 전환(승리·레벨업·신기록·게임 오버·보스 등장·격노·밤)에만 쓰고, 자주 나는 피드백은 SE 다. 실제
  사례: 보스 예고 `charge` 는 0.8초로 SE 예산을 넘어 0.6초로 줄였다. `nova` 는 0.7초 붐을 castNova 의 마지막
  폭발에 맞춰 1.2초라, 드문 궁극기로 보고 징글 예산을 쓴다.
- `pitch` 는 "key"(흰 건반, 타이틀·마을·숲·설원과 그 전투곡이 함께 쓰는 음계 — 단조 곡 위에서는 아래 조옮김),
  "none"(잡음뿐), 또는 `{ offKey: "이유 한 줄" }` 이다. 음을 차례로 올릴 때는 같은 Hz 간격이 아니라 음계를 따라
  올린다. 실제 사례: 옛 `run` 은 600·700·800Hz 로 올라 키를 벗어났다 → D6-E6-G6.
- "key" 프로그램은 지금 도는 BGM 의 조를 따라간다. 동굴·심연 필드(`DUNGEON_THEME`, C단조)와 화산
  (`VOLCANO_THEME`·`VOLCANO_BATTLE_THEME`, D화성단조)이 도는 동안은 온음 아래(-2)로 재생한다(`audio.ts` 의
  `SFX_KEY_SHIFT`, `playBgm` 이 `setSfxKeyShift` 로 넘김). 데이터는 흰 건반 그대로 쓰고 offKey·잡음·필터는 옮기지
  않는다. 실제 사례: 동굴 필드의 `chest`·`levelup`·`pickup` 은 E·B 가 곡의 Eb·Bb 와, 화산 전투의 `victory`·
  `levelup` 은 C 가 곡의 C# 과 반음으로 부딪혔다(곡이 치지 않는 음과의 반음이 효과음 한 번당 동굴 17→0%, 화산
  전투 11→1%, A 가중 음량 차 -0.9~+0.6dB). 새 단조·선법 곡을 넣으면 키트의 잦은 음(C·E·G·A)이 곡이 한 번도
  치지 않는 음에 떨어지는지 보고 표에 한 줄 넣는다. 화성단조는 흰 건반을 옮겨서는 다 맞지 않으니 후보마다 잰다
  (화산은 +5 가 G 를 C 로 옮겨 C# 과 부딪혀서 -2 가 됐다). `BOSS_THEME`(E프리지안)은 흰 건반 그대로라 0 이다.
  그 곡의 E/F·B/Bb 반음은 곡 자신의 음이라 옮겨도 줄지 않는다.
- 연달아 나는 소리끼리 반음으로 부딪히지 않는지 본다. 실제 사례: 전투 결산은 `victory` 360ms 뒤에 `pickup` 을
  낸다. 그 B5 가 `victory` 의 C6 지속음과 반음으로 부딪혀 `pickup` 을 E6→A6 로 옮겼다.
- 재료는 정해진 것만 쓴다(square, pulse25·pulse12, triangle, sawtooth, sine, LFSR noise·metal, filter, drive,
  crush). 모든 소리는 캐비닛(tone lowpass → soft clip, 천장 0.14)을 지나 sfxBus 로 간다. 천장은 master 2.8 과
  리미터 -8dBFS 에 맞춘 값(0.142)이라 둘 중 하나를 바꾸면 같이 바꾼다. 리미터는 압축기라 짧은 소리를 긴 소리보다
  많이 깎으니, 소리 하나의 봉우리는 clip 이 임계 아래에서 다듬고 압축기는 BGM 과 겹칠 때만 일하게 둔다.
- 음량은 소리 하나만 듣지 말고 형제 소리와 견줘 정한다. 기준은 A 가중 50ms 최대(마스터 버스, 리미터 앞)이고
  BGM 은 -24~-25 다: 궁극기·보스 -18, 전투 타격(attack·strike·hit) -20, 주문·상태 -21~-22, 보상·장면 징글
  -20~-23(타격을 덮지 않게), 확인·틱 -23~-25. 실제 사례: 옛 키트는 A 가중으로 전투 타격(-25~-29)이
  보상음(-17~-20)보다 작았다.
- 가장 잦은 소리는 음량 대신 대역으로 띄운다. 실제 사례: 메뉴 커서 `move`(600Hz)는 BGM 선율(150~1050Hz)과 같은
  대역이라 1.5kHz 위에서 BGM 보다 5dB 아래였다 → A6 12.5% 펄스(무게중심 4.5kHz)로 옮겨 그 대역에서 BGM 보다
  약 10dB 위다.
- 낮은 소리에는 옥타브 위 square 를 겹친다. 노트북 스피커는 150Hz 아래를 거의 못 낸다. 실제 사례: 첫 `enrage` 는
  에너지의 85% 가 150Hz 아래라, 가중 없는 RMS 로는 키트에서 가장 컸지만 A 가중으로는 -23 이었다.
- 같은 이벤트는 16ms 안에 2번까지만 난다(`emitSfx`). 한 프레임에 몰린 같은 소리는 겹쳐 커지기만 한다.
- 재는 법: OfflineAudioContext 에 sfxBus → master 2.8 → 리미터 사본을 만들어 렌더한다(`/tmp/pwcheck/` 의 일회용
  스크립트). 소리 앞에는 0.5초 무음을 둔다. 실제 사례: Chrome 압축기가 렌더 첫 순간의 짧은 소리를 12~14dB 깎아,
  무음 없이 잰 `move` 가 실제보다 그만큼 낮게 나왔다(게임에서는 압축기가 계속 돌고 있어 해당 없음). 사람 귀로
  들어 볼 항목은 `TODO.md` 에 있다.
