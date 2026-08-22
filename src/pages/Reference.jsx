// ─────────────────────────────────────────────────────────────────────────────
// Reference — 계측기 도감 (정보 전달용, 읽기 전용)
//   탭 3개: ① 계측기 목록 ② 공식 타입 ③ 계수 사전.
//   데이터 단일 소스 = lib/sensorReference.js. API·상태·영속 없음.
//
// 참고: Pulse 는 공식을 "적용"하지 않습니다(ADR-0009). 이 페이지는 어떤 계측기가
// 어떤 공식·계수로 환산되는지 사람에게 설명하는 도감(문서)일 뿐입니다.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader.jsx';
import SensorListTab from '../components/reference/SensorListTab.jsx';
import FormulaTab from '../components/reference/FormulaTab.jsx';
import CoefficientTab from '../components/reference/CoefficientTab.jsx';

const TABS = [
  { id: 'sensors', label: '계측기 목록' },
  { id: 'formula', label: '공식 타입' },
  { id: 'coeff', label: '계수 사전' },
];

export default function Reference({ dark, setDark }) {
  const [tab, setTab] = useState('sensors');

  return (
    <>
      <PageHeader
        title="계측기 도감"
        subtitle="계측기 종류 · 공식 타입 · 계수 사전"
        dark={dark}
        setDark={setDark}
      />

      {/* 탭 네비 (밑줄형) */}
      <div className="px-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 h-10 text-[14px] font-semibold border-b-2 whitespace-nowrap transition-colors duration-150 ${
                  active
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-50'
                    : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="max-w-[1120px] mx-auto" key={tab}>
          {tab === 'sensors' && <SensorListTab />}
          {tab === 'formula' && <FormulaTab />}
          {tab === 'coeff' && <CoefficientTab />}
        </div>
      </div>
    </>
  );
}
