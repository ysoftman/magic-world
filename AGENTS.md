# Magic World 개발 규칙

## Dev 서버 관리

- dev 서버는 **항상 1개만** 띄운다. 포트는 5199 고정.
- 코드 수정 후에는 **기존 서버를 먼저 종료하고 새로 시작**한다:
  - 종료: `lsof -iTCP:5199-5206 -sTCP:LISTEN -P | awk 'NR>1 {print $2}' | sort -u | xargs kill`
  - 시작: `nohup bun run dev --port 5199 --strictPort > /tmp/pwcheck/devserver.log 2>&1 &`
- 여러 서버가 떠 있으면 사용자가 옛 탭/옛 코드를 볼 수 있어 혼란을 준다(실제 사례: hjkl 미동작 원인이 예전 탭의 예전 번들이었음).
- 사용자에게는 항상 `http://localhost:5199/` 한 URL만 안내한다.

## 커밋은 의미 단위로 그때그때

- 기능·수정·문서 한 단위가 끝나고 검증(`bunx tsc --noEmit`, 수정 파일 `biome check --write`,
  그리드를 고쳤으면 `bun run check:art`)을 통과하면 **그 단위만 바로 커밋**한다. 한 커밋에 여러
  기능을 섞지 않는다. 실제 사례: 한 세션의 작업이 60개 파일 커밋 하나로 들어가, 400여 조각을
  나눠 13개 커밋으로 다시 만들어야 했다.
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
| Text 스타일·웹폰트·줄바꿈 | `text-and-bitmaptext` |
| 화면 배율·FIT·선명도 | `scale-and-responsive` |
| tween·easing | `tweens` |
| 텍스처 굽기(RenderTexture/DynamicTexture) | `render-textures` |
| 필터·후처리 | `filters-and-postfx` |
| 사운드 | `audio-and-sound` |
| Phaser 4 새 기능, v3 습관 피하기 | `v4-new-features`, `v3-to-v4-migration` |

