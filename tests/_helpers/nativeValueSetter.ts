// tests/_helpers/nativeValueSetter.ts
//
// Native React-controlled-component value setter helper.
//
// React intercepts `onChange` by attaching its listener at the document
// level and comparing the input's PRE-change value against the post-change
// value via the prototype's value descriptor. Setting `.value =` directly
// on the instance does NOT trigger the prototype descriptor and therefore
// does NOT fire onChange. The documented workaround is:
//
//   1. Look up the OWN property descriptor of the value attribute on
//      HTMLInputElement.prototype / HTMLTextAreaElement.prototype.
//   2. Call that descriptor's `set` against the instance.
//
// Calling `inputValueSetter.call(textarea, ...)` throws a TypeError
// (`'set value' called on an object that is not a valid instance of
// HTMLInputElement`) because both setters are strict-instance-checked.
// That's why we expose BOTH raw setters and the type-routing
// `setReactValue` convenience.
//
// `setReactValue` ALSO dispatches a bubbling `input` event so React's
// synthetic onChange handler fires (React listens for the native `input`
// event on controlled components). We deliberately use `new Event(...)`
// rather than `new InputEvent(...)` because jsdom polyfills `Event` more
// faithfully than `InputEvent` across its supported React versions
// (verified against React 18 + jsdom 22+; if you migrate to a newer
// jsdom and discover InputEvent is fully supported, switch freely).
//
// Always call `setReactValue(element, '...')` AFTER the element is
// mounted and AFTER any play() / focus() steps the test requires.
//
// ## Usage
// ```ts
// import { setReactValue, inputValueSetter, textareaValueSetter } from './_helpers/nativeValueSetter';
//
// // Convenience (preferred): auto-dispatches the input event.
// setReactValue(input, 'Hello');
// setReactValue(textarea, 'Multi-line text');
//
// // Low-level: dispatch the event yourself.
// inputValueSetter.call(input, 'Hello');
// input.dispatchEvent(new Event('input', { bubbles: true }));
// ```

// Raw per-prototype descriptor setters. Intentionally untyped: the
// `Object.getOwnPropertyDescriptor(...)!.set!` accessor is typed as
// `((v: any) => any) | undefined` in lib.dom.d.ts. We let TypeScript infer
// rather than apply an explicit `this:` annotation so the helper survives
// future lib.dom typing changes without manual cast escalation.
export const inputValueSetter =
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set;

export const textareaValueSetter =
    Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set;

/**
 * Set the value of a React-controlled input/textarea AND dispatch a
 * bubbling input event so React's synthetic onChange handler fires.
 *
 * Uses the per-prototype value descriptor to bypass React's
 * change-detection trap (see module header).
 */
export function setReactValue(
    el: HTMLInputElement | HTMLTextAreaElement,
    value: string,
): void {
    // Local typed alias keeps the conditional readable while staying
    // structurally compatible with the inferred `Function` type of the raw
    // setters declared above.
    const setter = (el instanceof HTMLTextAreaElement
        ? textareaValueSetter
        : inputValueSetter) as (this: unknown, value: string) => void;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}
