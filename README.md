# pjt-alpha-hunter

> “Early signals. Deep research. Real alpha.”

Alpha Hunter는 기존 뉴스/미디어 중심 분석이 아닌,
커뮤니티·오픈소스·리서치·디벨로퍼 생태계에서 나오는
**원천/raw/nerdy 신호**를 중심으로
새로운 기술, 섹터, 그리고 “원석 같은 기업”을 조기에 발견하는 프로젝트입니다.

기존 프로젝트인 **pjt-warren-buffett**와 연동하여:
- 거시/리짐/섹터 맥락을 공유하고,
- Alpha Hunter가 발견한 신규 신호를 실제 투자/포트폴리오 전략과 연결하는
**시너지 구조**를 가집니다.

---

## 1. 핵심 철학

- **Raw over polished:** Bloomberg 같은 레거시 미디어보다 먼저 움직이는 신호를 우선.
- **Community-first:** GitHub, Hacker News, Reddit, X, Discord, Research 포럼 등
  실제 빌더/리서처/디벨로퍼들이 모이는 곳에서 데이터를 수집.
- **Signal velocity matters:** 얼마나 빠르게 움직이는가(스타 증가율, 포럼 반응, 트래픽)가 핵심.
- **Structured pipeline:** 데이터는 고정된 소스에서 일관되게 수집 → data.json → 프롬프트 → 인사이트 보고서.
  기존 프로젝트와 동일한 안정적 파이프라인 원칙을 따릅니다.

---

## 2. 프로젝트 목표

1) 조기 발견 (Early Discovery)
- 아직 대중에 알려지지 않았으나:
  - 강한 개발자/리서처 관심
  - 빠른 생태계 성장
  - 실제 사용/어답션 증가
  를 보이는 기술/프로젝트/회사를 발견.

2) 섹터/트렌드 선점 (Sector & Trend Mapping)
- 개별 프로젝트가 아닌
  - 특정 기술 스택 (예: AI agent infra, RISC-V, WebGPU, ZK, DePIN, etc.)
  - 특정 문제 영역 (예: climate tech, defense tech, bio+AI, spatial compute)
  의 부상 신호를 포착.

3) 실제 투자/전략 연결 (Alpha to Action)
- 발견된 신호를:
  - pjt-warren-buffett의 거시/리짐/섹터 분석과 결합
  - “관찰 대상 기업/프로젝트 리스트”와 “테마 포트폴리오 아이디어”로 구체화.

---

## 3. 기존 프로젝트와의 시너지 구조

- pjt-warren-buffett:
  - 거시 경제, 시장 리짐, 섹터 동향, 기업 실적 등 “macro + fundamental” 중심.
- pjt-alpha-hunter:
  - 기술 생태계, 커뮤니티, 오픈소스, 연구 동향 등 “micro-signal + early mover” 중심.

연동 방식:

- Alpha Hunter가 발견한:
  - 부상하는 기술 스택
  - 급성장 오픈소스 프로젝트
  - 새로운 생태계/프로토콜
  를 pjt-warren-buffett의 섹터/테마 분석에 반영.
- pjt-warren-buffett의:
  - 리짐 (risk_on / risk_off)
  - 섹터 강세/약세
  - 거시 이벤트 (금리, 규제, 지정학)
  를 Alpha Hunter의 “진입 타이밍” 및 “위험 필터”로 사용.

결과:
- “조기에 발견 + 거시/시장 맥락에서 검증”
  → 더 높은 확률의 알파.

---

## 4. 주요 데이터 소스 (Signal Layers)

### 4-1. GitHub 및 오픅소스 생태계 (핵심)

- GitHub Trending:
  - 언어별, 전체별, 일/주/월 단위 트렌드.
  - 스타 벨로시티(24h/7d/30d 증가), 이슈/PR 활동, 컨트리뷰터 증가.
- 개별 레포지토리:
  - 스타/포크/릴리즈/Contributors/Dependents 추이.
  - 사용 언어, 라이선스, 최근 커밋 패턴.
- 오픈소스 생태계:
  - CNCF, Rust, Go, WebAssembly, ML/AI 관련 생태계 동향.

### 4-2. Hacker News / Show HN / New / Top

- Show HN:
  - 새로운 제품/스타트업/도구/SDK/프로토콜 발견.
  - 댓글의 질(개발자/엔지니어 중심인지)로 신호 강도 판단.
- Top/New:
  - 특정 기술/섹터가 갑자기 뜨는 패턴 포착.

### 4-3. Reddit 및 전문 커뮤니티

- 핵심 서브레딧 (예시):
  - r/futurology, r/singularity, r/technology, r/startups
  - r/opensource, r/Golang, r/rust, r/python, r/webdev
  - r/cybersecurity, r/netsec
  - r/cryptocurrency, r/ethfinance, r/solana 등 (crypto/protocol 신호)
- 분석 포인트:
  - 급증하는 업votes와 논쟁
  - “누가 이걸 쓰는지, 왜 쓰는가”
  - 실제 사용자 경험 vs 마케팅성 포스트 구분.

### 4-4. X (Twitter) / Tech Twitter / Crypto Twitter

