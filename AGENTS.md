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
- 대화창(`ui/DialogueBox.ts`)은 입력 방식마다 레이아웃이 다르다(`KEYBOARD`·`TOUCH`). 키보드는
  `bodyStyle(22)` 한 줄 60글자(840px)·줄 간격 34px·4줄, 상자는 가운데 x 188..1092·y 516..688(테두리
  포함), 선택지 `retroStyle(6)` 셋까지(280px 간격, 질문 쪽은 본문 3줄), 이름표 `retroStyle(4)` 다.
  터치는 `bodyStyle(33)` 한 줄 42글자·화면 폭 상자·선택지 `retroStyle(8)` 둘·질문 쪽 본문 1줄
  그대로다(폰 화면에서는 글자가 더 작게 보이고, 원판을 피한 42글자에 맞춘 문구가 많다). 그래서
  대화 문구의 폭은 여전히 터치 42글자로 잰다. 키보드 줄이 더 길어 터치에 맞으면 키보드에도 맞는다.
  실제 사례: 키보드도 33 으로 화면 폭 54글자였을 때는 두 줄이 화면을 꽉 채워 읽기 힘들었고, 22 를
  화면 폭 그대로(84글자) 쓰면 다음 줄 머리를 찾기 어려워 상자를 60글자 폭으로 좁혔다.
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
  배경을 불투명(alpha 1)으로 한다 — 0.95 에서 퀘스트 일지 제목 줄 뒤로 HUD 글자가 비쳤다. HUD 에 닿지 않는 패널도
  불투명으로 한다. 실제 사례: 0.95 이던 설정·FARM·도움말·낚시·행운의 바퀴·이름 입력·외형 고르기 패널은 뒤의
  건물과 타이틀 글자가 글자 줄 사이로 유령처럼 비쳤다. 새 패널 바탕은 alpha 1 로 만든다.
- 그런 패널의 top 은 `StatusHud` 의 `PANEL_TOP_OVER_HUD`(8, HUD 두 줄을 다 덮음) 또는
  `PANEL_TOP_UNDER_HUD_ROW1`(40, 1행 y 14..34 와 2행 y 58..78 사이) 둘 중 하나로 둔다. 실제
  사례: top 28 인 업적·도감의 위 테두리가 HUD 1행을, top 61 인 상점이 2행을 가로로 잘라 글자
  윗부분만 패널 위로 비쳤다. 지금 배치는 업적·도감과 터치에서 위에 붙는 집·부엌·대장간·가방·
  상점이 8, 키보드 상점·랭킹·퀘스트가 40, 키보드 가방이 83(HUD 아래라 상관없음)이다.
- top 40 인 패널(퀘스트 일지·랭킹·키보드 상점)은 폭 1160 이라 HUD 2행(x 24..1256)의 양 끝이 패널 밖에 남는다. 그래서
  패널의 dim 아래에 HUD 바탕색 띠(`StatusHud` 의 `hudRow2Cover`, x 2..1278·y 40..86, HUD 테두리 안쪽)를 깔고 열 때
  `showHudRow2Cover`(HUD 를 숨긴 동안은 안 보임), 닫을 때 숨긴다. 실제 사례: 일지 왼쪽에 `SLIMES 0/5` 의 `SL`, 오른쪽에
  축복 태그 `GREED 6` 의 `6` 만 잘려 보였다. top 40 인 패널을 새로 만들면 같은 띠를 넣는다.
- top 8 인 패널(업적·도감, 터치의 집·부엌·대장간·가방·상점)도 HUD 보다 좁아 두 행의 양 끝이 패널 밖에 남는다. 그래서
  `StatusHud` 의 `coverHudUnder(scene, dim)` 이 HUD 두 행 전체(x 2..1278·y 4..86, 위 강조선 아래)를 HUD 바탕색으로 dim 아래(깊이
  149.9)에 깔고, 매 프레임 dim 이 보이고 HUD 가 켜져 있을 때만 보인다(여닫는 코드는 그대로). 실제 사례: 터치 가방 왼쪽에 이름과
  `SEE ELDER` 의 `SEE E`, 오른쪽에 시계 끝자리와 해가 잘려 보였다. top 8 인 패널을 새로 만들면 dim 바로 뒤에 이 한 줄을 넣는다.
- 필드의 지역 제목(`THE FOREST` 등)도 맵 위에 바로 놓이므로 `sceneCommon` 의
  `fadeAreaTitle` 이 외곽선을 달고, 입구의 `TOWN` 이름표는 제목이 사라진 뒤에 들어온다
  (`fadeInAfterAreaTitle`). 실제 사례: 밤 숲에서 외곽선 없는 초록 `THE FOREST` 가 나무 꼭대기에
  묻혔고, 제목이 사라지는 0.6초 동안 함께 들어오던 `TOWN` 이름표와 겹쳐 둘 다 반쯤 비쳤다.
