"use client";

import { useEffect, useState } from "react";
import { Field, inputClass } from "@/components/ui/Form";

const KEY = "solarguard.actor";

/**
 * "Acting as" name recorded in the audit trail. There are no user accounts yet, so this is a
 * self-declared label, not an authenticated identity. Remembered per browser as a convenience.
 */
export function useActor(): [string, (v: string) => void] {
  const [actor, setActor] = useState("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate a per-browser preference
      if (saved) setActor(saved);
    } catch {
      /* storage unavailable: the field simply starts empty */
    }
  }, []);
  const update = (v: string) => {
    setActor(v);
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [actor, update];
}

export function ActorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="max-w-xs">
      <Field
        label="Acting as"
        htmlFor={id}
        hint="Recorded in the audit trail. A self-declared name: there are no user accounts yet."
      >
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={80}
          placeholder="Your name or role"
          autoComplete="name"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
