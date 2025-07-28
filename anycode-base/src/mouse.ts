import { AnycodeLine } from './utils';

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
