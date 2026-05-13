# pjt-alpha-hunter — Pipeline Design

> 핵심 원칙:
> - 고정된 소스 + 일정한 구조 + 자동화 가능
> - raw JSON 우선 → 이후 프롬프트/분석 레이어에서 가공
> - 잡음(noise)과 신호(signal)는 후처리에서 구분

---

## 1. GitHub & Open Source Ecosystem

### 목적
- 급성장 레포, 새로운 스택, 부상하는 오픈소스 프로젝트 조기에 포착.
- 빌더/리서처들이 실제로 코드를 쓰는 곳.

### 수집 항목
- GitHub Trending (Daily / Weekly)
  - 전체 및 주요 언어 (Python, Rust, Go, TypeScript, JavaScript)
  - 각 프로젝트: 이름, 설명, 스타, 스타 증가량(24h/7d 추정), 언어, 링크
- 개별 레포 (후기 단계)
  - 스타/포크/Contributors/Dependents 추이
  - 최근 릴리스/활동성

### 구현 방식
- 우선: GitHub Trending 페이지 웹 파싱 (Playwright 또는 web_fetch)
  - URL: https://github.com/trending?since=daily, weekly
- 결과: data/github_trending.json

### JSON 스키마 (간단)
{
  "source": "github_trending",
  "date": "YYYY-MM-DD",
  "period": "daily|weekly",
  "items": [
    {
      "repo": "owner/repo",
      "description": "...",
      "language": "...",
      "stars": 1234,
      "recent_stars": 56,
      "url": "https://github.com/..."
    }
  ]
}

### 테스트 계획
- [ ] GitHub Trending daily 페이지를 Playwright/web_fetch로 한 번 크롤링
- [ ] 10~20개 항목 샘플 JSON 생성
- [ ] 안정성 확인 후 스크립트로 고정

---

## 2. Hacker News

### 목적
- Show HN / Top / New에서 부상하는 도구, 스타트업, 기술, 아이디어 포착.
- 엔지니어 중심의 논의로 신호의 질이 높음.

### 수집 항목
- Frontpage Top 50
- Show HN (24h)
- 각 항목: 제목, URL, 점수, 댓글 수, 링크

### 구현 방식
- 우선: HN API 사용 (안정적)
  - https://hacker-news.firebaseio.com/v0/topstories.json
  - https://hacker-news.firebaseio.com/v0/newstories.json
- Show HN은 제목에 "Show HN" 포함 항목 필터링.

### JSON 스키마
{
  "source": "hackernews",
  "date": "YYYY-MM-DD",
  "sections": {
    "top": [
      {
        "id": 123456,
        "title": "...",
        "url": "...",
        "score": 456,
        "comments": 78
      }
    ],
    "show_hn": [
      {
        "id": 123456,
        "title": "...",
        "url": "...",
        "score": 120,
        "comments": 34
      }
    ]
  }
}

### 테스트 계획
- [ ] Top 50 + Show HN 필터 샘플 크롤
- [ ] JSON 스키마로 저장 테스트
- [ ] 스크립트화 (scripts/hn_signals.js)

---

## 3. Reddit & Tech Communities

### 목적
- 특정 서브레딧에서 급증하는 주제, 도구, 프로젝트, 스타트업 포착.
- 실제 사용자 경험과 논쟁을 통한 신호 검증.

### 수집 항목
- 핵심 서브레딧:
  - r/futurology
  - r/technology
  - r/startups
  - r/opensource
  - r/Golang, r/rust, r/python, r/webdev
  - r/cybersecurity, r/netsec
  - r/cryptocurrency, r/ethfinance, r/solana (crypto 신호)
- 각 서브레딧: Top (24h) 또는 Hot 상위 30~50개 포스트
  - 제목, URL, 점수, 댓글 수, 서브레딧명

### 구현 방식
- Reddit JSON API 사용:
  - https://www.reddit.com/r/{subreddit}/top.json?t=day&limit=50
  - 또는 hot.json
- 우선 주요 서브레딧 5~7개로 시작.

### JSON 스키마
{
  "source": "reddit",
  "date": "YYYY-MM-DD",
  "subreddits": [
    {
      "name": "r/futurology",
      "posts": [
        {
          "title": "...",
          "url": "...",
          "score": 1200,
          "comments": 145
        }
      ]
    }
  ]
}

