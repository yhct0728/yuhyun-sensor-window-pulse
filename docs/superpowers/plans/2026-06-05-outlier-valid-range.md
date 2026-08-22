# 이상치 유효범위 (센서별) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노드 상세 드로어에서 센서(채널)별 정상범위(하한~상한)를 입력하고, raw 값이 범위를 벗어나면 값은 그대로 둔 채 🔴 이상치로 표시한다(드로어 + 노드 목록 요약 배지).

**Architecture:** 순수 판정 함수(`lib/outlier.js`) + 전역 상태(store의 `channelRanges` 맵, localStorage 임시 영속) + 드로어 입력 UI + 노드 목록 배지. 값은 절대 변형하지 않음(비파괴, 표시 전용). 기존 패턴 준수: 상태는 store Context, 임시 영속은 localStorage(`pulse:theme` 패턴), 컴포넌트는 함수형+Hooks, 아이콘은 lucide-react.

**Tech Stack:** React 18 + Tailwind(zinc 팔레트), Playwright E2E(`npm test`, `tests/pulse-v2.spec.js`), 외부 상태 라이브러리 없음.

**Spec:** `docs/superpowers/specs/2026-06-05-outlier-valid-range-design.md`

---

## File Structure

- **Create** `src/lib/outlier.js` — 순수 판정·키 헬퍼 (`rangeKey`, `hasRange`, `isOutlier`, `nodeOutlierCount`). window 의존 없음(노드 환경 단위 테스트 가능).
- **Modify** `src/lib/store.jsx` — `channelRanges` 상태 + `setChannelRange` + localStorage 영속, context 노출.
- **Modify** `src/components/nodes/NodeDetailDrawer.jsx` — `ChannelStream` 에 "정상 범위" 섹션(`ValidRangeSection`/`RangeRow`) 추가.
- **Create** `src/components/nodes/NodeOutlierBadge.jsx` — 노드 이상치 개수 배지(store 직접 구독).
- **Modify** `src/components/nodes/NodeTable.jsx` / `NodeCardGrid.jsx` / `NodeCompactList.jsx` — 배지 1줄씩 삽입.
- **Modify** `tests/pulse-v2.spec.js` — 단위(import) + E2E 테스트 추가.
- **Create** `docs/decisions/0012-이상치-판정-펄스-이관.md` + `docs/decisions/README.md`·`CHANGELOG.md` 갱신.

키 형식: `rangeKey(nodeId, code)` = `"${nodeId}|${code}"` (파싱 안 함, 단순 결합). `channelRanges` = `{ [key]: { min:number|null, max:number|null } }`.

---

### Task 1: 순수 판정 함수 `lib/outlier.js`

**Files:**
- Create: `src/lib/outlier.js`
- Test: `tests/pulse-v2.spec.js` (맨 위 `nodeRegisterBody` 단위 테스트 블록과 같은 import 스타일로 추가)

- [ ] **Step 1: Write the failing test**

`tests/pulse-v2.spec.js` 상단 import 줄 아래에 추가:

```js
import { isOutlier, nodeOutlierCount, rangeKey, hasRange } from '../src/lib/outlier.js';

test.describe('이상치 — 순수 판정(outlier.js)', () => {
  test('범위 없음/결측은 이상치 아님', () => {
    expect(isOutlier(5, undefined)).toBe(false);
    expect(isOutlier(5, { min: null, max: null })).toBe(false);
    expect(isOutlier(null, { min: 0, max: 10 })).toBe(false);
    expect(isOutlier('', { min: 0, max: 10 })).toBe(false);
    expect(hasRange({ min: null, max: null })).toBe(false);
    expect(hasRange({ min: 0, max: null })).toBe(true);
  });

  test('한쪽/양쪽 경계 + 경계값', () => {
    expect(isOutlier(11, { min: 0, max: 10 })).toBe(true);   // 상한 초과
    expect(isOutlier(-1, { min: 0, max: 10 })).toBe(true);   // 하한 미만
    expect(isOutlier(10, { min: 0, max: 10 })).toBe(false);  // 경계 포함(정상)
    expect(isOutlier(0, { min: 0, max: 10 })).toBe(false);
    expect(isOutlier(99, { min: null, max: 10 })).toBe(true);  // 상한만
    expect(isOutlier(99, { min: 0, max: null })).toBe(false);  // 하한만(상한 없음)
    expect(isOutlier(-5, { min: 0, max: null })).toBe(true);   // 하한만 미만
  });

  test('nodeOutlierCount — 채널별 집계', () => {
    const node = { id: 'YH-0007', chans: [
      { code: 'GI-A', value: 41 },
      { code: 'GI-B', value: 8 },
      { code: 'TMP', value: 23 },
    ] };
    const ranges = {
      [rangeKey('YH-0007', 'GI-A')]: { min: -30, max: 30 },  // 41 → 이상치
      [rangeKey('YH-0007', 'GI-B')]: { min: 0, max: 50 },     // 8 → 정상
      // TMP 범위 없음 → 검사 안 함
    };
    expect(nodeOutlierCount(node, ranges)).toBe(1);
    expect(nodeOutlierCount(node, {})).toBe(0);
    expect(nodeOutlierCount(null, ranges)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- -g "순수 판정"`
