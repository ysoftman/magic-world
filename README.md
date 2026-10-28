# MAGIC WORLD

8비트 픽셀 감성의 판타지 RPG 브라우저 게임입니다. [Phaser 4](https://phaser.io/) + TypeScript + Vite 기반으로, 그래픽 에셋 없이 코드로 픽셀아트를 그려 넣은 것이 특징입니다.

![tech](https://img.shields.io/badge/Phaser-4.x-blue) ![tech](https://img.shields.io/badge/TypeScript-7.x-3178c6) ![tech](https://img.shields.io/badge/Vite-8.x-646cff) ![tech](https://img.shields.io/badge/Bun-ready-f472b6)

## 게임 기능

### 지역과 보스

| 지역 | 열리는 조건 | 몬스터 | 보스 |
| --- | --- | --- | --- |
| 마을 들판 | 처음부터 | SLIME, GOBLIN, WOLF (드물게 GOLDEN SLIME, KING SLIME 처치 뒤 거인 TROLL KING, 밤에 NIGHT WISP) | - |
| 동굴 | 처음부터 | SLIME, GOBLIN, BAT (드물게 CURSED GOBLIN) | KING SLIME |
| 숲 | KING SLIME 처치 | WASP, SPIDER, ORC (드물게 SILVER WASP) | MOSS GOLEM (1부 끝: TO BE CONTINUED, 마을로) |
| 설원 | MOSS GOLEM 처치 | FROST MOTH, YETI (드물게 AURORA MOTH) | GLACIER GOLEM |
| 화산 | GLACIER GOLEM 처치 | MAGMA SLIME, FIRE IMP, SALAMANDER | FLAME DRAKE (진엔딩: THE TRUE END) |
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
- 적 창의 HP 막대 아래에 약점이 나온다: 이미 싸워 본(도감에 있는) 종이면 `WEAK:ICE` 처럼, 처음 보는 종은 `WEAK:?`, 약점이 없으면 `WEAK:-`
- 보스와 거인은 HP 30% 이하에서 격노(ATK x1.3). 기를 모으면(CHG) 다음 턴에 강타가 오니 WARD·회복으로 대비한다. 강타는 최대 HP 70% 를 넘지 않고, GLACIER GOLEM 의 강타는 빙결을 건다
- 아이템: 포션류, BOMB(DEF 무시 12 피해), CANDY(약해진 몬스터 포획, 보스 불가). 포획에 성공하면 몬스터가 분홍빛으로 줄어들며 동료 자리로 빨려 들어가 새 동료로(있던 동료 대신) 나타나고, 실패하면 고개를 젓는다. STEAL 로 골드를 훔치고(보스 제외), RUN 은 50%. 아이템 목록(E)에서는 커서가 놓인 아이템의 설명이 목록 아래 한 줄로 나온다(재고 0 인 것도). 터치는 다른 아이템을 탭하면 커서만 옮기고, 같은 아이템을 다시 탭하면 쓰며, 목록 밖을 탭하면 턴을 쓰지 않고 메뉴로 돌아간다(키보드는 Z 로 쓰고 ESC 로 돌아간다). 목록이 열린 동안 동료는 흐려진다. 가방에 아이템이 하나도 없으면 E:ITEM 이 흐려지고 열리지 않는다
- 동료: 잡은 몬스터 하나를 도감(B)에서 동료로 정하면 매 턴 함께 공격한다. 함께 싸운 10라운드마다 ATK +1(최대 +5), 종마다 고유 기술(회복·두 번 물기·독·그물·방어 등). bond 는 종마다 따로 쌓여 동료를 바꿔도 남는다. 한 종과 50라운드를 싸워 BOND+5 가 되면 그 종은 PARTNER 가 되고, PARTNER 2종마다 영웅 ATK·DEF +1(최대 +3, 6종). 도감에 PARTNER 표시와 PARTNERS 줄이 있다. 전투에서 PARTNER 가 되는 순간 메시지로 알려 주고("WOLF IS NOW A PARTNER!"), 그로 보너스가 오르면 "ATK/DEF +1 (n PARTNERS)" 도 덧붙인다
- 정한 동료는 마을·숲·설원·화산·동굴·심연에서도 영웅이 걸은 길을 한 걸음 뒤에서 따라온다(충돌 없음, 도감에서 바꾸면 바로 바뀜)
- 전투에서도 착용한 검·방패가 영웅 손에 보이고 공격 돌진을 함께 따라간다. 영웅·적·동료는 제자리에서 천천히 숨 쉬듯 오르내리고(빙결 중에는 영웅이 멈춘다), 이기면 영웅과 동료가 두 번 뛰어오르며, 도망에 성공하면 화면 왼쪽으로 빠져나간다. OS 의 '동작 줄이기' 설정이면 숨쉬기와 뛰기는 생략한다
- 승리하면 골드·EXP·드롭(포션, CANDY, 대장장이 소재), 3연승부터 연승 보너스 골드. 패배하면 골드 절반을 잃고 마을로 돌아온다
- 보물 지도: 승리 25번에 1번꼴로(심연·아레나 제외, 최대 3장) 마을 들판·동굴·숲·설원·화산 중 열린 곳 하나의 지도를 얻는다. 아이템 창(I) 3쪽에서 지도와 X 를 보고, 그 자리 근처에서 Z 로 파면 골드·그 지역 소재·드물게 CANDY 나 상점 장비. 2타일 안에 들어가면 바닥이 반짝인다. 맵 편집기로 지형을 바꿔 X 자리가 막히면, 필드에 들어갈 때 같은 지역에서 원래 X 에 가장 가까운 팔 수 있는 자리로 옮겨진다(갈 곳이 없으면 그대로 둔다)

### 마을

| 장소 | 내용 |
| --- | --- |
| HOME | Z 로 HOME 창: REST / COOK / BUILD. 휴식: HP/MP 회복, 밤(20:00~06:00)에 자면 다음 06:00 으로 넘어간다. 요리(KITCHEN): 재료로 음식을 만들면 다음 전투 5번 동안 효과(한 번에 하나, 새로 먹으면 바뀜). GRILLED FISH(FISH 2) ATK +10%, BEAN SOUP(BEAN 2) DEF +15%, FISH STEW(FISH·CORN) 이길 때마다 HP 15% 회복, PUMPKIN PIE(PUMPKIN·BEAN) EXP +20%·전투 골드 +10%, MOON TEA(MOONFLOWER) 독·빙결 50% 막음, KOI FEAST(RARE FISH·PUMPKIN) 소재 드롭 x2(심연 깊이 배수와 곱한다). 재료는 밭의 CORN·BEAN·PUMPKIN·MOONFLOWER 와 낚시의 FISH·RARE FISH 여섯 가지. 남은 횟수는 HUD·전투 창에 표시. 증축(BUILD, 차례대로, NEW GAME+ 에도 유지): HEARTH(2000G·SLIME GEL 4·BAT WING 2) 음식 지속 7전투, HERB GARDEN(4000G·SPIDER SILK 3·WOLF FANG 3) 하루 한 번 집에 오면 재료 2개, FEATHER BEDS(8000G·YETI FUR 3·MAGMA CORE 2) 집에서 쉬면 다음 전투를 WARD 2턴으로 시작. 단계마다 집 모양이 바뀐다 |
| SHOP | 소모품·장비 구매, TAB 으로 판매. MYTHRIL 장비·저항 장신구는 보스 처치 후. 산 장비는 그 칸이 비었거나 지금 낀 것보다 모든 수치(ATK/DEF·최대 HP·막는 상태 이상)에서 같거나 낫고 하나라도 더 나을 때만 바로 장착된다. 장신구끼리의 맞교환(AMULET 과 저항 장신구 등)은 그대로 두니, 바꾸려면 아이템 창(I)에서 Z. 판매는 받을 골드가 상한 9999G 를 넘기면 거부한다 |
| BLACKSMITH | FORGE 탭: 몬스터 소재 + 골드로 제작 — LIFE CHARM(최대 HP +20), TALISMAN(독·빙결 차단), GLACIER MAIL(DEF +8), DRAKE BLADE(ATK +8). REFINE 탭(H/L 로 전환): 착용한 무기·방어구(제작한 DRAKE BLADE·GLACIER MAIL 포함, 장신구 제외)를 +1~+5 로 강화, 단계마다 ATK(무기)·DEF(방어구) +1. 비용은 500/1000/2000/3500/5000G 와 장비 등급에 맞는 지역 소재 두 가지(최상급 무기는 +4·+5 에 DRAKE SCALE 1개씩). 강화는 장비 종류별로 기록돼 바꿔 껴도 따라오고 NEW GAME+ 에도 남으며, 그 장비의 마지막 한 개를 팔면 사라진다(상점이 "Its +N will be lost!" 로 한 번 더 묻고, 다시 Z 를 눌러야 판다). 가방·상점·대장간에서 이름 뒤에 +N 이 붙는다 |
| ARENA | KING SLIME 처치 후. 처치한 보스(쓰러뜨리거나 잡은 TROLL KING 포함) 최대 5연전, 사이마다 HP/MP 20% 회복, 도망 불가. 상금은 보스 골드의 25%로 이긴 판마다 바로 지급·저장(완주 시 합계의 +50% 추가) |
| FARM | 4칸. CORN, BEAN, PUMPKIN, MOONFLOWER(밤에만 자람). 5% 확률로 황금 수확 x3. 수확하면 골드와 함께 그 작물이 요리 재료로 1개 |
| FISHING | 마을 연못과 설원 얼음 구멍. 입질("!") 때 Z. 밤에만 나오는 어종, 황금 어종은 포션 동봉. TAB 으로 어류 기록. 낚을 때마다 골드와 함께 요리 재료 FISH 1개(어종 구분 없음). 희귀 어종(포션이 딸린 GOLDEN FISH·AURORA KOI, 밤에만 나오는 MOON EEL·GHOST ICEFISH)은 RARE FISH 를 하나 더 준다 — 낮 약 8%, 밤에는 밤 어종이 더해져 약 16% |
| BOUNTY BOARD | 매일 바뀌는 처치 의뢰(3~6마리) |
| GAMBLER | LUCKY WHEEL: 10/50/200/1000G 베팅. 최고 당첨(JACKPOT x5)이 나왔을 때 9999G 를 넘길 베팅은 받지 않는다(그 줄은 흐리게 표시) |
| RANK BOARD | 영웅 레벨 순위 |
| ELDER / HUNTER | 메인 퀘스트 / 사이드 의뢰. HUNTER 는 BAT 4마리 → CANDY 로 몬스터 3마리 포획 → (KING SLIME 처치 뒤) SPIDER SILK 3개 가져오기(넘길 때 YES/NO, 110G + HI-POTION 2) → YETI 처치 → 화산 몬스터 포획 순 |
| 주민 | FARMER·FISHER·TRAVELER 가 낮에 돌아다니며 힌트를 주고, 해가 지면 집에 간다 |

마을 이벤트는 사흘에 한 번: MARKET DAY(구매가 -20%), FISHING DERBY(연못 낚시 x1.5), HARVEST FESTIVAL(수확 x1.5), LUCKY DAY(룰렛 꽝 감소). 이벤트 날짜는 배속과 무관하게 실제 시간 기준으로 센다(아래 "날씨와 밤").

### 날씨와 밤

- 시계는 게임 1분 = 실제 1초(설정 TIME SPEED 로 x5, x20). 밤은 20:00~06:00. 작물과 하루 단위 보상(BOUNTY BOARD 의 바운티·납품)은 배속과 무관하게 실제 시간 기준으로 돈다(x20 에서 CORN 은 게임 시간 6D16H, 새 바운티는 게임 20일마다; 잠으로 건너뛴 밤도 배속만큼 덜 친다)
- 밤에는 몬스터 HP/ATK x1.25(보스 제외), 골드·EXP x1.5, 조우율 x1.8
- 마을 키 큰 풀을 포함한 모든 필드(마을·동굴·숲·설원·화산·심연)의 조우는 걷는 동안에만 일어나고 서 있으면 나지 않는다(초당 확률 마을 0.18, 그 밖 0.06, 밤 x1.8). 전투가 끝나면(이기거나 도망) 싸우던 자리로 돌아오고(마을은 몬스터 구역 밖으로 비켜서) 지역 이름은 다시 뜨지 않는다. 상자(심연 상자 포함)를 열거나 보물 지도를 판 직후 잠깐(1.2초)은 몬스터에 부딪혀도 전투가 나지 않는다
- 날씨는 지역마다 날짜별로 정해진다: 마을·숲 맑음/비/폭풍, 설원 눈/맑음/눈보라, 화산 맑음/화산재. 비·폭풍 날은 연못 입질이 빨라지고 수확이 x1.2, 눈보라 날은 얼음 낚시가 느려진다
- 날씨와 마을 이벤트의 날짜도 바운티·납품과 같은 실제 시간 기준 날(econDay, 배속과 무관하게 24분)로 정해진다. x20 으로 비 오는 날이나 MARKET DAY 를 당겨 놓고 NORMAL 로 되돌려 쓸 수 없고, NORMAL 만 쓰면 시계의 날과 같다. 계절(4일씩, 16일 1년)만 시계의 날을 따라서 x20 에서는 계절이 날씨보다 빨리 돈다. 마을·숲 날씨 확률표는 화면에 보이는 계절의 것을 쓴다
- 마을과 숲의 땅은 가을에 물들고 겨울에 눈에 덮인다(봄·여름은 같은 모습). 그 안에 있는 동안 땅 모습이 바뀌는 계절이 오면 화면이 0.3초 어두워졌다가 같은 자리에서 땅·건물·미니맵이 새 계절로 다시 그려진다(창·대화가 열려 있으면 닫힌 뒤, 집에서 자다가 넘어가면 깨어날 때). 숲은 이때 지역 이름을 다시 띄우지 않고, 날씨가 함께 바뀐 경우에만 날씨 이름을 띄운다. 봄→여름은 다시 그리지 않는다. 계절 소식(`AUTUMN HAS COME!` 등)은 마을에서 뜨고, 뜨는 즉시 저장돼 새로고침해도 다시 나오지 않는다

### 진행과 저장

- 퀘스트 일지(U): 진행 중인 메인·사이드 의뢰
- 아이템 창(I): 왼쪽 위에 지금의 ATK/DEF(레벨·장비·REFINE·도감·PARTNER 를 모두 합친 값)가, 오른쪽 위에 HP/MP 가 나온다
- 업적(A), 도감(B): 도감은 본/잡은 몬스터와 약점(WEAK)·능력(CAN: 독·빙결·재생·격노)을 보여 주고, 잡을 수 있는 13종 중 잡은 종 20%마다 ATK/DEF +1(최대 +5). 희귀 몬스터(GOLDEN SLIME·CURSED GOBLIN·NIGHT WISP·SILVER WASP·AURORA MOTH)와 보스는 13종에 들지 않아 세지 않는다. 희귀 몬스터는 골드·EXP 가 크고(SILVER WASP·AURORA MOTH 는 숲·설원에서 같은 계열 몬스터 대신 3.5% 로 나오며 그 지역 소재 2개를 꼭 남긴다), CANDY 로 잡을 수는 있지만 도감 완성에는 필요 없다. HUD 의 CAUGHT 도 이 13종 중 잡은 종 수다
- 업적이 10·20·30·38개가 되면 영웅 외형 TEAL·CRIMSON·NIGHT·GOLD 가 차례로 열린다(토스트 "NEW LOOK UNLOCKED: TRY IT ON AT HOME!", 업적 창 아래에 다음 외형까지의 NEXT LOOK 줄). 업적은 세이브마다 따로라 새 게임은 기본 4종(BLUE·RED·GREEN·VIOLET)부터고, NEW GAME+ 는 업적과 함께 이어진다
- NEW GAME+: FLAME DRAKE 처치 후 타이틀에서 P. 레벨·장비·도감·동료와 몬스터 소재·요리 재료·보물 지도·집 증축은 유지하고 퀘스트·상자·농장은 처음부터, 소모품은 처음 세트로, 골드는 절반. 회차마다 적 HP/ATK +50%, 보상 +25%(3회차까지)
- 세이브 슬롯 3개(타이틀에서 선택). 자동 저장 + CTRL+S. 새 게임·NEW GAME+·가져오기로 덮어쓴 세이브는 타이틀에서 복원(U), 설정(O)에서 세이브 코드 내보내기/가져오기

## 조작

필드에서 `?` 를 누르면 필드 키 목록(도움말)이 뜬다. 맨 아래 줄은 마을에서는 지금 목표(`GOAL: SLIMES 0/5 - IN THE TALL GRASS` 처럼 HUD 의 목표와 그 장소), 동굴에서는 KING SLIME 을 쓰러뜨리기 전엔 `FIND THE KING!`, 심연 계단이 열린 뒤엔 `THE ABYSS STAIR IS OPEN!`, 그 사이엔 마을과 같은 목표 줄이고, 다른 필드는 그 지역 안내다. 도움말을 열 때마다 다시 읽는다.

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
| CTRL+S / Q | 저장 / 타이틀로(대화창 YES/NO, Y·N·ESC 키도 됨) | - |
| F2 | 맵 편집기(마을, 개발용) | - |

타이틀: 방향키·H/L·1~3 슬롯 선택, Enter/Z 시작, C 이어하기, N 새 게임, P NEW GAME+, D 삭제, U 복원, O 설정.

새 게임은 먼저 게임 안 이름 창이 뜬다(최대 12글자, 비우면 HERO). 키보드는 바로 입력(Backspace 지우기, Enter 확인, ESC 뒤로), 터치는 글자 칸을 탭(패널 밖 탭은 뒤로), 게임패드는 D-pad 로 칸을 옮겨 A 로 입력·B 로 뒤로. 이름 다음이 외형 선택이다.

영웅 외형(새 게임, 또는 HOME 앞에서 C): 4x2 칸을 방향키·H/L·J/K 나 1~8 로 고르고 Z 로 정한다(ESC 는 그대로). 잠긴 외형은 실루엣과 필요한 업적 수로 보인다.

터치 기기에서는 화면 버튼이 나온다: 왼쪽 아래 방향 패드, 오른쪽 아래 Z·ESC, 오른쪽 세로 줄 I·U·B·A·T·O·?(도움말과 같은 글자). 전투 메뉴, 타이틀 버튼, 창의 칩(CLOSE, LOG)은 탭해서 고른다. 전투에는 화면 버튼이 없고, 메시지는 화면을 탭해 넘긴다(안내도 `TAP:CONTINUE`). 대화 선택지(YES/NO 등, 타이틀로 나갈지 묻는 것도)는 탭하거나 방향 패드 ←/→ 로 옮긴 뒤 Z 로 고른다.

게임패드(표준 배치: Xbox·PlayStation·Switch Pro)는 버튼을 키보드 키로 바꿔 보낸다. 브라우저는 패드 버튼을 한 번 누른 뒤부터 패드를 알아본다.

| 버튼 | 필드 | 전투 |
| --- | --- | --- |
| D-pad / 왼쪽 스틱 | 방향키 | 아이템 목록 이동 |
| A / B | Z / ESC | Z / ESC |
| X | A(업적) | FIGHT |
| Y | I(아이템) | E(아이템) |
| LB / RB | B(도감) / U(퀘스트 일지) | HEAL / FIRE |
| LT / RT | - | ICE / BOLT |
| L3 / R3 (스틱 누르기) | T(미니맵) / - | WARD / NOVA |
| Start / Select | O(설정) / ?(도움말) | - / STEAL |

타이틀에서는 D-pad ←/→ 로 슬롯을 고르고 A 로 시작한다(세이브가 있으면 이어하기, 없으면 새 게임). 타이틀의 C/N/P/D/U 와 그 Y 확인, 필드의 S·M·Q·CTRL+S 는 키보드로 누른다. 소리는 키보드·마우스·터치 입력으로 한 번 깨운 뒤에 난다(패드 입력은 브라우저가 사용자 동작으로 치지 않는다).

## build / run

[Bun](https://bun.sh) 필요. 글꼴 Press Start 2P(OFL)는 `@fontsource/press-start-2p` 의 라틴 subset 으로, 긴 글(대화·설명)의 Departure Mono(Helena Zhang, SIL OFL 1.1, [departuremono.com](https://departuremono.com/))는 공식 배포본을 같은 라틴 범위로 잘라 `src/assets/fonts/`(라이선스 `OFL.txt`)에 넣어 번들에 들어 있어, 폰트 CDN 에 닿지 못하는 오프라인·사내망에서도 같은 글꼴로 나온다.

```bash
bun install

# 개발 서버 (http://localhost:5199)
bun run dev --port 5199 --strictPort

# 프로덕션 빌드 (tsc + vite build → dist/)
bun run build

# 빌드 결과 미리보기
bun run preview

# 보스 전투 밸런스 시뮬 (보스 5종 x 레벨 1~30 승률·라운드·받은 피해, 옵션은 --help)
# 후반 키트: --refine N, --forged, --ng N, --abyss FLOOR, --hipotions N, --talisman, --meal atk|def
bun run sim:battle
```

### Claude Code 스킬(선택)

Claude Code 로 이 저장소를 작업할 때 Phaser 공식 에이전트 스킬을 쓰려면 저장소 루트에서 설치한다. 출처는 [phaserjs/phaser](https://github.com/phaserjs/phaser) 저장소의 `skills/`(Phaser 공식, MIT)이고, 그중 이 게임에 쓰는 10개만 고른다.

```bash
DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 bunx skills add phaserjs/phaser -a claude-code --copy -y \
  -s input-keyboard-mouse-touch scenes text-and-bitmaptext scale-and-responsive tweens \
     render-textures filters-and-postfx audio-and-sound v4-new-features v3-to-v4-migration
```

- bun 이 없으면 `bunx` 를 `npx` 로 바꾸면 된다
- `-a claude-code`: Claude Code 에만 설치한다(다른 에이전트 폴더는 만들지 않는다)
- `--copy`: 링크 대신 파일을 복사한다
- `-s`: 설치할 스킬 이름(여러 개). `-y` 는 확인 질문을 건너뛴다
- `DISABLE_TELEMETRY=1 DO_NOT_TRACK=1`: CLI 가 기본으로 보내는 익명 사용 통계와 보안 감사 요청을 끈다
- `-g` 를 붙이면 이 저장소 대신 `~/.claude/skills/` 에 전역 설치한다
- 고를 수 있는 전체 목록은 설치 없이 `bunx skills add phaserjs/phaser -l` 로 본다

설치하면 `.claude/skills/<스킬 이름>/` 에 생기고, 새로 연 Claude Code 세션부터 불러온다. 설치한 것 보기·업데이트 확인·업데이트·삭제는 `bunx skills list`, `bunx skills check`, `bunx skills update`, `bunx skills remove <스킬 이름>` 이다(같은 환경변수를 앞에 붙인다). `.claude` 가 개인 전역 gitignore 에 걸린 환경이면 설치한 스킬이 git 에 잡히지 않으니, 체크아웃마다 위 명령으로 다시 설치한다.

## deploy

`main` 브랜치에 push하면 GitHub Actions가 빌드해 GitHub Pages로 자동 배포