### 테스트 계획
- [ ] 3~5개 서브레딧에서 Top 24h 샘플 크롤
- [ ] JSON 스키마 저장 테스트
- [ ] 스크립트화 (scripts/reddit_signals.js)

---

## 4. X (Twitter) / Tech Twitter / Crypto Twitter

### 목적
- 가장 빠른 신호: 빌더/VC/리서처들이 실시간으로 논의하는 주제.
- 특정 프로젝트/기술에 대한 언급량 급증 탐지.

### 수집 항목 (초기)
- 핵심 계정 및 리스트 기반:
  - AI/ML: Andrew Ng, Yann LeCun, Andrej Karpathy, etc.
  - Open Source / Infra: notable builders
  - Crypto/DeFi: Vitalik, Paradigm, a16z crypto, etc.
  - VC: a16z, Sequoia, Andreessen, etc.
- 각 트윗: 텍스트, 시간, 리트윗/좋아요/반응 수 (제한적 샘플)

### 구현 방식
- 초기는 완전 자동 크롤링보다:
  - 수동/반자동으로 주요 계정 트윗 샘플 수집
  - 또는 X API / third-party API / web_fetch로 제한적 수집
  - 안정화 필요 → 우선은 low-priority 또는 샘플링 수준으로 시작.

### JSON 스키마 (간단)
{
  "source": "x_twitter",
  "date": "YYYY-MM-DD",
  "accounts": [
    {
      "handle": "@example",
      "tweets": [
        {
          "text": "...",
          "time": "YYYY-MM-DDTHH:mm:ssZ",
          "likes": 345,
          "retweets": 56
        }
      ]
    }
  ]
}

### 테스트 계획
- [ ] 핵심 계정 5~10개 트윗 샘플 수집 (API 또는 웹)
- [ ] 스키마 저장 테스트
- [ ] 법적/ToS 이슈 확인 후 안정화

---

## 5. Research & ML Ecosystem (ArXiv, Hugging Face, etc.)

### 목적
- 연구 동향을 통해 “다음 기술”과 “다음 스타트업”을 예측.
- 특정 연구 방향이 실제 제품/프로토콜로 전환되는 패턴 포착.

### 수집 항목
- Hugging Face Trending Models (Daily/Weekly)
  - 모델명, 설명, 좋아요 수, 태그, 링크
- ArXiv CS.AI / CS.LG / CS.CR / CS.SE 등 (선택적)
  - 최신 논문 제목/추약/저자 (제한적 샘플)
- Papers With Code (선택적)
  - trending papers / datasets

### 구현 방식
- Hugging Face:
  - https://huggingface.co/models?sort=trending
  - web_fetch 또는 Playwright로 크롤.
- ArXiv:
  - ArXiv API (Atom) 사용.
  - 예: https://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=30

### JSON 스키마 (HF 예시)
{
  "source": "huggingface_trending",
  "date": "YYYY-MM-DD",
  "models": [
    {
      "id": "org/model",
      "name": "...",
      "likes": 1200,
      "tags": ["transformers", "text-generation"],
      "url": "https://huggingface.co/..."
    }
  ]
}

### 테스트 계획
- [ ] Hugging Face trending 페이지 크롤 테스트
- [ ] ArXiv API로 cs.AI 최신 20편 샘플
- [ ] 스크립트화 (scripts/hf_trending.js, scripts/arxiv_signals.js)

---

## 6. Product Hunt / BetaList / IndieHackers / YC (New Products & Startups)

### 목적
- 아직 알려지지 않았으나 실제 사용자/디벨로퍼들이 반응하는 신생 제품/스타트업 발견.
- “누가 어떤 문제를 풀고 있는가”를 빠르게 파악.

### 수집 항목
- Product Hunt:
  - Today’s Top 20~30 products
  - 제목, 태그, 업votes 수, 링크, 설명
- IndieHackers / YC (선택적, 초기에는 샘플 수준):
  - Show & Tell / Launch / Discuss 섹션의 핫 포스트
- BetaList:
  - 최신/인기 베타 제품 목록

### 구현 방식
- Product Hunt:
  - https://www.producthunt.com/에서 web_fetch 또는 Playwright 사용
  - 초기에는 Today / This Week의 상위 목록만 수집
