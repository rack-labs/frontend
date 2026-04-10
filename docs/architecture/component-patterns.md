# 컴포넌트 패턴 정리

이 문서는 코드베이스 내 컴포넌트 작성 규칙과 공통 패턴을 기록한다.

---

## 파일 구조

```
src/components/
  ComponentName/
    ComponentName.jsx
    ComponentName.module.css
    hooks/          # 컴포넌트 전용 커스텀 훅 (필요 시)
    utils/          # 컴포넌트 전용 유틸 함수 (필요 시)
```

- 컴포넌트 이름 = 폴더명 = 파일명 (PascalCase)
- JSX + CSS Module 한 쌍이 기본 단위
- 섹션 컴포넌트는 `sections/` 하위에 위치

---

## CSS Module 규칙

- 클래스명은 camelCase
- 디자인 토큰은 `src/Styles/main.css`의 CSS 변수만 사용 (하드코딩 금지)
- 주요 토큰:

| 종류 | 변수 |
|---|---|
| 기본 배경 | `--color-bg` (#0A0A0C) |
| 서피스 배경 | `--color-bg-surface-80` |
| 포지티브(파랑) | `--color-bg-positive` (#0D93F2) |
| 텍스트 | `--color-text`, `--color-text-sub`, `--color-text-muted`, `--color-text-disabled` |
| 보더 | `--color-bg-white-5`, `--color-border-negative` |
| 성공 | `--color-success` (#22C55E) |
| 에러 | `--color-error` (#EF4444) |
| 포인트 | `--color-accent` (#00F2FF) |
| 폰트 크기 | `--font-size-xm` ~ `--font-size-xl`, `--font-size-display` |
| 폰트 굵기 | `--font-weight-medium` (400), `--font-weight-bold` (700) |
| 테두리 반경 | `--border-radius` (0.4rem), `--border-radius-round` |
| 컨테이너 너비 | `--width-container` (128rem) |

- `font-size: 62.5%` 기준 → `1rem = 10px`

---

## Button 컴포넌트

```jsx
<Button
  label="텍스트"
  theme="positive"   // 'positive' | 'negative'
  width="17.4rem"    // CSS 값 (기본)
  height="5.8rem"
  fontSize="var(--font-size-md)"
  disabled={false}
  onClick={handler}
/>
```

- `disabled` 시 `pointer-events: none` + `--color-surface-2` 배경으로 시각적 비활성화
- hover: `filter: brightness(1.2)` + `translateY(-0.1rem)`
- active: `scale(0.97)` + `translateY(0.1rem)`
- focus-visible: `outline` 표시

---

## Panel 컴포넌트

```jsx
<Panel icon={IconImage} label="패널 제목">
  {children}
</Panel>
```

- 고정 너비 `39rem`, 패딩 `2.4rem`
- 헤더: 아이콘(14×14px) + h3 타이틀
- 배경: `--color-bg-surface-80`, 보더: `--color-bg-white-5`
- `icon` prop 생략 시 아이콘 미표시

---

## Toggle 컴포넌트

```jsx
<Toggle
  label="레이블"
  checked={boolean}
  onChange={(newValue) => {}}  // boolean 전달
/>
```

- `label` 컴포넌트 클릭 전체 영역이 인터랙션 대상 (`<label>` 래핑)
- on 상태: `--color-bg-positive` 트랙 + 썸 우측 이동

---

## 상태 관리 패턴

현재: 로컬 `useState` (추후 Zustand 전환 예정)

```js
// store shape (context.md 기준)
{
  status: 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'
  videoFile: File | null
  jobId: string | null
  skeletonData: SkeletonJSON | null
  analysisResult: AnalysisResult | null
  vizConfig: { showSkeleton: boolean, jointLoad: boolean, angleOverlay: boolean }
}
```

- `vizConfig`는 백엔드에 전달하지 않음 — 순수 프론트 렌더링 옵션
- 부모 컴포넌트가 `vizConfig`와 `handleVizChange(key, value)`를 소유하고 자식에게 prop으로 전달

---

## 커스텀 훅 패턴

- 컴포넌트 디렉터리 안 `hooks/` 폴더에 위치
- 이름: `use[동작]` (camelCase)
- React ref는 의존성 배열에 넣지 않음 (`.current`가 바뀌어도 ref 객체 자체는 불변)
- 자주 바뀌는 값(vizConfig 등)은 ref로 추적해 RAF 루프 재시작 없이 반영:

```js
const latestRef = useRef(value)
useEffect(() => { latestRef.current = value }, [value])
// RAF 콜백 내에서 latestRef.current 읽기
```

---

## 섹션 컴포넌트 레이아웃

```css
/* 섹션 기본 구조 */
.section {
  width: 100%;
  padding: 8rem 0;
  display: flex;
  justify-content: center;
}

/* 컨테이너 */
.layout {
  width: var(--width-container); /* 128rem */
  padding: 0 2.4rem;
}
```

- 섹션은 `id` 앵커 속성 보유 (`#coreDemo`, `#dataInsight`, `#pipeline`)
- 컨테이너 최대 너비 `128rem`, 좌우 패딩 `2.4rem`

---

## 이미지/아이콘

- `src/assets/images/` 에 PNG/SVG 저장
- 아이콘 파일명 컨벤션: `icon_[Name].png`
- JSX에서 `import`로 불러와 `<img src={icon} />` 사용

---

## 조건부 렌더링 패턴 (status 기반)

```jsx
{status === 'done' ? (
    <ActiveContent />
) : (status === 'uploading' || status === 'analyzing') ? (
    <LoadingState />
) : status === 'error' ? (
    <ErrorState />
) : (
    <IdlePlaceholder />
)}
```
