# TODO

완료되지 않은(진행 중) 작업과 앞으로 작업할 내용을 기록한다. 완료된 항목은 삭제한다.

## 진행 중

(없음)

## 예정

전부 실기기나 사람 귀·눈으로만 확인할 수 있는 항목이다(헤드리스 측정은 끝남). 측정 기준과 조정 지점은 AGENTS.md 해당 절에 있다.

- 모바일 실기기 프레임 비용: 타이틀 시트 warm(`warmSheets`)과 전투 날씨 field 굽기, 마을 첫 진입, 첫 전투(숨결·`petrify`·`soul-rise` 포함 상태·기술 시트 warm), 밤 라이트맵(NightOverlay), 실시간 캔버스(`lightCanvas.ts`: 숲 빛줄기·축제 불꽃·별똥별·엔딩 불꽃), 설원 오로라(`AURORA_STEP_MS`). 느리면 시트 프레임 수·crop·캔버스 크기·주기부터 줄인다
- 눈으로 확인: 깊은 씬의 해질녘·새벽이 회보라로 읽히는지(`nightBlue`), 화산 용암 둘레 분위기(라이트맵), 설원 낮 서리 숨결이 옅지 않은지
- 전체화면 실기기 확인: 안드로이드 Chrome, iPad/macOS Safari, Firefox(설정의 FULLSCREEN 줄, `SettingsUI.setFullscreen`)
- 소리 청취: 날씨·환경음(`RAIN_VOLUME`/`WIND_VOLUME`/`AMBIENCE_VOLUME`)과 천둥(노트북 스피커·헤드폰에서 따로, 안 들리면 lowpass 시작 300Hz 를 올림), 효과음 키트(`src/sfxKit.ts`: 낮은 소리 웅웅거림, 메뉴 `move` 거슬림, `error` 빈도, 동굴·화산의 `SFX_KEY_SHIFT`, 포탈 `warp-out`·`warp-in` 구분)
- 2px 칸 작업(2026-11-07)의 모바일 실기기 확인: 전투 시트 2배 밀도(Lv30 기술 34장 약 52MB, 타이틀 warm 약 2.6초), 필드에서 기술 시트 미리 굽기(마을 프레임 최대 16ms 근처, `MOVES_WARM_MS`·`BAKE_BUDGET_MS`), 전투 날씨 640x236 캔버스, 상태 이펙트 HD 몸(그 자리 굽기 56~80ms)
- 2px 칸이 아닌 채 남긴 것(결정): 엔딩 불꽃·낚시 패널 1px, 아이템 아이콘·HUD 날씨 아이콘 0.5배, 도감 아이콘 0.5배(2px 로 하려면 64px 라 줄 배치를 다시 짜야 함), 숲 빛줄기·날씨의 하늘 패스(pixelfx 가 4px 칸마다 계산), 움직이는 스프라이트의 홀수 px 위치 위상
