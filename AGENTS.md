# 멀티에이전트 기초 실습

TEAM.md와 data/programs/RULES.md를 참고하세요.
워크북의 단계 요청을 따르세요. 준비·설정 확인 단계에서는 에이전트를 실행하지 않습니다.
제작 요청을 받으면 wb_criteria → wb_calculator와 wb_ui 병행 → 통합 → wb_reviewer 순서로 진행합니다.
전체 조율은 Codex GPT-6.1 Sol Medium 또는 Claude Opus 5.5 Medium,
세 제작 역할은 Codex GPT-6 Luna High 또는 Claude Sonnet 5.5 Medium,
독립 결과 확인은 Codex GPT-6.1 Sol Medium 또는 Claude Opus 5.5 Medium입니다.
실제로 선택된 앱의 역할 설정만 사용하세요. 기존 팀의 작업을 이어가고 하위 에이전트의 추가 위임을 금지합니다.
Codex 역할 생성은 fork_turns="none"으로 필요한 맥락만 전달하며 model과 reasoning_effort를 역할 설정대로 명시하세요.
전체 대화를 복제하는 fork_turns="all"에서는 부모 모델을 상속할 수 있으므로 혼합 팀 생성에 사용하지 마세요.
브라우저 실행은 전체 조율 담당만 진행하세요. 커밋·공개 저장소 생성·푸시는 8단계의 명시적인 요청에서 진행합니다.
