import { AnycodeLine, Pos } from "./utils"; 

export function getMouseRow(
    event: MouseEvent, 
    sel: Selection | null
): number | null {
    if (!sel || sel.rangeCount === 0) return null;
    
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    
    const lineDiv = target.closest('.line') as AnycodeLine | null
        ?? node.parentElement?.closest('.line') as AnycodeLine | null;
    
    if (!lineDiv) return null;
    
    const row = lineDiv.lineNumber ?? parseInt(lineDiv.getAttribute('ln') || '-1', 10);
    return isNaN(row) || row < 0 ? null : row;
}

export function getMouseCol(
    event: MouseEvent,
    sel: Selection | null,
    chunks: Node[]
): number | null {
    if (!sel || sel.rangeCount === 0) return null;
    
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offsetInNode = range.startOffset;
    
    if (chunks.length === 1) {
        const content = chunks[0].textContent ?? '';
        if (content === '' || content === '\u200B') {
            return 0;
        }
    }
    
    let col = 0;
    for (const ch of chunks) {
        if (ch === node || (ch as Element).contains?.(node)) {
            col += offsetInNode;
            break;
        }
        col += (ch.textContent ?? '').length;
    }
    
    return col;
}

export function getPosFromMouse(e: MouseEvent): Pos | null{
    
    const target = e.target as Node;
    if (!target) return null;

    let pos: { offsetNode: Node; offset: number } | null = null;

    if (document.caretPositionFromPoint) {
        const caret = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (caret) {
            pos = { offsetNode: caret.offsetNode, offset: caret.offset };
        }
    } else if ((document as any).caretRangeFromPoint) {
        const range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
            pos = { offsetNode: range.startContainer, offset: range.startOffset };
        }
    }

    if (!pos || !pos.offsetNode) return null;

    const abs = resolveAbsoluteOffset(pos.offsetNode, pos.offset);
    return abs
}

export function resolveAbsoluteOffset(node: Node, nodeOffset: number): Pos | null {
    // corner case, whole row selected
    if (
        node instanceof HTMLElement &&
        node.classList.contains("line")
    ) {
        const lineDiv = node as AnycodeLine;
        return { row: lineDiv.lineNumber, col: 0 }; 
    }

    const lineDiv = (
        node instanceof HTMLElement
            ? node.closest(".line")
            : node.parentElement?.closest(".line")
    ) as AnycodeLine | null;

    if (!lineDiv || typeof lineDiv.lineNumber !== "number") return null;
    
    if (lineDiv.childNodes.length === 1) {
        const content = lineDiv.childNodes[0].textContent ?? '';
        if (content === '' || content === '\u200B') {
            return { row: lineDiv.lineNumber, col: 0 }; 
        }
    }

    let offset = 0;
    let found = false;

    for (const child of lineDiv.childNodes) {
        if (found) break;

        if (child.contains(node)) {
            if (child === node) {
                offset += nodeOffset;
            } else {
                for (const sub of child.childNodes) {
                    if (sub === node) {
                        offset += nodeOffset;
                        found = true;
                        break;
                    } else {
                        offset += sub.textContent?.length ?? 0;
                    }
                }
            }
            found = true;
        } else {
            offset += child.textContent?.length ?? 0;
        }
    }

    return { row: lineDiv.lineNumber, col: offset }; 
}
