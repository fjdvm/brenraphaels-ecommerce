"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const yearsAhead = 3;

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** Today in Asia/Manila as "YYYY-MM-DD", the zone every Interview is scheduled in. */
export function manilaToday(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * A month calendar. Every day before `min` and every year before its year is disabled, so it cannot be clicked or chosen.
 * Values are "YYYY-MM-DD".
 */
export function DatePicker({ value, onChange, min }: { value: string; onChange: (value: string) => void; min: string }) {
  const [minYear, minMonth] = min.split("-").map(Number);
  const [shown, setShown] = useState(() => {
    const [year, month] = (value || min).split("-").map(Number);
    return { year, month: month - 1 };
  });
  const atEarliest = shown.year === minYear && shown.month === minMonth - 1;

  function go(step: number) {
    const index = shown.year * 12 + shown.month + step;
    setShown({ year: Math.floor(index / 12), month: index % 12 });
  }

  const firstWeekday = new Date(Date.UTC(shown.year, shown.month, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(shown.year, shown.month + 1, 0)).getUTCDate();
  const cells = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  const years = Array.from({ length: yearsAhead + 1 }, (_, index) => minYear + index);
  const selectClass = "rounded-full bg-surface px-3 py-1.5 text-sm font-medium tracking-[0.35px] text-ink";
  const arrowClass = "grid size-9 place-items-center rounded-full bg-surface text-primary disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3 border border-line p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous month" disabled={atEarliest} onClick={() => go(-1)} className={arrowClass}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <select aria-label="Month" value={shown.month} onChange={(event) => setShown({ ...shown, month: Number(event.target.value) })} className={selectClass}>
            {months.map((name, index) => (
              <option key={name} value={index} disabled={shown.year === minYear && index < minMonth - 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            value={shown.year}
            onChange={(event) => {
              const year = Number(event.target.value);
              setShown({ year, month: year === minYear ? Math.max(shown.month, minMonth - 1) : shown.month });
            }}
            className={selectClass}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button type="button" aria-label="Next month" onClick={() => go(1)} disabled={shown.year === minYear + yearsAhead && shown.month === 11} className={arrowClass}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs tracking-[0.35px] text-muted">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} />;
          const date = iso(shown.year, shown.month, day);
          const past = date < min;
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              disabled={past}
              aria-pressed={selected}
              aria-label={`${day} ${months[shown.month]} ${shown.year}`}
              onClick={() => onChange(date)}
              className={`grid h-10 place-items-center rounded-full text-sm font-medium tracking-[0.35px] disabled:cursor-not-allowed disabled:text-line ${
                selected ? "bg-primary text-white" : "text-ink enabled:hover:bg-lavender"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