- 설치는 저장소 루트에서 아래 명령으로 한다(사용자가 설치한 그대로). 출처와 내용 해시는
  `skills-lock.json` 에 남는다. `.claude` 가 개인 전역 gitignore 에 걸린 환경이면 스킬 파일은 git 에
  안 잡히니 체크아웃마다 다시 설치한다(README "Claude Code 스킬(선택)" 절).

  ```bash
  DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bunx skills add phaserjs/phaser -a claude-code --copy -y \
    -s input-keyboard-mouse-touch scenes text-and-bitmaptext scale-and-responsive tweens \
       render-textures filters-and-postfx audio-and-sound v4-new-features v3-to-v4-migration
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
- 브라우저로 직접 확인하는 일은 이 저장소 전용 `magic-world-playtest` 스킬을 쓴다("기타" 절).

## UI 텍스트가 패널/화면을 벗어나지 않는지 확인

패널·라벨·힌트 문구를 새로 넣거나 고칠 때는 **구현 시점에 폭을 계산해서** 확인한다.
(실제 사례: FARM 패널을 620px로 만들었는데 씨앗 안내 줄이 660px라 패널 밖으로 삐져나감)

- `Press Start 2P` 는 고정폭이고 글자 하나가 1em 이다. `retroStyle(n)` 텍스트의 폭은
  **`문자수 x n x PIXEL(4)` px** — 예: `retroStyle(6)` 26글자 = 26 x 24 = 624px.
- **긴 글은 `bodyStyle`, 짧은 글은 `retroStyle`.** 대화창 본문, 전투 메시지, 상점·가방·대장간·
  부엌의 INFO·msg 줄, 도움말 본문, 업적 설명, 퀘스트 상세는 `bodyStyle(22|33)`(Departure
  Mono)로 쓴다. 제목·HUD·메뉴·이름표·선택지·토스트·키 안내 줄은 `retroStyle` 그대로다. 실제
  사례: Press Start 2P 32px 다섯 줄은 행간이 없어 한 덩어리로 읽혔다.
- Departure Mono 도 고정폭이다. 글자 폭은 **`size x 7/11`** — `bodyStyle(33)` 21px,
  `bodyStyle(22)` 14px(`pixelart.ts` 의 `BODY_GLYPH_W`). 11px 격자라 22·33 외의 크기는 흐리다.
  줄 높이(Phaser metrics)는 39 / 26px 로 retroStyle 보다 크고, 대문자는 줄 위에서 8 / 6px
  아래(악센트 자리), 내림획은 37 / 24px 까지 내려온다. 세로 여백은 이 값으로 계산한다.
  retroStyle(6·8) 줄을 33으로, (4·5) 줄을 22로 바꾸면 가로 폭은 늘 줄어든다.
- 글꼴은 `@fontsource/press-start-2p` 의 latin subset 과 같은 범위로 자른 Departure Mono
  (`src/assets/fonts/`, 자른 명령은 그 CSS 주석)를 번들로 쓴다(`src/main.ts` 의 CSS import,
  부팅 전에 두 글꼴을 다 기다린다). 그 범위(U+0000-00FF, U+2000-206F 등, 패키지 `unicode.json`
  의 `latin`) 밖 글자는 fallback 폰트로 그려져 위 폭 규칙이 맞지 않으니, 새 문구는 범위 안
  글자만 쓰고 ★ 는 쓰지 않는다. 실제 사례: 예전 Google Fonts CDN 을 막으면 전 화면이 fallback 이 되어 `HOME` 이름표가
  84→53px 로 줄었다. 지금은 번들이라 오프라인에서도 같다.
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
  "#0b0b2b", 4)`)이나 뒷판(`setBackgroundColor` + `setPadding`)을 단다. 실제 사례: 대화창
  이름표 `ELDER` 가 뒤의 `BLACKSMITH` 이름표와 섞였고, 전투 `Z:CONTINUE` 는 풀밭 위에서 1.4:1 이었다.
  그래서 패널·도움말·대화가 열려 있는 동안에는 맵 이름표를 전부 숨긴다(`sceneCommon` 의
  `whilePanelUp(scene, () => this.uiBlocking())`, 모든 필드 씬). 반투명 패널 뒤로 이름표가
  유령 글자처럼 비쳤기 때문이다. 새 필드 씬도 같은 줄을 넣는다.
- 같은 `whilePanelUp` 이 그동안 토스트도 붙잡는다. `!` 가 들어간 소식(업적·해금 팁·
  `MARKET DAY! ...`)은 패널이 닫힌 뒤 순서대로 나오고, 패널이 열릴 때 떠 있던 토스트는 내린다
  (소식은 다시 줄 맨 앞에, `SAVED` 같은 상태 줄은 버림). 패널 안에서 누른 키의 답(`SOUND: OFF`,
  `SLOT 1 CODE COPIED`, `INVALID CODE`)과 `SAVE FAILED: STORAGE FULL` 은 `!` 없는 상태 줄이라
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
- 크기: Press Start 2P 는 8px 격자라 `retroStyle(n)` 의 짝수 n(16·24·32px)이 선명하다.
  `retroStyle(5)`(20px)는 글자 픽셀이 2.5px 라 조금 흐리지만, 패널·HUD 폭이 거기 맞춰져 있어
  그대로 두었다. 새로 만드는 줄은 4 또는 6을 쓴다.
