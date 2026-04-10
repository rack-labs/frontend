# Core Demo / Analysis Dashboard Rebuild Plan

작성일: 2026-04-09

기준 문서:
- `docs/architecture/frontend-api-integration-guide.md`

관련 구현 위치:
- `app/src/components/sections/CoreDemoSection/CoreDemoSection.jsx`
- `app/src/components/VisualizationSettings/VisualizationSettings.jsx`
- `app/src/components/SkeletonViewer/SkeletonViewer.jsx`
- `app/src/components/sections/AnalysisDashboardSection/AnalysisDashboard.jsx`

## 1. 목적

`frontend-api-integration-guide.md`를 단일 기준으로 삼아 현재 프론트의 `Core Demo` 섹션과 `Analysis Dashboard` 섹션을 실제 동작 가능한 구조로 재정비한다.

이번 작업의 범위는 다음과 같다.

- `analysisSettingsPanel`에 API 요청에 필요한 입력값을 추가한다.
- `CoreDemoSection` 안에 loading spinner + stepper UI + pipeline visualization을 실제 polling 데이터에 연결한다.
- `Visualization Settings`에 실제 지원 가능한 시각화 옵션 토글을 확장한다.
- `Live Sync View`를 하단 별도 2열 섹션의 큰 뷰어 영역으로 유지하되, 실제 `/jobs -> polling -> /result + /skeleton` 흐름에 맞게 수정한다.
- `Analysis Dashboard`를 mock 의존 구조에서 실제 API 응답 렌더 구조로 교체한다.
- 이미 존재하는 콘텐츠와 섹션 성격은 유지하되, 데이터 소스와 정보 구조를 실제 응답 계약에 맞게 재구성한다.

## 2. 현재 상태 요약

### 2.1 Core Demo

현재 `CoreDemoSection`은 다음 상태다.

- `videoFile`, `fps`, `status`, `skeletonData`, `analysisResult`, `vizConfig`를 로컬 state로 보유
- `handleStartAnalysis`는 비어 있음
- `Start Analysis` 버튼은 업로드 파일 존재 여부만 확인
- `analysisSettingsPanel`에는 `videoFile`과 `samplingFps`만 존재

즉, 실제 API 호출과 job orchestration이 전혀 연결되어 있지 않다.

### 2.2 Visualization Settings

현재 토글은 3개뿐이다.

- `showSkeleton`
- `jointLoad`
- `angleOverlay`

하지만 실제 백엔드 계약상 `analysis.visualization`, `analysis.timeseries`, `analysis.events`, `analysis.issues`, `repSegments`를 조합해 더 풍부한 오버레이와 표시 제어가 가능하다. 현재 이름도 백엔드 응답 키와 1:1로 연결되지 않는다.

### 2.3 Live Sync View

현재 `SkeletonViewer`는 다음 전제를 갖고 있다.

- 완료 상태를 `done`으로 가정
- `skeletonData.fps`, `skeletonData.frames` 구조를 가정
- `analysisResult.frames[].joint_load`, `analysisResult.frames[].joint_angles` 구조를 가정

이 전제는 기준 문서와 다르다.

- 완료 상태는 `completed`
- skeleton 데이터는 `/jobs/{jobId}/skeleton` 응답 구조 기준
- `/result`의 주 데이터는 `analysis`, `llmFeedback`, `benchmark`
- frame별 overlay 정보는 `timeseries`, `events`, `issues`, `repSegments`, `visualization` 조합 기준으로 재구성해야 함

### 2.4 Analysis Dashboard

현재 `AnalysisDashboard`는 실제 계약과 맞지 않는 mock 구조를 기대한다.

- `analysisResult.metrics`
- `analysisResult.feedback`
- `analysisResult.skeletonJson`

반면 기준 문서의 실제 응답 구조는 다음이다.

- `analysis.summary`
- `analysis.kpis`
- `analysis.timeseries`
- `analysis.repSegments`
- `analysis.events`
- `analysis.issues`
- `analysis.visualization`
- `llmFeedback`
- `benchmark`

즉, 현재 Dashboard는 거의 전면 교체가 필요하다.

## 3. 목표 상태

### 3.1 Core Demo 목표