Expected: FAIL — `Cannot find module '../src/lib/outlier.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/outlier.js`:

```js
// ─────────────────────────────────────────────────────────────────────────────
// outlier — 이상치 유효범위 순수 판정 (표시 전용, 값 변형 없음)
//
// range = { min:number|null, max:number|null }. 둘 다 null = 검사 안 함.
// 어디서도 직접 비교하지 말고 이 모듈만 호출(단일 소스). window 의존 없음.
// 정책: 값을 버리거나 0/보정하지 않는다 — raw 보존, 표시만(spec 2026-06-05).
// ─────────────────────────────────────────────────────────────────────────────

/** 채널 범위 저장 키 (nodeId + channelCode). 파싱하지 않으므로 단순 결합. */
export function rangeKey(nodeId, channelCode) {
  return `${String(nodeId ?? '')}|${String(channelCode ?? '')}`;
}

/** 유효한 경계가 하나라도 있나? (둘 다 null/undefined 면 검사 안 함) */
export function hasRange(range) {
  return !!range && (range.min != null || range.max != null);
}

/**
 * 값이 유효범위를 벗어났는지. 범위 없음 또는 결측(value=null/빈값/비숫자)이면 false.
 * 경계는 포함(>= min, <= max 가 정상). min/max 각각 있을 때만 그 쪽을 검사.
 */
export function isOutlier(value, range) {
  if (!hasRange(range)) return false;
  if (value === null || value === undefined || String(value).trim() === '') return false;
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  if (range.min != null && v < Number(range.min)) return true;
  if (range.max != null && v > Number(range.max)) return true;
  return false;
}

/** 노드의 이상치 채널 수. channelRanges = { [rangeKey]: range }. */
export function nodeOutlierCount(node, channelRanges) {
  if (!node || !Array.isArray(node.chans) || !channelRanges) return 0;
  let n = 0;
  for (const c of node.chans) {
    if (isOutlier(c.value, channelRanges[rangeKey(node.id, c.code)])) n += 1;
  }
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- -g "순수 판정"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/outlier.js tests/pulse-v2.spec.js
git commit -m "feat(outlier): 순수 유효범위 판정 함수 추가"
```

---

### Task 2: store 에 `channelRanges` 상태 + 영속

**Files:**
- Modify: `src/lib/store.jsx`

- [ ] **Step 1: Write the failing test**

`tests/pulse-v2.spec.js` 에 추가 — store 가 context 로 `channelRanges`/`setChannelRange` 를 노출하는지 E2E 로 간접 확인하는 대신, 여기서는 영속 키 계약을 단위로 고정한다(드로어 동작은 Task 3 에서 E2E). 다음 import 와 테스트 추가:

```js
test.describe('이상치 — store 영속 계약', () => {
  test('rangeKey 로 만든 맵이 JSON 직렬화 round-trip 가능', () => {
    const map = { [rangeKey('YH-0007', 'GI-A')]: { min: -30, max: 30 } };
    const round = JSON.parse(JSON.stringify(map));
    expect(round[rangeKey('YH-0007', 'GI-A')]).toEqual({ min: -30, max: 30 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes trivially — proceed regardless)**

Run: `npm test -- -g "store 영속 계약"`
Expected: PASS (이 단계는 키 계약 가드일 뿐; 실제 store 동작은 Task 3 E2E 가 검증). 실패하면 Task 1 의 `rangeKey` import 누락이므로 import 추가.

- [ ] **Step 3: Add channelRanges to store**

`src/lib/store.jsx` 의 import 블록(`import { ingestSensorCode } from './backendApi.js';` 줄 아래)에 추가:

```js
import { rangeKey } from './outlier.js';
```

`buildNode` 함수 위(파일 상단 헬퍼 영역, `const PulseContext = createContext(null);` 아래)에 추가:

```js
const RANGES_KEY = 'pulse:channelRanges'; // 이상치 유효범위 임시 영속(Phase 2 SQLite 이관)

/** localStorage 에서 채널 범위 맵을 읽음(없거나 깨졌으면 빈 맵). */
function loadChannelRanges() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RANGES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
```

`PulseProvider` 안, `const [ingest, setIngest] = useState({...})` 블록 아래에 상태 추가:

```js
  // 이상치 유효범위 — { [rangeKey(nodeId,code)]: { min, max } }. 임시 localStorage 영속.
  const [channelRanges, setChannelRanges] = useState(loadChannelRanges);
```

`updateNodeInterval` callback 아래(또는 `addChannelType` 위)에 setter 추가:

```js
  /**
   * 채널(센서) 유효범위 설정. range={min,max}(숫자|null). 둘 다 null/빈값이면 키 삭제(검사 안 함).
   * 표시 전용 — 측정값은 변형하지 않음. localStorage 즉시 영속(Phase 2 SQLite).
   */
  const setChannelRange = useCallback((nodeId, channelCode, range) => {
    const key = rangeKey(nodeId, channelCode);
    setChannelRanges((cur) => {
      const next = { ...cur };
      const min = range && range.min != null ? range.min : null;
      const max = range && range.max != null ? range.max : null;
      if (min != null || max != null) next[key] = { min, max };
      else delete next[key];
      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(RANGES_KEY, JSON.stringify(next)); } catch { /* 영속 실패 무시 */ }
      }
      return next;
    });
  }, []);
```

`value = useMemo(() => ({ ... }), [...])` 의 객체에 `channelRanges, setChannelRange,` 를 (예: `setIngest,` 위) 추가하고, deps 배열에도 `channelRanges, setChannelRange,` 를 추가:

```js
      ingest,
      channelRanges,
      setChannelRange,
      isElectron: folderApi.isElectron(),
```

deps 배열(끝부분 `retryNode, flushNode, retryAll, addChannelType, removeChannelType, loadDefaults,` 줄):

```js
      retryNode, flushNode, retryAll, addChannelType, removeChannelType, loadDefaults,
      channelRanges, setChannelRange,
```

- [ ] **Step 4: Run full suite to verify no regression**

Run: `npm test`
Expected: 기존 테스트 전부 PASS + 이번 단위 테스트 PASS (콘솔 에러 없음 테스트 포함).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.jsx tests/pulse-v2.spec.js
git commit -m "feat(store): 채널 유효범위 상태/영속(channelRanges) 추가"
```

---

### Task 3: 드로어에 "정상 범위" 입력 섹션

**Files:**
- Modify: `src/components/nodes/NodeDetailDrawer.jsx`
- Test: `tests/pulse-v2.spec.js`

- [ ] **Step 1: Write the failing E2E test**

`tests/pulse-v2.spec.js` 의 `test.describe('Pulse v2 — 노드 상세 드로어 (?test=node)' ...)` 블록 내부(기존 테스트들과 나란히)에 추가. 합성 노드 GI-A 최근값 ≈ 11.9mm:

```js
  test('정상 범위 — 상한 입력 시 이상치 배지 표시', async ({ page }) => {
    // 합성 노드 GI-A 최근값 ≈ 11.9 mm. 상한 10 → 이상치.
    await expect(page.getByText('정상 범위').first()).toBeVisible();
    const max = page.getByLabel('GI-A 상한');
    await max.fill('10');
    await max.press('Enter');
    // 같은 행에 이상치 배지가 뜸
    await expect(page.getByText('이상치', { exact: true }).first()).toBeVisible();
    // GI-B(범위 미입력)는 "검사 안 함"
    await expect(page.getByText('검사 안 함').first()).toBeVisible();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- -g "정상 범위 — 상한 입력"`