- IndieHackers / YC:
  - HTML 파싱 또는 공식 API/JSON (존재 시) 활용
  - 우선은 제한적 샘플 크롤링

### JSON 스키마 (Product Hunt 예시)
{
  "source": "product_hunt",
  "date": "YYYY-MM-DD",
  "products": [
    {
      "name": "...",
      "tagline": "...",
      "votes": 340,
      "tags": ["AI", "Developer Tools"],
      "url": "https://www.producthunt.com/..."
    }
  ]
}

### 테스트 계획
- [ ] Product Hunt Today Top 20 크롤 테스트
- [ ] JSON 스키마 저장 테스트
- [ ] 스크립트화 (scripts/product_hunt_signals.js)

---

## 7. Job Signals (Hiring as a Leading Indicator)

### 목적
- 채용 공고에서: 어떤 기술, 어떤 문제, 어떤 스택에 회사가 지금 돈을 쓰는지 파악.
- 급증하는 직무는 곧 다음 기술 트렌드를 의미.

### 수집 항목 (초기 범위)
- 주요 플랫폼:
  - LinkedIn Jobs (제한적 샘플)
  - Wellfound (AngelList)
  - YC Work at a Startup
  - 각 기술 커뮤니티의 Jobs 포럼 (HN, Reddit, IndieHackers)
- 수집 포인트:
  - 직무명, 회사명, 기술 스택 키워드, 지역/리모트 여부

### 구현 방식
- 초기에는 완전 자동 크롤링보다:
  - 특정 키워드 (AI infra, agent, ZK, DePIN, WebGPU, edge AI, etc.) 기반 샘플링
  - 각 플랫폼의 검색 결과에서 상위 20~50개 공고 수집
- 이후: 키워드 빈도 추이를 통해 “부상하는 직무” 탐지

### JSON 스키마 (간단)
{
  "source": "job_signals",
  "date": "YYYY-MM-DD",
  "platform": "wellfound|linkedin|yc|others",
  "jobs": [
    {
      "title": "AI Infrastructure Engineer",
      "company": "...",
      "tags": ["AI", "Kubernetes", "Rust"],
      "location": "Remote",
      "url": "https://..."
    }
  ]
}

### 테스트 계획
- [ ] Wellfound 또는 YC에서 AI/infra 관련 직무 20~30건 샘플 수집
- [ ] JSON 스키마 저장 테스트
- [ ] 스크립트화 (scripts/job_signals.js)

---

## 8. 실행 계획 (Test → Stabilize → Automate)

### Phase 1: Proof of Concept (3~5일)
- 목표: 7개 소스에서 최소 한 번씩 안정적으로 raw JSON 생성.
- 우선순위:
  1) GitHub Trending
  2) Hacker News
  3) Reddit (3~5 서브레딧)
  4) Hugging Face Trending
  5) Product Hunt Today
  6) ArXiv (cs.AI 등) 샘플
  7) Job Signals (Wellfound/YC 샘플)
  8) X/Twitter: 초기에는 수동/샘플 수준

- 각 파이프라인별 작업:
  - [ ] 스크립트 작성 (scripts/ 하위)
  - [ ] data/ 폴더에 JSON 저장 (예: data/github_trending_YYYY-MM-DD.json)
  - [ ] 1~2회 연속 실행 → 안정성 확인

### Phase 2: 프롬프트 & 분석 레이어
- 목표: 수집된 JSON을 기반으로 Alpha Hunter 분석 보고서 생성.
- 작업:
  - [ ] PROMPTS.md 작성: 각 소스별 + 통합 분석 프롬프트 정의
  - [ ] 일간/주간 보고서를 reports/daily, reports/weekly 에 생성
  - [ ] pjt-warren-buffett 맥락과 결합하는 규칙 정의

### Phase 3: 자동화 & 크론잡
- 목표: pjt-warren-buffett 스타일 고정 파이프라인으로 완성.
- 작업:
  - [ ] 각 스크립트를 크론잡에 등록 (openclaw cron)
  - [ ] 실패 시 로깅 및 재실행 전략 정의
  - [ ] Obsidian 연동 (선택): 주요 프로젝트/인물/관계 노드로 연결

---


