# Fidere

[![CI](https://github.com/sean-cc/fidere/actions/workflows/ci.yml/badge.svg)](https://github.com/sean-cc/fidere/actions/workflows/ci.yml)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [繁體中文（香港）](README.zh-HK.md) | [日本語](README.ja.md) | **한국어** | [Русский](README.ru.md)


Fidere는 브라우저에서 실행되는 작은 에이전트 워크스페이스입니다. [pi coding agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) SDK 위에 만들어져, 에이전트가 파일을 읽고 쓰고 명령을 실행할 수 있으며 사고 과정과 도구 호출을 실시간으로 스트리밍합니다. 그러면서도 프레임워크나 번들러, 별도의 서비스를 여러분의 컴퓨터에 끌어들이지 않습니다.

![Fidere 대화 화면](docs/screenshot-chat.jpg)

- **의도적으로 작게** —— 의존성은 pi SDK 하나뿐입니다. 프런트엔드 프레임워크도, 번들러도, CDN도 없습니다. 약 8,300줄의 순수 JS/CSS이며 실행 경로는 `node scripts/start.mjs` 하나입니다.
- **답변뿐 아니라 작업 과정도 보여줍니다** —— 사고 과정과 도구 호출이 대화 안에 실시간으로 나타나고, 응답이 끝나면 접히며, 응답별로 다시 펼칠 수 있습니다.
- **여러분의 언어로 동작합니다** —— 인터페이스는 English, 简体中文, 繁體中文(台灣/香港), 日本語, 한국어, Русский 7개 언어를 지원합니다. 사이드바의 지구본 버튼에서 바꿀 수 있습니다.
- **비용이 보입니다** —— 모든 응답에 토큰 사용량이 붙고, 실제로 호출한 엔드포인트의 공급자 공식 가격으로 계산됩니다. 고정된 가격표가 아닙니다.
- **비싼 모델을 몰래 고르지 않습니다** —— 새 세션은 직접 보고 바꿀 수 있는 모델에서 시작합니다. 세션을 다시 열 때 모델이 조용히 바뀌었다면 대화 위에 명확히 알려 줍니다.

![모델 선택 화면과 저장된 기본 모델](docs/screenshot-models.jpg)

## 할 수 있는 일

- 브라우저에서 에이전트와 대화하고 사고 과정과 도구 호출을 실시간으로 확인합니다
- 응답마다 사고 과정과 도구 호출을 접거나 펼칩니다. 끝난 응답은 자동으로 접힙니다
- 오른쪽 타임라인으로 이전 프롬프트로 돌아갑니다
- 기록을 읽는 동안 화면이 아래로 끌려가지 않습니다. 준비되면 최신 출력으로 돌아옵니다
- 세션 관리, 모델 전환, 이미지나 파일 첨부
- 새 세션이 사용할 모델을 지정하고(모델 선택 화면의 `set default`), 세션을 다시 열 때 모델이 바뀌었다면 대화 위에서 알림을 확인합니다
- 응답별 시간, 토큰 사용량, 비용을 확인합니다(공급자 공식 가격, 위안화 환산 추정 포함)
- 이전 메시지를 편집해 새 분기로 다시 보내기, 응답 복사, 거부된 프롬프트 재시도, 스트림이 끊긴 뒤 자동 복구
- 긴 작업을 실행하는 동안 Mac이 잠들지 않게 유지(선택)
- 사이드바 지구본 버튼에서 인터페이스 언어 전환(English / 简体中文 / 繁體中文(台灣) / 繁體中文(香港) / 日本語 / 한국어 / Русский)

## 키보드 단축키

| 단축키 | 동작 |
|----------|--------|
| `Enter` | 메시지 보내기 |
| `Shift+Enter` | 입력창에서 줄바꿈 |
| `/` | 명령 팔레트 열기(명령, 모델, 스킬, 프롬프트 템플릿) |
| `↑` / `↓` | 팔레트 결과 사이 이동 |
| `Tab` / `Enter` | 선택한 팔레트 항목 확정 |
| `Esc` | 명령 팔레트 또는 세션 이어서 하기 대화상자 닫기 |
| `↑` / `↓`, `Home` / `End` | 오른쪽 타임라인에 포커스가 있을 때 이전 프롬프트 사이 이동 |

## 요구 사항

- Node.js **22.19 이상**
- 지원되는 공급자의 API 키(Anthropic, OpenAI, Google, DeepSeek, OpenRouter, Moonshot, MiniMax, xAI, Groq, Mistral 등)

## 설치 및 실행

```bash
git clone https://github.com/sean-cc/fidere.git
cd fidere
npm install --ignore-scripts
npm run setup
npm start
```

<http://localhost:3000> 을 열고 시작할 때 출력된 액세스 토큰으로 로그인합니다(토큰은 `~/.pi/agent/fidere-token`에도 저장됩니다). 세션 쿠키는 30일 동안 유지됩니다. 전체 옵션은 아래 "액세스 제어"를 참고하세요.

`npm start`는 실행할 때마다 npm에 새 pi SDK가 게시되었는지 확인합니다. 대화형 터미널에서는 업데이트할지 물어보고, 수락하면 새 SDK를 설치한 뒤 서버를 시작합니다. 비대화형 환경에서는 사용 가능한 버전만 출력하고 평소대로 시작합니다. `FIDERE_SDK_UPDATE=off`로 확인을 건너뛰고, `FIDERE_SDK_UPDATE=auto`로 묻지 않고 업데이트할 수 있습니다.

`npm run setup`은 공급자를 고르고 API 키를 입력받는 것만 합니다. Fidere와 함께 설치된 의존성만 있으면 되고 **pi CLI를 따로 설치할 필요는 없습니다**. 키는 `~/.pi/agent/auth.json`에 저장됩니다.

시작한 뒤 왼쪽 아래 모델 선택 화면에서 모델을 고르세요. 고르지 않으면 저장된 기본 모델, Fidere 자체 추천(아래 참고), SDK의 공급자별 대체 모델 순으로 사용됩니다.

### 환경 변수로 설정하기

대화형 설정을 쓰지 않으려면 환경 변수를 직접 지정해도 됩니다.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` 등 다른 공급자 환경 변수도 동작합니다. pi CLI는 필요 없습니다.

포트 변경:

```bash
PORT=8080 npm start
```

## 참고 사항

- **가격은 어디서 오나요?** Fidere는 모델이 실제로 호출되는 엔드포인트를 기준으로 가격을 정합니다. `api.deepseek.com`의 모델은 DeepSeek 공식 피크/오프피크 가격을 해당 통화로 사용하고(`zh` 로케일이면 중국어 페이지/위안화, 그 외에는 영어 페이지/미국 달러. `FIDERE_PRICE_CURRENCY=CNY|USD`로 강제 가능), `openrouter.ai`의 모델은 OpenRouter 공식 토큰 단가를, `open.bigmodel.cn`의 모델은 즈푸(Zhipu) 공식 가격 문서(위안화)를 사용합니다. `api.anthropic.com`, `api.moonshot.cn`, `dashscope.aliyuncs.com`, `router.huggingface.co`의 모델도 각자의 공식 가격 페이지/API를 사용합니다. 그 밖의 엔드포인트는 `models.json`에서 해당 공급자에 설정한 `cost`를 사용하고(프록시와 게이트웨이는 자체 가격 유지), 마지막 대비책으로 SDK에 포함된 가격을 씁니다. 가격은 공급자 통화 그대로 표시됩니다(`zh` 로케일의 DeepSeek, GLM, Moonshot, Aliyun은 위안화, OpenRouter, Anthropic, HuggingFace 그리고 `zh` 외 로케일의 DeepSeek은 미국 달러). 미국 달러 가격의 위안화 툴팁은 7.2 위안/달러 기준 추정치입니다(`localStorage.setItem('fidere-usd-cny', '7.30')`으로 변경 가능). 확인은 서버가 시작될 때부터 진행됩니다. 실패한 확인은 이전 캐시를 유지하고, 최신 공급자 목록에 없는 모델은 지난 공식 가격을 유지하며, 둘 다 없을 때만 SDK 가격이 적용됩니다. 캐시는 `~/.pi/agent/fidere-prices.json`에 있고, `FIDERE_PRICES=off`로 공급자 조회를 끌 수 있습니다. 상태 확인: `GET /api/prices`.
- **모델이 안 보이나요?** `npm run setup`을 실행하거나 공급자 환경 변수를 설정한 뒤 서버를 다시 시작하세요.
- **새 세션은 어떤 모델로 시작하나요?** 먼저 `~/.pi/agent/settings.json`의 `defaultProvider`/`defaultModel`, 그다음 Fidere 자체 추천 표(현재는 DeepSeek → `deepseek-flash` 하나), 마지막으로 SDK 내장 공급자별 표 순입니다. `npm run setup`은 추천 모델을 settings에 기록하고, 모델 선택 화면 각 행의 **set default**로 나중에 바꿀 수 있습니다. **default** 배지가 붙은 행이 새 세션에서 쓸 모델입니다. 이 덮어쓰기 층이 있는 이유: SDK 표는 DeepSeek을 `deepseek-v4-pro`로 시작하는데, 이는 `deepseek-flash`의 4.4배 입력 가격이고 이미지도 지원하지 않아 갓 설치한 사용자가 바로 큰 비용을 낼 수 있기 때문입니다.
- **액세스 제어:** 모든 API 경로에는 액세스 토큰이 필요합니다. `FIDERE_TOKEN`에서 읽거나, 처음 시작할 때 `~/.pi/agent/fidere-token`(권한 0600)에 생성됩니다. 경로는 시작할 때 출력됩니다. 처음에는 `/#token=<토큰>`을 열거나 로그인 화면에 붙여넣어 로그인합니다. fragment는 서버에도 프록시 로그에도 전달되지 않습니다. 세션 쿠키는 `HttpOnly`, `SameSite=Strict`이고 30일 동안 유지됩니다(`FIDERE_SESSION_MAX_AGE`, 초 단위). 상태를 바꾸는 요청에는 이중 제출 CSRF 토큰도 필요하며 UI가 자동으로 보냅니다. 스크립트는 `Authorization: Bearer <토큰>`으로 대신할 수 있습니다. `FIDERE_COOKIE_SECURE=auto|on|off`는 `Secure` 플래그를 제어합니다(기본값은 `X-Forwarded-Proto`를 따름). `FIDERE_AUTH=off`는 이 모든 것을 끕니다. 다른 사람이 접근할 수 없는 컴퓨터에서만 사용하세요.
- **다른 컴퓨터에서 접속하려면:** 서버는 기본적으로 `127.0.0.1`만 수신합니다. 인터넷에 직접 노출하지 마세요. TLS가 적용된 리버스 프록시나 사설 터널 뒤에 두세요. `HOST=0.0.0.0`은 신뢰할 수 있는 네트워크에서만 사용하세요.
- **Mac을 덮으면 작업이 멈추나요?** 작업이 실행되는 동안에는 `caffeinate` 어서션을 유지할 수 있습니다. 다만 덮개를 닫으면 클램셸 모드가 아닌 한 잠들게 됩니다. 무인으로 긴 작업을 돌릴 때는 항상 켜 두는 컴퓨터를 사용하세요.
- **키는 어디에 저장되나요?** `~/.pi/agent/auth.json`입니다. API 키는 이 저장소에 기록되지 않습니다.

## 개발

아키텍처, 테스트, API 엔드포인트, SDK 업그레이드 관련 내용은 [DEVELOPMENT.md](DEVELOPMENT.md)를 참고하세요.

## 라이선스

MIT. [LICENSE](LICENSE)를 참고하세요.
