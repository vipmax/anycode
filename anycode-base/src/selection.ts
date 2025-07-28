import { AnycodeLine, Pos } from "./utils"; 
import { Code } from "./code";

export class Selection {
    start: number;
    end: number;

    constructor(a: number, b: number) {
        this.start = a;
        this.end = b;
    }

    static fromAnchorAndCursor(anchor: number, cursor: number): Selection {
        if (anchor <= cursor) return new Selection(anchor, cursor);
        else return new Selection(cursor, anchor);
    }

    public isActive(): boolean {
        return this.start !== this.end;
    }

    public isEmpty(): boolean {
        return Math.max(this.start, this.end) === Math.min(this.start, this.end);
    }
    
    public nonEmpty(): boolean {
        return !this.isEmpty();
    }

    public contains(index: number): boolean {
        return index >= this.start && index < this.end;
    }

    public sorted(): [number, number] {
        return [Math.min(this.start, this.end), Math.max(this.start, this.end)];
    }

    public min(): number {
        return Math.min(this.start, this.end);
    }
    
    public max(): number {
        return Math.max(this.start, this.end);
    }

    public toString(): string {
        return `[${this.start}, ${this.end})`;
    }

    public bigger(s: Selection): boolean {
        let [start, end] = this.sorted();
        let [sstart, send] = s.sorted();
        return (end - start) > (send - sstart);
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
    // Returns the anchor (start or end) of the selection, given the cursor offset
    // Assumes selection has .start and .end properties (as offsets)
    if (selection == null) return cursor;
    if (cursor === selection.start) {
        return selection.end;
    } else {
        return selection.start;
    }
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
    console.log('setSelectionFromOffsets', selection, lines, code);
    
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

export function setSelection(element, start, end) {
    // Find the line divs
    const startLineDiv = element.querySelector(`.line[ln="${start.row}"]`);
    const endLineDiv = element.querySelector(`.line[ln="${end.row}"]`);

    if (!startLineDiv || !endLineDiv) {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        return;
    }

    // Find nodes and offsets
    const startPos = findNodeAndOffset(startLineDiv, start.col);
    const endPos = findNodeAndOffset(endLineDiv, end.col);

    // Set range if both positions are found
    if (startPos && endPos) {
        // console.log('setSelectionFromPosition', { start, end });
        const range = document.createRange();
        const selection = window.getSelection();

        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
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