// 프롤로그 대본 — 프로토타입 src/data/story/stage1.json에서 이식 (사용자 요청).
// 인물: 현곡(스승) / 무명(주인공) / 적하(원수).

export interface DialogueLine {
  speaker?: string;
  side?: 'left' | 'right';
  portraitColor?: number; // 임시 초상화 색 (아트 교체 전)
  text: string;
  stroke?: boolean;       // 이 줄에서 첫 획 입력 대기 (관대 판정)
}

const MASTER = 0x6a7a9a;  // 현곡 (푸른 노사)
const HERO = 0xe8dcc0;    // 무명 (주인공)

/** 프롤로그: 멸문의 밤 → 스승의 첫 가르침 → 첫 획. */
export const PROLOGUE: DialogueLine[] = [
  { text: '상운검문(祥雲劍門)이 불타던 밤을, 나는 이름과 함께 잃었다.' },
  { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '…아직 숨이 붙어 있구나. 손을 다오.' },
  { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '네 가문의 검은 재가 되었다. 허나 검(劍)은 쇠가 아니라 눈(眼)에서 나온다.' },
  { speaker: '무명', portraitColor: HERO, side: 'right', text: '…원수를. 갚고 싶습니다.' },
  { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '그 말은 아직 이르다. 원수를 보기(觀) 전에, 네 검이 먼저 무너질 테니.' },
  { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '첫 획을 그어라. 틀려도 좋다 — 오늘은 네가 살아 검을 쥔 것만으로 족하다.' },
  { stroke: true, text: '▶ 화면을 가로질러 검을 그어라 — 방향은 무엇이든 좋다' },
  { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '되었다. 그것이 검로(劍路)다. 이제 이 늙은이가 두 글자를 새겨주마 — 관(觀), 응(應).' },
];

/** 유파 선택 프롬프트 + 각 선택 후 스승의 반응. */
export const STYLE_PROMPT: DialogueLine = {
  speaker: '현곡', portraitColor: MASTER, side: 'left',
  text: '검을 쥐기 전, 하나만 묻자. — 너는 어느 손에 검을 쥘 것이냐.',
};

export interface StyleChoice {
  label: string;
  hint: string;
  lefty: boolean;
  reaction: DialogueLine[];
}

export const STYLE_CHOICES: StyleChoice[] = [
  {
    label: '오른손 — 우수검류(右手劍流)',
    hint: '정통. 궤적이 순(順)하다',
    lefty: false,
    reaction: [
      { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '바르다. 상운의 검이 그러했지.' },
      { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '한번 정한 손은 이번 생의 검로다. 다른 손의 검이 궁금하거든 — 이 길을 끝까지 걷고 나서 다시 오너라.' },
    ],
  },
  {
    label: '왼손 — 좌수검류(左手劍流)',
    hint: '이단. 모든 획이 거울처럼 좌우로 뒤집힌다',
    lefty: true,
    reaction: [
      { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '…남다르구나. 뒤집힌 검로는 적의 눈도 함께 뒤집는다.' },
      { speaker: '현곡', portraitColor: MASTER, side: 'left', text: '한번 정한 손은 이번 생의 검로다. 다른 손의 검이 궁금하거든 — 이 길을 끝까지 걷고 나서 다시 오너라.' },
    ],
  },
];

/** 스테이지 1 진입 직전 한 마디. */
export const STAGE1_INTRO: DialogueLine = {
  speaker: '현곡', portraitColor: MASTER, side: 'left',
  text: '관문 너머에 적하(赤霞)의 수하가 있다. 거기까지가 오늘의 검이다. — 가거라.',
};
