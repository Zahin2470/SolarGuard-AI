"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Wraps a server action for a <form>. React resets uncontrolled fields after a form `action`
 * completes, even on a validation error, which would wipe what the person typed (and a chosen
 * file). Submitting through onSubmit keeps the fields, so an error never costs the user their input.
 */
export function useServerForm<S extends object>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initial: S,
) {
  const [state, dispatch, actionPending] = useActionState(
    action as unknown as (prev: Awaited<S>, formData: FormData) => Promise<Awaited<S>>,
    initial as unknown as Awaited<S>,
  );
  const [transitionPending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(() => dispatch(data));
  };
  return { state: state as S, pending: actionPending || transitionPending, onSubmit };
}