- 해상도: 텍스트는 `retroStyle`·`bodyStyle` 의 `TEXT_RESOLUTION`(1~3)배로 크게 구운 뒤 nearest 로
  1280x720 캔버스에 줄여 그린다. 캔버스는 어느 화면에서나 1280x720 이라, 크게 구워도 기기 픽셀에
  1:1 로 맞지 않는다. 얻는 것은 nearest 가 고를 깨끗한 표본, 즉 회색 AA 테두리 픽셀이 줄어드는
  것이다. 실제 사례: HUD 20px 줄의 중간 밝기 픽셀이 1·2·3 에서 30.2·17.8·8.5% 였고, 1x·2x 화면에서
  똑같았다(캔버스가 같으므로). 화면이 게임 1픽셀을 2기기픽셀 이상으로 키우면 그 차이가 보이므로
  배율(DPR x 표시 폭/1280)이 2 이상이면 3, 그 아래는 올림한 값이다(맥북 DPR2 의 정확한 2배는 3).
  그래서 Text 는 반드시 `retroStyle` 이나 `bodyStyle` 로 만든다. 메모리는 배율의 제곱이라 상한이
  3이다(마을 Text 497개 기준 4.1·16.4·36.8MB). 값은 `watchTextResolution`(main.ts)이 매 프레임
  확인하고, 창 크기·브라우저 확대·다른 DPR 화면으로 옮길 때 모든 씬의 Text 를 다시 굽는다.
  실제 사례: 작게(640x360, DPR2) 연 창을 키워도 새로고침 전까지 1로 남아 흐렸다. DPR 만 바뀌는
  경우는 resize 가 나지 않고, `matchMedia("(resolution: …dppx)")` 의 change 도 헤드리스
  Chrome 에서는 오지 않아 확인할 수 없었다. 그래서 이벤트 대신 매 프레임 두 숫자를 비교한다.
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
  아래라 밤에는 이름표와 함께 어두워진다.
- 확인 방법: `src/levels.ts` 의 `*_POS` 상수를 import 해서 라벨 사각형 목록을 만들고 AABB
  겹침을 검사하는 일회용 스크립트를 `/tmp/pwcheck/` 에 두고 `bun` 으로 돌린다. 라벨 목록은
  각 씬 `create()` 의 `.text(...)` 호출이 원본이다.

## 오버월드 맵 레이아웃

- 마을 지형과 랜드마크 위치는 **`src/overworldMap.ts` 한 파일**에 있다. 이 파일만 바꾸면
  레이아웃 전체가 바뀐다 (`levels.ts` 는 여기서 읽어 쓴다).
- 게임 안에서 `F2` 로 맵 편집기를 열고 `X` 를 누르면 dev 서버가 이 파일을 **직접 덮어쓴다**
  (`vite.config.ts` 의 `overworld-map-writer` 플러그인, dev 전용). 저장 후 Vite 가 리로드하고
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

## 필드 씬 입력(종료 확인·터치·게임패드)

- 타이틀로 나가기(Q)는 `sceneCommon` 의 `askQuitToTitle(this.dialogue, () => this.quit())` 로
  대화창에서 묻고, 씬의 `quit()` 은 `quitting = true` 뒤 `saveAndQuit(this)` 를 부른다. 실제
  사례: 예전에는 여섯 필드 씬이 각자 중앙 `QUIT TO TITLE? Y/N` 글자와 Y/N/ESC 리스너를 따로
  들고 있었고, 안내 화살표·도움말·조우·보물 파기·심연 계단 질문이 그 플래그를 씬마다 따로
  봤다. 지금은 대화창이 `uiBlocking()` 이라 영웅·패널 키가 멈추고 이름표도 숨으며, 저장 뒤
  타이틀로 가기까지의 700ms 는 `quitting` 하나로 막는다. 새 필드 씬도 DialogueBox 와 이 두
  줄(`askQuitToTitle`, `quitting` 가드)을 넣는다.
- 필드의 패널 키나 전투 키를 새로 만들면 터치와 게임패드도 같이 본다. 터치 오른쪽 세로 줄은
  `TouchControls` 의 `MENU`(씬이 등록한 키만 버튼이 됨), 패드는 `src/ui/Gamepad.ts` 의
  `FIELD`/`BATTLE` 표다. 둘 다 `sendKey` 로 키보드 이벤트를 합성해 보내서 씬은 키보드만
  처리하면 되지만, 표에 없는 키는 그 기기로 누를 방법이 없다. 실제 사례: 전투의
  WARD·NOVA·STEAL 과 필드의 T(미니맵)가 패드 표에 빠져 있었다. README 의 조작 표와
  게임패드 표도 같이 고친다.
