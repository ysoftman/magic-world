# TODO

완료되지 않은(진행 중) 작업과 앞으로 작업할 내용을 기록한다. 완료된 항목은 삭제한다.

## 진행 중

## 예정

- 패드로 조작할 때 패널 키 안내 줄을 패드 표기로(전 패널 공통): 힌트는 `isTouchDevice()` 로 터치/키보드 두 갈래뿐이고 `Gamepad.ts` 에는 패드를 쓰는 중인지 알 수 있는 상태가 없음. 그래서 상점의 LB/RB 판매 전환 같은 패드 전용 동작은 README 로만 안내됨
- 깊은 씬(숲·설원·겨울 마을·동굴·화산)의 해질녘·새벽 30분이 예전보다 덜 파랗고 회보라로 바뀜(NightOverlay `nightBlue`, 피부 hue 8~31° 를 위해 결정) — 숲의 "푸른 시간" 이 회보라로 읽히는지 실기기에서 눈으로 확인. 헤드리스 swiftshader 측정이라 실 GPU 블렌딩 반올림이 다르면 hue 가 ±3~4° 흔들릴 수 있음(여유 피부 9.0°, 그림자 8.2°)
- 밤 라이트맵(NightOverlay): 실기기(모바일) 프레임 비용 확인 — 헤드리스 데스크톱 Chrome 에서는 사각형과 차이 없음(스텝 약 1.0ms), 램프 있는 씬(마을·화산)만 +3.7MB. 화산은 용암 둘레 바위의 주황 안개가 줄어 분위기가 바뀌었으니 실기기에서 눈으로도 확인
- 텍스트를 RetroFont BitmapText 로 옮기기(장기): DPR 과 무관하게 선명하고 글자 텍스처 메모리(해상도 3 에서 약 37MB)와 갱신 비용이 거의 사라짐. setStroke 외곽선 미지원이라 외곽선 변형을 따로 구워야 하고 retroStyle(5)(2.5배)는 고르지 않은 픽셀이 됨 — Phaser 스킬 검토(qa) 후보 8
- 전체화면 실기기 확인: 안드로이드 Chrome(행 탭·D-pad →), iPad/macOS Safari, Firefox — 헤드리스 Chrome 에서만 확인함(설정의 FULLSCREEN 줄, `SettingsUI.setFullscreen`)
- 게임패드(src/ui/Gamepad.ts): 실기기 패드로 확인 필요 — playwright 의 가짜 navigator.getGamepads(standard mapping)로만 검증함(타이틀 A 새 게임·이어하기, D-pad·왼쪽 스틱 이동과 데드존, Select 도움말, L3 미니맵, 전투 A 메시지 넘김·X FIGHT·L3 WARD·R3 NOVA·Select STEAL, 필드 LT HUD·RT 음소거·R3 나가기 질문, 타이틀 X/LB/RB/LT 질문과 Y 확인·RT 음소거). standard 가 아닌 배치의 패드는 같은 번호로 짐작해 읽음. 패드 입력은 브라우저 user activation 이 아니라 AudioContext 는 키보드·클릭 뒤에만 깨어남. 패드 매핑 없음: 필드의 CTRL+S(sendKey 에 modifier 가 없음, R3 Q 로 나가면 저장됨), 타이틀의 X(손상 사본 삭제)와 C(A 가 대신함). Switch Pro 는 standard 3번(Y 자리)이 Nintendo 표기로 X 라 타이틀 확인 버튼 이름이 어긋남
- 가을 숲 전투 배경: 진홍 벽을 자두빛 황혼·먼지 낀 황갈색 벽으로 다시 칠해 전투 띠 chroma 0.20→0.14(봄 숲 0.16, 겨울 숲 0.14, 캐릭터 평균 0.35)로 낮춤 — 헤드리스 chromium 측정뿐이라 실기기에서 눈으로 확인 필요
- 안내 화살표(GuideArrow, 깊이 10.5): 실기기에서 크기·밝기 눈으로 확인 필요. 헤드리스(DPR 1)로는 5개 필드 씬 낮·밤 모두 확인함(이름표 아래, 밤 그늘 아래, 지역 제목·HUD 와 안 겹침)
- 날씨 효과음·지역 환경음·지역 전투 BGM 은 헤드리스 게인/배열 값으로만 검증됨 — 실기기에서 들어보고 RAIN_VOLUME/WIND_VOLUME/AMBIENCE_VOLUME 조정. 기준선(마스터 버스 AnalyserNode, 리미터 앞, 가중 없는 RMS dBFS, BGM/SFX 볼륨 1, 환경음·효과음은 0.4초 간격 6회): BGM -31, 비 최대 -36, 바람 최대 -38, 부엉이 -36, 물방울 -41, 새 -45, 우르릉 -48, 귀뚜라미 -51, 공격 효과음 -28. 비 최대는 RAIN_VOLUME 0.035→0.018 적용 후 -36(BGM 보다 6dB 아래, 보통 비 -40) — 광대역 잡음이라 RMS 보다 크게 들린다는 근거로 정한 출발점. 천둥(thunder(1))은 400ms 최대 -20 인데 에너지가 거의 150Hz 아래라(150Hz 하이패스 뒤 -41) 노트북 스피커와 헤드폰에서 따로 들어 볼 것 — 노트북에서 안 들리면 음량 대신 대역(lowpass 시작 300Hz)을 올리는 쪽
- 요리(cooking.ts): 음식을 끊기지 않게 유지할 만큼(5전투마다 재료 2개) 밭·낚시 공급이 따라가는지 실플레이로 확인 — 밸런스 시뮬은 재료 무한 가정이고 수치는 cooking.ts 주석. MOON TEA 차단은 난수라 코드 확인만 함
- 보물 지도(treasure.ts): 시급 영향은 밸런스 시뮬 수치로 주석에 정리(시간당 ~5장, 골드는 본전 근처). 지역별 골드·소재/CANDY/장비 확률은 실플레이로 확인 필요
- 필드 씬 공통화 5단계 이후(미착수): 패널 묶음(FieldPanels)과 페이드 중 입력 차단(`FieldKeys.leaving()`)은 끝남. 업적 1초 확인, SAVED 토스트 구독, 걷기·로머·조우·출구 페이드, shutdown 정리가 아직 6개 씬에 중복. S·M 은 아직 키를 누른 채 씬이 바뀌면 repeat keydown 을 받음(I 는 통일함)
- 터치에서 필드 맵의 오른쪽 아래 모서리가 Z·ESC 원판 밑에 깔림(동굴 상자 (22,14) 는 Z 아래 반쯤, 그쪽을 걷는 영웅도). 동굴만 카메라를 한 타일 더 내렸다(`TOUCH_CAMERA_FOOT`) — sceneCommon `boundCameraToMap` 에 터치 여백을 일반화할지 검토