Expected: FAIL — `getByText('정상 범위')` 없음(섹션 미구현).

- [ ] **Step 3: Implement the section**

`src/components/nodes/NodeDetailDrawer.jsx` 상단 import 에 추가:

```js
import { rangeKey, isOutlier, hasRange } from '../../lib/outlier.js';
```

`NodeDetailDrawer` 본문에서 store 구조분해에 `channelRanges, setChannelRange` 추가:

```js
  const { ingest, syncNode, flushNode, deleteNode, setSensorLifecycle, updateNodeInterval, channelRanges, setChannelRange } = usePulse();
```

`ChannelStream` 호출부에 props 전달:

```js
          {tab === 'stream' && <ChannelStream node={node} onSetLifecycle={onSetLifecycle} channelRanges={channelRanges} setChannelRange={setChannelRange} />}
```

`ChannelStream` 시그니처/본문 수정 — 기존 `센서 상태` 섹션 다음, `{node.series && <DepthProfile .../>}` 앞에 `<ValidRangeSection ... />` 삽입:

```jsx
function ChannelStream({ node, onSetLifecycle, channelRanges, setChannelRange }) {
  return (
    <div className="space-y-4">
      {/* 센서 상태 — (기존 내용 그대로 유지) */}
      <section>
        {/* ...기존 센서 상태 섹션 변경 없음... */}
      </section>

      <ValidRangeSection node={node} channelRanges={channelRanges} setChannelRange={setChannelRange} />

      {node.series && <DepthProfile node={node} />}
    </div>
  );
}
```

> 주의: 위에서 `센서 상태` `<section>` 의 **내부는 변경하지 말 것** — `<ValidRangeSection>` 한 줄만 `{node.series && ...}` 위에 추가한다.

파일 하단(예: `DepthProfile` 함수 아래)에 두 컴포넌트 추가:

```jsx
// ── 정상 범위(이상치 기준) ───────────────────────────────────────────────────
function ValidRangeSection({ node, channelRanges, setChannelRange }) {
  return (
    <section>
      <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">
        정상 범위 <span className="normal-case text-zinc-300 dark:text-zinc-600">— 벗어난 값은 이상치로 표시(값은 그대로 전송)</span>
      </h4>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {node.chans.map((c) => (
          <RangeRow
            key={c.ch}
            chan={c}
            range={channelRanges?.[rangeKey(node.id, c.code)]}
            onCommit={(r) => setChannelRange?.(node.id, c.code, r)}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        하한·상한을 비워두면 검사하지 않습니다. 값은 버리거나 고치지 않고 표시만 합니다.
      </p>
    </section>
  );
}

// 한 채널의 범위 입력 행. 블러/Enter 시 커밋, 하한>상한·비숫자는 인라인 경고.
function RangeRow({ chan, range, onCommit }) {
  const [min, setMin] = useState(range?.min != null ? String(range.min) : '');
  const [max, setMax] = useState(range?.max != null ? String(range.max) : '');
  const [err, setErr] = useState('');

  useEffect(() => {
    setMin(range?.min != null ? String(range.min) : '');
    setMax(range?.max != null ? String(range.max) : '');
  }, [range?.min, range?.max]);

  const commit = () => {
    const parse = (s) => {
      const t = String(s).trim();
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    };
    const mn = parse(min);
    const mx = parse(max);
    if (Number.isNaN(mn) || Number.isNaN(mx)) { setErr('숫자를 입력하세요'); return; }
    if (mn != null && mx != null && mn > mx) { setErr('하한이 상한보다 큽니다'); return; }
    setErr('');
    onCommit?.({ min: mn, max: mx });
  };

  const r = { min: range?.min ?? null, max: range?.max ?? null };
  const checked = hasRange(r);
  const outlier = isOutlier(chan.value, r);
  const inputCls =
    'w-16 h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] tabular-nums text-zinc-800 dark:text-zinc-100';

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300 w-16 shrink-0 truncate">{chan.code}</span>
        <span className="text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400 w-16 shrink-0 text-right">
          {chan.value == null ? '—' : fmtNum(chan.value)}
        </span>
        <input
          type="number" inputMode="decimal" aria-label={`${chan.code} 하한`} placeholder="하한"
          value={min} onChange={(e) => setMin(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()} className={inputCls}
        />
        <span className="text-zinc-300 dark:text-zinc-600 text-[12px]">~</span>
        <input
          type="number" inputMode="decimal" aria-label={`${chan.code} 상한`} placeholder="상한"
          value={max} onChange={(e) => setMax(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()} className={inputCls}
        />
        <span className="text-[11px] text-zinc-400 w-8 shrink-0 truncate">{chan.unit || ''}</span>
        <span className="flex-1" />
        {!checked ? (
          <span className="text-[11px] text-zinc-300 dark:text-zinc-600 shrink-0">검사 안 함</span>
        ) : outlier ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 shrink-0">이상치</span>
        ) : (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">정상</span>
        )}
      </div>
      {err && <div className="mt-1 text-[10.5px] text-red-600 dark:text-red-400">{err}</div>}
    </div>
  );
}
```

