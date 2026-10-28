---
name: magic-world-playtest
description: magic-world 를 실제 브라우저(python playwright, 헤드리스)로 띄워 플레이·스크린샷·화면 감사를 할 때 쓴다. 새 게임 스모크, 진행 상태 당기기(세이브 주입·GameState 조작), 전투·필드·패널 화면 확인, 터치·게임패드 흉내, 글자 이탈·겹침·대비 점검, 키 입력 중복 확인이 대상. "플레이테스트", "QA", "브라우저로 확인", "실제 게임에서 확인", "스크린샷 찍어", "화면 겹침 점검", "터치로 확인", "게임패드 확인", "playwright", "playtest", "screenshot the game" 같은 요청에 쓴다. 코드만 읽는 리뷰나 sim:battle 같은 밸런스 계산에는 쓰지 않는다.
---

# magic-world 플레이테스트

`scripts/harness.py` 는 브라우저 실행, dev 번들 패치(main.ts 의 게임 생성), HMR 차단, 세이브 주입, 씬 시작, 화면 감사, 스크린샷을 한 번에 해 준다. 매번 하네스를 새로 만들지 말고 이것을 import 해서 쓴다. 이번 세션 1~4차 QA 의 스크립트에서 검증된 코드만 모아 두었다.

## 시작 전

- dev 서버는 5199 하나만 쓴다(AGENTS.md "Dev 서버 관리"). 이미 떠 있으면 그대로 쓰고, 팀 작업 중이면 남이 띄운 서버를 죽이거나 새로 띄우지 않는다. 확인: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/`
- 스크립트와 스크린샷은 `/tmp/pwcheck/<주제>/` 에만 둔다. 저장소에는 훅·산출물을 남기지 않는다(AGENTS.md "작업 완료 후 중간 산출물 정리").

## 빠른 시작

```bash
python3 -I .claude/skills/magic-world-playtest/scripts/harness.py smoke           # 새 게임 → 마을 → 스크린샷 + 감사
python3 -I .claude/skills/magic-world-playtest/scripts/harness.py smoke --touch   # 같은 것을 터치(pointer: coarse)로
```

JSON 으로 title·town·hero·screenshot(`/tmp/pwcheck/playtest/smoke-town.png`)·audit·keydown_counts·errors 를 출력한다. exit 0 이면 통과다.

## 하네스 쓰기

```python
import sys
sys.path.insert(0, ".claude/skills/magic-world-playtest/scripts")  # 저장소 루트에서 실행
from harness import Game

g = Game("mycheck", touch=False, pad=False, out="/tmp/pwcheck/mycheck")
try:
    g.boot()                                   # 또는 g.boot(save=세이브 dict, slot=1)
    g.new_game("QA")                           # 이름 창 입력 → 외형 Z → Town
    g.gs("G.player.atk = 40; G.save(); return 1")
    g.start("Battle", {"enemy": "slime", "from": "Town"})
    g.wait_menu(); g.shot("menu"); g.fight()
    print(g.audit(), g.errors)
finally:
    g.close()