- 전투 화면에는 `TouchControls` 가 없다(메뉴를 바로 탭한다). 그래서 전투에서 키(ESC 등)에만
  묶인 동작은 탭 경로를 함께 만든다. 실제 사례: 아이템 목록을 닫는 길이 ESC 뿐이라 터치에서는
  아이템을 쓰지 않고는 나올 수 없었고, 재고가 0 이면 전투가 멈췄다 → 지금은 목록 밖을 탭하면
  메뉴로 돌아간다(`BattleScene` 의 `closeItems`).

## 작업 완료 후 중간 산출물 정리

- 작업 중 생성한 **중간 산출물**(디버그 스크린샷 png, 검증용 임시 파일, 임시 훅 등)은 작업이 끝나면 반드시 정리한다.
- 스크린샷/검증 산출물이 저장소 루트에 남지 않도록 확인하고, 필요 없어진 파일은 삭제하거나 `.gitignore`에 추가한다.
- 임시 디버그 훅(예: `Object.assign(window, { __game })`)은 커밋 전에 반드시 제거한다.
- `/tmp/pwcheck/` 등 임시 디렉터리의 파일은 저장소 정리 대상에서 제외한다.

## TODO.md

- 완료되지 않은(진행 중) 작업이나 앞으로 작업할 내용은 루트의 `TODO.md`에 기록한다.
- 작업을 완료하면 해당 항목을 `TODO.md`에서 삭제한다.

## 기타

- 빌드: `bun run build` (tsc + vite build)
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
- playwright 에서 드롭·포획을 강제하려고 `Math.random` 을 상수 함수(`() => 0.01`)로 덮으면,
  Phaser 가 텍스처 키 UUID 를 `Math.random` 으로 만들어서 모두
  `00000000-0000-4000-8000-000000000000` 이 된다. 그 결과 "Texture key already in use" 콘솔
  에러와 `Cannot read properties of null (reading 'context')` pageerror 가 나며 게임이 멈춘다
  (실제 사례: 4차 QA 의 KOI FEAST 드롭 강제). 강제가 필요하면 그 호출만 짧게 감싸거나 시드 있는
  의사난수로 바꾼다. 아니면 강제 없이 여러 판 돌린다.
- 여러 명이 동시에 소스를 고치는 중이면 Vite HMR 이 테스트 페이지를 통째로 다시 불러 전투
  도중 타이틀로 돌아간다. 테스트 페이지의 init script 에서 프로토콜이 `vite-hmr`/`vite-ping`
  인 WebSocket 을 가짜 객체(`EventTarget` + 빈 `send`/`close`)로 바꾸면 불러온 시점의 코드로
  끝까지 돈다. 저장소 코드는 건드리지 않는다.
- 브라우저 점검(playwright)은 `.claude/skills/magic-world-playtest` 의 `scripts/harness.py` 를
  쓴다(위 함정들이 이미 들어 있다). 스모크: `python3 -I .claude/skills/magic-world-playtest/scripts/harness.py smoke`.
  `.claude` 가 개인 전역 gitignore 에 걸린 환경이면 이 스킬 파일을 고칠 때 `git add -f` 로 올린다.

## 픽셀 그리드 검증 (`bun run check:art`)

`BootScene.ts` 의 타일/스프라이트 그리드를 손대면 **커밋 전에
`bun run check:art`** 를 돌린다. 이 검사가 실제로 잡아낸 버그가 있어서
남겨둔 것이다 — `BAT_TILE` 이 3행만 17자라 텍스처가 68px 로 구워진 것,
`ICE_GOLEM_TILE` 이 팔레트에 없는 문자를 써서 2픽셀이 투명하게 빠진 것,
길 variation 2장이 위상이 접혀 바이트 단위로 중복된 것. 셋 다 아무것도
throw 하지 않고 그림만 조용히 틀리는 종류다.

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
지형 경계만 다듬을 전환 타일은 `smoothBoundaryOnly(계열, ...)` 를 쓴다.
32칸으로 다시 그린 그리드는 `makeTexture(..., ART_PX)` 로 Scale2x 없이
굽고, check:art 가 32x32 인지 본다.