> `useState`/`useEffect` 는 파일 상단에서 이미 `import React, { useEffect, useState } from 'react';` 로 들어와 있고, `fmtNum` 도 이미 import 되어 있다(추가 import 불필요).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- -g "정상 범위 — 상한 입력"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/NodeDetailDrawer.jsx tests/pulse-v2.spec.js
git commit -m "feat(drawer): 채널별 정상범위 입력 + 이상치 표시"
```

---

### Task 4: 노드 목록 이상치 요약 배지

**Files:**
- Create: `src/components/nodes/NodeOutlierBadge.jsx`
- Modify: `src/components/nodes/NodeTable.jsx`, `NodeCardGrid.jsx`, `NodeCompactList.jsx`
- Test: `tests/pulse-v2.spec.js`

- [ ] **Step 1: Write the failing E2E test**

`tests/pulse-v2.spec.js` 의 드로어 describe 블록(`?test=node`) 안에 추가 — 드로어에서 범위 설정 후 닫으면 목록 행에 요약 배지가 뜸:

```js
  test('이상치 설정 후 드로어 닫으면 노드 목록에 "이상치 1" 요약', async ({ page }) => {
    await page.getByLabel('GI-A 상한').fill('10');
    await page.getByLabel('GI-A 상한').press('Enter');
    // 드로어 닫기 (헤더 X 버튼 — aside 안의 X)
    await page.keyboard.press('Escape');
    await expect(page.getByText('YH-0007').first()).toBeVisible(); // 목록 노출
    await expect(page.getByText(/이상치 1/).first()).toBeVisible(); // 요약 배지
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- -g "이상치 1"`
Expected: FAIL — `이상치 1` 텍스트 없음(배지 미구현).

- [ ] **Step 3: Create badge + wire into 3 views**

Create `src/components/nodes/NodeOutlierBadge.jsx`:

```jsx
// ─────────────────────────────────────────────────────────────────────────────
// NodeOutlierBadge — 노드의 이상치 채널 수 요약 배지. 0 이면 렌더 안 함.
//   유효범위(store.channelRanges)를 직접 구독해 채널 값과 대조(표시 전용).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePulse } from '../../lib/store.jsx';
import { nodeOutlierCount } from '../../lib/outlier.js';

export default function NodeOutlierBadge({ node, className = '' }) {
  const { channelRanges } = usePulse();
  const count = nodeOutlierCount(node, channelRanges);
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 ${className}`}>
      <AlertTriangle size={11} /> 이상치 {count}
    </span>
  );
}
```

`NodeTable.jsx` — import 추가 후, 센서 컬럼 `<td>`(채널 코드 나열하는 셀, `n.chans.slice(0, 2)...` 가 든 `</td>`) 안 마지막에 배지 삽입:

import 줄 추가:
```js
import NodeOutlierBadge from './NodeOutlierBadge.jsx';
```

해당 `<td className="px-3 py-2.5 whitespace-nowrap">` (센서 컬럼) 의 닫는 `</td>` 직전에:
```jsx
                <NodeOutlierBadge node={n} className="ml-2 align-middle" />
```

`NodeCardGrid.jsx` — import 추가:
```js
import NodeOutlierBadge from './NodeOutlierBadge.jsx';
```
채널 목록 블록(`<div className="space-y-1 mb-3"> ... </div>`)의 닫는 `</div>` 바로 다음(푸터 `<div className="flex items-center justify-between pt-3 ...">` 앞)에:
```jsx
          <div className="mb-3 -mt-1"><NodeOutlierBadge node={n} /></div>
```

`NodeCompactList.jsx` — import 추가:
```js
import NodeOutlierBadge from './NodeOutlierBadge.jsx';
```
`<span className="flex-1" />` 다음 줄(주기/시각 span 앞)에:
```jsx
          <NodeOutlierBadge node={n} className="shrink-0" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- -g "이상치 1"`
Expected: PASS

- [ ] **Step 5: Run full suite (no regression)**

Run: `npm test`
Expected: 전부 PASS (기존 + 신규). 콘솔 에러 없음 테스트 포함.

- [ ] **Step 6: Commit**

```bash
git add src/components/nodes/NodeOutlierBadge.jsx src/components/nodes/NodeTable.jsx src/components/nodes/NodeCardGrid.jsx src/components/nodes/NodeCompactList.jsx tests/pulse-v2.spec.js
git commit -m "feat(monitor): 노드 목록 이상치 요약 배지"
```

---

### Task 5: 결정 기록(ADR) + CHANGELOG

**Files:**
- Create: `docs/decisions/0012-이상치-판정-펄스-이관.md`
- Modify: `docs/decisions/README.md`, `CHANGELOG.md`

- [ ] **Step 1: ADR 작성**

`docs/decisions/adr-template.md` 를 복사해 `docs/decisions/0012-이상치-판정-펄스-이관.md` 생성. 핵심 내용:
- 제목: 이상치(유효범위) 판정을 백엔드 → 펄스로 이관
- 상태: 채택됨 (2026-06-05)
- 맥락: ADR-0010 은 "판정=백엔드"였으나, 운영 요구로 센서별 유효범위 설정·이상치 표시를 펄스에서 직접 한다.
- 결정: 센서(채널)별 `{min,max}` 를 펄스가 보관(localStorage→Phase2 SQLite), 전송값과 대조해 표시만(비파괴). 값은 변형/드롭하지 않음(value:null 보존 원칙 유지).
- 영향: ADR-0010 의 "판정=백엔드" 문구를 "수집기 표시는 펄스, 정본 품질판정은 백엔드와 병행" 으로 보완(ADR-0010 상태는 유지, 본 ADR 이 보완).
- 비범위: 종류별 기본값 페이지·다단계 경고·백엔드로 범위 전송은 추후.

`docs/decisions/README.md` 인덱스에 0012 한 줄 추가.

- [ ] **Step 2: CHANGELOG 갱신**

`CHANGELOG.md` 의 `[Unreleased]` 에 한 줄 추가:
```
- 센서(채널)별 정상범위 설정 + 이상치 표시(드로어·노드 목록 요약). 값은 비파괴 표시만. (ADR-0012)
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0012-이상치-판정-펄스-이관.md docs/decisions/README.md CHANGELOG.md
git commit -m "docs: 이상치 판정 펄스 이관 ADR-0012 + CHANGELOG"
```

---

## Self-Review (작성자 확인 완료)

- **Spec coverage:** 입력 위치(Task 3) / 판정 단일함수(Task 1) / 표시: 드로어+목록(Task 3,4) / 비파괴(Task 1 정책·Task 3 표시만) / 미입력=검사안함(Task 1 hasRange·Task 3 "검사 안 함") / 저장 localStorage→SQLite(Task 2) / 종류별 페이지 제외(비범위) / ADR 기록(Task 5) — 모두 매핑됨.
- **Placeholder scan:** 모든 코드 단계에 실제 코드 포함. "적절히 처리" 류 없음.
- **Type consistency:** `rangeKey`/`isOutlier`/`hasRange`/`nodeOutlierCount` 시그니처가 Task 1 정의와 Task 2~4 사용처에서 일치. range 형태 `{min:number|null,max:number|null}` 일관. store 노출명 `channelRanges`/`setChannelRange` 일관.
- **합성 노드 값 가정:** TEST_NODE GI-A 최근값 ≈ 11.9mm(상한 10 → 이상치), GI-B ≈ 8.1mm. App.jsx TEST_NODE.raw 마지막 행 기준 deriveFromRaw 로 채워짐 — 드로어/목록 테스트의 기대값 근거.
