// tests/_helpers/statCardPinner.ts
//
// DOM-traversal helper for admin render-flow regression tests.
//
// Pin (read-and-assert) the values of a stat-card grid by querying the
// parent node's descendants that match a CSS selector. Each match's trimmed
// innerText is returned in document order. The render-flow test files use
// this to assert stat-grid counts (Total / Active Signals / Status / Days
// Left / etc) in a copy-stable way: the digits are the contract; the copy
// around them can move freely.
//
// Both `root` and `selector` are REQUIRED so callers commit intentionally
// to the scope (container vs document.body) AND the exact CSS class
// combination. The admin components intentionally use DIFFERENT selectors:
//   - SignalManager: <p className="text-2xl font-black"> (p + font-black)
//   - BrainManager:  <div className="text-2xl font-black"> (div + font-black)
//   - GiveawayManager: <div className="text-2xl font-bold ..."> (font-bold)
// so no single default would be honest for all three. Forcing explicit
// arguments at every call site also surfaces selector drift immediately
// when one component quietly renames its stat-card class.
//
// ## Migration path for the 4 prior render-flow files
//
// When migrating tests/customerProfileAdminRender / tests/orderManagerRender
// / tests/couponManagerRender / tests/userManagerRender to this helper,
// follow the same pattern: inspect the component's actual JSX for the
// stat-card element's tag (p vs div) + class combination (font-black vs
// font-bold + case tokens), then pass those EXACT values here. Do NOT
// assume a "canonical" selector that works across files.
//
// ## Usage
// ```ts
// import { pinStatValues } from './_helpers/statCardPinner';
//
// const values = pinStatValues(container, 'div.text-2xl.font-black');
// expect(values[0]).toBe('3'); // Total
// ```

export function pinStatValues(
    root: ParentNode,
    selector: string,
): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>(selector))
        .map((el) => (el.textContent || '').trim());
}
