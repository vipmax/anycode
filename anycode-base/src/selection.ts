import { AnycodeLine, Pos } from "./utils"; 
import { Code } from "./code";

export class Selection {
    public anchor: number | null ;
    public cursor: number | null ;

    constructor(anchor: number, cursor: number) {
        this.anchor = anchor;
        this.cursor = cursor;
    }
    
    public reset(pos: number) {
        this.anchor = pos;
        this.cursor = pos;
    }
    public updateCursor(pos: number) {
        this.cursor = pos;
    }

    static fromRange(start: number, end: number): Selection {
        return new Selection(start, end);
    }

    static fromAnchorAndCursor(anchor: number, cursor: number): Selection {
        return new Selection(anchor, cursor);
    }
    
    withCursor(cursor: number): Selection {
        return new Selection(this.anchor!, cursor);
    }

    static empty(offset: number): Selection {
        return new Selection(offset, offset);
    }

    public isEmpty(): boolean {
        return this.anchor === this.cursor;
    }
    
    public nonEmpty(): boolean {
        return !this.isEmpty();
    }

    public isActive(): boolean {
        return this.nonEmpty();
    }

    public contains(index: number): boolean {
        const [start, end] = this.sorted();
        return index >= start && index < end;
    }

    public sorted(): [number, number] {
        return this.anchor! <= this.cursor! 
            ? [this.anchor!, this.cursor!] 
            : [this.cursor!, this.anchor!];
    }

    public get start(): number {
        return Math.min(this.anchor!, this.cursor!);
    }

    public get end(): number {
        return Math.max(this.anchor!, this.cursor!);
    }

    public min(): number {
        return this.start;
    }
    
    public max(): number {
        return this.end;
    }

    public length(): number {
        return this.end - this.start;
    }

    public equals(other: Selection | null): boolean {
        if (!other) return false;
        return this.anchor === other.anchor && this.cursor === other.cursor;
    }

    public toString(): string {
        return `Selection(anchor=${this.anchor}, cursor=${this.cursor})`;
    }

    public bigger(s: Selection): boolean {
        return this.length() > s.length();
    }
}

export function getSelection(): { start: Pos, end: Pos } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        return null;
    }

    const range = sel.getRangeAt(0);
    if (range.collapsed) {
        return null;
    }

    const start = resolveAbsoluteOffset(range.startContainer, range.startOffset);
    const end = resolveAbsoluteOffset(range.endContainer, range.endOffset);

    if (start == null || end == null) {
        return null;
    }

    return { start, end };
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


interface DOMPosition {
    node: Node;
    offset: number;
}

function resolveDOMPosition(
    offset: number, lines: AnycodeLine[], code: Code
): DOMPosition | null {
    for (const line of lines) {
        const lineOffset = code.getOffset(line.lineNumber, 0);
        const lineLength = Array.from(line.childNodes)
            .map(n => n.textContent?.length ?? 0)
            .reduce((a, b) => a + b, 0);

        if (offset >= lineOffset && offset <= lineOffset + lineLength) {
            let remaining = offset - lineOffset;

            for (const span of line.childNodes) {
                const len = span.textContent?.length ?? 0;
                if (remaining <= len) {
                    const textNode = span.firstChild;
                    if (!textNode) return null;
                    return { node: textNode, offset: remaining };
                }
                remaining -= len;
            }
        }
    }
    return null;
}

export function setSelectionFromOffsets(
    selection: Selection, lines: AnycodeLine[], code: Code
) {
    // console.log('setSelectionFromOffsets', selection, lines, code);
    
    if (lines.length === 0) return;

    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];

    const visibleStart = code.getOffset(firstLine.lineNumber, 0);
    const visibleEnd =
        code.getOffset(lastLine.lineNumber, 0) +
        Array.from(lastLine.childNodes)
            .map((n) => n.textContent?.length ?? 0)
            .reduce((a, b) => a + b, 0);

    const [selectionStart, selectionEnd] = selection.sorted(); // DOM needs sorted

    const clamped = new Selection(
        Math.max(selectionStart, visibleStart),
        Math.min(selectionEnd, visibleEnd)
    );

    const startPos = resolveDOMPosition(clamped.start, lines, code);
    const endPos = resolveDOMPosition(clamped.end, lines, code);
    if (!startPos || !endPos) return;

    const range = document.createRange();
    const sel = window.getSelection();
    if (!sel) return;

    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    sel.removeAllRanges();
    sel.addRange(range);
}

function findNodeAndOffset(lineDiv: AnycodeLine, targetOffset: number) {
    let currentOffset = targetOffset;
    for (let chunkNode of lineDiv.children) {
        const textLength = chunkNode.textContent!.length;
        if (currentOffset <= textLength) {
            return {
                node: chunkNode.firstChild,
                offset: currentOffset
            };
        }
        currentOffset -= textLength;
    }
    return null;
}

export function selectionDirection(selection: globalThis.Selection) {
    const anchorNode = selection.anchorNode!;
    const anchorOffset = selection.anchorOffset;
    const focusNode = selection.focusNode;
    const focusOffset = selection.focusOffset;

    // console.log("Anchor Node:", anchorNode, "Anchor Offset:", anchorOffset);
    // console.log("Focus Node:", focusNode, "Focus Offset:", focusOffset);

    let direction;

    if (anchorNode === focusNode) {
        // Same node: Compare offsets
        direction = anchorOffset <= focusOffset ? "forward" : "backward";
    }
    else {
        // Different nodes: Compare positions in the DOM
        const position = anchorNode.compareDocumentPosition(focusNode!);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            direction = "forward";
        }
        else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
            direction = "backward";
        }
        else {
            direction = "unknown";
        }
    }

    return direction;
}