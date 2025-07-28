import { AnycodeLine, Pos } from "./utils"; 
import { Code } from "./code";

export class Selection {
    readonly anchor: number;
    readonly cursor: number;

    constructor(anchor: number, cursor: number) {
        this.anchor = anchor;
        this.cursor = cursor;
    }

    static fromRange(start: number, end: number): Selection {
        return new Selection(start, end);
    }

    static fromAnchorAndCursor(anchor: number, cursor: number): Selection {
        return new Selection(anchor, cursor);
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
        return this.anchor <= this.cursor 
            ? [this.anchor, this.cursor] 
            : [this.cursor, this.anchor];
    }

    public get start(): number {
        return Math.min(this.anchor, this.cursor);
    }

    public get end(): number {
        return Math.max(this.anchor, this.cursor);
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

    public isForward(): boolean {
        return this.cursor >= this.anchor;
    }

    public isBackward(): boolean {
        return this.cursor < this.anchor;
    }

    public moveCursor(newCursor: number): Selection {
        return new Selection(this.anchor, newCursor);
    }

    public moveAnchor(newAnchor: number): Selection {
        return new Selection(newAnchor, this.cursor);
    }

    public collapse(toAnchor: boolean = false): Selection {
        const offset = toAnchor ? this.anchor : this.cursor;
        return Selection.empty(offset);
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

export function selectionAnchor(selection: Selection | null, cursor: number): number {
    // Returns the anchor position of the selection
    if (selection == null) return cursor;
    return selection.anchor;
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

// export function setSelectionFromOffsets(
//     selection: Selection, lines: ExtendedHTMLDivElement[]
// ) {
//     if (lines.length === 0) return;

//     const [startOffset, endOffset] = selection.sorted(); // DOM needs sorted

//     console.log('setSelectionFromOffsets', startOffset, endOffset);

//     const startPos = resolveDOMPosition(startOffset, lines);
//     const endPos = resolveDOMPosition(endOffset, lines);
//     if (!startPos || !endPos) return;

//     const range = document.createRange();
//     const sel = window.getSelection();
//     if (!sel) return;

//     range.setStart(startPos.node, startPos.offset);
//     range.setEnd(endPos.node, endPos.offset);

//     sel.removeAllRanges();
//     sel.addRange(range);
// }




// interface Selection  {
//     from: { row: number, col: number },
//     to: { row: number, col: number },
// };

// export function getSelection(element): Selection | null {
//     var selection = element.getSelection();
//     if (selection.rangeCount === 0) return null; // Check if there's no selection
//     var range = selection.getRangeAt(0);
//     if (range.isCollapsed) return null;
//     var startNode = range.startContainer;
//     var endNode = range.endContainer;
//     // console.log({startNode, endNode})

//     // Calculate start position
//     let startLineDiv = startNode.parentNode.parentNode;
//     let startLine = 0;
//     let startColumn = 0;

//     if (startLineDiv.tagName == "DIV" && startLineDiv.classList && startLineDiv.classList.contains("line")) {
//         startLine = startLineDiv.lineNumber;

//         var startCharacter = range.startOffset;
//         let startC = 0;
//         let startChunks = Array.from(startLineDiv.children);

//         for (let chunkNode of startChunks) {
//             if (chunkNode == startNode.parentNode) { break }  // found node
//             // @ts-ignore
//             startC += chunkNode.textContent.length;
//         }

//         startCharacter += startC;
//         startColumn = startCharacter;
//     }

//     // Calculate end position
//     let endLineDiv = endNode.parentNode.parentNode;
//     let endLine = 0;
//     let endColumn = 0;

//     if (endLineDiv.tagName == "DIV" && endLineDiv.classList && endLineDiv.classList.contains("line")) {
//         endLine = endLineDiv.lineNumber;

//         var endCharacter = range.endOffset;
//         let endC = 0;
//         let endChunks = Array.from(endLineDiv.children);

//         for (let chunkNode of endChunks) {
//             if (chunkNode == endNode.parentNode) { break }  // found node
//             // @ts-ignore
//             endC += chunkNode.textContent.length;
//         }

//         endCharacter += endC;
//         endColumn = endCharacter;
//     } else {
        // // corner case, whole row selected
        // if (endNode.tagName == "DIV" && endNode.classList && endNode.classList.contains("line")) {
        //     endLine = endNode.previousSibling.lineNumber;
        //     // @ts-ignore
        //     endColumn = Array.from(endNode.previousSibling.children).map(node => node.textContent).join('').length;
        // }
//     }

//     if (startLine == 0 && startColumn == 0 && endLine == 0 && endColumn == 0) {
//         // console.log('no selection');
//         return null;
//     }

//     return {
//         from: { row: startLine, col: startColumn },
//         to: { row: endLine, col: endColumn }
//     };
// }


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