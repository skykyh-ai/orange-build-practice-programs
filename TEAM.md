# 실습 팀 설정

## Codex
준비는 GPT-6 Luna / Low, 제작 대화는 GPT-6.1 Sol / Medium / Standard로 선택합니다.
기준·계산·화면은 GPT-6 Luna / High, 독립 검증은 GPT-6.1 Sol / Medium을 사용합니다.
역할 파일은 .codex/agents/, 프로젝트 기본값은 .codex/config.toml에 있습니다.

## Claude Code
준비는 Sonnet 5.5 / Low, 제작 대화는 Opus 5.5 / Medium으로 선택합니다.
기준·계산·화면은 Sonnet 5.5 / Medium, 독립 검증은 Opus 5.5 / Medium을 사용합니다.
역할 파일은 .claude/agents/에 있습니다. 압축을 푼 프로젝트를 열면 불러옵니다.

## 읽기·실행 확인
4단계는 설정 확인과 계획만 진행합니다. 5단계에서 네 역할을 실제로 실행합니다.
프로젝트 신뢰 확인이 필요하면 앱 안내대로 확인하고, 설정을 읽지 못하면 프로젝트 폴더를 다시 엽니다.
준비된 설정은 전역 설정이나 다른 프로젝트를 바꾸지 않습니다. 사용 모델과 추론 수준은 실행 기록으로 확인하세요.
요청한 모델을 사용할 수 없으면 다른 모델로 조용히 바꾸지 말고 진행자와 함께 해결합니다.
8단계 커밋·푸시는 Codex Luna High / Claude Sonnet Medium으로 진행합니다.