- 동굴·숲·설원·화산의 지역 제목 아래에는 그 지역에 오늘 남은 것 한 줄이 같이 떴다 사라진다(`sceneCommon` 의
  `fadeAreaTitle(scene, title, region)` → `areaLeft`: `STARS 1/3   SEAL   SHRINE   NEST   PEDDLER`, 남은 것만, 없으면 줄 없음).
  못 찾은 별 조각, 강적을 아직 못 이긴 봉인, 오늘 안 바친 제단, 오늘 안 들어간 둥지(5승 뒤부터), 오늘 그 지역에 서 있고 살 것이
  남은 상인을 센다. 별
  조각·봉인·상인은 마을 해금 팁(`seenTips` 의 `fields`·`peddler`)이 나온 뒤에만 넣는다. 제목과 같은 조건(입장 때만,
  전투에서 돌아올 때는 없음)이고 저장하는 것은 없다. 이변이 걸린 필드면 맨 앞에 그 이름(`GOLD RUSH   STARS ...`, "오늘의 이변" 절)이 붙는다. retroStyle(4) 최장 54글자
  864px(x 208..1072), y 208..224 로 날씨
  캡션(144..164)·토스트 줄(176..196) 아래다. 토스트가 두 줄로 넘어와 이 줄에 닿으면 그동안 숨는다. 실제 사례: 입장
  직후의 `ACHIEVEMENTS: ...` 두 줄 토스트가 이 줄을 덮었다. 지역에 새 할 일을 넣으면 `areaLeft` 에 한 조각을 더하고
  최장 폭을 다시 잰다.
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
  획이 16·17·18 기기픽셀로 섞였다. 대가로 화면이 한 단계까지 작아진다(맥북 91%). 폰은 한 단계가 50%라
  터치(`isTouchDevice()`, 부팅 때 한 번)는 snap 없이 FIT 그대로다. 실제 사례: 가로로 든 폰은 주소창 때문에
  높이가 360 CSS px 미만이라(iPhone 6.1" Safari 844x340, Galaxy S23 Chrome 780x304, Pixel 7 Chrome 914x355)
  snap 이 게임을 320x180 CSS(배율 0.25)로 떨어뜨려 글자가 0.6~1.1mm 였다. 지금 604x340·540x304·631x355 다.
  게임 1px 이 기기 1.27~1.42px 라 획이 1·2 기기픽셀로 섞이지만 416~460ppi 에서 0.06mm 라 안 보인다.
  `320 / devicePixelRatio` 같은 기기 픽셀 snap 은 부동소수 오차로 한 단계를 잃어(844x340 → 426x240) 쓰지 않는다.

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
- 전투 메시지 창은 대화창과 같은 기준이다(BattleScene `msgLayout`): 키보드는 bodyStyle(22)·한 줄 60글자(840px)·줄 간격 34px 에 그 폭의 상자(x 196..1084), 터치는 bodyStyle(33)·한 줄 54글자·화면 폭 상자. 전투 문구는 터치의 54글자에 맞춰 쓰고(이 문서의 "54글자"는 그 한도다) 키보드에서는 같은 문구가 더 일찍 줄바꿈되지 않는다. 실제 사례: 키보드도 33 으로 화면 폭이던 때 결산 두 줄이 화면을 꽉 채웠다. SKILL 목록의 INFO 줄도 같은 크기이고 쪽 칩은 상자 오른쪽 끝 32px 안이다.
- 전투 승리 결산은 say 한 번(2줄 x 54글자)이고, 레벨업·보물 지도·보스 줄만 따로 둔다. 전투 첫 줄은 Z 를
  기다리지 않고 메뉴와 함께 뜬다(BattleScene `type()`). 동료의 평범한 공격 줄은 읽을 시간을 위해 자동으로
  넘기지 않는다(결정). 실제 사례: 처치·골드·연승·획득·EXP·"Battle won!" 이 각각 Z 를 받아 SLIME 한 판이
  Z 8~10번이었다(지금 2~3번). 결산에 문구를 더하면 `victory()` 의 최악 길이 주석(4자리 수치·13글자
  이름)을 다시 잰다.
- 전투 줄(`say`)은 타자기(`TYPE_MS` 10ms/글자, BATTLE SPEED 로 나눔)가 끝난 뒤의 키로 넘어가고, 찍히는 중의 키는 그 줄을 바로 다
  보여 주기만 한다(늦은 PARRY·PERFECT 입력이 여기 떨어지므로 그 키로 넘기지 않는다). 그렇게 당겨 본 줄은 타이핑에 걸렸을 시간(`LINE_MIN_MS` 200ms 이상)이 지나야 넘어가고, 놓치면 안 되는 줄(`say(text, true)`: 결산·LEVEL UP·보물 지도·보스 예고·격노·첫 안내)은 `NEWS_HOLD_MS` 350ms 를 더 머문다. 끝까지 찍히게 둔 줄은 예전처럼 바로 넘어가서 읽는 사람의 시간은 그대로다. 실제 사례: 당겨 본 직후(1ms)에 넘김을 걸어서 130ms 연타에 결산 줄이 0.22초, 40ms 연타에 0.06~0.12초만 떠 있었다(지금 0.24초 이상, 소식 줄 0.65~1.2초). 타이핑·유지 중에는 힌트 줄을 비운다(그 입력은 넘기지 않으므로). 새 소식 줄은 `say` 의 둘째 인자를 준다. 일격의 줄은 영웅이 돌아온 뒤가 아니라 닿는
  순간(`onContact`)부터 찍는다. 실제 사례: PARRY·PERFECT 가 붙은 뒤 라운드당 최소 시간이 1.35~1.6초에서 1.9~2.2초가 됐고, 그 40~50% 가
  14ms/글자 타이핑이었다(지금 1.45~1.7초). 전투 흐름을 바꾸면 `/tmp/pwcheck/` 의 봇(메뉴는 즉시 FIGHT, 줄은 찍히는 즉시 넘김)으로
  기준 커밋과 라운드당 키 수·시간을 견준다. PARRY 의 멈춤·뒤로 빼기와 PERFECT 의 자세 유지(라운드당 약 0.7초)는 반응 시간과 연타
  방지 때문에 줄이지 않는다(아래 PARRY·PERFECT 항목).
- 한 턴의 한 사건은 줄 하나(키 하나)에 담는다. HOWL 과 그 물기, 지속 피해·독의 마지막 틱과 풀림, LEVEL UP 과 PERK 안내가 각각 한
  줄이고, SNATCH 골드 되찾기(`+9G BACK`), SWIFT 의 재행동(`AGAIN!`), DEFEND(`DEFEND` 팝업 뒤 0.35초), 얼어서 잃는 턴(`FROZEN` 팝업 뒤 0.45초)은 줄 없이 팝업이다. 독의 치료 안내 줄(`POISONED! HEAL or POTION cures it.`)은 한 전투에 한 번만 나오고 그 뒤 중독은 팝업과 태그뿐이다. 실제 사례: FLAME DRAKE 한 판(22라운드)이 57줄에 입력 약 110번이었고 DEFEND 의 "You brace for the blow!" 만 여덟 번이었다. 실제 사례: 이것들이 각각 제 줄과 Z 를 받아
  WOLF 의 HOWL 턴만 다른 적 턴보다 키가 하나 많았다. 새 기술·상태의 문구는 그 턴의 기존 줄에 붙일 수 있는지 먼저 본다(54글자).
- 전투 도움말(`src/ui/BattleHelp.ts`)은 메뉴가 떠 있을 때 `?`(터치는 힌트 줄의 `HELP` 탭)로 열고 아무 키·탭으로 닫는다. 전투 화면의
  요소마다 한 줄이고 이름은 화면에 보이는 그대로다(게이지의 `LIMIT`, 태그의 `CHG`·`>MOVE`). 실제 사례: 사용자가 가득 찬 LIMIT 게이지를
  보고 "이게 뭐냐"고 물었다. 첫 안내(`tip`)는 세이브당 한 번이고 놓치면 게임 안에 다시 볼 곳이 없었다. 그래서 전투에 새 요소(게이지·
  태그·타이밍 입력·라벨)를 더하면 `BattleHelp` 의 `rows()` 에 한 줄을 같이 넣는다: 이름 10글자 안, 줄 전체 60글자(bodyStyle(22)
  840px, x 220 부터) 안, 줄 간격 30px, 수치는 규칙 상수에서 읽는다. 패널은 x 24..1256·y 16..596 으로 두 상태창을 통째로 덮고(좁았을 때 창 테두리와 이름 윗부분이 둘레로 삐져나왔다), 지금 14행이 y 84..504, 닫기 안내가 560 이라 한 줄 더 들어간다.
  메뉴 버튼이 아니라 힌트 줄을 쓴 이유: 여섯째 버튼은 Lv2~4 의 한 줄 메뉴를 두 줄로 쪼갠다. 열려 있는 동안 메뉴는 숨긴다(패널
  양옆으로 메뉴 끝 글자가 삐져나왔다).
- 전투 메뉴에 버튼을 더하면 BattleScene `layoutMenu()` 위 폭 주석을 다시 잰다. 실제 사례: D:DEFEND
  하나로 두 줄 메뉴가 키보드 Lv18→Lv9 로, X:SKILL(Lv2)로 다시 Lv5(HEAL)로 당겨졌다. 전투 규칙을 바꾸면
  `scripts/sim-battle.ts` 의 같은 자리(cast·choose 등 BattleScene 을 옮긴 곳)도 고친다(실제 사례: CHAIN,
  DEFEND). 강타 예고(`BOSS_TELLS`)를 보스 아닌 몬스터에 붙일 때는 `chance` 로 확률을 낮추고, `mult` 는 지역
  입장 레벨에서 막지 않은 강타가 최대 HP 15~25% 가 되게 잰다(밤 x1.25 ATK 가 그대로 곱해진다).
- PARRY 는 BattleScene `enemyLunge` 하나에 있다: 무작위 멈춤(`PARRY_HOLD_MS`) → 뒤로 빼기(`PARRY_BACK_MS`, 큐, BATTLE
  SPEED 와 무관한 실제 ms) → 돌진, 닿는 순간에 그 사이의 첫 입력(`parryPress`, 키는 `onKey`·탭은 `onPointerDown` 의
  `parryInput`)이 마지막 `PARRY_WINDOW_MS` 안이었는지 본다. 피해는 `guardHit` 뒤에 `battleRules.parriedDamage` 를 곱하고
  독·빙결을 건너뛴다. 적의 새 공격이 몸으로 치는 것이면 `enemyLunge` 의 반환값을 받아 같은 식으로 쓰고, 숨결·원거리는
  부르지 않는다. 큐에서 타격까지는 반응 시간(200~330ms)보다 길게 둔다. 실제 사례: 뒤로 빼기 180ms 는 큐 270ms 뒤에
  닿아 큐를 보고 누르면 늦었다(지금 260ms, 큐 350ms 뒤·속도 2 에서 305ms). 멈춤의 최소값은 연타 간격(약 120ms)보다
  길게 둬 연타의 첫 입력이 늘 창보다 이르게 한다. 플레이어 실력이라 `sim-battle.ts` 에서는 성공 비율(`--parry P`)로 넣는다.
  하네스로 잴 때 `s.msgText.text` 는 PixelText 객체라 evaluate 가 멈춘다(`s.msgText.wrapped` 를 읽는다).
- CHG 뒤 강타(`bossStrike`)를 PARRY 하면 적이 비틀거려(`staggered`) 다음 턴을 잃는다. 보스도 그렇고(WEB·BOLT 의 `stuck` 은 보스에
  안 걸린다), 묶인 적처럼 머리 위 별(`showStun`)이 돌다가 잃는 턴의 줄(`MOSS GOLEM is off balance!`)에서 꺼지며, 그 턴에 예고된
  기술은 다음 턴으로 남는다. 강타 줄 끝에 ` It reels!`(최장 `CLUB SMASH! 9999 damage! (DEFEND) It reels!` 43글자)가 붙는다. 숨결
  (`BREATHS`)은 PARRY 가 안 되니 GLACIER GOLEM·FLAME DRAKE·SALAMANDER 는 비틀거리지 않는다. SWIFT 정예의 두 번째 행동도 막는다.
  묶인 적과 달리 FIGHT 가 치명타가 되지는 않는다. 실제 사례: 전에는 예고된 큰 한 방의 답이 DEFEND(x0.5·COUNTER) 하나라 PARRY 는
  x0.7 일 뿐이었다. sim(의도 레벨·의도 장비·`--perfect` 같은 값·`--limit 50`·`--perks might[,vigor]`, 8000판, 잃는 HP): KING·TROLL·
  MOSS 솔로가 `--parry 0.4` 에서 43/39/43% → 41/37/39%, 0.8 에서 39/35/40% → 35/32/34%, 승률 100% 그대로다.
- PERFECT 는 같은 입력(`timedPress`·`timedInput`)을 FIGHT 에 쓴 것이다(BattleScene `playerAttack`): 영웅이 자세를 잡은 채
  기다려(`strikeIn` 의 `hold`) FIGHT 뒤 `PERFECT_RUN_MS`(실제 ms)에 닿고, 조준 틀(`strikeCue`, 2px 격자의 모서리 꺾쇠)이 그보다
  `PERFECT_GRACE_MS` 먼저 닫힌다. 닿기 전 `PERFECT_WINDOW_MS` 안의 첫 입력이면 `battleRules.perfectDamage`. 실패는 손해가
  없어야 한다(결정). FIGHT 한 번이 평균 0.22초 길어졌으니 run 을 더 늘리지 않는다. 라벨(`timedNote`)은 맞는 쪽의 피해 숫자를
  피해 반대편 위에 둔다. 실제 사례: 영웅 머리 위의 `PARRY!` 가 피해 숫자와 겹쳐 둘 다 못 읽었다. 타이밍 입력을 다른 행동에
  더하면 `timedPress` 를 null 로 여는 곳과 닿는 순간 undefined 로 닫는 곳을 짝지어 둔다(열린 채 남으면 다음 키가 그 입력으로
  먹힌다, `init` 이 한 번 더 닫는다).
- 원소 반응(`battleRules.ts` 의 `REACTIONS`·`reactionOf`·`reactionDamage`)은 BattleScene `react(element)` 한 곳에서 난다:
  주문은 맞는 순간(`castSpell`), 스킬은 첫 타가 닿을 때(`castSkill` 의 `land`) 불러 상태를 쓰고 배율·추가 피해를 받는다. 상태
  하나에 반응 하나다(화상+얼음 MELT, 냉기+번개 SHATTER, 독+불 DETONATE). 새 반응은 그 표와 `reactionOf`, sim 의 `react`·
  `reacted`(greedy 가 반응 피해를 셈에 넣음)를 같이 고치고, 스킬 목록 INFO 줄에 뜨는 `info` 는 이름 + 9 + info 가 54글자 안인지
  잰다. 반응은 쓰는 상태가 남겼을 피해보다 손해가 아니게 한다. 실제 사례: MELT 가 x1.5 뿐일 때는 보스의 새 화상(세 틱 = 최대
  HP 15%)을 지우는 쪽이 손해였다 → 남은 틱을 같이 터뜨린다. 냉기를 거는 곳은 `chill()` 하나로 모아 SHATTER 가 깎인 ATK 를
  돌려준다(`chillLost`). sim 측정(8000판): 반응을 넣어도 보스전 잃는 HP 는 스킬 쓰는 영웅 기준 0~6%p 줄 뿐이고(MOSS 58→52,
  DRAKE 48→45, 나머지 그대로) 평균 가정은 그대로다. 반응을 노려 상태부터 거는 플레이(THORNS 뒤 FIRE)는 그냥 가장 센 기술을
  쓰는 것보다 못했다(MOSS 86% 대 58%): 발판은 동료 스킬이나 어차피 쓸 기술의 부가 효과여야 이득이다.
- 몬스터의 기술(`src/monsters.ts` 의 `move`, 규칙은 `battleRules.ts` 의 `MOVE_*`·`moveReady`)은 다음 턴에 쓸 것을 미리
  굴려(`rollIntent`: 첫 턴 전과 적 턴이 끝날 때마다) 적 창의 `>이름` 태그로 예고하고, 그 턴에 `enemyAct` 가 일반 공격 대신
  `enemyMove` 를 부른다. 묶여서(web·shock) 잃은 턴의 예고는 다음 턴까지 남는다. 새 기술은 종의 `move` 한 줄, `enemyMove` 의
  분기, `sim-battle.ts` 의 같은 분기를 같이 넣고 `--foe 종 --level 입장레벨` 로 전/후를 견준다(지금 여섯 종 모두 100% 그대로,
  받는 피해 ±3%p). 몸으로 치는 기술은 `enemyBlow(배율)` 로 쳐서 PARRY 가 그대로 되고, 막힌 일격에는 부가 효과(흡혈·훔치기)를
  붙이지 않는다. 이름은 6글자까지다: 태그 `>SNATCH` 가 태그 줄 160px(x 1072..1232) 중 140px 이고, 도감 `CAN:SNATCH` 가 10글자다. 기술이
  남기는 버프 태그(`ATK+`·`DEF+`)는 예고 태그와 같이 뜨지 않게 한다(버프 기술은 한 번만). 정예 태그도 상태 태그 목록의
  맨 끝(`updateEnemyStatus` 의 `layoutTags`)이라 위 줄 수만큼 내려가는데, 줄은 셋뿐(y 90·114·138)이고 `layoutTags` 가 태그마다 자리가 남은 첫 줄에 넣는다(짧은 태그 60·80px 둘이 한 줄). 지금 나올 수 있는 최악(GLACIER GOLEM 의 `CHG DEF+ / RAGE PSN / CHL`, `>ARMOR / DEF+ PSN / RAGE CHL`, 정예의 `>SNATCH / PSN CHL / STURDY`)은 세 줄에 들어간다(`ENEMY_STATUS_MIN_X` 위 주석). 넘치면 셋째 줄이 왼쪽으로 자라 `WEAK:FIRE`(x 996 까지, 같은 y 138)를 덮으니, 태그를 더하거나 폭을 늘리면 그 주석의 조합을 다시 센다. 실제 사례: 줄 폭 152px 에 한 줄씩 채우던 때는 GLACIER GOLEM 의 다섯 태그가 WEAK 를 덮었다. 실제 사례: WEAK 줄(y 140)에 고정돼 있던 정예 태그는 셋째 줄 태그와 겹쳤다. 강타 예고(`BOSS_TELLS`)가 있는 일반 종에는 주지 않는다(결정: 예고는 종마다
  하나). WASP·SPIDER·FROST MOTH(와 그 희귀종)의 독·빙결은 예전 `special`(예고 없이 일격에 실림) 대신 `afflict` 기술이다:
  이름이 상태 이름(`POISON`·`FREEZE`)이라 태그와 도감 CAN 줄이 같은 말을 쓰고, 걸릴 수 없을 때(`moveReady` 의 `immune`)는
  예고하지 않는다. `special` 은 강타 예고나 보스 기술이 이미 있는 YETI·MOSS GOLEM·GLACIER GOLEM 에만 남았다. 일반 전투는 약 2라운드라 적이 한두 번만 움직인다. 실제 사례: 턴을 쓰는 HOWL 은 WOLF 를 오히려 쉽게 만들어(Lv3
  받는 피해 7→4%) 같은 턴에 물게 했다.
- 보스·거인의 두 번째 패턴도 같은 `move` 다. `chance` 0 에 `at`(HP 비율 목록)을 주면 HP 가 그 선에 처음 닿을 때마다 한 번씩
  예고되고(`battleRules.moveDue`, `movesUsed`), 기 모으는 중(CHG)에는 예고하지 않고 강타 뒤로 미룬다. 보스의 기술은 그 턴의
  행동을 대신하지 않고 얹힌다(`enemyAct` 가 `move.at` 이면 이어서 평소 행동). 실제 사례: 대신하게 했더니 그 턴의 공격·강타
  예고가 사라져 보스전이 오히려 쉬워졌다(KING SLIME Lv6 솔로 잃는 HP 83→76%). `blast`(`enemyBlast`)는 돌진이 없어 PARRY 가
  없고 WARD·GUARD·DEFEND 만 통한다. `armor` 는 `turns` 뒤에 DEF 를 되돌린다. GLACIER GOLEM 의 ARMOR 는 2턴이다. 실제 사례: 3턴일 때 솔로로 가장 센 수를 고르는 영웅(`--greedy`)이 14.2라운드였다(다른 보스 6.8~8.9, 2턴에서 13.0·`--skills` 11.0). 변형별 sim 으로 가르면 ARMOR 가 2.9라운드, DEF 6 이 1.2, 빙결이 0.5 였고 나머지는 Lv18 의 HP 200 이다. 보스전 길이를 볼 때는 기본 가정(약점 주문을 FIGHT 보다 약해도 쓴다)이 아니라 `--greedy`·`--skills` 로 본다: 기본 가정의 GLACIER GOLEM 솔로 19.8라운드는 Lv18 영웅이 FIRE 를 고집한 탓이다. 수치는 `/tmp/pwcheck/moves/boss.sh` 같은 표로
  세 가정(새 요소 없음 / `--parry 0.4 --perfect 0.4 --limit 50` + 그 레벨 특성 / 0.8·100)과 대응 세 단계(`--nobrace` 아무것도
  안 막음 / 기본: CHG 만 막음 / `--brace`: blast 도 막음)를 같이 재고, 기본 가정의 솔로+의도 장비 승률 95% 이상을 지킨다(지금
  95~100%). DEFEND 는 예고된 큰 한 방(`guardHit` 의 `heavy`: CHG 강타와 blast)을 x0.5 로 받고 COUNTER(`counter()`, 턴을 안 쓰는
  `playerAttack`)로 되받는다. DEFEND 는 콤보를 끊지 않는다(`defend()` 에 `resetCombo` 없음, sim 도 같다): 끊던 때는 CHG 를 막을 때마다 그 뒤 FIGHT 가 최대 80% 를 잃어 잘 막을수록 전투가 길어졌다(솔로 KING SLIME 8.6 → 7.5 라운드, 예고를 다 막는 가정의 MOSS GOLEM 9.2 → 7.5). 실제 사례: x0.7 뿐일 때는 예고에 DEFEND 하는 쪽이 잃는 HP 가 더 많았다(KING 솔로 110% 대 85%,
  턴 하나가 일격 하나만큼 전투를 늘린다). "다음 FIGHT x2" 도 시험했지만 MP 가 있는 영웅은 주문 한 번을 포기하는 셈이라
  이득이 없었다. 새 예고 공격을 넣으면 PARRY 가 되는 일격인지(`enemyBlow`), DEFEND 로 받는 큰 한 방인지(`heavy`) 둘 중
  하나로 정한다. COUNTER 가 적을 쓰러뜨릴 수 있어 `runBattle` 은 적 턴 뒤에도 승리를 본다. 보스 기술 이름은 도감 CAN 줄에 넣지
  않는다(`CAN:REGEN,SPORES,ENRAGE` 368px 가 이름 칸을 넘는다).
- 정예(`src/elite.ts`)는 전투가 시작될 때 `BattleScene.init` 이 굴린다(`rollElite`, 필드 씬의 조우 굴림은 모른다). 수치는 `battleRules.scaleEnemy` 의 `elite` 옵션이 종의 HP·ATK·골드·EXP 에 먼저 곱하고(`eliteDef`), 그 위에 밤·HARD MODE 가 얹힌다. 이름은 바꾸지 않는다: 도감·퀘스트·드롭표·결산 줄이 모두 이름으로 종을 찾고 이름 길이로 폭을 쟀기 때문이다. 표시는 적 창 이름 색과 상태 태그 줄의 태그(6글자까지 120px, 태그 칸 x 1072..1232), 전투 첫 줄의 접두와 둘째 줄 `ELITE: <note>!`(note 13글자까지, WELL RESTED 문구와 한 줄 51글자)다. SWIFT 의 두 번째 행동은 `runBattle` 이 `enemyTurn` 을 한 번 더 부르는 것이고, 묶인 턴(`stuck`)과 방금 기를 모은 턴(`charging`)에는 없다. 새 정예는 `ELITES` 한 줄과 README 표, 수치는 `bun run sim:battle --foe <키> --elite <종류> --level <입장 레벨> --gear <무기,방어구>` 로 그 지역 입장 레벨의 SOLO+GEAR 승률·잃는 HP 를 본다(지금 값: 일반 전투의 약 3배 HP 를 잃고, 설원 입장 Lv13 의 FIERCE YETI 가 97%·최대 HP 만큼으로 가장 빡빡하다). `scaleEnemy` 를 부르는 곳(`scripts/sim-battle.ts`)도 같은 옵션을 받는다.
- LIMIT 게이지(`src/limit.ts`, `GameState.limit` 0..100, 저장됨)는 메뉴 버튼이 아니라 영웅 창의 게이지 자체가 버튼이다(L, 터치는 `LIMIT_TAP` 상자). 그래서 `layoutMenu()` 폭은 그대로다. 자리는 이름(y 68 까지)과 HP 줄(y 88 부터) 사이의 제 줄(y 70..86, retroStyle(4))로, 라벨 `LIMIT` x 64..144 · 막대 x 156..276·y 74..82(4등분 눈금) · 오른쪽 글자 x 288 부터다(차는 중 `45%`, 가득 차면 `L:BREAK!`, 터치 `TAP:BREAK!` 10글자 160px, x 448 까지, `LIMIT_TAP` 은 그 줄에 12px 여유). 실제 사례: 라벨이 막대 뒤에 있던 때는 빈 게이지가 바로 아래 `HP` 의 막대로, 바탕 없는 초록 HP 막대가 그 아래 `MP` 의 막대로 읽혔다. 그래서 영웅·적 창의 HP/MP 막대는 제 글자 바로 아래 2px(`statBar`, 글자 최대 폭 240px 의 어두운 바탕 위, 다음 줄과는 6px 이상)에 두고, 채움은 `StatusHud` 의 `barShare`(2px 격자, 0 이 아니면 한 칸 이상·가득이 아니면 한 칸 비움)로 잰다. 영웅 창의 줄은 이름 40 · LIMIT 70 · HP 88(막대 114..122) · MP 128(막대 154..162) · STREAK 170, 요리 태그 y 136 · 축복 태그 y 172 다. 충전은 피해 지점마다 훅을 두지 않고 `updateEnemyHp()`·`updatePlayerStats()` 끝의 `syncLimit()` 이 두 HP 가 지난번보다 줄어든 만큼을 센다(동료 타격·지속 피해·독 포함, 회복은 0). 그래서 HP 를 바꾸는 새 코드는 지금처럼 그 두 함수로 화면을 갱신하기만 하면 된다. PARRY 보너스만 `enemyLunge` 의 `syncLimit(LIMIT_PARRY)` 한 줄이다. LIMIT 일격(`limitBreak`)은 제 피해를 `limitSeen` 에 먼저 반영해 스스로를 채우지 않는다. 훈련장은 늘 가득이고 `GameState.limit` 을 쓰지 않는다. 수치를 바꾸면 `bun run sim:battle --foe <키> --level <입장 레벨> --gear <무기,방어구> --limit 0` 의 `L+nn`(한 판에 차는 양, 지금 22~40)과 `--boss <이름> --limit 100` 대 옵션 없는 실행의 라운드 차(지금 1.5~2.5 라운드)를 다시 본다. PARRY·PERFECT 를 쓰는 플레이어는 `--parry P --perfect P`(성공 비율, 0.4 가 평균·0.8 이 숙련 가정)로 넣고, 새 전투 요소를 더하면 보스 다섯의 의도 레벨에서 옵션 없는 실행과 `--parry 0.4 --perfect 0.4 --limit 50 --perks <그 레벨의 특성>` 을 견준다(2026-11 통합 점검: 솔로+의도 장비로 잃는 HP 가 53~104% → 31~49%, 그래서 `LIMIT_MULT` 3→2.5·`LIMIT_TAKEN` 150→120).
- 검의 성질(`battleRules.ts` 의 `WEAPON_NATURE`·`edgeOf`·`edgedDef`)은 검마다 하나고 FIGHT(`playerAttack`)와 무기 기술(`skillHit` 의 weapon 분기, `SkillTarget.edge`)에만 듣는다: HEAVY(IRON SWORD)는 적 DEF 의 절반만 만나고 KEEN(MYTHRIL SWORD)은 치명타 20% 다. QUICK(SWORD)은 그 전투의 첫 FIGHT x1.5, SEAR(DRAKE BLADE)는 적이 버틴 FIGHT 마다 15% 로 FIRE 의 화상을 건다(`spellEffectCanLand("burn")` 그대로). 이 둘은 FIGHT 에만 듣는다(`playerAttack` 의 `opened`). 실제 사례: SWORD 는 윗단보다 ATK 가 4~6 낮아 긴 전투에서 메울 성질이 없었다(콤보 보너스 x1.5 는 다섯 타에 +14%, 차이는 25%). 그래서 QUICK 은 초반 두 방짜리 전투용이다(SLIME Lv1 2.6 → 2.0 라운드). 단 사이 ATK 차가 2 라 성질 하나가 그만큼의 값이 되게 잰다: `/tmp/pwcheck/` 의 일회용 표(레벨·DEF 별 FIGHT 평균)로 "제 상황에서는 윗단을 이기고 평소에는 조금 진다"를 본다(지금 값: DEF 6 이하 KEEN 이 1.5~6 위, DEF 8 같음, DEF 12·16 HEAVY 가 2~6 위). 새 성질은 `WEAPON_NATURE` 한 줄(이름·`info`·`edge`)이고, INFO 줄(`itemInfo.ts` 의 `equipInfo`)에 `이름: info` 로 붙으니 가장 긴 줄이 55글자(bodyStyle(22) 770px, 가방·상점 패널 1160) 안인지 잰다. sim 은 `--gear` 의 무기로 같은 표를 읽는다(`Hero.edge`). 전투 화면에는 표시를 더하지 않고, 성질이 일한 순간만 기존 줄에 붙인다(`DEF+` 를 벤 FIGHT 줄 끝의 ` HEAVY!`, 50글자). 실제 사례: 무기는 검 넷이 한 줄로 선 것뿐이라 "무기 계열"은 없었다. 새 무기는 아이콘·필드 겹침·HD 격자 세 벌이 든다.
- 특성(`src/perks.ts`, `GameState.perks` 는 고른 키를 단계 순서대로 담은 배열, 저장됨·HARD MODE 유지)은 마을 ELDER 가 다른 말보다 먼저 묻는다(`TownScene.offerPerk`: 쌍 질문 → `TAKE <이름> FOR GOOD?` YES/NO. 되돌리기가 없고 대화창의 ESC 는 마지막 선택지를 고르기 때문에 한 번 더 묻는다). 터치 질문 한 줄(42글자)에 두 효과가 들어가야 해서 이름은 5글자, 효과 문구는 12글자까지다(최장 38글자). MIGHT·WALL 은 `GameState.effAtk/effDef` 안에서, VIGOR·FOCUS 는 고르는 순간 `takePerk` 가 영웅의 최대치에 더하고, 나머지는 `GameState.perk(키)`(안 골랐으면 0)를 그 수치를 쓰는 한 줄이 읽는다: `BattleScene` 의 RUN 굴림·`throwCandy`·`companionAttack`·`comboBonus()`·`syncLimit`·`limitBreak`·`victory()` 의 골드/회복/MP/EXP. 새 단계나 특성은 `PERK_TIERS`·`PERKS`, 읽는 곳 한 줄, README 표, `scripts/sim-battle.ts` 의 `--perks`(MIGHT·WALL·VIGOR·FOCUS·FLOW·SURGE·BREAK·PACK 만 반영)를 같이 고친다. 안내는 LEVEL UP 줄 끝의 `PERK: see the ELDER!`(`perkOpened`, 제 줄이 아니다), 마을 토스트(단계마다 한 번), 퀘스트 일지 제목 아래 줄(일곱 개 46글자 736px)이다.
- 새 전투 요소의 업적 집계는 `GameState.feats`(`src/feats.ts`, 저장됨·HARD MODE 유지) 한 객체에 모은다: PARRY 횟수는 `BattleScene.syncLimit` 이 bonus 를 받을 때(PARRY 뿐이라 `enemyLunge` 에 줄을 더하지 않았다), 정예 종류와 LIMIT 마무리는 `victory()` 의 `noteWin` 한 줄, 유물 최다·저주 상자는 `AbyssScene` 에서 센다. 제단(PILGRIM)과 특성(WELL ROUNDED)은 이미 저장된 `shrineDays` 의 키 수와 `perks` 길이를 읽어 훅이 없다. 새 집계는 `Feats`·`noFeats`·`loadFeats` 세 곳에 더한다. 외형 문턱 `LOOK_MILESTONES` 의 마지막은 "전체"가 아니라 38 로 고정이다(업적을 늘려도 GOLD 를 연 세이브가 잠기지 않게). 업적을 더하면 이름 15글자·설명 34글자 안인지(`AchievementsUI` 의 `TEXT_W`, 넘으면 패널이 넓어져 터치 메뉴 열에 닿는다)와 쪽 수(14개씩)를 본다. 전투의 첫 안내(`BattleScene.tip`: PARRY 는 첫 적 턴 앞, LIMIT 은 가득 찬 게이지로 처음 메뉴가 뜨기 직전, CHG 는 CHG 가 걸린 뒤 처음 메뉴가 뜨기 직전, PERFECT 는 PARRY 안내를 본 뒤의 전투 중 다른 안내가 아직 없는 전투의 첫 메뉴 직전)는 `GameState.seenTips` 에 id(`parry`·`limit`·`intent`·`react`·`charge`·`perfect`)를 같이 적어 세이브당 한 번이고, 문구는 한 줄 54글자 안이다. CHG 안내는 숨결(`BREATHS`: GLACIER GOLEM·FLAME DRAKE·SALAMANDER)이면 PARRY 를 말하지 않는다(`TIP: CHG: DEFEND halves the breath and hits back.` 49글자, 몸으로 치면 `TIP: CHG: DEFEND halves it; PARRY it and it reels.` 50글자). PERFECT 안내를 PARRY 와 다른 전투로 미룬 이유: 첫 전투는 이미 PARRY 와(대개) 적의 `>기술` 안내로 두 번 멈춘다. 그래서 둘째 전투 첫 메뉴 앞이 되는 일이 많고, 그때까지 `ANY KEY:PERFECT` 힌트를 몇 번 본 뒤라 전투 도움말과 같은 말("frame shuts gold")로 설명한다(키보드 52·터치 51글자). 실제 사례: CHG 강타 예고·DEFEND 의 COUNTER·PARRY 한 강타의 `It reels!` 와 `ANY KEY:PERFECT` 는 안내 없이 처음 나왔다.
- 전투 화면에는 `TouchControls` 가 없다(메뉴를 바로 탭한다). 그래서 전투에서 키(ESC 등)에만
  묶인 동작은 탭 경로를 함께 만든다. 실제 사례: 아이템 목록을 닫는 길이 ESC 뿐이라 터치에서는
  아이템을 쓰지 않고는 나올 수 없었고, 재고가 0 이면 전투가 멈췄다 → 지금은 목록 밖을 탭하면
  메뉴로 돌아간다(`BattleScene` 의 `closeItems`).
- 심연 유물(`src/relics.ts`)은 다이브 동안만 메모리에 있고 저장하지 않는다. `AbyssScene` 이 새 다이브를 만들 때 `resetRelics()` 하고, 제안(`run.offer`, 시작할 때와 계단 `RELIC_EVERY` 번마다)은 update() 에서 대화창 질문 하나로 묻는다. 터치 질문은 선택지 둘·본문 한 줄(42글자)이라 유물 이름은 5글자, 효과 문구는 11글자까지다(`"이름: 효과. 이름: 효과."` 최장 39글자). 전투는 `BattleScene` 의 네 곳(init 의 `openRelicBout`, `heroAtk`·`heroDef` 의 `relicAtk`·`relicDef`, `victory()` 의 `relicWinHeal`)만 읽고, 넷 다 `this.abyss` 가 없으면 중립이라 패배·타이틀로 끝난 다이브의 유물이 마을 전투에 닿지 않는다. 새 유물은 `RELICS` 에 한 줄과 그 값을 읽는 곳, README 의 유물 표를 같이 넣고, HUD 줄(`RELIC_TAG_*`, 모두 최대일 때 67글자 1072px)의 폭 주석을 다시 잰다. `scripts/sim-battle.ts` 에는 유물이 없다. 저주받은 상자(`abyss.ts` 의 `CURSED_CHANCE`·`CURSED_DEPTH`, `AbyssBout.cursed`)의 전투는 `battleRules.scaleEnemy` 가 `boutDepth` 로 8층 깊게(최소 `CURSED_MIN_DEPTH` B13, 적도 그 층 명단에서) 재고, 전투 라벨·드롭 배수는 실제 층 그대로다. 승패는 GUARDIAN 처럼 `GameState.battles` 가 늘었는지로 보고, 포획은 그 수를 올리지 않아 `GameState.caught.length` 도 같이 본다.
- 마을 TRAINING YARD(ARENA 관리인의 TRAIN, `src/practice.ts`)는 `Battle { practice }` 로 시작한다. HP/MP 는 매 프레임 채우고(`refillHero`), 적이 쓰러지면 `practiceVictory` 가 보상·집계 없이 `scene.restart` 로 무작위(`randomStep`, 방금 그 적은 빼고) 다른 적을 넣는다. 적 HP 는 `practiceHp`(원래의 10배와 영웅 공격력 x25 중 큰 쪽, 네 자리까지)이고 도감(`seenMonsters`)에는 올리지 않는다. 메뉴 C:FOE(`practiceFoe`, S:STEAL 자리, 스펠 첫 글자 F/H/I/B/W/N 과 안 겹침)가 원하는 적을 고르게 명단(`practiceEnemy`, 보스·거인 뺀 순서)의 다음 적으로 바꾸고, ESC:EXIT(`exitPractice`)만 끝낸다. 들어갈 때의 HP/MP·가방을 `endPracticeRun` 이 돌려놓아 힐·소모·비축에 못 쓴다. 식사 충전·휴식 효과·잡기·훔치기·밤 안내는 꺼진다. 새 전투 보상·집계를 `victory()` 에 더하면 `practice` 가 그 앞에서 빠지는지 본다. 관리인 첫 질문은 `ARENA`/`TRAIN` 둘이고 ESC 는 `escPick` 2 로 떠난다.
- 전투 SKILL 목록 안에서 X 를 한 번 더 누르면 Z 처럼 커서의 기술을 쓴다(`X X`). 목록이 마지막에 쓴 기술에서 열려서
  같은 기술의 반복이 두 번 누름이다. 키 안내는 `Z/X:OK` 다.
- 전투 SKILL 목록(X:SKILL, 첫 기술을 배우는 Lv2 부터)은 배우는 순서대로 3열 x 4행, 한 쪽 12개다(26개면 3쪽).
  4열은 긴 이름(DAGGER FLURRY 13글자, 12글자 넷)이 커서 넷과 1320px 라 화면에 안 들어가고, 4행이 자리
  전부다(BattleScene `SKILLS_PER_ROW` 위 주석). 그 4행이 y 474..598 을 다 써서, 목록이 열린 동안 커서 기술의
  `이름  MP  설명`(INFO, 메시지 창과 같은 크기, 54글자, `battleRules.ts` 의 `MoveBase.info`)과 키 안내는 메시지 창
  안(1행 `SKILL_INFO_Y`, 2행 `SKILL_HINT_Y`)에 놓이고 전투 줄은 숨는다. 아이템 목록(E:ITEM)도 같은 자리에 커서
  아이템의 `이름: 설명`(`itemInfo.ts` 의 `ITEM_INFO`, 최장 CANDY 40글자: 키보드 60글자 줄의 560px, 터치 54글자 줄의
  840px)과 키 안내를 둔다. 실제 사례: 아이템 설명은 목록 아래 전투 배경 위에 전투에서 가장 작은 retroStyle(4)로
  있었고, 그 아래 메시지 창에는 지난 줄(`ORC blocks your way!`)이 그대로 떠 있었다. 줄 끝의 H/L 이 쪽을 넘기고, 터치는 키
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

## 기습 (FIRST STRIKE, `sceneCommon` 의 `firstStrike`)

로머와 어떻게 만났는지가 전투의 첫 일격을 정한다. 판정은 `sceneCommon` 의 `firstStrike(walk, roamer)` 한 곳이고, 다섯 씬(마을·
동굴·숲·설원·화산)의 로머 overlap 이 그 결과를 `startBattle(..., opening)` → Battle data 의 `opening: "hero" | "foe"` 로 넘긴다.

- `"hero"`(AMBUSH!): 영웅이 로머를 보고 있고(보는 방향과 로머 방향의 cos 0.5 이상) 로머가 영웅에게서 멀어지는 쪽으로 걷는
  중이거나, 서 있으면 마지막으로 걸은 방향(`Roamer` 의 `headX/headY`)이 그쪽이다(그 방향과 영웅→로머 방향의 cos 0.5 이상). 전투가 영웅의 FIGHT 한 번으로 시작한다(평소 FIGHT 그대로라 PERFECT 도 된다).
- `"foe"`(OFF GUARD!): 영웅이 로머에게 등을 보인 채 닿음(보는 방향 cos −0.5 이하. 서 있든 걸어가든 마지막으로 걸은 방향).
  적이 평범한 일격 한 번으로 시작한다(`enemyBlow`, PARRY 가능, 기술·기 모으기·독 없음).
- 그 밖(정면, 옆, 아직 한 걸음도 안 걸은 로머)은 평소대로. 보스·거인 로머, 풀밭 무작위 조우, 봉인 강적, 둥지는 기습이
  없다(걸어가 만나는 것이 아니거나 `firstStrike` 가 null). 압도(`meetFoe`)가 먼저라 필드에서 쓰러지는 적은 기습도 없다.
- 달아나던 러너(`!` 뒤)에 닿으면 늘 AMBUSH 다(`Runner.ts` 가 `caught(this.alarmed)` 를 주고 씬이 `startBattle(희귀종, undefined,
  "hero")`). 추격의 끝이 무료 일격이다. 눈치채기 전에 닿으면 평소대로. 희귀종 HP(38·48·75·112)는 입장 레벨 FIGHT(약
  10·13·20·28)의 네 배쯤이라 일격은 HP 의 1/4 을 깎을 뿐 전투를 대신하지 않는다.
- 로머에는 그려진 방향이 없다(정면 그림이 대부분이고 flipX 는 안 보인다). 그래서 로머의 "등"은 걷는(서 있으면 마지막으로
  걸은) 방향의 반대쪽이고, 플레이어가 읽는 것은 "나에게서 멀어지는 중" 또는 "등을 돌린 채 멈췄다"이다. 로머에 방향 그림을
  넣게 되면 이 판정을 그 방향으로 바꾼다. 실제 사례: 걷는 중만 셀 때는 사람처럼 걸어가는 봇의 AMBUSH 가 6%(136판)였다. 로머는
  1~2초 걷고 0.5~1.4초 서 있어 영웅은 대개 서 있는 로머에 닿았다. 지금은 같은 접촉 120번(숲·동굴·설원 40번씩, 가장 가까운 로머로 곧장 걷는 봇)에서 12번(10%) → 23번
  (19%)이다. 가장 가까운 로머는 대개 영웅 쪽으로 오던 것이라, 등 뒤를 노려 도는 플레이어는 더 자주 낸다.
- BattleScene 은 `opening` 필드·init 한 줄·`runBattle` 의 인트로 앞 블록·`openingBlow()` 뿐이다. 일격이 끝난 뒤 평소 첫 줄
  (`X blocks your way!`, 정예 줄 포함)이 메뉴와 함께 뜨므로 첫 줄 폭 계산은 그대로다. 말은 `flashStatus` 로 두 전투원
  사이 가운데, 타이밍 라벨(`timedNote`, y 306)보다 한 줄 위(`OPENING_WORD_Y` 246, 크기 8)에 뜬다. 실제 사례: 맞은 쪽 머리 위에
  두던 때는 그 일격의 피해 숫자(머리 위 80px·오른쪽 40px)와 겹쳐 `AMBUSH!` 위에 `7` 이 얹혀 `AMBU7H!` 로 읽혔다. 지금
  `AMBUSH!`(x 528..752)·`OFF GUARD!`(480..800)는 적의 숫자(크리티컬 `516!` 이 x 888 부터)·영웅의 숫자(472 까지)와 가로로
  떨어지고, 같은 열의 PERFECT!/PARRY! 는 일격이 닿을 때(0.34초 이후) 떠서 같은 속도로 오르므로 이 말이 사라진 뒤에야 그 줄에
  닿는다. 아레나·심연·훈련장은 `opening` 을 넘기지 않는다.
- 수치(일회용 래퍼: 적 HP 에서 평균 FIGHT 를 뺀 뒤 sim, 입장 레벨·의도 장비·WOLF·포션 0): 영웅의 기습은 라운드 −0.7~−1.1,
  잃는 HP −3~−4%p(GOBLIN Lv3 1.9→1.0 라운드·4→0%, ORC Lv8 2.8→2.1·9→6%, YETI Lv13 2.8→2.1·10→7%, SALAMANDER Lv19
  2.2→1.1·3→0%). 등을 잡히면 일격 하나, 최대 HP 의 6~7% 를 더 잃는다(평범한 전투 한 판의 손실과 비슷). 승률은 모두 100% 그대로.
  실측(동굴 BAT, Z 연타): 첫 메뉴까지 평소 0.50초, AMBUSH 0.67초, OFF GUARD 0.87초.
- 전투 도움말(`ui/BattleHelp.ts`)의 `AMBUSH!` 행이 둘을 한 줄로 설명한다(`Its back: a free FIGHT. OFF GUARD!: it hits first.`, 이름 칸 포함 60글자, 그 표의 한도 60). 실제 사례: `OFF GUARD!: yours.` 는 누구의 일격인지 모호했다.
- `sim-battle.ts` 에는 기습이 없다. FIGHT·적 일격의 규칙을 바꾸면 위 표를 다시 잰다.

## 오늘의 이변 (`src/omen.ts`)

날마다(econDay 해시) 열린 필드 한 곳에 조건 하나가 걸린다. 어느 필드·어느 이변인지는 날짜와 열린 지역만으로 정해져
(`omenOn(day, quest)`) 저장하는 것이 없다. 영웅이 필드에 들어설 때 그날의 이변을 붙잡아(`enterField`, 상인처럼 들어선 날로
고정: 필드 안에서 자정이 지나도 나갔다 올 때까지 그대로) 마을에 돌아오면 푼다(`leaveFields`).

- 지금 넷: GOLD RUSH(그 필드 전투 골드 +30%, `OMEN_GOLD`), WILD HUNT(그 필드 일반 전투의 정예 확률 3배, 8→24%,
  `OMEN_ELITE_MULT`), CALM DAY(그 필드의 무작위 조우 절반 `OMEN_CALM_FIGHTS`, 입장 때 러너 30% `OMEN_CALM_RUNNER`, 별 조각 기척 6→9타일 `OMEN_CALM_SHARD_REACH`), HOLY DAY(그
  필드 제단 요금 절반, 올림). 이변은 날마다 있고 네 종류·열린 지역에 고르게 나온다(4000일 표본에서 16조합이 229~273일씩).
- CALM DAY 는 걸어서 하는 일(별 조각·봉인 발판·보물 지도·러너)의 날이다. 무작위 조우만 줄고(네 씬 `checkEncounter` 의
  `omenFightRate()`) 구역의 로머는 그대로다. 러너 도착은 과제의 50%(`RUNNER_WANTED_CHANCE`)와 큰 쪽을 쓴다(`Runner.roll` 의
  `Math.max`: 러너가 있을 이유가 둘이지 러너가 둘은 아니다). 사냥만 하는 영웅에게는 그 필드 골드가 절반인 날이다.
- HOLY DAY 는 요금만이고 하루 한 번은 그대로다(`shrine.ts` 의 `shrineCost(region, holy)`·`pray(..., holy)`, `ui/Shrine.ts` 가
  `omenHere() === "holy"` 를 넘김). 대화 첫 줄이 `HOLY DAY: once a day, 100 G (half) blesses 6 battles.` 로 바뀐다("필드 제단"
  절의 첫 쪽 항목). 15~100G 를 아끼는 정도라 벌이 영향은 없고, 바운티 SHRINE PRAYER 를 반값에 채운다.
- 훅은 셋뿐이고 BattleScene·필드 씬·TownScene 에는 없다:
  - 들어서기: `sceneCommon` 의 `fadeAreaTitle(scene, title, region)` 이 `enterField` 를 부르고 토스트(`GOLD RUSH: FIGHTS HERE PAY
    30% MORE GOLD TODAY!` 46글자)를 낸다. 제목과 같은 조건(입장 때만)이라 전투에서 돌아와도 붙잡은 이변이 그대로다.
  - 마을: `FieldToasts` 가 `tip: "town"` 으로 만들어질 때 `leaveFields`, update 에서 그날 한 번(세션 변수 `omenToldDay`)
    `TODAY: GOLD RUSH OVER THE VOLCANO!` 를 낸다(해금 팁이 나온 claim 은 다음으로 미룸).
  - 마을 토스트는 토스트 줄이 비었을 때만 낸다(대기 줄은 셋까지라 소식이 몰린 날 하나를 밀어낼 수 있다). 실측: 해금 팁 여섯과
    업적이 한꺼번에 뜬 마을 진입에서 여덟 줄 뒤 10.4초에 떴고 빠진 줄은 없었다.
  - 효과: 골드는 `payout.ts` `settleWin` 의 `mealGold` 합에 `omenGold()`(요리·축복·TRADE 와 더해짐, 재대결·심연 제외, 압도의
    몫에도 같이), 정예는 `sceneCommon` `meetFoe` 맨 앞의 추가 굴림(`omenEliteExtra()`, `rollElite` 의 규칙 그대로: 희귀종·보스·
    5승 전은 안 됨. 걸리면 그 정예로 바로 전투, 정예는 원래 압도되지 않는다).
- 다른 기능과의 관계: 압도는 GOLD RUSH 의 +30% 를 몫(x0.8)과 함께 받고, WILD HUNT 의 추가 굴림은 압도 판정보다 먼저다.
  기습은 그대로(정예 여부와 무관). 둥지·봉인 강적은 `meetFoe` 를 안 거쳐 WILD HUNT 와 무관하지만 필드 전투라 GOLD RUSH 의
  +30% 는 그 전투 골드에 붙는다(둥지의 purse·봉인의 골드는 `settleWin` 밖이라 그대로). 러너는 희귀종이라 정예가 안 되고 골드는
  +30%. 풀밭 무작위 조우와 로머 접촉은 둘 다 `startBattle` → `meetFoe` 라 같이 적용된다. 아레나·심연·훈련장·마을은 무관.
- 벌이: GOLD RUSH 는 그 필드 그날 사냥 골드의 +30%. 이틀에 하루 꼴이라 일지를 따라 그 필드만 도는 영웅은 길게 봐 +15%
  쯤이다. WILD HUNT 는 정예가 x2.5 를 줘 사냥의 골드·EXP 가 +12% 에서 +36% 로(대신 전투가 길고 아프다). 수치를 바꾸면 이
  줄과 README 를 고친다.
- 알리는 곳: 퀘스트 일지 왼쪽 위 둘째 줄 `GOLD: VOLCANO`(태그 GOLD·WILD·CALM·HOLY 4글자 + 지역 7글자 = 13글자 208px, x 84..292, y 36..52.
  상인 줄 y 10..26 아래, perks 줄 66..82 위. 제목 `QUEST JOURNAL` 은 x 432..848 이고 회차의 `HARD n` 은 제목 뒤 작은 태그(x 864~)라 왼쪽 줄과 140px 떨어진다), 지역 제목 아래 줄 맨 앞의 이름, 위 두 토스트. 새 이변은 이름 9글자·태그
  4글자·토스트 문구(`<이름>: <says>!` 52글자) 한도를 지킨다.
- 새 이변을 넣으면 `OmenKind`·`OMENS` 와 읽는 곳 한 줄(`omenHere()` 또는 전용 getter)을 넣는다. 종류 수가 바뀌면 날짜별
  배정이 통째로 바뀐다(저장하지 않으니 문제는 없다).

## 필드 제단 (`src/shrine.ts`, `src/ui/Shrine.ts`)

동굴·숲·설원·화산에 하나씩 있는 제단은 Z 로 골드를 바치고 두 축복 중 하나를 다음 `BLESSING_BATTLES`(6)전투 동안
받는 곳이다. 규칙·수치는 `shrine.ts`(`BLESSINGS`·`SHRINES`, Phaser 없음), 돌·이름표·대화는 `ui/Shrine.ts`, 자리는
`levels.ts` 의 `*_SHRINE_POS` 다. 축복은 요리(`cooking.ts`)와 같은 방식으로 센다: 전투가 시작될 때 한 번
(`takeBlessingCharge`, 연습 제외), 한 번에 하나, 요리와 겹친다(ATK·DEF 는 곱하고 골드·EXP 는 더한다). 제단마다 `econDay` 하루 한 번
(`GameState.shrineDays`)이다.

- 전투에서 돌아온 뒤 1.2초(`sceneCommon` 의 `justBackFromFight`, `takeFightSpot` 이 시각을 적음) 동안은 제단·봉인 돌·상인·
  둥지의 대화(`tryPray`·`tryTalk`)가 열리지 않는다. 실제 사례: 결산을 넘기던 Z 가 한 번 더 눌려 옆의 돌 대화가 바로 열리고
  강적 보상 토스트가 그 뒤로 밀렸다. Z 로 여는 새 필드 지점도 여는 함수 맨 앞에서 이것을 본다(둥지의 연전 질문은 Z 가
  아니라 그대로 뜬다).
- 새 필드 씬에 넣을 때: 대화창을 만든 뒤 `new Shrine(this, region, pos, this.player, this.dialogue, { ownKey: true,
  blocked: () => this.quitting || this.fieldKeys.leaving() || this.uiBlocking(), prayed: () => this.holdFights() })`.
  씬이 Z 를 직접 받으면(설원) `ownKey` 없이 만들고 그 Z 처리에서 `tryDig()` 다음에 `tryPray()` 를 부른다. 미니맵 표식,
  `treasure.ts` 의 `keep`(보물 지도 X 가 2칸 안에 오지 않게), `addCritters` 의 `avoid` 도 같이 넣는다.
- 터치 질문은 선택지 둘까지라 축복은 제단마다 둘이고, 고른 뒤 YES/NO 로 한 번 더 묻는다. 첫 질문의 ESC 는
  `escPick` 2(선택지 밖)로 그냥 떠난다. N 은 둘째 축복이지만 다음이 YES/NO 라 안전하다.
- `ownKey` 의 Z 는 keydown 에서 `blocked()` 가 아닐 때만 담고 POST_UPDATE 에서 연다. 실제로 생길 뻔한 일: 대화를
  닫는 Z 가 같은 프레임 끝에 제단 대화를 다시 열고, 리스너에서 바로 열면 대화창이 같은 Z 로 첫 쪽 타이핑을 건너뛴다.
- 제단을 옮기면 터치 원판과 겹치는지 화면 좌표로 계산한다("필드 씬 입력"의 모서리 규칙). 실제 사례: 숲 (22,15)·설원
  (20,14)은 카메라가 모서리에 붙을 때 돌이 Z·ESC 원판 밑에, 동굴 (22,6)은 이름표가 오른쪽 MENU 줄 밑에 들어가 각각
  (20,15)·(17,14)·(1,8)로 옮겼다. 동굴 (1,8)은 곁에 선 영웅에게는 안 걸렸지만 입장 화면(카메라가 맵 맨 위)에서 돌과
  이름표가 D-pad 밑에 깔려(영웅이 설 수 있는 247칸 중 41칸에서) 다시 (14,9)로 옮겼다(어느 칸에서도 안 걸림). 모서리만
  보지 말고 영웅이 설 수 있는 모든 칸의 카메라 자리로 센다: 일회용 스크립트가 칸마다 카메라 스크롤(가로 0..맵−1280, 세로
  −88..맵−720+터치 발)을 구해 돌·이름표·발판·상인 사각형을 D-pad·Z·ESC·MENU 원판과 견준다. 우선순위는 (1) 대화 반경 안의
  영웅(지금 네 지역의 제단·봉인 돌·발판·상인 모두 0칸), (2) 입장 화면, (3) 멀리서 원판 밑으로 지나가는 칸 수다. (3)은
  남쪽 구석의 숲·설원·화산 제단(344칸 중 80, 267칸 중 63, 256칸 중 70)처럼 길에서 떨어진 자리를 고르면 남는다: 0칸인
  자리는 입구 둘레 위쪽 띠뿐이라 그대로 둔다(결정). 하네스 `audit()` 의 `touch` 는 화면 고정 글자만 원판과 견주고 맵
  이름표는 `touchMap`(그 순간의 카메라 자리)이 본다. 돌 같은 그림은 어느 쪽도 안 본다. 몬스터 구역에서 한 타일 넘게, 상자에서 3칸 이상 떨어진 열린 바닥에 둔다(돌은 몸이
  있어 길을 막는다).
- 돌은 48칸 격자(96px, `props.ts` 의 `SHRINE_TILE`, 룬이 꺼진 `shrine-spent` 는 같은 격자의 다른 팔레트)라 영웅보다
  머리 하나 크다. 실제 사례: 32칸(64px)일 때는 앞에 선 영웅이 돌을 거의 다 가렸다. 영웅이 돌 뒤(위쪽)에 있으면 돌의
  깊이를 10.4 로 올려 영웅을 가린다(평소 9).
- 첫 쪽은 `Once a day: 200 G blesses 6 battles.`(36글자까지)로 하루 한 번임을 먼저 말하고(기도한 뒤 다시 눌러 봐야 알던
  것), 줄마다 제 줄에서 시작해 축복 하나가 두 줄로 갈리지 않는다. 터치(42글자)는 첫 줄·축복·축복 세 줄에 질문이 다음 쪽,
  키보드(54글자)는 두 축복을 한 줄(43글자까지)에 넣어 첫 줄·축복 쌍·질문 세 줄이다(선택지가 붙는 쪽은 세 줄까지). HOLY DAY
  에는 첫 줄이 `HOLY DAY: once a day, 100 G (half) blesses 6 battles.`(53글자)로 바뀌어 키보드 한 줄, 터치 두 줄(모두 네 줄)이다.
  실제 사례: 한 문단으로 이어 쓰던 때 터치에서 동굴·설원의 쌍이 `GREED:` / `GOLD +50%.` 로 갈렸고, 42글자 꼭 맞는 줄은
  다음 줄로 넘어갔다(대화창은 줄 끝 공백까지 센다: 한 줄은 폭보다 한 글자 짧게). 값이나 문구를 바꾸면 네 지역 다 평소·HOLY
  를 터치와 키보드로 다시 본다.
- 축복을 더하거나 수치를 바꾸면: 이름은 5글자까지(선택지·HUD·전투 창 태그 `STONE 6` 140px), `info` 는 24글자까지,
  README 의 제단 표를 같은 커밋에서 고친다. 효과를 새로 만들면 `BlessingEffect` 와 BattleScene 의 훅(`this.blessing`:
  `heroAtk`·`heroDef`, `victory()` 의 골드·EXP)을 같이 본다. HUD 2행은 요리·축복 태그가 EXP 막대 오른쪽 끝을
  나눠 쓴다(`StatusHud` 의 `expBarW`, 둘 다 있으면 막대 424px). `scripts/sim-battle.ts` 에는 축복이 없다.
- GREED 는 그 전투의 골드(연승 보너스 포함, PUMPKIN PIE 와 더해짐)에만 걸리고 재대결·아레나 상금에는 안 걸린다.
  싼 동굴 제단의 GREED 를 화산에서 쓰면 남는다(하루 한 번 약 +165G, `shrine.ts` 머리 주석). 일부러 둔 것이다(결정:
  돌아다닐 이유).

## 도망치는 희귀 몬스터 (`src/ui/Runner.ts`)

동굴·숲·설원·화산을 만들 때(`create`) `FieldRunner.roll` 이 들어설 때 `RUNNER_ARRIVAL_CHANCE`(12%), 전투에서 돌아올 때 `RUNNER_FIELDS[지역].back` 으로 그
지역의 희귀 몬스터를 구역 밖 열린 칸에 세운다. `NOTICE`(3타일) 안에 영웅이 오면 `!` 를 띄우고 `FLEE_MS`(10초) 동안
달아나다 사라진다. 닿으면 씬의 `startBattle(희귀 몬스터)` 다. 저장하는 상태는 없다(전투 뒤 씬이 다시 만들어지며 사라진다).

- 길 찾기는 없다. 영웅이 걷는 격자(`isWalkableCell`)에서 영웅과 가장 먼 이웃 칸으로 한 칸씩 간다. 막다른 곳을 몰라서
  몰아넣을 수 있고, 그게 잡는 방법이다. 제단처럼 타일이 아닌 벽은 `walls`, 출구는 `exits` 로 넘긴다.
- 달리는 속도(`RUNNER_FIELDS[지역].speed`, 290, 화산 320)는 영웅의 가로·세로 속도(240)보다 빠르고 대각선(339)보다 느리다. 실제 사례: 곧장 따라가기만 하는
  봇이 200~270 에서는 `!` 뒤 1.2~4.4초에 전부 잡았고(쫓을 것이 없음), 310 에서는 9번 중 4번, 290 에서는 11번 중 6번
  잡았다. 영웅 속도(`sceneCommon` 의 `WALK_SPEED`)를 바꾸면 다시 잰다. 칸에 닿은 프레임에 서지 않고 바로 다음 칸으로
  출발한다(한 프레임씩 서면 속도의 1/15 을 잃었다).
- 쫓는 동안(`fleeing()`) 씬의 `checkEncounter` 는 무작위 조우를 굴리지 않는다. 구역의 로머는 그대로라 닿으면 그 전투가
  시작되고 러너는 사라진다(결정: 지름길의 위험).
- 새 필드 씬에 넣을 때: `spawnMonsters()` 뒤에 `this.runner = FieldRunner.roll(this, this.player, level, 텍스처, { region, back,
  walls, exits, zones, paused, caught })`, `checkEncounter` 의 `if (!moving) return;` 뒤에 `if (this.runner?.fleeing())
  return;`. `paused` 는 `uiBlocking() || quitting || fieldKeys.leaving()`, `caught` 는 `() => { this.encounterCooldown = 0; return
  this.startBattle(희귀 몬스터); }` 다(닿으면 유예와 상관없이 전투가 난다. 나가는 중이면 `startBattle` 이 false 를
  돌려주고 러너는 세지 않는다).
- 빈도와 벌이는 지역마다 맞춘다: 러너를 다 잡아도 그 지역 사냥 골드(연승 보너스 없이 시간당 약 132전투)의 15% 쯤,
  절반 잡으면 7~8% 가 되게 `back` 을 둔다(동굴 0.8%·숲 1.8%·설원 1.3%·화산 1.5%, 계산표는 `Runner.ts` 머리 주석,
  밸런스 sim 은 안 돌림). 실제 사례: 모든 지역 2.5% 일 때 동굴은 37%, GILDED IMP 가 792G 일 때 화산은 30% 였다.
  희귀 몬스터의 골드나 지역 몬스터 골드를 바꾸면 이 표를 다시 계산한다.
- 화산은 용암 때문에 달아날 길이 적어 290 에서 직진 봇이 12번 중 11번 잡았다. 320 에서 9번 중 6번이라 화산만 320 이다.
- 화산의 GILDED IMP(`src/monsters.ts` 의 `gildedImp`)는 러너로만 만난다(구역 로머·무작위 조우에 없음). FIRE IMP 격자에
  팔레트만 다른 리스킨이라 외곽선 `K` 는 FIRE IMP 와 같은 값이다. 불 종 목록(`battleRules.ts` 의 `BURN_PROOF`,
  BattleScene 의 `BURNAWAY_KIN`)에도 들어 있다. 새 희귀 몬스터를 넣으면 이 두 목록 같은 종별 목록과 `drops.ts`,
  HD 굽기(`hdMonsters.ts`)를 같이 본다.
- 서 있는 동안에는 몬스터 구역(한 타일 여유)에 들어가지 않는다. 실제 사례: 화산 러너가 다리를 건너 FLAME DRAKE 의
  분화구 안에서 어슬렁거렸다. 달아날 때는 어디든 간다(분화구 포함).

## 별 조각 (`src/shards.ts`, `src/ui/StarShards.ts`)

동굴·숲·설원·화산에 3개씩 놓인 수집물이다. 칸은 `shards.ts` 의 `SHARD_CELLS`, 주운 것은 `GameState.shards`(id 목록,
옛 세이브는 빈 목록)다. 영웅이 `SEEN`(3타일) 안에 와야 보이고 칸을 밟으면 줍는다(Z 없음). 보상은 `takeShard` 가 준다: 한 지역의 셋째에서
최대 HP +5·그 지역 소재 2개·CANDY 1개, 열두째에서 ATK +2·DEF +2(STARFALL). 능력치는 `player` 에 바로 더해 영구이고,
HARD MODE 에서 조각은 `reset()` 으로 다시 놓인다.

- 칸을 옮기거나 지역 맵을 고치면 걸을 수 있고 입구에서 닿는지, 몬스터 구역에서 한 타일 넘게, 입구·상자·제단에서
  180px 넘게 떨어졌는지 다시 본다(`/tmp/pwcheck/` 의 일회용 스크립트로 `build*()` 격자를 BFS). 실제 사례: 처음 고른
  설원 (1,6)은 상자에서 두 칸, 화산 (22,11)은 상자에서 143px 이었다. 필드 맵은 F2 편집기로 못 고쳐서(마을만) 보물
  지도 같은 옮기기 처리는 없다. 마을에 조각을 두게 되면 그 처리(`resettleTreasureMaps` 방식)가 필요하다.
- 조각은 영웅이 3타일 안에 있을 때만 보이므로, 그 범위의 모든 칸에서 조각이 터치 원판(0.5 알파) 밑에 들어가지 않는
  칸에 둔다("필드 제단" 절의 계산). 실제 사례: 숲 (1,16)·(24,16)과 설원 (1,14)는 보이는 모든 칸에서 D-pad·Z 밑이라
  거의 안 보여 (1,14)·(24,13)·(5,14)로 옮겼다. 맵 아래 두 줄의 양쪽 구석이 그 자리다(동굴·화산은 터치 카메라가 두 타일
  더 내려가 괜찮다). id 는 칸이 아니라 순번(`forest-1`)이라 이미 주운 세이브는 그대로다.
- 미니맵 표식·이름표는 일부러 없다(찾는 재미). 늘 보이게 한 적이 있는데(커밋 하나 동안) 구석에 있어 맵 건너편에서도
  보여 찾을 것이 없었다. 그래서 가까이서만 보이고(그 조금 밖에서는 방향만 알려 주는 기척, 아래), 어느 지역에 몇 개 남았는지는 그 지역 제목 아래 줄이 알려 준다(일지는 합계만). 설원은 옅은 조각이
  눈 위에서 테두리만 보여, 같은 격자의 짙은 파랑 팔레트(`star-shard-snow`)를 쓴다. 겨울 숲도 설원 스킨의 눈 바닥이라 같은 팔레트다(씬을 만들 때
  `seasonLook` 으로 한 번 읽는다. 계절이 바뀌면 숲이 다시 만들어진다). 그림은 `StarShards.ts` 안의 격자를 `scene` 인자로 굽는다(보물 지도 glint 와 같은 방식, check:art 대상
  아님). 보물 지도의 금색 십자("여기를 파라")와 헷갈리지 않게 파란 조각 모양이다. 깊이 4.5(glint 와 같음).
- 기척(`StarShards.ts` 의 `hint`): 아직 안 보이는 조각(반쯤 보이기 시작하는 `SEEN` − 반 타일까지)이 `SENSE`(6타일) 안에
  있으면 가장 가까운 것 쪽으로 영웅 둘레에 반짝임 하나가 뜨고 소리 `shard:near`(`sfxKit.ts`, E7 유리 핑)가 같이 난다.
  반짝임(`star-mote`, 9칸 18px 네 갈래 별, 작은 꼴 → 큰 꼴 → 작은 꼴)은 650ms 동안 영웅 중심에서 44→92px(안내 화살표의
  56 을 지나, 64px 영웅 바로 밖) 밀려나며 들어왔다 사라지고, 그동안 영웅을 따라간다. 간격은 거리만으로 정한다: `SEEN` 에서
  0.7초, 한 타일마다 0.43초 길어져 6타일 2초, CALM DAY 의 9타일 3.3초. 들어서는 순간 첫 핑이 난다(곧장 걸으면 3타일을
  0.8초에 지나 핑이 한두 번뿐이라서). 음량은 `SEEN` 에서 1, 한 타일마다 0.12 줄어 6타일 0.64, 0.5 아래로는 안 내린다.
  오늘의 이변이 CALM DAY 인 필드는 9타일까지(`omen.ts` 의 `omenShardReach`, x1.5) 들린다. 영웅이 3초(`STILL_MS`) 넘게 서 있으면
  새 핑을 내지 않고 다시 걸으면 이어 간다. 실제로 생길 뻔한 일: 입구·제단·둥지·상인 같은 자리가 조각에서 6타일 안인 곳이 많아
  (화산 입구 5.0, 숲 제단 4.5, 화산 둥지 3.0타일) 거기 세워 둔 채 두면 1~2초마다 끝없이 울렸다. 화산은 들어서자마자 동쪽
  조각 쪽으로 울리는데, 입구 줄 5타일 거리라 원래 찾기 쉬운 조각이라 그대로 둔다(결정). 실측(키보드·터치 D-pad, 숲·설원):
  5.4타일 1.73초·3.9타일 1.12초·3.3타일 0.89초 간격, CALM DAY 숲 7.6타일에서 2.7초 간격, GOLD RUSH 날 같은 칸은 조용,
  5.3타일에서 한 걸음 뒤 10초 서 있으면 핑 둘.
  - "찾는 재미" 결정과의 관계: 방향만 주고 칸은 주지 않는다. 반짝임은 영웅 둘레에만 뜨고 조각 자체는 여전히 3타일 안에서만
    보여 마지막은 눈으로 찾는다. 6타일은 화면 반폭(10타일)보다 짧고 반높이(5.6타일)와 비슷해 이미 화면 안이나 바로 곁의 조각만
    알리고, CALM DAY 의 9타일도 반폭 안이다. 맵 건너편에서 알려 주던 첫 판과 달리 지역을 걸어 다녀야 들린다.
  - 씬은 Shrine 과 같은 `blocked`(`uiBlocking() || quitting || fieldKeys.leaving()`)를 넘겨 패널·대화·종료 질문·워프·출구
    페이드 동안 핑과 반짝임을 멈춘다. 새 필드 씬도 같이 넘긴다.
  - 깊이 10.45: 영웅·NPC(10) 위, 안내 화살표(10.5) 바로 아래, 이름표(11)·밤 그늘(90) 아래라 밤에는 맵과 함께 어두워진다.
    밤 그늘 위의 빛으로 두면 가리키는 조각(4.5, 그늘 아래)보다 밝아진다. 바닥과의 대비(WCAG, 알파 0.6~0.7 순간, 최대 0.85):
    낮 숲 5.0~5.2, 밤 숲 3.4~4.7, 설원 4.5~4.7, 겨울 숲 4.7, 밤 설원 2.6~2.7(눈 바닥에서는 짙은 별이라 밤 그늘이 둘을 같이
    어둡게 한다). 설원·겨울 숲은 짙은 파랑(`star-mote-snow`, 가운데가 가장 짙은 조각 테두리 `0x0b1440`)이다. 실제 사례: 가운데를
    `0x1e3a8a` 로 둔 첫 시안은 겨울 숲 눈 위에서 2.9 였다.
  - 터치 원판: 기척이 울리는 칸(숲 92·설원 95·동굴 84·화산 109칸) 중 반짝임의 밝은 절반이 원판 밑에 드는 칸은 숲 4·설원 7·
    동굴·화산 0 이고, 모두 영웅 자신도 원판 곁인 맵 아래 구석이다(소리는 그대로 난다). 조각이나 지역 맵을 옮기면 다시 센다.
  - 소리를 새로 만든 이유: 메뉴 커서 `move` 는 패널 없는 필드에서 들리면 뭘 눌렀나 싶고, `pickup` 은 줍는 소리 자체라 미리
    들리면 주운 것으로 읽힌다. 음량은 가장 가까울 때 커서와 같은 줄(BGM 한 음보다 2dB 아래), 6타일에서 4dB, 9타일에서 6dB
    더 작고, 전부 1.5kHz 위라 그 대역에서 BGM 보다 4~15dB 위다(`sfxKit.ts` 의 주석, "효과음 키트" 절의 재는 법).
  - 비용(헤드리스): 반짝임 텍스처 넷은 첫 필드에서 한 번 합 0.9ms 미만, 리스너는 기척이 도는 동안 프레임당 평균 0.007ms
    (최대 0.2ms). 시트·캔버스는 쓰지 않는다.
- 진행은 퀘스트 일지 제목 줄 오른쪽 첫 줄 `STARS 12/12`(`QuestLog`, retroStyle(4) 176px, x 1020..1196, y 10..26, 그 아래
  y 36..52 는 봉인 줄)이고, 지역별 개수는 그 지역 제목 아래 줄(`STARS 1/3`)에 나온다. 실제 사례: 일지에 `C3 F3 S3 V3` 줄까지
  세 줄을 20px 간격으로 쌓았을 때는 양옆이 작은 글자 덩어리로 읽혀 양쪽 두 줄·26px 간격으로 줄였다. 전부 모으면 업적 STARGAZER(`achievements.ts`)다.
- 토스트는 소식(`!`)이다: `STAR SHARD 2/3!`, 셋째는 `VOLCANO STAR WHOLE! MAX HP +5, 2 MAGMA CORE, CANDY`(49글자,
  980px), 열두째는 그 뒤에 `STARFALL! ALL 12 SHARDS: ATK +2 DEF +2`. 지역 이름(`SHARD_REGION_NAMES`)은 7글자까지.
- 첫 판(커밋 하나 동안)은 지역마다 ATK +1·DEF +1 이었다. 그때 별을 완성한 세이브는 그 능력치를 그대로 갖고 새 보상은
  받지 않는다.
- 보상을 바꾸면 README 의 별 조각 줄을 같은 커밋에서 고친다.

## 떠돌이 상인 (`src/peddler.ts`, `src/ui/Peddler.ts`)

PEDDLER 는 `econDay` 의 해시로 열린 필드 중 한 곳(`peddlerRegion`)에 서고, 그날의 두 가지(`peddlerStock`: 소재 2개
PIECES, 소모품 묶음 DEAL)를 하나씩 한 번 판다(`GameState.peddler` = 날짜와 산 것, 옛 세이브는 null). 자리는
`levels.ts` 의 `*_PEDDLER_POS`, 그림은 상점 주인 격자에 팔레트만 다른 `npc-peddler` 다.

- 값은 되팔아 남지 않게 둔다. PIECES 는 납품 단가(`delivery.ts` 의 `PIECE_GOLD`)의 1.5배라 납품하면 1/3 을 잃고,
  DEAL 은 상점 정가의 절반(상점 매입가)보다 비싸다. `PIECE_GOLD`·상점 정가(`shopItems.ts`)를 바꾸면 `DEALS` 의 값과
  주석의 정가를 다시 맞추고 README 의 줄도 고친다.
- 대화는 제단과 같은 꼴이다(선택지 둘 PIECES/DEAL, ESC 는 `escPick` 2 로 떠남, 고른 뒤 YES/NO). Z 처리도 같다(`ownKey`
  는 keydown 에서 `blocked()` 가 아닐 때만 담아 POST_UPDATE 에서 열고, 설원은 씬의 Z 에서 `tryPray()` 다음에
  `tryTalk()`). 새 필드 씬은 제단 다음에 `if (Peddler.here(region)) new Peddler(...)` 를 넣고, 자리를 `treasure.ts` 의
  `keep` 과 러너의 `walls` 에 넣는다(상인이 없는 날에도 넣어 둔다).
- 날짜는 씬을 만든 날로 고정한다. 필드 안에서 자정이 지나도 그날 물건을 그대로 판다.
- 오늘 있는 곳은 퀘스트 일지 제목 줄 왼쪽 첫 줄 `PEDDLER: VOLCANO`(16글자 256px, x 84..340, y 10..26, 제목 왼쪽 끝 432 에서
  92px)에 나온다. 실제 사례: 회차 표시가 제목 안(`QUEST JOURNAL  HARD 9`, x 304~)에 있을 때는 이 줄이 제목 위로 겹쳐 들어가 `HARD n` 을 제목 뒤 태그로 뺐다. 그 아래 둘째 줄(y 36..52)은 오늘의 이변이다("오늘의 이변" 절). 지역 이름(`PEDDLER_REGION_NAMES`)은 7글자까지, 물건 라벨은 13글자까지(`2 SPIDER SILK`)다.
- 터치 MENU 줄·원판과 겹치지 않게 네 자리 모두 맵 가운데 쪽 길가에 뒀다. 옮기면 제단처럼 화면 좌표로 다시 본다.

## 필드 봉인 (`src/seals.ts`, `src/ui/Seal.ts`)

필드의 퍼즐이다(동굴·숲·설원·화산, `SEALS` 표). 붉은 돌(SEAL)과 룬 발판 3개가 있고, 발판을 `order` 대로 밟으면 봉인이
풀려(`GameState.seals[지역] = "open"`) 돌에서 Z 로 봉인된 강적을 부른다. 이기거나 잡으면 `"done"` 이고 최대 MP +3·지역
골드를 한 번 준다(`fellKeeper`, 넷째에는 최대 MP +5 가 더). 옛 세이브는 전부 닫힘, HARD MODE 는 `reset()` 으로 다시 닫는다.

- 순서 힌트는 돌 자신이 말한다(`riddle`: 발판이 놓인 곳으로 가리킴). 발판이 셋이라 순서는 6가지뿐이고 틀리면 전부
  꺼질 뿐이라 힌트 없이도 풀린다. 발판 진행은 저장하지 않지만 전투는 넘긴다(`Seal.ts` 의 모듈 변수 `litKept`, 필드가
  `back` 으로 다시 만들어질 때만 되살림. 그 밖의 진입은 꺼진 채 시작). 실제 사례: 발판 사이 걸음 7~10초에 시도의 1/3 이상이
  무작위 조우로 말없이 초기화됐다. 켠 동안 조우를 끄는 쪽은 발판 하나로 필드 조우를 꺼 둘 수 있어 버렸다(결정).
  네 지역 모두 같은 순서 퍼즐이다(지역별 변형은 넣지 않음).
- 강적은 새 몬스터가 아니다. 그 지역 희귀종을 정예(`elite.ts`)로 강제하고 종의 HP·ATK 에 배율을 먼저 곱한 것이고
  (`KeeperBout`, `keeperDef`), 이름(`bout.name`)은 필드 대화·토스트와 전투 첫 줄(`GRUK THE HEXED rises!`, 정예 접두
  없이, 최장 22글자)에만 나온다(전투 창·도감·결산은 종 이름 + 정예 태그). 실제 사례: 첫 줄도 `FIERCE CURSED GOBLIN
  blocks your way!` 라 필드에서 부른 이름이 전투에 한 번도 안 나왔다.
  BattleScene 훅은 시작 data 의 `keeper` 하나다(`const def = keeperDef(...)`, `this.elite = data?.keeper?.elite ??
  rollElite(...)`, `this.keeperName`). 희귀종은 원래 정예가 되지 않으므로 이 조합은 봉인에서만 나온다.
- 배율은 `sim:battle` 의 "90% 이기는 첫 레벨"(WOLF/SOLO)이 그 지역의 가장 센 일반 정예와 보스 사이에 오게 잡았다:
  동굴 1/1 < GRUK 3/5 < KING 5/6, 숲 3/4 < ZIRR 5/6 < MOSS 7/8, 설원 7/8 < YSKA 10/14 < GLACIER 12/15, 화산 11/14 <
  MOLG 14/17 < DRAKE 18/23. 실제 사례: 배율 없이 정예로만 두면 넷 다 일반 정예와 같거나 그 아래였다(1/2, 2/3, 6/8,
  10/13). sim 에는 keeper 옵션이 없어 `ENEMIES` 의 HP·ATK 를 곱한 뒤 `--foe KEY --elite KIND` 로 돌리는 일회용
  스크립트(`/tmp/pwcheck/`)로 쟀다. 희귀종·정예 수치를 바꾸면 다시 잰다.
- 승리 판정은 전투 뒤 씬이 다시 만들어질 때 한다: 부르기 전의 `GameState.battles`·`caught.length` 를 모듈 변수에 적어
  두고 돌아왔을 때 늘었으면 이긴 것이다(심연 수호자와 같은 방식). 그래서 BattleScene 의 `victory()` 에는 훅이 없다.
  전투 중 새로고침하면 봉인은 풀린 채로 남는다. 씬의 `fight` 콜백은 `encounterCooldown` 을 0 으로 한 뒤 `startBattle`
  을 부른다. 실제로 생길 뻔한 일: 봉인이 풀린 직후(발견 뒤 1.2초 유예)나 전투에서 막 돌아왔을 때 부르면 `startBattle`
  이 조용히 거절하는데 적어 둔 값은 남아, 다음에 이긴 아무 전투가 보상을 줬다.
- 새 지역에 넣을 때: `SEALS` 에 항목과 `SealRegion`, 씬에 `new Seal(this, region, this.player, this.dialogue, { back:
  !!back, fight, blocked, found })`, `startBattle(enemy?, keeper?)` 가 `keeper` 를 Battle data 로 넘기게 하고, 돌 칸을
  러너 `walls` 와 `treasure.ts` 의 `keep` 에 넣는다. 칸은 걷는 바닥·입구에서 도달(돌을 벽으로 쳐도 맵이 안 끊김)·구역
  한 타일 밖·입구/상자/제단/상인/별 조각에서 180px 밖인지 스크립트로 확인한다. Seal 은 늘 제 Z 리스너를 쓰므로 씬이 Z
  를 직접 받는 설원에서는 얼음 낚시·제단·상인 자리에서 두 대화 반경(96+120px)보다 멀리 둔다.
- 보상을 최대 MP 로 둔 것은 별 조각(최대 HP·ATK·DEF)·제단(전투 수 제한 축복)과 겹치지 않게 하려는 결정이다. 업적은
  하나(SEALBREAKER, 하나라도)뿐이고 넷 전부는 업적이 아니라 최대 MP +5 다(결정). 수치를 바꾸면 README 의 봉인 표를
  같이 고친다.
- 틀린 발판은 밟는 순간 한 번 `Sfx.error()` 와 붉은 깜빡임(`Seal.refuse`, 280ms)으로 답한다. 켜진 것이 없을 때의 틀린
  첫 발판도 같다. 실제 사례: 그때는 `lit` 이 0 에서 0 이라 소리도 없어 발판이 아무것도 안 하는 것으로 읽혔다. 이미 켜진
  발판은 조용하다.
- 발판도 터치 원판 계산("필드 제단" 절)을 한다. 실제 사례: 화산 발판 2 는 (4,7)에서 입장 화면의 D-pad 위 원판 밑에
  있어 (3,6)(서쪽 용암이 꺾인 자리, 수수께끼 문구 그대로)으로 옮겼다. 화산 발판 1 (22,5)은 입장 화면 오른쪽 끝에서
  MENU 줄 밑에 반쯤 걸린 채다: 비키는 칸 (20,6)은 "동쪽 벽" 문구가 틀려져 그대로 뒀다(결정).
- 진행은 퀘스트 일지 오른쪽 위 둘째 줄 `SEALS 4/4`(`QuestLog`, 별 조각 줄 아래, y 36..52)다.
- 돌은 제단 격자(`SHRINE_TILE`)의 붉은 팔레트(`seal`)이고 풀린 뒤에는 `shrine-spent` 다. 발판 그림은 `Seal.ts` 안의
  격자를 `scene` 인자로 굽는다(check:art 대상 아님). 발판 깊이 3.6(바닥 위, glint·별 조각 4.5 아래).

## 둥지 연전 (`src/nest.ts`, `src/ui/Nest.ts`)

NEST 는 필드의 굴에서 세 전투를 연달아 하는 곳이다(동굴·숲·설원·화산에 하나씩, `NESTS` 표). Z → YES 로 들어가면 첫 전투가 바로
시작되고, 이길 때마다 필드로 돌아오자마자 `ON`/`LEAVE` 를 묻는다(ESC 는 LEAVE). 셋을 다 이기면 골드와 그 지역 소재
`NEST_PIECES`(3)개, 중간에 물러나거나 도망치면 그때까지 쌓인 골드(`purse`)만, 쓰러지면 평소 패배다. 사이에 회복은 승리의
+5 HP·+2 MP 뿐이다(필드에서 가방을 열 틈이 없다: 질문이 필드와 함께 뜬다). 하루 한 번(`GameState.nestDays`, shrineDays 와
같은 꼴, 옛 세이브는 빈 값, HARD MODE 의 `reset()` 이 비운다)이고 들어가는 순간 그날을 쓴 것으로 저장해 도중에
새로고침하면 그날은 끝이다. 정예와 같은 5승(`NEST_MIN_BATTLES`) 뒤부터 열린다.

- 연전 질문의 답은 복귀 뒤 1.2초(`justBackFromFight`) 동안 답으로 치지 않고 같은 질문을 다시 띄운다. 실제 사례: 결산을
  넘기던 Z 가 타이핑을 넘기고 다음 Z 가 ON 을 눌러 원치 않는 다음 전투가 시작됐다.
- BattleScene 에는 훅이 없다. 전투 하나하나가 봉인 강적과 같은 `KeeperBout`(종에 HP·ATK 배율을 먼저 곱한 정예, 첫 줄
  `NEST MOTHER rises!`)이고 씬의 `startBattle(enemy, keeper)` 로 시작한다. 그래서 세 전투 모두 정예 골드·EXP(x2.5)를 주고
  `feats.eliteWins` 에 들어간다(바운티 FELL AN ELITE 를 여기서 채울 수 있다: 값은 연전 한 번). 한 둥지에는 정예 종류를
  둘까지만 써서 한 번으로 ELITE HUNTER 가 나오지 않게 한다.
- 연전 상태(`run`: 지역·이긴 수·시작할 때의 `battles`·`caught.length`)는 `ui/Nest.ts` 의 모듈 변수다(봉인의 `fight` 와 같은
  방식, 저장 안 함). 필드가 `{ fromBattle }` 로 다시 만들어질 때 읽어 승리(전투 수나 포획 수가 늚)면 다음 질문이나 결산,
  아니면(도망) 쌓인 몫으로 끝낸다. 그 밖의 진입(패배 뒤 걸어옴·타이틀·새로고침)은 `run` 을 버린다. 아레나·심연·훈련장은
  시작하지도 읽지도 않는다. 씬의 `fight` 콜백은 봉인처럼 `encounterCooldown` 을 0 으로 한 뒤 `startBattle` 을 부른다(거절되면
  `run` 만 남아 다음에 이긴 아무 전투가 한 판으로 세어진다).
- 수치는 sim 에 배율 옵션이 없어 `/tmp/pwcheck/` 의 일회용 래퍼(ENEMIES 의 HP·ATK 를 곱한 뒤 `--foe KEY --elite KIND
  --potions 0`)로 잰다. WOLF + 그 지역 의도 장비로, 입장 레벨에서 세 판에 잃는 최대 HP 의 합에서 승리 회복 두 번(+5 HP 씩)을
  뺀 값이 73~78% 가 되게 잡았다: 동굴 Lv3 13·34·51%(98−25), 숲 Lv8 10·36·45%(91−15), 설원 Lv13 20·28·41%(89−11), 화산 Lv19
  7·23·56%(86−8). 포션 없이 다섯 번에 한 번쯤 쓰러지는 어림이다(판마다 편차를 평균의 절반으로 봄. sim 은 연전을 못 돌려
  판별 평균을 더한 것이고 HEAL 로 버틴 피해도 들어 있다). 한 레벨 아래는 대개 실패(합 147·129·105·103%), 한 레벨 위는
  안전(58·67·61·76%)이다. 실제 사례: 동굴 배율을 그대로 옮기자 숲 Lv8 은 합 172%, 설원 Lv13 은 156% 였다(ORC·YETI 의 정예가
  지역 안에서 유난히 세다). 골드는 세 전투의 정예 골드(62·175·340·485G) + purse(40·120·300·340G)로 그 지역 사냥
  하루치(24분, 380·1200·2590·3290G)의 1/4 쯤이고 상은 소재 3개다. 종·배율·purse 나 몬스터 수치를 바꾸면 다시 재고 README 표를
  고친다.
- 새 지역에 넣을 때: `NestRegion`·`NESTS` 한 항목, 씬에 `new Nest(this, region, this.player, this.dialogue, { back: !!back,
  fight: (f) => { this.encounterCooldown = 0; this.startBattle(f.enemy, f.bout); }, blocked, found })`, 굴 칸을 러너 `walls`·
  `treasure.ts` 의 `keep`·미니맵 표식에 넣는다. `areaLeft` 는 `NESTS` 에 있는 지역이면 알아서 `NEST` 를 넣는다. 칸은 제단과
  같은 조건(걷는 바닥, 굴을 벽으로 쳐도 맵이 안 끊김, 구역 한 타일 밖, 입구·상자·제단·봉인 돌·발판·상인·별 조각에서 180px,
  상자 3칸)과 터치 원판 계산("필드 제단" 절)으로 고른다. Nest 는 늘 제 Z 리스너를 쓰므로 설원에서는 봉인처럼 다른 Z
  지점에서 두 대화 반경보다 멀리 둔다. 지금 자리: 동굴 (13,14), 숲 (12,16), 설원 (12,14), 화산 (1,4), 모두 영웅이 설 수 있는 어느
  칸에서도 터치 원판 밑에 안 들어간다.
- 글자: 강적 이름은 봉인과 같은 한도(첫 줄 `<이름> rises!`), 들어가는 질문 둘째 줄 `Win all three for 300 G and 3 FROST
  SCALE.` 는 42글자(터치 한 줄 42), 토스트 `NEST CLEARED! +300 G, 3 FROST SCALE` 35글자. 토스트는 소식(`!`)이다.
- 그림은 `Nest.ts` 안의 32x24칸 격자(64x48px)를 `scene` 인자로 굽는다(check:art 대상 아님). 들어갈 수 있을 때는 굴 안에 눈
  둘, 그날을 쓴 뒤에는 눈이 없는 팔레트(`nest-still`)와 흐린 이름표다. 몸은 아래쪽 56x22, 영웅이 뒤에 서면 깊이 10.4.

## 압도 (`src/overrun.ts`, `src/payout.ts`)

한참 약한 적은 필드에서 닿는 순간 전투 없이 쓰러진다(OVERRUN). 규칙·지급은 `overrun.ts`(Phaser 없음), 필드 쪽은 `sceneCommon` 의
`meetFoe` 하나다. 이긴 전투의 결산은 `payout.ts` 의 `settleWin`·`settleLevels` 한 곳이고 BattleScene `victory()` 와 압도가 같이
쓴다(압도는 `share` 0.8 을 넘긴다). 결산에 보상·집계를 더하면 그 함수에 넣고, 압도에서도 주거나 셀지(`share < 1` 분기)를 정한다.

- 판정(`outmatched`)은 레벨 차가 아니라 전투 산식이다: 평균 굴림(x1.0)의 FIGHT 가 적 최대 HP(밤·HARD 반영) 이상이고 적의 최대
  치명타가 영웅 최대 HP 의 10%(`OVERRUN_HURT_SHARE`) 이하. 실제 사례: 최소 굴림(x0.8)으로 재면 SLIME 이 Lv12 부터였고 다섯 종뿐이라
  평균으로 넓혔다(SLIME 9·BAT 11·GOBLIN 14·WASP 18·WOLF 20, 의도 장비·낮). 그래도 "한 방"이 조건이라 숲 중반부터는 거의 안 된다
  (Lv30 미스릴 ATK 41, SPIDER HP 40·DEF 2). 영웅 ATK·몬스터 HP 를 바꾸면 `/tmp/pwcheck/` 의 일회용 표(종마다 `outmatched` 가 처음
  참이 되는 레벨)로 다시 뽑아 README 의 레벨을 고친다.
- 정예는 `meet` 이 전투와 같은 `rollElite` 를 먼저 굴리고, 정예면 늘 싸우며 그 굴림을 Battle data 의 `elite` 로 넘긴다(BattleScene
  `init` 은 data 에 `elite` 키가 있으면 다시 굴리지 않는다). 그래서 정예 빈도와 정예 과제·업적이 압도 때문에 줄지 않는다. 이변이 걸린 필드는 예외가 아니라 그 위에
  얹힌다("오늘의 이변" 절): WILD HUNT 의 추가 굴림(약 17.4%, 평소 8% 와 합쳐 24%)은 `meetFoe` 에서 `meet` 보다 먼저 굴리고 안 걸리면
  `meet` 으로 내려가며, GOLD RUSH 의 +30% 는 `settleWin` 의 합이라 압도의 몫(x0.8)에도 TRADE 처럼 붙는다. 필드에서
  Battle 을 여는 새 길은 `meetFoe` 를 거치거나(일반 조우) `elite` 를 넘기지 않는다(봉인 강적은 `keeper`, 러너는 희귀종이라 `meet` 이
  그대로 싸움으로 돌려준다).
- 못 잡은 종도 압도한다. 실제 사례: "CANDY 를 들고 있고 못 잡은 종이면 싸운다"는 첫 규칙은 압도를 거의 다 막았다. 일곱 번에 한 번
  CANDY 가 떨어져 가방에 늘 있기 때문이다(실게임 검증 중 첫 압도가 CANDY 를 줘서 다음 조우가 전투가 됐다). 잡으려는 사람은 설정에서
  끈다(README).
- 보상 비율(`OVERRUN_SHARE` 0.8)은 실측으로 정했다(`overrun.ts` 머리 주석): 한 방 전투는 닿은 순간부터 필드로 돌아오기까지 봇으로
  1.8~2.6초(키 3~4번, 사람은 약 3초)에 입장 유예 1.2초, 압도는 영웅을 세우지 않고 쿨다운 0.6초만 남긴다. 풀밭 조우는 걷는 동안 초당
  6% 라 약 17초에 한 번이니 0.8 x (17 + 1.2 + 3) / (17 + 0.6) = 시간당 0.96배다(봇 기준 0.92배). 요리·축복은 충전을 쓰지 않고 보너스도
  주지 않는다(판정의 ATK·DEF 에만 든다). 승리 회복·LIMIT·유대는 없다. 조우 확률·쿨다운이나 전투 길이를 바꾸면 이 식을 다시 계산한다.
- 압도된 로머는 그 필드가 다시 만들어질 때(전투 뒤, 나갔다 들어올 때)까지 돌아오지 않는다(결정). 로머는 한두 초 거리로 모여 있어
  다시 깔리게 하면 쓸고 다니는 사냥이 전투로 잡을 때의 두 배를 넘는다(전투는 한 마리에 약 6.5초, 압도는 2.5초). 그래서 한 구역의
  무리는 한 번(15마리쯤)만 주고 그 뒤는 풀밭 조우의 속도다. 압도 직후 겹친 다른 로머는 쿨다운 0.6초 뒤에 이어서 압도되거나(약한
  종) 전투가 된다. 영웅이 멈추지 않으니 무리를 쓸고 지나가는 것이 의도한 그림이다.
- 새 필드 씬에 넣을 때: `startBattle` 에서 종을 페이드 전에 고르고, `const met = keeper ? null : meetFoe(this, this.toasts, kind,
  this.player, this.roamers)` 가 `"overrun"` 이면 `encounterCooldown` 만 걸고 돌아오며, 아니면 `scene.start("Battle", { ..., elite: met })`
  다. `meetFoe` 가 지급·조용한 저장·토스트·효과음·연출을 다 한다(닿은 로머는 목록에서 빼고 영웅 반대쪽으로 밀리며 사라짐, 풀밭
  조우는 영웅이 걷는 쪽 한 걸음 앞에 그 몬스터 그림, 밀려난 자리 발밑에 fx-poof 를 필드 배율 1·영웅 아래 깊이 9.9 로). 씬 전환이
  없어 `exiting*` 플래그는 세우지 않는다. 실제 사례: 연기를 깊이 10.6 에 두었을 때 무리를 쓸면 영웅이 1~2초씩 안 보였고, 풀밭 그림은
  늘 영웅 오른쪽이라 왼쪽으로 걷던 영웅의 등 뒤에서 쓰러졌다.
- 토스트는 상태 줄(`!` 없음)이라 바로 뜨고 다음 압도가 덮는다: `OVERRUN <이름>: +NG +NEXP` 뒤에 얻은 것(52글자를 넘으면
  `+2 ITEMS`). 같은 씬에서 3초(`OVERRUN_CHAIN_MS`) 안에 이어진 압도는 한 번의 쓸기로 보고 그 줄을 합계로 바꾼다(`OVERRUN x6: +760G
  +524EXP  +2 ITEMS`, 최장 40글자). 실제 사례: 화산에서 8초에 여섯 마리를 쓸면 줄이 0.6~1.3초마다 바뀌어 번 돈(+760G)을 읽을 수
  없었다. 레벨업과 보물 지도는 소식 줄(`!`)로 뒤따른다(`overrunLines`, 최장 48글자 = 960px).
- 설정 `GameState.overrun`(기본 켬, `magic-world-settings` 에 저장)은 SettingsUI 의 열두 번째 줄이다. 그 줄을 넣으며 줄 간격이
  33 → 30px(줄 사이 6px)이 됐다. 위는 HUD, 아래는 D-pad 라 패널을 더 늘릴 수 없으니 설정을 더 넣으려면 줄을 합치거나 쪽을 나눈다.
- fx-poof 를 필드 배율로 처음 틀 때 그 자리에서 한 번 굽는다(헤드리스에서 그 프레임 24.6~24.8ms). 더 무거운 연출로 바꾸면 미리 굽는다.

## 바운티의 과제 (`src/bounties.ts`)

BOUNTY BOARD 의 일일 바운티는 `DEED_SHARE`(절반)로 처치 의뢰 대신 과제(`DEEDS`: 정예 처치·PARRY·러너 잡기·제단 기도·PERFECT·원소 반응·LIMIT
마무리)가 나온다. `BountyState` 에 `kind`·`snap` 이 붙고(처치 의뢰와 옛 세이브에는 없음) `target` 에는 과제 이름이 들어간다.

- 과제는 이미 있는 카운터로 센다(`GameState.deedCounters()`: `feats.parries`·`feats.eliteWins`·`feats.perfects`·
  `feats.reactions`·`feats.limitKills`, `prayers`, `runnersCaught`). 바운티는 게시될 때의 값(`snap`)을 적고 진행은 그 뒤 늘어난 만큼이다. `have` 는 `syncBounty()` 가
  저장할 때마다와 게시판이 굴리기 전에 맞춘다. 그래서 `have` 를 읽는 곳(게시판 대화, 일지, 날 넘김 정산, 상한 거부)은
  처치 의뢰와 같은 코드이고 전투·필드는 바운티를 모른다. 새 과제는 카운터 하나와 `DEEDS` 한 줄이다.
- 전투 안에서 세는 과제는 카운터를 `feats.ts`(`Feats`·`noFeats`·`loadFeats`)에 두고 BattleScene 에서 한 줄로 올린다:
  PARRY 는 `syncLimit`, PERFECT 는 `playerAttack` 의 `perfectDamage` 다음 줄, 반응은 `react()` 끝, LIMIT 마무리는
  `limitBreak` 의 `limitKill` 다음 줄(어떤 적이든 센다. 업적 FINISHER 의 `limitFinishes` 는 보스·거인만이라 따로다).
  넷 다 훈련장(`practice`)에서는 안 세고 아레나·심연에서는 센다. 정예는 `victory()` 의 `noteWin` 이라 쓰러뜨린 것만 센다
  (잡으면 안 셈).
- 나오는 조건(`open`): 정예는 5승 뒤, LIMIT FINISH 는 5승 뒤(게이지가 한 번은 찼을 때), REACTIONS 는 Lv4 부터(THORNS 의
  독 뒤 FIRE 로 혼자 DETONATE 를 낼 수 있는 레벨, `REACTION_MIN_LEVEL`). THORNS 의 learnLevel 이나 반응 표
  (`battleRules.ts` 의 `reactionOf`)를 바꾸면 이 레벨과 힌트(`FIRE ON POISON, ICE ON BURN`)를 다시 맞춘다.
- SHRINE PRAYER 는 오늘 안 바친 열린 제단이 하나라도 있을 때만 나온다(`deedCounters().shrinesLeft`, `gameState.ts` 의
  `SHRINE_GATES`). 실제 사례: 게시판을 읽기 전에 열린 제단에 다 바친 날은 끝낼 수 없는 과제가 걸렸다. 새 지역에 제단을
  넣으면 `SHRINE_GATES` 에도 넣는다.
- 그날 이변(`omen.ts`)이 게시판을 제 쪽으로 기울인다(`bounties.ts` 의 `OMEN_DEED`·`OMEN_FAVOR` 0.5): 과제가 나오는 날, 이변의
  과제(WILD HUNT → FELL AN ELITE, CALM DAY → CATCH A RUNNER, HOLY DAY → SHRINE PRAYER)가 그 영웅에게 열려 있으면 절반은 그것이다
  (그날 29%, 평소 과제 하나는 7%). GOLD RUSH 는 처치 의뢰의 절반을 그 필드의 종으로 돌린다(`gameState.ts` 의
  `OMEN_FIELD_MONSTERS`, 동굴은 SLIME·GOBLIN·BAT). 실측(4000번씩): 맞는 바운티가 29.3~30.9%, 처치 의뢰는 50% 그대로, 나머지 과제는
  3~4% 씩. 맞으면 게시판이 `THE OMEN FAVORS IT.`(19글자)를 같은 문단에 잇는다(`GameState.omenFavors(b)`, 바운티와 날짜만으로 판단해
  저장하는 것이 없다). 이 줄까지 넣어도 바운티 두 줄 + 납품 두 줄로 터치 한 쪽 네 줄 안이다. 일지에는 따로 표시하지 않는다
  (왼쪽 위의 이변 줄과 바운티 행이 이미 나란히 있다). 이변이나 과제를 더하면 `OMEN_DEED` 를 같이 본다.
- 글자 폭: 이름은 14글자까지(일지 제목 `BOUNTY: CATCH A RUNNER` 22글자, 한도 23), 일지 힌트는 `힌트 - 9999G` 로 37글자까지
  (힌트 28글자), 게시판의 `BOUNTY: CATCH A RUNNER 0/1` 과 `REWARD: 9999 GOLD.` 는 각각 터치 한 줄 42글자 안이다. 둘을 이은
  `BOUNTY: <이름> 0/9 REWARD: 999 GOLD.` 가 한 줄에 들어가려면 이름이 12글자까지다(새 셋은 12 이하, 13·14글자인
  FELL AN ELITE·CATCH A RUNNER 는 두 줄로 넘어가고 대화창이 쪽을 다시 나눈다). 보상은 지금 최대 299G(화산이 열린 뒤 배수 6).
- 보상은 `pay` x 바운티 풀 평균 골드 x `BOUNTY_MULT`(처치 의뢰는 평균 4.5마리분)다. 어떤 과제도 처치 의뢰 평균보다 낮지
  않게 둔다: SHRINE PRAYER·LIMIT FINISH 4.5, LAND PARRIES(3~5번)·PERFECT HITS(5~8번) 5, FELL AN ELITE 5.5, REACTIONS(2~3번) 6,
  CATCH A RUNNER 7. 실제 사례: 3~6 일 때 가장 낮은 것이 처치 의뢰 평균의 2/3 라, 처치 의뢰의 최고(가장 비싼 종 6마리,
  평균의 3배)와 견줘 꽝으로 읽혔다. 화산까지 열린 뒤(평균 33.3G): 처치 23~720G·평균 224G, 과제 224·249·274·299·349G. 지역이
  열릴 때마다 평균(9.3·15.3·22.8·33.3G)이 둘을 같이 올린다. 순서의 이유: 기도는 제단 골드(축복이 갚음)와 걸음 한 번,
  LIMIT 은 게이지 하나, PERFECT 는 FIGHT 마다 시도할 수 있어 PARRY 보다 횟수만 많고, 반응은 상태를 먼저 걸고 주문 둘의 MP 가
  들고, 러너는 그날 안 나올 수 있다. 러너·정예 확률이나 몬스터 골드를 바꾸면 `/tmp/pwcheck/` 의 일회용 표로 다시 본다.
- CATCH A RUNNER 가 걸려 있고 아직 못 채운 동안에는 필드 입장 때의 러너 도착 확률이 12% 대신 50%(`Runner.ts` 의
  `RUNNER_WANTED_CHANCE`)다. 실제 사례: 12% 에서는 입구를 평균 8번 들락거리는 것이 과제의 가장 빠른 길이었다. 잡으면 끝나서
  과제가 걸린 날(14일에 하루쯤)에 러너 하나가 더 나오는 정도다(벌이 표의 1% 미만).
- 러너 과제는 닿아서 전투가 실제로 시작될 때 센다(전투 결과와 무관, 러너당 한 번). 러너의 `caught` 콜백은 봉인처럼
  `encounterCooldown` 을 0 으로 한 뒤 `startBattle` 의 반환값(시작했으면 true)을 돌려주고, `Runner.ts` 는 true 일 때만
  `tagged`·`runnersCaught` 를 올린다. 실제 사례: 상자·기도 뒤의 유예(`holdFights`, 1.2초) 중에 닿으면 `startBattle` 이
  조용히 거절해 전투 없이 카운터만 올랐고 러너는 달아났다. 저장 전에 일지를 열면 `have` 가 한 박자 늦을 수 있다.
- 별 조각·봉인·상인의 존재는 `unlockTips.ts` 의 두 줄(3승·8승 뒤 마을 토스트)로 알린다. ELDER·HUNTER 대사는 건드리지
  않았다(결정: TownScene 대화 줄 폭 계산을 다시 하지 않아도 되는 쪽).

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

그림은 영역별 파일에 있다: `tiles.ts`(지형 격자·팔레트, 32칸. 바닥·물·용암·물가/길 전환 51장은 `scripts/gen-terrain.ts` 가 만든 리터럴이라
그 스크립트를 고치고 `bun run gen:terrain` 으로 다시 쓰며 `--check` 로 맞는지 본다. 나무·바위는 손으로 고친다), `tilesets.ts`(tiles16/shore16/road16 와
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
- 물 A/B 프레임이 같은 배치의 위상 차이인지 (`B[y] === A[(y+off)%32]`, 지형은 32칸 격자)
- 타일셋 텍스처 폭이 **2048px 이하**인지. 일부 모바일 GPU 의
  `GL_MAX_TEXTURE_SIZE` 하한이고 이 게임은 터치를 지원한다. `tiles16` 에
  타일을 계속 이어붙이면 여기서 걸린다
- 전환 타일이 코너 마스크 1..14 순서인지, 완전 불투명한지, 각 타일에 두
  지형 계열 색이 모두 있는지. 한쪽만 있으면 경계를 안 그리고 베이스 지형을
  지운다. 이웃할 수 있는 전환 타일 쌍마다 이음매 양쪽 칸의 지형 계열이 2칸 넘게
  어긋나지 않는지(경계가 이음매를 건너 이어지는지)
- 지형 바닥·물·용암·전환 타일이 Scale2x 를 거치지 않는지(그대로 굽거나 `keepBlocky`). 거치면 물결
  점선이 사선이 되고 채움이 휜다
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
결과를 눈으로 확인한다. 얼굴(눈이 비대칭·웃는 눈으로 바뀜)·1칸 점무늬·가로 잔물결(사선 줄무늬로
바뀜)처럼 Scale2x 가 뜻을 바꾸는 격자는 `keepBlocky(...)` 로 4px 그대로 둔다. 등록은 그 격자가 있는 파일
최상위, 격자 정의 뒤에 둔다. 모듈을 불러올 때 등록되어 굽기보다 먼저 실행되고, 정의 앞에 두면
TDZ 로 부팅이 죽는다. 지금 쓰는 격자는 `npcs.ts` 의 대체 NPC 하나뿐이다. `scale2x` 의 `family` 는 한
경계에서만 모서리를 다듬는 인자로, `battleHd.ts` 가 빈 공간(".")을 줘 전투원 외곽선만 다듬는다.

지형(`tiles.ts`: 바닥·물·용암·나무·바위·물가/길 전환 56장)은 32칸 격자를 `makeTilesetTexture(..., 32, ART_PX)`
로 그대로 굽는다. 바닥 무늬는 16칸 때의 배치·간격·표시 칸 비율을 지키고 4px 표시 하나를 같은 넓이의 2px
모양(풀잎·조약돌·부스러기)으로 바꿨다(2px 라고 무늬를 촘촘히 하지 않는다, 명도차 규칙 그대로). 물결은 2px 가로
점선이고 B 는 A 를 한 칸(2px) 민 것이다. 전환 타일은 모서리 쌍선형을 smoothstep 좌표의 0.5 등고선으로 자르고
가장자리에서 0 인 출렁임을 더해, 이웃 타일이 공유하는 가장자리를 같은 자리에서 자른다. 채움은 기본 타일 무늬를
그대로 이어 간다(그래서 `SHORE` 에 물의 `d`, `ROAD` 에 길의 `h` 가 있다). 실제 사례: 4px 무늬를 지키던 바닥이
화면 대부분을 차지해 그 위의 2px 캐릭터·건물보다 뭉툭했고, 예전 길 오버레이는 기본 길과 다른 어두운 4px 점을
깔아 한 칸 폭 길이 점박이로 보였다. 바닥·물·용암·전환 격자는 `tiles.ts` 에서 직접 고치지 않는다. 다음
`bun run gen:terrain` 이 덮어쓰므로 `scripts/gen-terrain.ts` 를 고친다.
32칸(보스·거인은 48칸)으로 다시 그린 그리드는 `makeTexture(..., ART_PX)` 로 Scale2x 없이
굽고, check:art 가 32x32 또는 48x48 정사각인지 본다(입자 둘만 예외로 이름을 적어 둔다: spark 16칸·firefly
24칸, check-art 의 `SMALL_AT_ART_PX`). 소품·작물(`props.ts`, 밭의 호박·월광화 포함)도 이렇게 32칸을 ART_PX 로
굽는다. 필드 건물·랜드마크(`landmarks.ts`: 동굴 입구, 작업장 6채,
밭, HOME 집 단계와 눈 덮개, 표지판)와 심연 계단(`AbyssScene`)도 2px 칸 격자를 ART_PX 로 굽는다. 이것들은 맵 타일
단위(한 타일 32칸)라 check:art 가 32칸 배수의 한 장짜리 격자(64x64, 밭 96x64)를 따로 센다. 실제 사례: 4px 칸
격자를 Scale2x 로 굽던 건물은 경계만 2px 이고 안쪽은 4px 덩어리라 옆의 2px 영웅보다 뭉툭했고, 집과 표지판은
Graphics 사각형이라 디테일이 주변보다 한참 낮았다.

영웅은 3.6등신이다(머리가 키의 28%). 32칸판은 29행에 머리 1~8행·발 29행, HD 64칸판은 58행에 머리 2~17행·발 행
59 이고, 손은 32칸 행 17~20(HD 36~41), 장비 쥠점은 검 (14, 6)·방패 (-16, 6)(`HeroGear` 의 `GEAR_LAYOUT`)이다. 머리가 키의
25~29% 인지와 모든 걷기 다리가 발 줄에서 끝나는지는 check:art 가 본다. 실제 사례: 예전 영웅은 머리가 키의 거의
절반(이등신)이라 난쟁이 같았고, 머리를 줄이면 32칸 얼굴은 눈 1칸 둘뿐이라 뺨·턱 테두리를 어두운 `d` 대신 피부 그림자
`S` 로 둘렀다(작은 얼굴에서 `d` 는 수염으로 읽혔다). 미소는 HD 에만 있다. NPC 7명과 마을 사람 3종도 영웅과 같은 몸 설계(머리 10x8, 어깨 16, 발 28~29행)를
따르고, 마을 사람은 다리 배열(`VILLAGER_LEGS_*_32`)을 `npcs.ts` 에 따로 둔다. 직업은 실루엣으로 가른다(노인은 구부정하게,
경비는 크고 단단하게, 대장장이는 굵은 팔, 도박사는 날씬하게). 영웅의 머리 폭·어깨·발 행을 바꾸면 NPC 를 다시 맞춘다.

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

그림 밖에서 코드로 그리는 도형도 2px 격자를 따른다. 테두리는 `gridOutline(rect, 색)`(pixelart.ts, 2px, 선이
격자에서 벗어나는 가장자리를 1px 밖으로 옮김)으로 긋는다. 실제 사례: Phaser 는 사각형 테두리를 가장자리 가운데에
그려서, 짝수 가장자리의 2px 선이 홀수~홀수 px 에 걸쳤고 전투 창·HUD 의 1px 선은 아트 칸의 절반이었다(감사 결과 마을
화면의 홀수 px 타일 76→0). WebGL 에서는 외곽선을 채우기 노드의 네 띠로 그려 바깥 모서리가 꽉 찬다(Phaser 의 사각형
외곽선은 네 변을 따로 그어 모서리마다 1x1px 이 비었다). Phaser 의 `RectangleWebGLRenderer` 가 `customRenderNodes.FillRect` 를
먼저 찾는 것에 기대므로 Phaser 를 올리면 모서리 확대를 다시 본다. 같은 사각형에 `setStrokeStyle` 을 직접 다시 걸지 않는다. 일회용 감사기(/tmp/pwcheck/px2/)는 화면 스냅샷의 색 경계 run 최대공약수와 위상을 16px
타일마다 잰다. 필드 바닥 그림자(`addGroundShadow`, 필드 동료)는 `stepEllipse` 가 Ellipse 의 경로를 2px
줄로 바꿔 그린다(전투 그림자 BattleScene `stand()` 와 같은 계단). Ellipse 를 받는 곳(sceneCommon·Villagers)은 그대로다. 도감 아이콘은 몬스터
텍스처를 0.5배(1px 칸, 아이템 아이콘과 같은 밀도, 보스 48px)로 그린다. 실제 사례: 0.63배는 칸이 1.26px 라 1·2px
가 섞여 얼굴이 일그러졌다. 2px 칸으로 하려면 아이콘이 64px 라 줄(56px) 배치를 다시 짜야 한다.

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
- 바닥의 y 474..586 에는 전투 메뉴·힌트·아이템·SKILL 목록이 흰색·연파랑 글자로 바로
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
  프레임 180장) `src/ui/PixelWeather.ts` 가 15fps 로 640x236 CanvasTexture(한 칸 2텍셀, 텍셀 2px, y 0..472)에
  바로 다시 그린다(`hiresPaint` 의 `rawCells`). 빗줄기·바람 줄은 한 칸(4px) 굵기에 계단만 2px 이고, 하늘 패스(안개·비
  장막·눈 장막, weather/_lib 의 pass/rows)는 효과가 칸마다 계산해 4px 그대로다. 1텍셀(2px) 줄도 시험했지만 비의
  잉크가 절반이라 비가 약해지고 눈보라 줄이 거의 사라져 버렸다(결정). 이펙트 바닥을 지평선(y 440)에 두고 그 아래에는 front 층(가까운 빗방울·물보라)만 그린다. 실제 사례:
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
- 보스 기술의 시트는 `bossSheets.ts` 의 `BOSS_SHEETS`(fx.ts 의 `SHEETS` 에 펼침)이고, 그 보스 전투의 `warmStatuses` 가 처치
  시트 바로 뒤에 제 것 하나만 `warmFx` 로 굽는다(타이틀 warm 에는 없다). BattleScene 의 `MOVE_FX` 가 기술 이름으로 시트·길이·
  맞는 순간(`hit`, 파도가 부서지고 포자가 터지는 때)·효과음(`move:*`)을 정하고, blast 는 영웅 발밑(`GROUND_Y`)에 적 쪽에서
  오게 뒤집어, ARMOR 는 적 발밑에, FRENZY 는 타마다 `fx-bs-club` 을 평범한 타격 불똥 대신 둔다. crop 은 기술 시트와 같은 땅 위
  58칸·아래 8칸이다. 헤드리스 실측: 텍스처 SPLASH 2.87·SPORES 1.52·SWEEP 1.31·ARMOR 2.84·club 0.57MB, 전투 시작 0.11~0.56초에
  준비(첫 HP 선은 몇 라운드 뒤), 그 전투 시작의 가장 긴 프레임 간격 27~33ms. 한 번 구운 시트는 세션에 남는다(보스 다섯을 다
  만나면 9.1MB). 실제 사례: 포자 버섯을 영웅 발밑에 두었더니 흰 줄기가 영웅을 가려 적 쪽으로 14칸 옮겼고(`focus`), 파란 물결은
  KING SLIME 과 무관해 보여 슬라임의 빨강 램프로 칠했다.
- SKILL 목록의 스킬·기술 시트는 `skillSheets.ts`·`techSheets.ts` 의 표를 `fx.ts` 의 `SHEETS` 에 펼쳐 넣고, 놓는 자리와
  맞는 순간(`onHit`)은 `skillFx.ts`·`techFx.ts` 가 정한다. 시트 표는 pixelfx·`sheetFx.ts`·`PixelSheet` 타입만 불러
  fx.ts 와 값이 돌지 않게 한다. crop 은 땅 기준 위 58칸·아래 8칸, 적 발 기준 위 46칸이다(`sheetFx.ts` 의 `around`,
  `GROUND_UP`·`FEET_UP`·`DOWN`). 같은 파일의 래퍼: `squeezeX`(길이가 정해진 빔의 가운데를 줄여 손~적 사이에 맞춤),
  `soften`(crop 가장자리 8칸의 솔리드 픽셀을 Bayer 디더로 녹임. 실제 사례: 연기·불꽃 머리가 y 224 에서 직선으로
  잘렸다), `half`(몸보다 훨씬 큰 효과를 반 크기로, 짝수 res 에서는 원해상도로 직접 그려 BLACK HOLE·implosion 의 선이
  2px 로 가늘다). 래퍼는 pixelfx painter 의 `frame` 필드와 createFx 안의 createFx 에 기대고, `hiresPaint.ts` 는 Painter
  메서드 목록, fire/_lib 의 solid·soft, explosions/_lib 의 cs/sn 항등 검사, shadow/_lib 의 cellX·`p.L`, weather/_lib
  의 pass()·rows() 빠른 길과 clip() 에 기댄다. 회전은 클로저에 두고 painter 의 cs/sn 은 NaN 이라 항등 검사로 빠른 길을
  타는 코드는 일반 경로를 탄다. `rawCells`(날씨 전용) 일 때만 sn 0 으로 빠른 길이 칸 단위 그림자 버퍼에 쓰고, 다음
  그리기 전에 텍셀로 합친다(칸 안에 이미 다른 텍셀이 있으면 같은 블렌드를 역산해 다시 적용하는 근사).
  pixelfx 를 올리면 시트를 전·후 픽셀 비교로, 2배 밀도는 res 1 대 2 의 프레임별 ink 비·무게중심 이동(전에 0.86~1.31)으로
  다시 본다.
- 전투 시트는 `trimFrames` 로 프레임마다 그린 상자만 잘라 묶는다(GAP 1, Phaser 의 trimmed frame 이라 크기·origin 이
  같다). 2배 밀도에서 이것 없이는 Lv30 기술 34장이 약 83MB 였다(지금 51.9MB). `fx-sk-beam` 은 `skillFx` 가 frame 폭
  비율로 `setCrop` 하므로 끈다.
- 배운 기술의 시트는 그 세션 첫 전투 create 가 `warmStatuses` 에서 `warmFx` 로 굽고(Lv30 은 상태 시트와 함께 41장(기술 34 + 상태 7), 헤드리스 약 4.4초, p95
  9ms, 2배 밀도 전 1.2초) 세션 내내 남는다(기술 34장 51.9MB, 2배 밀도 전 24.5MB). 순서는 처치 시트 → 상태 시트 → 마지막에 쓴 기술(`lastSkill`) →
  동료 시트 → 나머지 기술을 learnLevel 높은 것부터다. 실제 사례: 배운 순서로 구웠더니 VOID·BLACK HOLE 이 1.1~1.2초에야
  들어와, 첫 턴에 바로 쓰면 그 자리에서 26~46ms 를 구웠다(지금 0.18~0.28초에 준비). 필드 씬도 `FieldPanels` 생성 1.5초 뒤
  `warmMoves`(sceneCommon)로 배운 기술 시트를 같은 순서로 그 씬 큐에 넣어, 필드에 약 5초 머물면 첫 전투가 기술 시트를
  굽지 않는다(Lv30 첫 전투 p95 8.1→5.4~6.4ms). 대가로 그동안 마을 프레임이 최대 16ms 근처다(헤드리스, 늦추려면
  `MOVES_WARM_MS`·`BAKE_BUDGET_MS`). 5초 전에 전투로 가면 필드 큐는 SHUTDOWN 에 버려지고 전투가 남은 것을 굽는다. `lastSkill` 은 페이지마다 비어서
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
  루프라 시트로 굽지 않고 PixelWeather 처럼 15fps 로 320x180 캔버스(4px 칸)에 다시 그린다(`lightCanvas.ts`). 빛은 업로드 때
  2배(640x360) 겹선형으로 올리고(`addLightCanvas` 의 `smooth: 2`), 불투명 먼지는 nearest 로 4px 그대로다. 몸통은
  weather/_lib rows() 가 칸마다 계산해 2배 painter 로 그려도 같아서 그리기는 칸 그대로다(업로드 프레임 +2.3ms, 헤드리스). 빛과 불투명 먼지만 ADD 로
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