`CoreDemoSection`은 단순 UI 조합이 아니라 분석 세션 진입점이 되어야 한다.

목표 동작:

1. 사용자가 비디오와 분석 옵션 입력
2. `POST /jobs` 호출
3. `jobId` 저장 후 `GET /jobs/{jobId}` polling
4. polling 중 `CoreDemoSection`에서 loading spinner + stepper UI + pipeline visualization 갱신
5. `completed` 시 `GET /jobs/{jobId}/result`
6. 이어서 `GET /jobs/{jobId}/skeleton?offset=0&limit=300`
7. 결과를 store에 병합
8. 하단 2열 섹션의 `Live Sync View`와 `Analysis Dashboard`가 같은 분석 세션 데이터를 공유 렌더

### 3.2 Analysis Settings 목표

패널 입력값은 기준 문서의 요청 필드와 맞춰야 한다.

필수/기본 노출 대상:

- `video`
- `samplingFps`
- `exerciseType`
- `bodyweightKg`
- `externalLoadKg`
- `barPlacementMode`
- `modelAssetPath`
- `modelVariant`
- `delegate`

UI 정책:

- `exerciseType`은 현재 `squat`만 선택 가능하도록 제한
- `bodyweightKg`, `externalLoadKg`는 숫자 입력
- `barPlacementMode`는 `auto | high_bar | low_bar`
- `modelAssetPath`는 항목은 보이되 MVP v1 demo에서는 unsupported 설명과 함께 disabled 처리
- `modelVariant`는 `lite | full | heavy`
- `delegate`는 `CPU | GPU` 항목을 보여주되 MVP v1 demo에서는 `GPU`를 unsupported 설명과 함께 disabled 처리
- 개발용 mock video 무파일 실행은 초기 구현에서는 숨기거나 dev-only로 분리

### 3.3 Visualization Settings 목표

토글은 "실제 뷰어에서 제어 가능한 시각화 기능" 기준으로 재정리한다.

1차 지원 토글 후보:

- `showSkeleton`
- `showJointLabels`
- `showAngleOverlay`
- `showIssueMarkers`
- `showRepBoundaries`
- `showEventMarkers`
- `showPathTrace`
- `showConfidenceTint`

정책:

- 백엔드에 전송하지 않는 프론트 렌더링 설정으로 유지
- 실제 사용 가능한 데이터가 없으면 토글은 숨기지 말고 disabled 또는 no-op로 두지 말고, 1차 범위에서 지원 가능한 것만 노출
- 현재 `jointLoad`는 실제 백엔드 계약에 직접 대응하지 않으므로, 유지 여부를 재검토한다.
  - `analysis.visualization` 또는 유사 frame-level 데이터가 확인되면 유지
  - 아니면 `showPathTrace` 또는 `showIssueMarkers`로 대체

## 4. 권장 아키텍처

## 4.1 새 모듈 구조

권장 디렉터리:

- `app/src/api/analysisClient.js`
- `app/src/features/analysis-session/`
- `app/src/features/analysis-session/store.js`
- `app/src/features/analysis-session/selectors.js`
- `app/src/features/analysis-session/adapters.js`

역할:

- `api/analysisClient.js`
  - 순수 fetch 함수만 담당
- `store.js`
  - 분석 세션 상태, polling lifecycle, 요청 취소, 결과 병합, adaptive polling 정책 담당
- `adapters.js`
  - `/result`, `/skeleton`, `/benchmark` 응답을 UI 친화 구조로 변환
- `selectors.js`
  - Core Demo와 Dashboard가 공통으로 쓰는 파생 데이터 계산

## 4.2 상태 모델

기준 문서에 맞춰 상태를 재정의한다.

```ts
type AnalysisStatus =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'generating_feedback'
  | 'completed'
  | 'error'
```

권장 store shape:

```ts
type AnalysisSessionStore = {
  status: AnalysisStatus
  form: {
    videoFile: File | null
    samplingFps: number | null
    exerciseType: 'squat'
    bodyweightKg: number | null
    externalLoadKg: number | null
    barPlacementMode: 'auto' | 'high_bar' | 'low_bar'
    modelAssetPath: string | null
    modelVariant: 'lite' | 'full' | 'heavy' | null
    delegate: 'CPU' | 'GPU' | null
  }
  vizConfig: {
    showSkeleton: boolean
    showJointLabels: boolean
    showAngleOverlay: boolean
    showIssueMarkers: boolean
    showRepBoundaries: boolean
    showEventMarkers: boolean
    showPathTrace: boolean
    showConfidenceTint: boolean
  }
  jobMeta: {
    jobId: string | null
    progress: null | {
      stage: string
      currentStep: number
      totalSteps: number
      ratio: number
    }
    error: null | {
      code: string
      message: string
    }
  }
  summaryResult: MotionAnalysisSummary | null
  skeletonPage: SkeletonPageResponse | null
  benchmarkDetails: BenchmarkSummary | null
  videoObjectUrl: string | null
}
```

## 5. 컴포넌트별 변경 계획

### 5.1 `CoreDemoSection`

변경 방향:

- 로컬 state 중심 구조를 세션 store 소비 구조로 교체
- `onAnalysisComplete` prop 기반 상위 전달 제거 또는 최소화
- `Start Analysis` 클릭 시 store action 호출
- 분석 중 중복 제출 방지
- 상태별 버튼 텍스트 변경
  - `idle`: Start Analysis
  - `uploading/queued/extracting/analyzing/generating_feedback`: Analyzing...
  - `completed`: Re-run Analysis

추가 UI:

- 입력 유효성 검증 메시지
- progress stage 표시
- loading spinner + stepper UI + pipeline visualization
- 실패 시 사용자 친화 메시지

### 5.2 `Analysis Settings Panel`

추가할 입력 컴포넌트:

- `ExerciseTypeSelector`
- `NumericField` 2종
  - `bodyweightKg`
  - `externalLoadKg`
- `BarPlacementSelector`
- `ModelVariantSelector`
- `DelegateSelector`
- `ModelAssetPathField`

입력 규칙:

- 숫자 필드는 빈 값 허용 후 submit 시 검증
- 음수 또는 0 입력 방지
- `exerciseType`은 현재 `squat` 고정
- `GPU`와 `modelAssetPath`는 MVP v1 demo에서 disabled 상태로 노출

### 5.3 `VisualizationSettings`

변경 방향:

- 단순 3개 토글에서 확장형 토글 세트로 교체
- 토글 라벨을 backend 계약 기반 명칭으로 맞춤
- 뷰어에서 지원하는 오버레이 기능과 1:1 연결

토글 1차안:

- Skeleton
- Joint Labels
- Angle Overlay
- Rep Boundaries
- Event Markers
- Issue Markers
- Motion Path
- Confidence Tint

제거/보류 후보:

- `Joint Load`
  - 실제 응답 스키마 확인 전까지는 보류

### 5.4 `LiveSyncViewPanel`

변경 방향:

- `CoreDemoSection`과 분리된 하단 2열 섹션의 큰 뷰어 영역으로 유지
- 영상 재생과 skeleton overlay의 실사용 영역을 담당
- polling 진행 상황 자체는 이 패널이 아니라 `CoreDemoSection`에서 표시

### 5.5 `SkeletonViewer`

핵심 수정점:

- 완료 상태 조건을 `done`에서 `completed`로 수정
- `videoFile` 대신 store가 유지하는 `videoObjectUrl` 또는 업로드 원본 `File` 기반 재생
- `/skeleton` 응답 구조에 맞는 frame 선택 로직으로 수정
- `effectiveSamplingFps` 또는 timestamp 기반 동기화 사용
- `analysisResult.frames` 전제 제거

뷰어 내부 책임:

- 현재 video time에 대응하는 skeleton frame 계산
- `repSegments` 경계 오버레이
- `issues/events` 기반 시점 마커
- `analysis.visualization` 또는 adapter 파생값 기반 보조 오버레이

별도 adapter 필요:

- `SkeletonPageResponse.frames[]`를 canvas draw 함수가 쓰기 쉬운 구조로 변환
- `analysis.timeseries`, `repSegments`, `events`, `issues`를 timeline marker 구조로 변환

### 5.6 `AnalysisDashboard`

전면 개편 방향:

현재 3패널 구조를 유지하되 콘텐츠를 실제 응답 기준으로 교체한다.

권장 패널 구성:

1. `Session Summary`
   - `analysis.summary`
   - rep count, duration, source FPS, sampled FPS, detection ratio, bar placement, total system mass

2. `Biomechanics KPIs`
   - `analysis.kpis`
   - 현재 `MetricsList`를 확장 또는 신규 컴포넌트로 교체

3. `Rep Breakdown`
   - `analysis.repSegments`
   - rep별 start/end/bottom, depth angle, eccentric/concentric duration

4. `Movement Issues`
   - `analysis.issues`
   - severity, code, message, rep index, timestamp

5. `LLM Feedback`
   - `llmFeedback.overallComment`
   - `highlights`
   - `corrections`
   - `coachCue`

6. `Timeseries / Diagnostics`
   - `analysis.timeseries` 중 존재하는 series만 선택 렌더
   - `benchmark`는 developer-oriented secondary panel로 lazy load 가능

7. `Raw Skeleton`
   - 현재 `RawSkeletonJson`을 유지하되 `/skeleton` 첫 페이지 또는 선택 frame 기준으로 표시

### 5.7 기존 콘텐츠 유지 방침

이미 있는 섹션의 시각적 성격과 설명 문구는 최대한 유지한다.

유지 대상:

- `CORE DEMO` 섹션 제목/설명
- `ANALYSIS DASHBOARD` 섹션 제목/설명
- `Live Sync View`의 비디오+캔버스 오버레이 컨셉
- `MetricsList`, `LlmFeedback`, `RawSkeletonJson`의 기본 패널 성격

교체 대상:

- mock metric 배열
- 단일 문자열 feedback 렌더
- 전체 skeleton mock JSON 의존

즉, "컨텐츠 추가"는 새 섹션을 임의로 만들기보다 이미 존재하는 Dashboard 패널을 실제 응답 블록으로 채우는 방식으로 진행한다.

## 6. 데이터 매핑 계획

### 6.1 `POST /jobs` 요청 매핑

프론트 form -> API form-data:

- `videoFile` -> `video`
- `samplingFps` -> `samplingFps`
- `exerciseType` -> `exerciseType`
- `bodyweightKg` -> `bodyweightKg`
- `externalLoadKg` -> `externalLoadKg`
- `barPlacementMode` -> `barPlacementMode`
- `modelAssetPath` -> `modelAssetPath`
- `modelVariant` -> `modelVariant`
- `delegate` -> `delegate`

`fps` 필드는 사용하지 않는다.
MVP v1 demo에서는 `modelAssetPath`를 UI에 disabled로 노출하므로 실제 전송에서는 제외될 수 있다.

### 6.2 `/result` 매핑

UI 소비 객체 예시:

- `summaryCards`
- `kpiItems`
- `repItems`
- `issueItems`
- `timeseriesSeries`
- `feedbackViewModel`
- `benchmarkViewModel`

매핑 원칙:

- UI는 raw API shape에 직접 강결합하지 않음
- optional 필드는 adapter에서 빈 배열 또는 null-safe 구조로 정규화
- `llmFeedback` 비어 있음 대비 fallback 포함

### 6.3 `/skeleton` 매핑

필수 파생값:

- `fps`: `videoInfo.effectiveSamplingFps`
- `totalFrames`
- `frames`
- `frameByIndex`
- `timestampMs -> nearestFrameIndex` 검색 유틸

이 adapter가 있어야 `Live Sync View`와 `Raw Skeleton`이 안정적으로 동작한다.

## 7. 구현 순서

### Phase 1. 세션 인프라

- `analysisClient` 작성
- store 작성
- `POST /jobs`, polling, `/result`, `/skeleton` orchestration 구현
- adaptive polling 정책 구현
- 상태/에러 모델 정리

### Phase 2. Core Demo 연결

- `CoreDemoSection`을 store 기반으로 전환
- `analysisSettingsPanel` 입력 확장
- unsupported 입력 항목(`GPU`, `modelAssetPath`, 사실상 `squat`만 허용) 반영
- submit validation 연결
- progress / error UI 연결
- loading spinner + stepper UI + pipeline visualization을 `CoreDemoSection`에 연결

