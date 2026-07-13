# GPT 아트 생성 프롬프트 — game/ 전체 로스터 (2026-07-13)

로컬 Inkpunk 결과가 화풍 미달일 때, ChatGPT(GPT-4o 이미지)로 생성하기 위한 프롬프트 세트.
**받은 파일을 `game/public/art/`에 아래 파일명대로 저장하면 게임이 자동으로 사용한다** (없으면 도형 fallback이라 부분 교체도 안전).

## 사용법 (중요 — 일관성의 핵심)

1. **한 대화에서 연속 생성**: 새 채팅 하나를 열고, 맨 먼저 아래 [스타일 확립] 메시지 + **참조 이미지 첨부**(`public/art/portrait_hero.webp` 권장, 기존 세트 톤 앵커). 이후 캐릭터를 같은 채팅에서 순서대로 뽑는다 — GPT가 앞 결과를 기억해 화풍이 유지된다.
2. 각 캐릭터는 아래 표의 프롬프트를 복사해 요청. **1캐릭터 = 1장씩** (묶어 그리면 품질 저하).
3. 출력 요구: **배경 투명 PNG, 1024×1024** ("transparent background" — GPT 지원). 투명이 안 되면 "flat solid light-grey background (#cccccc), no gradient"로 받아 오면 누끼는 이쪽에서 처리.
4. 받은 PNG는 파일명만 맞춰 저장 요청 (예: `enemy_soldier.png`) → 이후 webp 변환·배치는 에이전트가 함.

## 스타일 확립 (첫 메시지, 참조 이미지와 함께)

```
You are generating a consistent character art set for a 2D side-scrolling sword-action game.
Art style (keep EXACTLY consistent across all images in this chat):
- Darkest Dungeon-inspired dark fantasy ink illustration
- bold black ink outlines, heavy chiaroscuro shadows, flat painterly shading (no photorealism, no 3D render)
- desaturated muted palette, bone-ivory highlights, occasional deep blood-red accent
- gritty East-Asian (Joseon/wuxia) swordsman world: worn fabric, leather, iron
- full body, single character, dynamic but readable silhouette
Technical (every image): side view, feet grounded on the same baseline, character fills ~85% of canvas height,
1024x1024, transparent background PNG, no text, no watermark, no frame.
Attached image = the game's protagonist portrait; match its ink density and mood.
Reply OK if ready — I will request characters one by one.
```

## 캐릭터 프롬프트

공통 접미(모든 프롬프트 끝에 이미 포함됨): *full body, transparent background* — 적/보스는 **왼쪽 보기(facing left)**, 주인공만 **오른쪽 보기(facing right)**.

### 주인공
| 파일명 | 프롬프트 |
|---|---|
| `hero.png` | The protagonist from the attached portrait as a full-body game sprite: young Korean swordsman, messy black hair, scarred face, grey hooded scarf, tattered beige robe, katana held low in right hand, calm ready stance, **facing right**, full body, transparent background |

### 일반 적 12종 (전부 facing left)
| 파일명 | 이름 | 프롬프트 |
|---|---|---|
| `enemy_soldier.png` | 잡병 | Ragged bandit footsoldier with a chipped short sword and patched leather armor, hunched aggressive stance, facing left |
| `enemy_spear.png` | 창병 | Lean spearman thrusting a long bamboo-shafted spear, wide low stance, patched infantry garb, facing left |
| `enemy_hound.png` | 들개 | Feral snarling wild dog, mangy fur, bared fangs, crouched to lunge, facing left |
| `enemy_archer.png` | 궁수 | Wiry archer drawing a short composite bow, arrow nocked, quiver on back, stepping backward warily, facing left |
| `enemy_swift.png` | 쾌검사 | Slender fast swordsman mid-dash with a thin curved blade, flowing ragged cloth, blurred speed feeling, facing left |
| `enemy_shield.png` | 방패병 | Stocky soldier braced behind a tall battered wooden tower shield, mace in the other hand, facing left |
| `enemy_dual.png` | 쌍검사 | Dual-wielding swordsman with two short swords crossed, twin-blade flourish stance, facing left |
| `enemy_heavy.png` | 중갑귀 | Hulking brute in heavy scarred iron plate armor dragging a massive greatsword, oppressive silhouette, facing left |
| `enemy_berserk.png` | 광전사 | Shirtless berserker mid-charge with a crude great axe, wild hair, screaming, red war paint, facing left |
| `enemy_caster.png` | 주술사 | Hunched shaman-sorcerer in dark tattered robes, talisman papers, dark energy orb between hands, facing left |
| `enemy_shadow.png` | 그림자검사 | Shadow assassin swordsman, body half-dissolving into black ink smoke, thin dark blade, facing left |
| `enemy_knight.png` | 정예기사 | Elite knight in ornate dark lamellar armor with a long straight sword raised, disciplined duel stance, facing left |

