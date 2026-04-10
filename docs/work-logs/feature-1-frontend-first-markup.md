# [feature] Frontend First Markup

## 작업 목적
프론트엔드 초기 마크업 구현. 서비스의 UI 구조를 HTML/컴포넌트 단위로 처음 작성하는 작업이다.

## 작업 내용
- React 컴포넌트 기반 페이지 구조 구성
- 페이지별 기본 JSX 마크업 작성
- 컴포넌트 단위 레이아웃 분리
- 시맨틱 태그 적용

## 완료 조건
- 주요 페이지 컴포넌트가 React 구조로 작성되어 브라우저에서 렌더링 확인 가능
- 컴포넌트 분리 기준에 따라 파일 구조가 정리된 상태

## 참고 자료

---

## 작업 일지

### 2026-04-01

#### 작업 내용

**1. CSS 전역 스타일 기반 구축** `6efc522`
- `:root`에 CSS 변수 구획 구성 (color, typography, spacing, layout, border, shadow, animation, z-index)
- Figma(MVP_v1.svg)에서 색상 추출 → 배경(`--color-bg`, `--color-surface`, `--color-surface-2`), 주요 색상(`--color-primary`, `--color-accent`), 상태 색상(success, error), 텍스트 계열 5단계 변수로 정의
- `sr-only` 유틸리티 클래스 작성
- `html, body, #root` 전역 스타일 및 `.container` 레이아웃 기반 정의
- Pretendard 폰트 npm 설치 및 `main.jsx`에서 import

**2. 컴포넌트 폴더 구조 초기화 및 에셋 경로 정리** `dbc22cf`
- SVG 에셋을 `docs/Figma/` → `app/src/assets/Figma/`로 이동
- `pages/Landing.jsx` 생성
- `components/sections/` 하위에 섹션별 폴더 구성
  - NavBar, HeroSection, FeatureSection, ShowcaseSection, CtaSection, Footer
  - 각 섹션마다 `.jsx` + `.module.css` 쌍으로 구성

---

#### 배운 내용 및 실무 적용

**CSS 변수 두 레이어 전략**
팔레트(원시 색상값)와 시맨틱(용도별 이름) 두 레이어로 분리하는 방식을 이해했다.
현재 프로젝트 규모상 팔레트 없이 시맨틱 변수만 직접 정의했고, 나중에 다크모드 등 테마 추가 시 시맨틱 변수만 재정의하면 된다.

**`clip` deprecated → `clip-path: inset(50%)`**
`sr-only`에서 기존에 많이 쓰던 `clip: rect(...)` 대신 `clip-path: inset(50%)`를 사용했다. `clip`은 deprecated 속성이므로 지양해야 한다.

**CSS import는 `index.html`이 아닌 `main.jsx`에서**
Vite + React 환경에서 CSS를 `index.html`의 `<link>`로 넣는 것보다 `main.jsx`에서 import하는 것이 관심사 분리에 맞고, Vite가 번들링/최적화까지 처리해준다.

**컴포넌트 구조 설계 기준**
- `sections/` — 해당 페이지 전용, 재사용 의도 없는 섹션 컴포넌트
- `components/` — 여러 곳에서 재사용 가능한 공통 컴포넌트
- 섹션도 마크업 범위가 있으므로 각자 `.module.css`를 갖는 구조로 결정

**git push 원칙 확립**
fork 기반 워크플로우에서 `git push`만 단독으로 사용하면 tracking 설정에 따라 upstream으로 푸시될 수 있다. 항상 `git push origin <branch>`로 명시해야 한다.
