나는 지금 운동 영상 분석 웹앱을 React로 개발 중이다.

## 프로젝트 개요
사용자가 동영상 하나를 업로드하면, FastAPI 백엔드("C:\Users\neighbor\Documents\Code\Github\rack-tracker-forked\poseLandmarker_Python")가
1. OpenCV로 프레임 추출
2. MediaPipe BlazePose로 프레임별 스켈레톤(관절 좌표) 추출
3. 데이터 분석 파이프라인 실행
4. LLM 피드백 생성
을 수행하고, 결과물 JSON 2개(skeleton JSON, analysis+LLM JSON)를 프론트로 반환한다.

## 프론트엔드 아키텍처
단일 페이지(Landing). 섹션별 앵커 내비게이션 구조.

```
App
├── MainHeader                   # 로고 / nav(#coreDemo, #dataInsight, #pipeline) / CTA 버튼
├── HeroSection                  # 헤드라인, 서브카피, Start Demo / View Tech Docs 버튼
├── CoreDemoSection  #coreDemo   # 분석 설정 + 스켈레톤 뷰어
│   ├── Panel("Analysis Settings")
│   │   ├── VideoUpload          # 드래그&드롭 업로드 영역 (MP4, MOV / Max 50MB)
│   │   ├── FpsSelector          # Sampling Rate 토글 (30 / 60 / 120 FPS)
│   │   └── Button "Start Analysis"  # videoFile 없으면 disabled
│   ├── Panel("Visualization Settings")
│   │   ├── Toggle "Show Skeleton"   # 스켈레톤 오버레이 표시 여부
│   │   ├── Toggle "Joint Load"      # 관절 부하 히트맵 표시 여부
│   │   └── Toggle "Angle Overlay"   # 관절 각도 수치 오버레이 표시 여부
│   └── SkeletonViewer               # 분석 결과 렌더링 (status === 'done' 시 활성)
│       # vizConfig { showSkeleton, jointLoad, angleOverlay } 에 따라 시각화 옵션 적용
│       # vizConfig는 백엔드에 전달하지 않음 — 순수 프론트 렌더링 옵션 (B안 채택)
├── DataInsightSection #dataInsight  # AnalysisBoard — 분석 수치/LLM 피드백 표시
├── PipelineSection    #pipeline     # 기술 파이프라인 다이어그램/설명
└── Footer
```

설계는 `C:\Users\neighbor\Documents\Code\Github\racl-labs-frontend-forked\app\src\assets\Figma\MVP_v1.svg` 참고.

### 현재 구현 완료
| 컴포넌트 | 경로 | 상태 |
|---|---|---|
| Button | components/Button/Button.jsx | ✅ disabled prop 포함 |
| Panel | components/Panel/Panel.jsx | ✅ |
| VideoUpload | components/VideoUpload/VideoUpload.jsx | ✅ 선택 완료 상태 포함 |
| FpsSelector | components/FpsSelector/FpsSelector.jsx | ✅ |
| MainHeader | components/sections/MainHeader | ✅ |
| HeroSection | components/sections/HeroSection | ✅ |
| CoreDemoSection | components/sections/CoreDemoSection | 구현중 (2열 레이아웃 완료) |
| SkeletonViewer | components/SkeletonViewer | ✅ Live Sync View (video+canvas overlay, 재생 컨트롤) |
| Footer | components/sections/Footer | 껍데기만 존재 |

## 상태 타입
```ts
type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

store shape:
{
  status: AnalysisStatus
  videoFile: File | null
  jobId: string | null
  skeletonData: SkeletonJSON | null
  analysisResult: AnalysisResult | null
  vizConfig: {
    showSkeleton: boolean   // default: true
    jointLoad: boolean      // default: false
    angleOverlay: boolean   // default: false
  }
}
```

## 규칙
- 상태관리: Zustand (Context에서 이전 예정 or 처음부터 Zustand)
- 백엔드 통신: REST (FastAPI) — upload → polling으로 status 확인 → done이면 results fetch
- status === 'done' 시점에 CoreDemo, AnalysisBoard가 데이터 받아 렌더링
- api/ 함수는 store를 직접 건드리지 않음. 컴포넌트에서 호출 후 store에 set
- vizConfig는 백엔드 API 요청에 포함하지 않음. status === 'done' 이후 SkeletonViewer에만 prop으로 전달하는 순수 프론트 렌더링 옵션 (B안)

## 지금 할 작업
다음 단계: Zustand store 연결 및 API 통신 구현 (브랜치: 1-feature-frontend-first-markup)

- [x] Toggle 컴포넌트 — on/off 토글 UI
- [x] VisualizationSettings 패널 — Show Skeleton / Joint Load / Angle Overlay 토글 3개
- [x] CoreDemoSection에 VisualizationSettings 패널 추가
- [x] SkeletonViewer (Live Sync View) — video+canvas overlay, scrubber, 배속, 프레임 이동
- [x] CoreDemoSection 2열 레이아웃 (좌: 설정 패널, 우: SkeletonViewer)
- [ ] Zustand store 설정 — `AnalysisStatus` + `vizConfig` 포함한 store shape 구현
- [ ] `api/` 모듈 작성 — upload, polling, results fetch
- [ ] CoreDemoSection에서 store 연결 — `handleStartAnalysis` 로직 구현
- [ ] SkeletonViewer 컴포넌트 — `status === 'done'` 시 `vizConfig`에 따라 렌더링
- [ ] DataInsightSection — AnalysisBoard, LLM 피드백 표시