### 미니보스 5종 (facing left, 일반 적보다 위압적으로)
| 파일명 | 이름 | 프롬프트 |
|---|---|---|
| `boss_mini_captain.png` | 산적 두목 | Burly bandit captain with a huge cleaver-like blade over his shoulder, fur-trimmed coat, arrogant grin, facing left |
| `boss_mini_ranger.png` | 사냥꾼 | Grizzled hunter with a heavy longbow and trophy pelts, hood shadowing his eyes, facing left |
| `boss_mini_twin.png` | 쌍둥이 검사 | Twin swordsmen back to back as one unit, matching masks and mirrored blades, facing left |
| `boss_mini_juggernaut.png` | 파성귀 | Siege-breaker giant carrying an enormous iron battering club, cracked stone-like armor plates, facing left |
| `boss_mini_gatekeeper.png` | 검문의 수문장 | Stern gate warden in official uniform armor with a broad guandao polearm, immovable stance, facing left |

### 보스 5종 (facing left, 스테이지 주인 — 가장 정교하게)
| 파일명 | 이름 | 프롬프트 |
|---|---|---|
| `boss_boss_veteran.png` | 갈퇴 — 낡은 검의 노병 | Aged veteran swordsman with grey topknot and a notched old longsword, battle-worn armor, weary but deadly duel stance, facing left |
| `boss_boss_dancer.png` | 홍련 무희 — 쌍검의 배신자 | Deadly dancer-swordswoman with twin crimson blades, flowing red-accented silk ribbons mid-spin, facing left |
| `boss_boss_fortress.png` | 철벽 거암 — 몰락한 성의 수문장 | Colossal fortress guardian in full tower-like iron armor with a wall-sized shield and warhammer, facing left |
| `boss_boss_mirror.png` | 그림자 무영 — 흑월의 암살검 | Mirror-shadow assassin: a dark inverted double of the protagonist, black ink dripping upward, pale mask, facing left |
| `boss_boss_saint.png` | 검성 흑월 — 찬탈자 | The usurper sword-saint: regal black-and-gold robes, floating ornate blade, cold overwhelming aura, black moon motif, facing left |

### 배경 5종 (와이드 가로, 캐릭터 없음)
공통: *2D side-scroller background, distant layered silhouettes, muted desaturated palette, dark ink painting style, 1792×1024 landscape, no characters, no text*
| 파일명 | 스테이지 | 프롬프트 |
|---|---|---|
| `bg_mountain.png` | 산길 | Gloomy Korean mountain pass at dusk, twisted pines and rocky cliffs, mist between ridges |
| `bg_bamboo.png` | 대나무 숲 | Dense dark bamboo forest, tall stalks fading into fog, thin moonlight shafts |
| `bg_castle.png` | 폐성 | Ruined fortress interior, crumbled stone walls and broken banners, cold torchlight |
| `bg_snowfield.png` | 설원 | Bleak snowfield under a grey sky, sparse dead trees, wind-blown snow streaks |
| `bg_peak.png` | 검성봉 | Ominous sword-saint's peak above the clouds, jagged summit shrine, black moon in the sky |

## 저장·적용 절차 (받은 뒤)
1. PNG들을 `D:\swordmaster-road\game\public\art\` 에 저장 (파일명 그대로, 확장자 png면 에이전트가 webp 변환)
2. 에이전트에게 "GPT 아트 적용해줘" → 변환·리네임·preload 갱신·커밋까지 처리