### Phase 3. Live Sync View 교체

- `LiveSyncViewPanel`을 하단 별도 2열 뷰어 영역으로 정리
- `SkeletonViewer`를 실제 응답 구조에 맞게 수정
- timestamp/frame 동기화 수정
- visualization toggles 반영
- timeline marker, rep boundary, issue/event overlay 추가

### Phase 4. Analysis Dashboard 개편

- `AnalysisDashboard`를 실제 응답 기반 패널 구성으로 교체
- KPI / summary / rep / issues / feedback / raw data 렌더 구현
- benchmark는 1차 구현에서 간략 카드 또는 lazy load로 연결

### Phase 5. 마감 정리

- 비어 있는 데이터 fallback 정리
- loading state polish
- 오류 메시지 문구 정리
- 컴포넌트별 prop 인터페이스 단순화

## 8. 완료 기준

다음 조건을 만족하면 계획 범위 구현 완료로 본다.

- 사용자가 비디오와 분석 설정을 입력하고 `Start Analysis`를 실행할 수 있다.
- 프론트가 `POST /jobs` 후 `status === completed` 또는 `status === failed`까지 polling을 수행한다.
- polling은 적응형 정책을 사용한다.
  - 초기 짧은 구간 `500ms`
  - 일반 구간 `1000ms`
  - 탭 비활성화 또는 장시간 대기 구간에서는 더 느리게 조정 가능
- stepper의 부드러운 시간 표시는 초고빈도 polling이 아니라 프론트 elapsed-time 보간으로 구현한다.
- `completed` 시 `/result`와 `/skeleton`을 모두 fetch 한다.
- loading spinner + stepper UI + pipeline visualization이 `CoreDemoSection`에서 동작한다.
- `Live Sync View`가 업로드한 원본 비디오와 skeleton frame을 실제로 동기 표시한다.
- Visualization 토글이 실제 오버레이 표시 여부를 제어한다.
- `Analysis Dashboard`가 mock 이 아니라 `analysis`, `llmFeedback`, `benchmark` 기반으로 렌더한다.
- `exerciseType`은 `squat`만 허용한다.
- `GPU`와 `modelAssetPath`는 MVP v1 demo에서 unsupported / disabled 처리된다.
- 실패 상태와 빈 LLM 응답에 대한 fallback이 존재한다.

## 9. 리스크와 확인 필요 사항

### 9.1 인코딩

`frontend-api-integration-guide.md`가 현재 콘솔에서 깨져 보인다. 구현 전 문서 인코딩을 UTF-8로 정리하거나, 최소한 필요한 필드명/상태값은 재검증해야 한다.

### 9.2 `analysis.visualization`의 실제 shape

가이드에는 `visualization` 블록이 언급되지만 현재 프론트에서 바로 소비할 수 있는 구체 shape가 부족하다. 따라서 1차 구현은 `repSegments`, `events`, `issues`, `timeseries` 중심으로 오버레이를 만들고, `visualization`은 보조 소스로 취급하는 편이 안전하다.

### 9.3 Joint Load 토글

현재 viewer 코드의 `jointLoad`는 `analysisResult.frames[].joint_load`를 기대하지만 기준 문서에는 그 구조가 명시되지 않는다. 이 기능은 backend 실제 응답 샘플 확인 전까지 제거 또는 보류 가능성이 높다.

### 9.4 benchmark 범위

`benchmark`는 개발자용 정보에 가깝다. Dashboard의 핵심 UX를 먼저 `summary`, `kpis`, `issues`, `llmFeedback`, `repSegments`로 완성한 뒤 2순위로 연결한다.

## 10. 이번 계획 문서의 결론

이번 리빌드는 단순한 입력 필드 추가 작업이 아니다. 실제로는 다음 세 가지를 함께 바꿔야 한다.

- 분석 세션 상태 모델
- API 응답 adapter 구조
- Core Demo / Live Sync View / Dashboard의 공통 데이터 소비 방식

따라서 구현은 `UI patch`가 아니라 `analysis session` 중심의 재배선으로 진행해야 한다. 그 기준은 반드시 `frontend-api-integration-guide.md`로 고정한다.
