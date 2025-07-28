import { AnycodeLine } from './utils';

export function removeCursor() {
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
}

export function moveCursor(
    lineDiv: HTMLElement,
    column: number,
    focus: boolean = true
) {
    var character: number = column;
    
    const chunks = Array.from(lineDiv.children).map(l => l as AnycodeLine);
    let chunkCharacter = 0;
    let chunk: Element | null = null;

    for (let chunkNode of chunks) {
        const chunkLength = chunkNode.textContent!.length;
        if (chunkLength === 0) {
            chunk = chunkNode;
            chunkCharacter = 0;
            break;
        }
        if (character < chunkLength) {
            chunk = chunkNode;
            chunkCharacter = character;
            break;
        } else {
            character -= chunkLength;
        }
    }

    if (!chunk) {
        chunk = chunks[chunks.length - 1];
        chunkCharacter = chunk?.textContent?.length ?? 0;
    }
    
    if (!chunk) {
        return
    }

    const ch = chunk.firstChild || chunk;
    const range = document.createRange();
    range.setStart(ch, chunkCharacter);
    range.collapse(true);
    
    if (focus) {
        const scrollable = lineDiv?.parentElement?.parentElement;
        scrollCursorIntoViewVertically(scrollable!, lineDiv);
        
        const buttonsDivs = scrollable!.querySelectorAll(".buttons div");
        const gutters = scrollable!.querySelectorAll(".gutter .ln");
        const codeElement = scrollable!.querySelector(".code") as HTMLElement | null;
        
        const buttonsWidth = buttonsDivs.length > 0 ? 
            buttonsDivs[0].getBoundingClientRect().width : 0;
        const gutterWidth = gutters.length > 0 ? 
            gutters[0].getBoundingClientRect().width : 0;
        const codePaddingLeft = codeElement ? 
            parseFloat(getComputedStyle(codeElement).paddingLeft) : 0;
        
        const cursorNode = ch.firstChild || ch;
        const cursorOffset = chunkCharacter;
    
        scrollCursorIntoViewHorizontally(
            scrollable!, cursorNode, cursorOffset, 
            buttonsWidth + gutterWidth + codePaddingLeft
        );
        console.log('scrollable?.scrollTop', scrollable?.scrollTop);
    }

     
    const sel = window.getSelection();
    if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function scrollCursorIntoViewVertically(
    container: HTMLElement, lineDiv: HTMLElement
) {
    const containerRect = container.getBoundingClientRect();
    const lineRect = lineDiv.getBoundingClientRect();

    if (lineRect.top < containerRect.top) {
        container.scrollTop -= (containerRect.top - lineRect.top);
    } else if (lineRect.bottom > containerRect.bottom) {
        container.scrollTop += (lineRect.bottom - containerRect.bottom);
    }
}

function scrollCursorIntoViewHorizontally(
    container: HTMLElement, 
    cursorNode: Node, 
    cursorOffset: number, 
    leftPlus: number, 
) {

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);    
    if (isSafari) {
        // Safari-specific multiple carets bug: 
        // temporarily disable scrolling
        return;
    }
    
    const range = document.createRange();
    range.setStart(cursorNode, cursorOffset);
    range.collapse(true);

    const cursorRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const leftVisible = containerRect.left + leftPlus;
    const rightVisible = containerRect.right;

    if (cursorRect.left < leftVisible) {
        const delta = leftVisible - cursorRect.left;
        container.scrollLeft -= delta;
    } else if (cursorRect.right > rightVisible) {
        const delta = cursorRect.right - rightVisible;
        container.scrollLeft += delta;
    }
}