- 기술/스타트업/VC/리서처 계정의 트윗과 스레드.
- 특정 프로젝트/프로토콜/도구의:
  - 언급량 급증
  - 영향력 있는 빌더/VC의 집중적 언급
  - 생태계 내 협업 신호
- 기존 레거시 뉴스보다 훨씬 빠른 신호 발생.

### 4-5. 연구/논문/ML 생태계

- ArXiv, Papers With Code, Hugging Face:
  - trending models, datasets, repos.
  - 특정 연구 방향 (예: reasoning models, agent infra, multimodal, ZKML) 의 집중도.
- 기업/스타트업과 연결:
  - 논문을 실제로 제품/서비스로 빠르게 전환하는 팀 발견.

### 4-6. Product Hunt / BetaList / IndieHackers / YC

- Product Hunt:
  - 새로운 제품/도구/플랫폼의 런칭과 커뮤니티 반응.
- IndieHackers / YC:
  - 부트스트랩/VC 지원 스타트업의 방향성.
  - “어떤 문제를 풀고 있는지”가 핵심.

### 4-7. Crypto / DeFi / Onchain 생태계 (선택적)

- 신규 프로토콜, L2, ZK 생태계, DePIN, RWAs 등.
- 온체인 지표 (TVL, 거래량, 주소 수)와 커뮤니티 반응 병행 분석.
- 기존 Crypto 뉴스가 아닌, 실제 코드/리서치/디스코드/포럼에서 시작.

### 4-8. 채용/잡 시그널 (Job Signals)

- 급증하는 직무 (예: “AI infra engineer”, “ZK engineer”, “agent platform”):
  - 어떤 스택, 어떤 문제 영역에 회사가 돈을 쓰고 있는지 반영.
- 스타트업/빅테크 채용 공고에서 특정 기술/프로토콜이 반복 등장 → 중요한 신호.

---

## 5. 파이프라인 설계 방향 (pjt-warren-buffett 스타일)

### 기본 원칙

- 고정된 소스 + 일정한 스케줄 + 구조화된 JSON + 강력한 프롬프트 = 안정적 인사이트.
- 커뮤니티/opensource 중심이지만, “잡음”과 “신호”를 구분하는 기준이 명확해야 함.

### 예시 파이프라인 구성

1) GitHub Signal Pipeline
   - GitHub Trending + 특정 레포/테그/오르그 데이터 수집
   - 스타 벨로시티, 기여자 증가, 이슈/PR 활동 기반 필터링
   - 결과: github_signals.json

2) Community & Discussion Pipeline
   - Hacker News, Reddit, IndieHackers, YC 등
   - 급증하는 주제/프로젝트/키워드 추출
   - 결과: community_signals.json

3) Research & ML Ecosystem Pipeline
   - ArXiv, Papers With Code, Hugging Face trending
   - 급성장 연구 방향과 실제 프로젝트 매칭
   - 결과: research_signals.json

4) X / Tech Twitter / Crypto Twitter Pipeline (선택)
   - 주요 계정의 트윗/스레드 수집
   - 특정 프로젝트/기술의 언급량 급증 탐지
   - 결과: social_signals.json

5) Alpha Hunter Deep Analysis
   - 위 신호들을 통합하여:
     - 부상하는 기술/섹터/프로젝트/기업 후보 목록 생성
     - “왜 지금인가?”에 대한 근거와 리스크를 함께 분석
   - pjt-warren-buffett의 거시/리짐/섹터 컨텍스트와 결합
   - 결과: daily / weekly Alpha Hunter 보고서

---

## 6. 분석 기준 (Signal → Alpha)

신호가 “단순히 핫”이 아닌 “Alpha 후보”가 되려면 다음을 종합:

- Velocity:
  - 얼마나 빠르게 성장하는가? (스타, 트래픽, 업votes, 사용자 증가)
- Quality:
  - 빌더/리서처/엔지니어 중심의 진지한 관심인가?
  - 코드와 문서가 성숙한가?
- Fit:
  - 거시 환경/규제/금리와 충돌하지 않는가?
  - 기존 섹터/테마와 어떻게 시너지하는가?
- Moat:
  - 기술적/생태계적 우위가 있는가?
  - 복제하기 어려운 구조인가?

---

## 7. 파일/디렉토리 구조 (초안)

- README.md
- PIPELINE.md
- PROMPTS.md
- data/
  - github_signals.json
  - community_signals.json
  - research_signals.json
  - social_signals.json
  - alpha_candidates.json
- reports/
  - daily/
  - weekly/
- scripts/
  - github_trending.js
  - hn_signals.js
  - reddit_signals.js
  - hf_trending.js
  - x_signals.js (optional)
  - alpha_analysis.js

---

## 8. 다음 단계 (To-Do)

- [ ] 각 파이프라인별 상세 설계 (PIPELINE.md)
- [ ] 프롬프트 설계 (PROMPTS.md) — 기존 deep analysis 수준의 깊이 유지
- [ ] 크론잡 구성 (openclaw cron) — 일관된 스케줄링
- [ ] pjt-warren-buffett와의 연동 규칙 정의