```

| 함수 | 하는 일 |
| --- | --- |
| `Game(..., viewport=(1280, 720), dpr=1)` | 창 크기와 장치 배율. 도중 변경은 `g.page.set_viewport_size(...)`, DPR 은 CDP `Emulation.setDeviceMetricsOverride`(`g.ctx.new_cdp_session(g.page)`) |
| `boot(save=None, slot=1, settings=None)` | 타이틀까지 띄움. save 를 주면 localStorage `magic-world-save-<slot>` 에 넣고 다시 불러옴(형식은 `GameState.save()`) |
| `new_game(name)` | 빈 슬롯에서 Z → 이름 입력 → Enter → 외형 Z → Town |
| `gs(body)` | `G` = 게임의 GameState 로 JS 실행, `return` 값을 돌려줌 |
| `scene(key, body)` | `s` = 그 씬(비공개 필드도 그냥 읽힘) |
| `start(key, data)` | 지금 씬에서 `scene.start`(void, data 기본 `{}`) |
| `press`·`hold`·`pad(button)`·`teleport` | 키 입력, 가짜 패드 버튼(standard: 0 A, 1 B, 2 X, 3 Y, 8 Select, 9 Start, 12~15 D-pad), 순간이동 |
| `shot(name)`·`audit()` | 스크린샷, 화면 감사(고정 글자의 화면 이탈·겹침, `__MISSING` 텍스처, 터치 원판과 글자 겹침) |
| `wait_menu()`·`fight(key)` | 전투 메뉴까지 Z, 메뉴마다 key(기본 A=FIGHT)로 끝까지 |
| `keydown_counts(scene)` | keydown 3개를 한 번에 보내 씬 리스너가 받은 횟수 — `[1, 1, 1]` 이어야 함 |

## 함정 (이번 세션에 실제로 겪은 것)

- 브라우저: python playwright 기본 chromium 이 없을 수 있다. 기본값 `browser="chrome"`(설치된 Chrome)을 쓴다. `browser="shell"` 은 캐시된 headless shell 을 glob 해서 swiftshader 인자로 띄우는데, 드라이버 버전과 어긋나면 screenshot 이 멈춘 적이 있다.
- GameState 는 `g.gs` 로, 씬은 `g.scene` 으로 만진다. Bun dev 서버는 소스를 한 번들(`/_bun/client/*.js`)로 내보내 `import('/src/...')` 할 모듈 URL 이 없다. 그 밖의 모듈 값은 씬이 들고 있는 필드나 GameState 를 거쳐 읽는다.
- HMR 소켓(`/_bun/hmr`)은 하네스가 막는다. 막지 않으면 팀원의 수정으로 페이지가 테스트 도중 다시 불려 전투 중에 타이틀로 돌아간다. 그 대신 결과는 페이지를 불러온 시점의 코드 기준이다.
- `page.evaluate` 가 Phaser 객체를 돌려주면(예: `scene.start(...)`) 직렬화하느라 멈춘다. 직접 쓸 때는 `void` 로 감싼다(AGENTS.md "기타").
- `Math.random` 을 상수 함수로 덮지 않는다. 텍스처 UUID 가 모두 같아져 게임이 멈춘다(AGENTS.md "기타"). 드롭·포획은 강제하지 말고 여러 판 돌린다.
- 대화창 질문은 타이핑이 끝나기 전 Y/N 을 무시한다. 질문이 뜨면 1.5초쯤 기다린 뒤 누른다. 부엌 COOK, 대장간 FORGE/REFINE, 강화된 장비 판매는 Z 를 두 번 눌러야 한다(확인 질문).
- `teleport` 직후에는 검·방패·그림자가 옛 자리에 남는다. 스크린샷 전에 한 걸음 걷는다.
- `scene.start` 에 data 를 빼면 Phaser 가 지난 data 를 다시 쓴다. 하네스의 `start` 는 `{}` 를 기본으로 넘긴다. 마을은 종료 때 `GameState.pos` 를 저장한다.
- `audit()` 의 겹침은 깊이·가림을 보지 않는다. HUD 띠까지 덮는 불투명 패널(가방·도감·업적·상점·대장간 등)을 열면 그 밑의 HUD 글자가 겹침으로 나오므로 스크린샷으로 거른다.
- 터치: `has_touch` 만으로는 `(pointer: coarse)` 가 켜지지 않아 하네스가 `matchMedia` 를 덮는다. 전투에는 화면 버튼이 없다(메뉴를 바로 탭).
- 이름 창: `keyboard.type` 은 신뢰된 이벤트라 글자로 들어가고, 패드·터치의 합성 Z 는 칸 선택이다.
- 골드 9999 에서는 상점 판매가 "Gold is full!" 로 막힌다. 판매를 볼 때는 골드를 낮춘다.

## 점검 레시피

- 글자 폭·패널 여백: AGENTS.md "UI 텍스트가 패널/화면을 벗어나지 않는지 확인" 으로 계산하고, `audit()` 와 스크린샷으로 실제를 본다.
- 대비·채도·링 소실: 정의는 AGENTS.md("글자 대비와 뒷판", "픽셀 그리드 검증"의 링 소실, "전투·타이틀 배경"의 측정 정의)를 따른다. 구운 텍스처의 원본 픽셀은 `g.ev("(k) => window.__game.textures.getBase64(k)", key)` 로 받는다.
- 진행 당기기: `g.gs` 로 `G.quest` 플래그·`G.inventory`·`G.player` 를 바꾸고 `G.save()`. 지역은 `g.start("Snow")` 처럼 바로 연다(숲은 `{}`). 적 키는 `src/monsters.ts` 의 `ENEMIES`.
- 시간·계절: `G.minutes` 를 설정한다(하루 = 1440, 계절 = 4일). 날씨·이벤트는 실시간 기준 `econDay` 라 시계로는 바뀌지 않는다.
- 토스트: `g.scene(key, "const t = s.children.getByName('__toast'); return t && t.alpha > 0.05 ? t.text : null")` 를 짧은 간격으로 읽는다.
- 게임패드: `Game(pad=True)` 뒤 `g.pad(i)`. 매핑은 `src/ui/Gamepad.ts` 와 README 게임패드 표.
- 키 중복: `g.keydown_counts()` 가 `[1, 1, 1]` 이 아니면 `src/keyboardQueueFix.ts` 가 빠졌거나 Phaser 가 바뀐 것이다(AGENTS.md "기타").
- 빌드 결과(dist): 서버를 띄우지 말고 `page.route` 로 `dist/` 파일을 바로 내려 준다(폰트 오프라인 확인에 쓴 방식).

## 끝낼 때

- `g.close()` 를 `finally` 에서 부른다. `pgrep -fl "chrome-headless|Google Chrome.*--headless"` 로 남은 브라우저를 보고, 내가 띄운 것만 정리한다(다른 teammate 의 것은 두기).
- `git status` 로 저장소에 산출물이 없는지 확인한다.