영웅·NPC·몬스터는 전부 32칸 그리드다. 몬스터 그리드 두 개는 여러 텍스처가
나눠 쓴다: `SLIME_32` (slime / goldSlime / king / magmaSlime), `GOBLIN_32`
(goblin / cursedGoblin). 그래서 그리드에 문자를 하나 더하면 그 그리드를 쓰는
팔레트 전부에 키가 있어야 한다 (check:art 가 잡는다). 희귀 변종도 tint 를
쓰지 않고 전용 팔레트·텍스처로 굽는다. 곱하기 tint 는 녹색 슬라임을 금색이
아니라 올리브색으로 만들었다. 반대로 보스·거인은 작은 몬스터 그리드를
키워 쓰지 않는다. TROLL KING·MOSS GOLEM 이 고블린 그리드를 키운 것이었을 때는
'큰 고블린'으로 읽혀서 전용 그리드로 바꿨다.

아이템 아이콘은 `icon-<키>` 텍스처다(인벤토리·소재·요리 재료·요리 키, 보물 지도는
`icon-map`). 16칸 그리드를 기본 Scale2x 로 구워 64px 이 되고, 패널은 그 절반인
32px 로 그린다. 아이템 창·상점·대장간·KITCHEN 이 키 이름으로 텍스처를 찾으므로,
아이템이나 요리를 새로 넣으면 BootScene 에 그 아이콘도 함께 그려야 한다. 빠지면
Phaser 의 missing 텍스처가 대신 뜬다. 장비 아이콘은 영웅 장비와 같은 팔레트
(`EQUIP_*_PALETTE`)로 칠해서 등급 색이 서로 맞는다.

## 전투·타이틀 배경 (`src/backdrops.ts`)

지역별 전투 배경(마을·숲은 계절 3종, 동굴, ABYSS, 설원, 화산)은 부팅 때 한 번
1280x720 텍스처로 굽는다. 4px 칸으로 원경·중경·근경을 그려서 2px 칸인
캐릭터보다 한 단계 멀어 보이게 한다. 타이틀 배경(`title-bg`)도 같은 파일에서 같은
도우미로 그린다. 그쪽은 로고(y 168..264)·부제(350..432)·세이브 카드(455..555)·안내
줄(645..675)·버전 표시(오른쪽 아래) 뒤에 밝은 점을 두지 않는다. 고칠 때 지킬 것:

- 지평선은 y 440 이다. BattleWeather 가 그 아래에만 빗방울을 튀기고, 동료도
  그 선에 선다.
- 바닥의 y 488..584 에는 전투 메뉴·힌트·아이템 목록이 흰색·연파랑 글자로 바로
  그려진다. 그래서 바닥은 어둡고 무늬가 없게 둔다. 풀·균열 같은 디테일은
  지평선 바로 아래(y 444..484)나 화면 양 끝에만 둔다. 처음 시안에서 화산 균열이
  메뉴 글자를 가로질렀다.
- 배경은 캐릭터보다 채도·대비가 낮아야 한다. 전투 띠(y 204..436, 캐릭터 자리
  제외)의 평균 chroma 가 캐릭터 평균(0.37)보다 낮고 명도 표준편차가 캐릭터
  최소(42)보다 낮은지 잰다. 영웅·적이 서는 자리(영웅 x 256..384, 적
  x 864..1056) 뒤에는 밝은 것을 두지 않는다.
  - 측정 정의: luma = 0.299R + 0.587G + 0.114B, chroma = (max − min) / 255, 띠 =
    y 204..436 에서 영웅 자리(x 256..384, y 304..432)·적 자리(x 864..1056,
    y 216..408) 제외, 표준편차는 모집단. 구운 텍스처를 `textures.getBase64` 로 받아
    원본 픽셀로 잰다. 캐릭터는 `hero-down-0` 과 `ENEMIES` 의 텍스처 20종(불투명
    픽셀)이고, 이 정의로 평균 chroma 0.366·최소 명도 std 42.1(`king`, KING SLIME)이
    나와 위의 0.37·42 와 맞는다.
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
