# MAGIC WORLD

8비트 픽셀 감성의 판타지 RPG 브라우저 게임입니다. [Phaser 4](https://phaser.io/) + TypeScript + Vite 기반으로, 그래픽 에셋 없이 코드로 픽셀아트를 그려 넣은 것이 특징입니다.

![tech](https://img.shields.io/badge/Phaser-4.x-blue) ![tech](https://img.shields.io/badge/TypeScript-7.x-3178c6) ![tech](https://img.shields.io/badge/Vite-8.x-646cff) ![tech](https://img.shields.io/badge/Bun-ready-f472b6)

## 게임 기능

### 지역과 보스

| 지역 | 열리는 조건 | 몬스터 | 보스 |
| --- | --- | --- | --- |
| 마을 들판 | 처음부터 | SLIME, GOBLIN, WOLF (드물게 GOLDEN SLIME, 거인 TROLL KING, 밤에 NIGHT WISP) | - |
| 동굴 | 처음부터 | SLIME, GOBLIN, BAT (드물게 CURSED GOBLIN) | KING SLIME |
| 숲 | KING SLIME 처치 | WASP, SPIDER, ORC | MOSS GOLEM (엔딩) |
| 설원 | MOSS GOLEM 처치 | FROST MOTH, YETI | GLACIER GOLEM |
| 화산 | GLACIER GOLEM 처치 | MAGMA SLIME, FIRE IMP, SALAMANDER | FLAME DRAKE (에필로그) |
| 심연(ABYSS) | FLAME DRAKE 처치(NEW GAME+ 는 처음부터), 동굴 남동쪽 끝 계단 | 층이 깊을수록 동굴 → 숲 → 설원 → 화산 순 | 5층마다 처치한 보스가 GUARDIAN 으로 |

최대 레벨은 30. 처음 열리는 지역·기능과 처음 얻은 소재·CANDY·요리 재료의 쓰임새는 마을에서 한 번씩 토스트로 알려 준다.

심연은 내려갈 때마다 새로 만들어지는 층을 계속 내려가는 포스트게임 던전이다. 층마다 적 HP/ATK +6%, 골드·EXP +2%(NEW GAME+ 배율과 곱해 각각 최대 x4, x2). HP/MP 는 층을 넘어가도 회복되지 않고, 층마다 있는 위 계단(TOWN)으로 언제든 마을로 나갈 수 있다. 위 계단을 밟으면 바로 나가지 않고 "STAY IN THE ABYSS?" 를 묻는다(STAY / LEAVE, 기본 선택과 ESC 는 STAY, 계단에서 벗어났다가 다시 밟아야 다시 물음). B2 아래에서 LEAVE 로 나가면 그 층에 포탈이 남아, 마을에서 쉬고 돌아와 동굴 계단에서 그 층부터 다시 내려갈 수 있다(체크포인트와 포탈 중 더 깊은 쪽을 제안, 비용 없음). 포탈은 한 번 쓰면 사라지고, 심연에서 패배하면 지워진다. B1 을 골라 내려가도 포탈은 남고, 다시 나가면 둘 중 더 깊은 층이 남는다. 패배는 보통 패배(골드 절반). GUARDIAN 을 쓰러뜨려야 아래 계단이 열리고, 상금은 보스 골드의 30%. 소재 드롭은 B11부터 x2, B21부터 x3. GUARDIAN 을 쓰러뜨리면 그다음 층(B6, B11, …)이 체크포인트로 저장되어, 동굴 계단에서 B1 과 체크포인트 중 시작 층을 고를 수 있다(HP/MP 는 들어갈 때 그대로, 진행 중인 층은 저장되지 않음). 최고 층·체크포인트·포탈은 기록되고(NEW GAME+ 에서도 유지), B10 도달 업적이 있다. 밤 효과는 없다.

### 전투

- 영웅 → 동료 → 적 순서의 턴제. 연속 FIGHT 는 콤보로 피해 +10%씩(최대 +80%), 크리티컬 10%(x2), 약점 원소 x1.5
- 주문은 레벨이 되면 자동으로 배운다. 부가 효과 확률은 약점이면 2배

  | 주문 | 레벨 | MP | 효과 |
  | --- | --- | --- | --- |
  | FIRE | 1 | 3 | 불 피해, 6% 화상(3턴 지속 피해) |
  | HEAL | 5 | 4 | HP 20 회복, 독 해제 |
  | ICE | 9 | 6 | 얼음 피해, 5% 냉기(적 ATK x0.85) |
  | BOLT | 14 | 10 | 번개 피해, 15% 감전(적 1턴 쉼, 보스 제외) |
  | WARD | 18 | 6 | 3턴 동안 받는 피해 절반 |
  | NOVA | 24 | 24 | 무속성 큰 피해 |

- 상태 이상: 독(WASP·SPIDER), 빙결(FROST MOTH·YETI·GLACIER GOLEM, 1턴 행동 불가), 재생(MOSS GOLEM). ANTIDOTE CHARM·EMBER RING·TALISMAN 으로 막는다
- 보스와 거인은 HP 30% 이하에서 격노(ATK x1.3). 기를 모으면(CHG) 다음 턴에 강타가 오니 WARD·회복으로 대비한다. 강타는 최대 HP 70% 를 넘지 않고, GLACIER GOLEM 의 강타는 빙결을 건다
- 아이템: 포션류, BOMB(DEF 무시 12 피해), CANDY(약해진 몬스터 포획, 보스 불가). STEAL 로 골드를 훔치고(보스 제외), RUN 은 50%
- 동료: 잡은 몬스터 하나를 도감(B)에서 동료로 정하면 매 턴 함께 공격한다. 함께 싸운 10라운드마다 ATK +1(최대 +5), 종마다 고유 기술(회복·두 번 물기·독·그물·방어 등)
- 정한 동료는 마을·숲·설원·화산·동굴·심연에서도 영웅이 걸은 길을 한 걸음 뒤에서 따라온다(충돌 없음, 도감에서 바꾸면 바로 바뀜)
- 승리하면 골드·EXP·드롭(포션, CANDY, 대장장이 소재), 3연승부터 연승 보너스 골드. 패배하면 골드 절반을 잃고 마을로 돌아온다
- 보물 지도: 승리 25번에 1번꼴로(심연·아레나 제외, 최대 3장) 마을 들판·동굴·숲·설원·화산 중 열린 곳 하나의 지도를 얻는다. 아이템 창(I) 3쪽에서 지도와 X 를 보고, 그 자리 근처에서 Z 로 파면 골드·그 지역 소재·드물게 CANDY 나 상점 장비. 2타일 안에 들어가면 바닥이 반짝인다

### 마을

| 장소 | 내용 |
| --- | --- |
| HOME | Z 로 HOME 창: REST / COOK / BUILD. 휴식: HP/MP 회복, 밤(20:00~06:00)에 자면 다음 06:00 으로 넘어간다. 요리(KITCHEN): 재료로 음식을 만들면 다음 전투 5번 동안 효과(한 번에 하나, 새로 먹으면 바뀜). GRILLED FISH(FISH 2) ATK +10%, BEAN SOUP(BEAN 2) DEF +15%, FISH STEW(FISH·CORN) 이길 때마다 HP 15% 회복, PUMPKIN PIE(PUMPKIN·BEAN) EXP +20%·전투 골드 +10%, MOON TEA(MOONFLOWER) 독·빙결 50% 막음. 남은 횟수는 HUD·전투 창에 표시. 증축(BUILD, 차례대로, NEW GAME+ 에도 유지): HEARTH(2000G·SLIME GEL 4·BAT WING 2) 음식 지속 7전투, HERB GARDEN(4000G·SPIDER SILK 3·WOLF FANG 3) 하루 한 번 집에 오면 재료 2개, FEATHER BEDS(8000G·YETI FUR 3·MAGMA CORE 2) 집에서 쉬면 다음 전투를 WARD 2턴으로 시작. 단계마다 집 모양이 바뀐다 |
| SHOP | 소모품·장비 구매, TAB 으로 판매. MYTHRIL 장비·저항 장신구는 보스 처치 후 |
| BLACKSMITH | 몬스터 소재 + 골드로 제작: LIFE CHARM(최대 HP +20), TALISMAN(독·빙결 차단), GLACIER MAIL(DEF +8), DRAKE BLADE(ATK +8) |
| ARENA | KING SLIME 처치 후. 처치한 보스(쓰러뜨리거나 잡은 TROLL KING 포함) 최대 5연전, 사이마다 HP/MP 20% 회복, 도망 불가. 상금은 보스 골드의 25%로 이긴 판마다 바로 지급·저장(완주 시 합계의 +50% 추가) |
| FARM | 4칸. CORN, BEAN, PUMPKIN, MOONFLOWER(밤에만 자람). 5% 확률로 황금 수확 x3. 수확하면 골드와 함께 그 작물이 요리 재료로 1개 |
| FISHING | 마을 연못과 설원 얼음 구멍. 입질("!") 때 Z. 밤에만 나오는 어종, 황금 어종은 포션 동봉. TAB 으로 어류 기록. 낚을 때마다 골드와 함께 요리 재료 FISH 1개(어종 구분 없음) |
| BOUNTY BOARD | 매일 바뀌는 처치 의뢰(3~6마리) |
| GAMBLER | LUCKY WHEEL: 10/50/200/1000G 베팅 |
| RANK BOARD | 영웅 레벨 순위 |
| ELDER / HUNTER | 메인 퀘스트 / 사이드 의뢰(BAT 처치, 몬스터 포획, YETI 처치, 화산 몬스터 포획) |
| 주민 | FARMER·FISHER·TRAVELER 가 낮에 돌아다니며 힌트를 주고, 해가 지면 집에 간다 |

마을 이벤트는 사흘에 한 번: MARKET DAY(구매가 -20%), FISHING DERBY(연못 낚시 x1.5), HARVEST FESTIVAL(수확 x1.5), LUCKY DAY(룰렛 꽝 감소).

### 날씨와 밤

- 시계는 게임 1분 = 실제 1초(설정 TIME SPEED 로 x5, x20). 밤은 20:00~06:00. 작물과 하루 단위 보상(BOUNTY BOARD 의 바운티·납품)은 배속과 무관하게 실제 시간 기준으로 돈다(x20 에서 CORN 은 게임 시간 6D16H, 새 바운티는 게임 20일마다; 잠으로 건너뛴 밤도 배속만큼 덜 친다)
- 밤에는 몬스터 HP/ATK x1.25(보스 제외), 골드·EXP x1.5, 조우율 x1.8
- 날씨는 지역마다 날짜별로 정해진다: 마을·숲 맑음/비/폭풍, 설원 눈/맑음/눈보라, 화산 맑음/화산재. 비·폭풍 날은 연못 입질이 빨라지고 수확이 x1.2, 눈보라 날은 얼음 낚시가 느려진다

### 진행과 저장

- 퀘스트 일지(U): 진행 중인 메인·사이드 의뢰
- 업적(A), 도감(B): 도감은 본/잡은 몬스터와 약점을 보여 주고, 잡은 종 20%마다 ATK/DEF +1
- NEW GAME+: FLAME DRAKE 처치 후 타이틀에서 P. 레벨·장비·도감·동료와 몬스터 소재·요리 재료·보물 지도·집 증축은 유지하고 퀘스트·상자·농장은 처음부터, 소모품은 처음 세트로, 골드는 절반. 회차마다 적 HP/ATK +50%, 보상 +25%(3회차까지)
- 세이브 슬롯 3개(타이틀에서 선택). 자동 저장 + CTRL+S. 새 게임·NEW GAME+·가져오기로 덮어쓴 세이브는 타이틀에서 복원(U), 설정(O)에서 세이브 코드 내보내기/가져오기

## 조작

필드에서 `?` 를 누르면 필드 키 목록(도움말)이 뜬다.

| 키 | 필드 | 전투 |
| --- | --- | --- |
| 방향키 / HJKL | 이동 | 아이템 목록 이동 |
| Z | 말하기·조사·확인 | 메시지 넘기기·아이템 선택 |
| ESC | 대화 건너뛰기·창 닫기 | 도망(RUN)·아이템 목록 닫기 |
| A | 업적 | FIGHT |
| F / H / I / B / W / N | - | FIRE / HEAL / ICE / BOLT / WARD / NOVA |
| E | - | 아이템 |
| S | HUD 켜기/끄기 | STEAL |
| I / B / U | 아이템 / 도감 / 퀘스트 일지 | - |
| O / T / M | 설정 / 미니맵 / 음소거 | M 음소거 |
| CTRL+S / Q | 저장 / 타이틀로(Y/N) | - |
| F2 | 맵 편집기(마을, 개발용) | - |

타이틀: 방향키·H/L·1~3 슬롯 선택, Enter/Z 시작, C 이어하기, N 새 게임, P NEW GAME+, D 삭제, U 복원, O 설정.

터치 기기에서는 화면 버튼이 나온다: 왼쪽 아래 방향 패드, 오른쪽 아래 Z·ESC, 오른쪽 세로 줄 I·U·B·A·T·O·?(도움말과 같은 글자). 전투 메뉴, 타이틀 버튼, 창의 칩(CLOSE, LOG)은 탭해서 고른다. 대화 선택지(YES/NO 등)는 탭하거나 방향 패드 ←/→ 로 옮긴 뒤 Z 로 고른다.

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
