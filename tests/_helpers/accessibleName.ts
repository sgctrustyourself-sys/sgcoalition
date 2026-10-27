// tests/_helpers/accessibleName.ts
//
// Accessible-name computation for the runtime half of the a11y guard.
//
// The source-level guards (tests/modalOverlayFocusTrapCoverage.test.ts,
// tests/iconControlName.test.ts) can see that an element declares a label, but
// only the rendered DOM proves the label survives rendering, resolves to real
// text, and is what a screen reader would actually announce. These helpers
// answer "what would a screen reader call this?" from the live tree.
//
// Name computation follows the ARIA order for the forms this app uses:
//
//   1. aria-labelledby — the text of each referenced element, in id order.
//      A reference that does not resolve contributes nothing; if no reference
//      resolves, the next source is tried.
//   2. aria-label.
//   3. name from contents — for buttons and links this is the normal case:
//      the text of their descendants, with aria-hidden subtrees skipped,
//      <img alt> contributing its alt, and <svg> icon internals skipped
//      (an icon contributes no text). This is why the sweep can flag an
//      icon-only control whose sibling badge number would otherwise become
//      its name.
//   4. title.
//
// Step 3 is limited to the roles that actually allow name from contents. A
// dialog does not: it is named by the author, so a dialog whose aria-labelledby
// target is missing is UNNAMED, not named after its body text. The dialog tests
// rely on that — they assert the name is empty when the referenced heading is
// gone, which is exactly the failure a screen reader would hit.
//
// Deliberately not a full implementation: no <label> association for form
// fields, no table-header or cell-header traversal, no aria-owns. A dialog that
// relies on those should be named explicitly instead, which is also what the
// source-level guards require.

export const MODAL_ROLE_SELECTOR = '[role="dialog"], [role="alertdialog"], dialog';

/** Controls whose name a screen reader takes from their contents. */
export const CONTROL_SELECTOR = 'button, a[href]';

/** Element text, with the whitespace collapse a name comparison needs. */
const textOf = (element: Element): string =>
    (element.textContent || '').replace(/\s+/g, ' ').trim();

const SKIPPED_TAGS = new Set(['svg', 'script', 'style']);

/** Roles whose name may come from their contents (accname "name from content"). */
const NAME_FROM_CONTENT_ROLES = new Set([
    'button',
    'link',
    'heading',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'tab',
    'treeitem',
    'checkbox',
    'radio',
    'switch',
]);

function allowsNameFromContents(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a') return true;
    const role = element.getAttribute('role');
    return role !== null && NAME_FROM_CONTENT_ROLES.has(role);
}

/**
 * The text a control would be named by, following the accname content rules
 * this app depends on: aria-hidden subtrees contribute nothing, an <img>
 * contributes its alt, and an icon <svg> contributes nothing.
 */
function nameFromContents(element: Element): string {
    const parts: string[] = [];

    const walk = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.nodeValue || '');
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const child = node as Element;
        if (child.getAttribute('aria-hidden') === 'true') return;

        const tag = child.tagName.toLowerCase();
        if (tag === 'img') {
            const alt = child.getAttribute('alt');
            if (alt?.trim()) parts.push(` ${alt} `);
            return;
        }
        if (SKIPPED_TAGS.has(tag)) return;

        for (const grandchild of child.childNodes) walk(grandchild);
    };

    for (const child of element.childNodes) walk(child);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** The accessible name of a rendered element. */
export function accessibleName(element: Element): string {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
        const document = element.ownerDocument;
        const referenced = labelledBy
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id))
            .filter((target): target is HTMLElement => target !== null)
            .map(textOf)
            .filter(Boolean)
            .join(' ')
            .trim();

        if (referenced) return referenced;
    }

    const label = element.getAttribute('aria-label');
    if (label?.trim()) return label.trim();

    if (allowsNameFromContents(element)) {
        const contents = nameFromContents(element);
        if (contents) return contents;
    }

    const title = element.getAttribute('title');
    if (title?.trim()) return title.trim();

    return '';
}

/** Elements with a modal role whose accessible name is exactly `name`. */
export function dialogsNamed(root: ParentNode, name: string): Element[] {
    return [...root.querySelectorAll(MODAL_ROLE_SELECTOR)].filter(
        (element) => accessibleName(element) === name,
    );
}

/** Every rendered dialog name, for failure messages that show what IS there. */
export function dialogNames(root: ParentNode): string[] {
    return [...root.querySelectorAll(MODAL_ROLE_SELECTOR)].map((element) => accessibleName(element));
}

/** A control (button or link) rendered with no accessible name. */
export interface UnnamedControl {
    tag: string;
    html: string;
}

/**
 * Every rendered button/link whose accessible name is empty.
 *
 * This is the runtime counterpart of tests/iconControlName.test.ts: the static
 * guard proves a name is *written*, this proves one is *announced* after the
 * component renders — which is where a name built from an empty prop, a badge
 * number, or a conditional label goes wrong.
 */
export function controlsWithoutName(root: ParentNode): UnnamedControl[] {
    return [...root.querySelectorAll(CONTROL_SELECTOR)]
        .filter((element) => accessibleName(element) === '')
        .map((element) => ({
            tag: element.tagName.toLowerCase(),
            html: element.outerHTML.replace(/\s+/g, ' ').slice(0, 180),
        }));
}

/** The accessible name of the control whose visible text is exactly `text`. */
export function controlByText(root: ParentNode, text: string): Element {
    const match = [...root.querySelectorAll(CONTROL_SELECTOR)].find(
        (element) => (element.textContent || '').replace(/\s+/g, ' ').trim() === text,
    );
    if (!match) throw new Error(`no control whose text is exactly "${text}"`);
    return match;
}
