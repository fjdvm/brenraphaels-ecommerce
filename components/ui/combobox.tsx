"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  label: string;
  /** Submitted with the form like a native field: the chosen option's value, or "" when nothing is chosen. */
  name: string;
  options: ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
};

/** A searchable dropdown: type to filter, arrow keys and Enter or the mouse to choose, and a button to clear. */
export function Combobox({
  label,
  name,
  options,
  defaultValue = "",
  placeholder,
  emptyMessage = "No matches found",
  disabled,
  className,
}: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? "";

  const [value, setValue] = useState(defaultValue);
  const [text, setText] = useState(labelOf(defaultValue));
  const [filtering, setFiltering] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = text.trim().toLowerCase();
  const visible = filtering && query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;

  function choose(next: string) {
    setValue(next);
    setText(labelOf(next));
    setFiltering(false);
    setOpen(false);
    setActive(-1);
  }

  function clear() {
    choose("");
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(visible.length ? 0 : -1);
        return;
      }
      if (!visible.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + visible.length) % visible.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (visible[active]) choose(visible[active].value);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setFiltering(true);
            setValue("");
            setOpen(true);
            setActive(-1);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            setFiltering(false);
            setText(labelOf(value));
          }}
          className={cn(
            "w-full border bg-white pr-16 outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-container-low",
            fieldClass,
          )}
        />
        <input type="hidden" name={name} value={value} />
        <div className="absolute inset-y-0 right-3 flex items-center gap-1">
          {text || value ? (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
              className="grid size-6 place-items-center rounded-full text-muted hover:text-primary"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
          <ChevronDown aria-hidden className="pointer-events-none size-[18px] text-muted" />
        </div>
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-64 flex-col gap-0.5 overflow-auto rounded-2xl border border-line bg-white p-2 shadow-[0_20px_24px_rgba(43,26,69,0.18)]"
        >
          {visible.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-[10px] p-3 text-sm tracking-[0.35px] text-ink",
                index === active && "bg-lavender-soft",
                option.value === value && "font-medium text-primary",
              )}
            >
              <span className="flex-1">{option.label}</span>
              {option.value === value ? <Check aria-hidden className="size-4" /> : null}
            </li>
          ))}
          {visible.length === 0 ? (
            <li role="presentation" className="px-3 py-2.5 text-xs tracking-[0.35px] text-muted">
              {emptyMessage}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
