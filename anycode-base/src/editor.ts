import { Code, HighlighedNode } from "./code";
import { 
    generateCssClasses, addCssToDocument, isCharacter,
    AnycodeLine as AnycodeLine, Pos,
    minimize, objectHash
} from './utils';

import { vesper } from './theme';
import {
    Action, ActionContext, ActionResult, executeAction
} from './actions';
import {
    getMouseRow, getMouseCol
} from './mouse';

import { 
    removeCursor, moveCursor
} from './cursor';

import {
    Selection, getSelection,
    selectionDirection, setSelectionFromOffsets,
    resolveAbsoluteOffset
} from "./selection";

import './styles.css';


export class AnycodeEditor {
    private code: Code;
    private offset: number;
    
    private settings: {
        lineHeight: number;
        buffer: number;
    };
    
    private container!: HTMLDivElement;
    private buttonsColumn!: HTMLDivElement;
    private gutter!: HTMLDivElement;
    private codeContent!: HTMLDivElement;
    
    
    private selection: Selection | null = null;
    private isSelecting: boolean = false;
    private anchorOffset: number | null = null;
    private ignoreNextSelection: boolean = false;

    private runLines: number[] = [];
    private errorLines: Map<number, string> = new Map();

    constructor(initialText = '', options: any = {}) {
        this.offset = 0;
        this.code = new Code(initialText, "test", "javascript");
        this.settings = { lineHeight: 20, buffer: 20 };
        
        // this.setErrors([
        //     { line: 2, message: 'Unexpected token' },
        //     { line: 4, message: 'Undefined variable `foo`' },
        // ]);
        // this.runLines = [1, 2, 3];
        
        const theme = options.theme || vesper;
        const css = generateCssClasses(theme);
        addCssToDocument(css, 'anyeditor-theme');
        
        this.createDomElements()
    }
    
    private createDomElements() {
      this.container = document.createElement('div');
      this.container.className = 'anyeditor';
    
      this.buttonsColumn = document.createElement('div');
      this.buttonsColumn.className = 'buttons';
    
      this.gutter = document.createElement('div');
      this.gutter.className = 'gutter';
    
      this.codeContent = document.createElement('div');
      this.codeContent.className = 'code';
      this.codeContent.setAttribute("contentEditable", "true");
      this.codeContent.setAttribute("spellcheck", "false");
      this.codeContent.setAttribute("autocorrect", "off");
      this.codeContent.setAttribute("autocapitalize", "off");
    
      this.container.appendChild(this.buttonsColumn);
      this.container.appendChild(this.gutter);
      this.container.appendChild(this.codeContent);
    }

    public setText(newText: string) {
        this.code.setContent(newText);
    }

    public async init() {
        await this.code.init();
        this.setupEventListeners();
    }

    public getContainer(): HTMLDivElement {
        return this.container;
    }

    public setRunButtonLines(lines: number[]) {
        this.runLines = lines;
    }

    public setErrors(errors: { line: number, message: string }[]) {
        this.errorLines.clear();
        for (const { line, message } of errors) {
            this.errorLines.set(line, message);
        }
    }

    private setupEventListeners() {
        console.log("setupEventListeners");
        
        let ticking = false;
        var lastScrollTop = 0;
        
        this.container.addEventListener("scroll", () => {
            const scrollTop = this.container.scrollTop;
            if (!ticking) {
                requestAnimationFrame(() => {
                    if (scrollTop !== lastScrollTop) {
                        this.render();
                        lastScrollTop = scrollTop;
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
        
        
        this.handleClick = this.handleClick.bind(this);
        this.codeContent.addEventListener('click', this.handleClick);
        
        this.handleKeydown = this.handleKeydown.bind(this);
        this.codeContent.addEventListener('keydown', this.handleKeydown);
        
        this.handleSelectionChange = this.handleSelectionChange.bind(this);
        document.addEventListener('selectionchange', this.handleSelectionChange);
        
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.codeContent.addEventListener('mousedown', this.handleMouseDown);

        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.codeContent.addEventListener('mouseup', this.handleMouseUp);
        
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.codeContent.addEventListener('mousemove', this.handleMouseMove);
    }

    private createSpacer(height: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.className = "spacer";
        spacer.style.height = `${height}px`;
        return spacer;
    }

    private createLineNumber(lineNumber: number): HTMLDivElement {
        const div = document.createElement('div');
        div.className = "ln";
        div.textContent = (lineNumber + 1).toString();
        div.style.height = `${this.settings.lineHeight}px`;
        div.setAttribute('data-line', lineNumber.toString());
        return div;
    }

    private createButtonsColumnLine(lineNumber: number): HTMLDivElement {
        const div = document.createElement('div');
        div.style.height = `${this.settings.lineHeight}px`;
        div.setAttribute('data-line', lineNumber.toString());
    
        const isRun = this.runLines.includes(lineNumber);
        const hasError = this.errorLines.has(lineNumber);
    
        if (isRun) {
            div.textContent = '▶';
            div.title = `Run line ${lineNumber + 1}`;
            div.style.color = '#888';
            div.style.fontSize = '20px';
            div.style.cursor = 'pointer';
            div.onclick = () => {
                console.log(`Run line ${lineNumber + 1}`);
            };
        } else if (hasError) {
            const errorText = this.errorLines.get(lineNumber)!;
            div.textContent = '!';
            div.title = errorText;
            div.style.color = '#ff6b6b';
            div.style.cursor = 'pointer';
            div.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(errorText).then(() => {
                    console.log(`Copied error: ${errorText}`);
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            };
        }
    
        return div;
    }

    private createLineWrapper(
        lineNumber: number, nodes: HighlighedNode[]
    ): AnycodeLine {
        const wrapper = document.createElement('div') as AnycodeLine;
        
        wrapper.lineNumber = lineNumber;
        wrapper.className = "line";
        wrapper.style.lineHeight = `${this.settings.lineHeight}px`;

        // Add hash for change tracking
        const hash = objectHash(nodes).toString();
        wrapper.setAttribute('data-hash', hash);

        if (nodes.length === 0 || (nodes.length === 1 && nodes[0].text === "")) {
            const span = document.createElement('span');
            span.textContent = "";
            wrapper.appendChild(span);
        } else {
            for (const { name, text } of nodes) {
                const span = document.createElement('span');
                if (name) span.className = name;
                if (!name && text === '\t') span.className = 'indent';
                span.textContent = text;
                wrapper.appendChild(span);
            }
        }

        const errorMessage = this.errorLines.get(lineNumber);
        if (errorMessage) {
            let smallError = minimize(errorMessage);
            wrapper.classList.add('has-error');
            wrapper.setAttribute('data-error', smallError);
        }

        return wrapper;
    }
    
    private getVisibleRange() {
        const totalLines = this.code.linesLength();
        const scrollTop = this.container.scrollTop;
        const viewHeight = this.container.clientHeight;
        
        let visibleBuffer = this.settings.buffer;
        let itemHeight = this.settings.lineHeight;
        const visibleCount = Math.ceil(viewHeight / itemHeight);
        const startLine = Math.max(0, Math.floor(scrollTop / itemHeight) - visibleBuffer);
        const endLine = Math.min(totalLines, startLine + visibleCount + visibleBuffer * 2);
    
        return { startLine, endLine };
    }

    public render() {
        const totalLines = this.code.linesLength();
        const { startLine, endLine } = this.getVisibleRange();
        
        let itemHeight = this.settings.lineHeight;
        const paddingTop = startLine * itemHeight;
        const paddingBottom = (totalLines - endLine) * itemHeight;

        const buttonFragment = document.createDocumentFragment();
        buttonFragment.appendChild(this.createSpacer(paddingTop));
        for (let i = startLine; i < endLine; i++) {
            buttonFragment.appendChild(this.createButtonsColumnLine(i));
        }
        buttonFragment.appendChild(this.createSpacer(paddingBottom));
        this.buttonsColumn.replaceChildren(buttonFragment);

        const gutterFragment = document.createDocumentFragment();
        gutterFragment.appendChild(this.createSpacer(paddingTop));
        for (let i = startLine; i < endLine; i++) {
            gutterFragment.appendChild(this.createLineNumber(i));
        }
        gutterFragment.appendChild(this.createSpacer(paddingBottom));
        this.gutter.replaceChildren(gutterFragment);

        const codeFragment = document.createDocumentFragment();
        codeFragment.appendChild(this.createSpacer(paddingTop));
        for (let i = startLine; i < endLine; i++) {
            const nodes = this.code.getLineNodes(i);
            const lineWrapper = this.createLineWrapper(i, nodes);
            codeFragment.appendChild(lineWrapper);
        }
        codeFragment.appendChild(this.createSpacer(paddingBottom));
        this.codeContent.replaceChildren(codeFragment);

        const fullHeight = this.codeContent.scrollHeight;
        this.gutter.style.height = `${fullHeight}px`;
        this.buttonsColumn.style.height = `${fullHeight}px`;
        this.codeContent.style.height = `${fullHeight}px`;
                
        if (!this.selection || this.selection.isEmpty()) {
            this.updateCursor(false);
        } else {
            const lines = this.getLines();
            setSelectionFromOffsets(this.selection, lines, this.code)
            this.ignoreNextSelection = true;
        }
    }
    
    private getLines(): AnycodeLine[] {
        const lines = Array.from(this.codeContent.children)
            .filter(child => 
                !child.classList.contains('spacer')
            ) as AnycodeLine[];
        return lines;
    }
    private getLine(lineNumber: number): AnycodeLine | null {
        const { startLine, endLine } = this.getVisibleRange();
        if (lineNumber < startLine || lineNumber >= endLine) return null;
    
        const relativeLine = lineNumber - startLine + 1; // +1 for the spacer
        const line = this.codeContent.children[relativeLine];
        return line as AnycodeLine;
    }
    
    private updateCursor(focus: boolean = true) {
        const { line, column } = this.code.getPosition(this.offset);
        const lineDiv = this.getLine(line);
    
        if (lineDiv && lineDiv.isConnected) {
            moveCursor(lineDiv, column, focus);
        } else {
            removeCursor();
        }
    }
    
    public renderChanges() {
        console.time('updateChanges');

        let { startLine, endLine } = this.getVisibleRange();
        
        const codeChildren = Array.from(this.codeContent.children).filter(child => 
            !child.classList.contains('spacer')
        ) as AnycodeLine[];
        
        if (codeChildren.length === 0) { this.render(); return; }
        
        const buttonChildren = Array.from(this.buttonsColumn.children).filter(child =>
            !child.classList.contains('spacer')
        ) as HTMLElement[];
        
        const gutterChildren = Array.from(this.gutter.children).filter(child => 
            !child.classList.contains('spacer')
        ) as HTMLElement[];
            
        let oldStartLine = codeChildren[0].lineNumber;
        let oldEndLine = codeChildren[codeChildren.length - 1].lineNumber + 1;

        if (oldStartLine !== startLine || oldEndLine !== endLine) {
            console.log('oldStartLine !== startLine || oldEndLine !== endLine full render');
            this.render();
            console.timeEnd('updateChanges');
            return;
        }
        
        // Update or add visible lines
        for (let i = startLine; i < endLine; i++) {
            const nodes = this.code.getLineNodes(i);
            const theHash = objectHash(nodes).toString();

            // Find existing line element
            const existingLine = codeChildren.find(line => line.lineNumber === i);

            if (existingLine) {
                const existingHash = existingLine.getAttribute('data-hash');
                if (existingHash !== theHash) {
                    // Replace line
                    console.log(`Line ${i} update`);
                    const newLineElement = this.createLineWrapper(i, nodes);
                    existingLine.replaceWith(newLineElement);
                    
                    // Try smart update first
                    // this.updateLineWrapper(existingLine, nodes)
                    // console.log(`Line ${i} smart update`);
                }
            } else {
                // This should trigger a full re-render since we're missing lines
                console.log('Missing lines detected, triggering full render');
                this.render();
                console.timeEnd('updateChanges');
                return;
            }
        }
        
        console.timeEnd('updateChanges');
    }
    
    private updateLineWrapper(
        existingLine: AnycodeLine, 
        newNodes: HighlighedNode[]
    ): boolean {
        const existingSpans = Array.from(existingLine.children) as HTMLSpanElement[];
        
        // Simple diff: compare arrays element by element
        let changed = false;
        const maxLen = Math.max(existingSpans.length, newNodes.length);
        
        for (let i = 0; i < maxLen; i++) {
            const existingSpan = existingSpans[i];
            const newNode = newNodes[i];
            
            if (!existingSpan && newNode) {
                // Insert new span
                const span = this.createSpan(newNode);
                existingLine.appendChild(span);
                changed = true;
            } else if (existingSpan && !newNode) {
                // Remove old span
                existingSpan.remove();
                changed = true;
            } else if (existingSpan && newNode) {
                // Check if span needs update
                if (existingSpan.textContent !== newNode.text || 
                    existingSpan.className !== (newNode.name || '')) {
                    existingSpan.textContent = newNode.text;
                    existingSpan.className = newNode.name || '';
                    changed = true;
                }
            }
        }
        
        return changed;
    }
    
    private createSpan(node: HighlighedNode): HTMLSpanElement {
        const span = document.createElement('span');
        if (node.name) span.className = node.name;
        if (!node.name && node.text === '\t') span.className = 'indent';
        span.textContent = node.text;
        return span;
    }
    
    private handleClick(event: MouseEvent): void {
        console.log("handleClick ", this.selection);
        if (this.selection && this.selection.nonEmpty()) {
            return;
        }
        
        event.preventDefault();
        const sel = window.getSelection();
        const row = getMouseRow(event, sel);
        if (row === null) return;
      
        const lineDiv = this.getLine(row);
        if (!lineDiv) return;
      
        const chunks = Array.from(lineDiv.childNodes);
        const col = getMouseCol(event, sel, chunks);
        
        if (col === null) return;

        let offset = this.code.getOffset(row, col);
        this.offset = offset;
        console.log('click', row, col, offset);
        this.updateCursor();
    }
    
    private handleSelectionChange(e: Event) {
        console.log("");
        if (this.ignoreNextSelection) {
            console.log('ignoreNextSelection');
            this.ignoreNextSelection = false;
            return;
        }

        const selectionPos = getSelection();
        
        if (!selectionPos) {
            this.selection = null;
            return;
        }
            
        let selectionStartOffset = this.code.getOffset(
            selectionPos.start.row, selectionPos.start.col
        );
        let selectionEndOffset = this.code.getOffset(
            selectionPos.end.row, selectionPos.end.col
        );
        let selection = new Selection(
            selectionStartOffset, selectionEndOffset
        );
        console.log('SELECTION = ', selection);
        
        const direction = selectionDirection(window.getSelection()!);

        if (this.anchorOffset == null) {
            if (!selection.isEmpty()) {
                this.selection = new Selection(selection.start, selection.end);
                this.offset = this.selection.max();
                console.log('THIS.SELECTION = ', selection);
            }
            return;
        }

        console.log('this.offset =', this.offset, "anchor = ", this.anchorOffset);
        let sel = new Selection(this.anchorOffset!, this.offset);
        console.log('sel', sel);

        // this.offset = direction === 'forward' ? selection!.end : selection!.start;

        // if (!this.anchorOffset && selection) {
        //     if (direction === 'forward') sel = new Selection(selection.start, this.offset);
        //     else sel = new Selection(this.offset, selection.end);
        // }

        // if ((sel.isEmpty() && !selection.isEmpty()) || (!sel.isEmpty() && selection.bigger(sel))) {
        //     sel = selection;
        //     this.offset = sel.max();
        //     // console.log('BIGGER = ', sel);
        // }

        this.selection = sel;
        console.log('THIS.SELECTION = ', this.selection);
    }
    
    private handleMouseUp() {
        console.log('handleMouseUp ', this.selection);
        this.isSelecting = false;
        this.anchorOffset = null;
    }
    
    private handleMouseDown(e: MouseEvent) {
        console.log('handleMouseDown ', this.selection);
        
        if (!e.shiftKey) {
            this.selection = null;
            this.anchorOffset = null;
        }

        const target = e.target as Node;
        if (!target) return;

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

        if (!pos || !pos.offsetNode) return;

        const abs = resolveAbsoluteOffset(pos.offsetNode, pos.offset);
        
        
        if (abs != null) {
            this.isSelecting = true;
            let ao = this.code.getOffset(abs.row, abs.col)
            this.anchorOffset = ao;
            console.log("Anchor offset set (mousedown):", abs);
        } else {
            console.warn("Failed to resolve anchor offset (mousedown)");
        }
    }
    
    private handleMouseMove(event: MouseEvent) {
        if (this.isSelecting) {
            let e = event;
            const target = e.target as Node;
            if (!target) return;

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

            if (!pos || !pos.offsetNode) return;

            const abs = resolveAbsoluteOffset(pos.offsetNode, pos.offset);
            if (abs != null) {
                // this.isSelecting = true;
                let ao = this.code.getOffset(abs.row, abs.col)
                this.offset = ao;
                // console.log("this.offset = ", abs);
            } else {
                console.warn("Failed to resolve this.offset");
            }
        }
    }
    
    private async handleKeydown(event: KeyboardEvent) {
        // console.log('keydown', event);
                
        const action = this.getActionFromKey(event);
        if (!action) return;
        
        event.preventDefault();
        
        const ctx: ActionContext = {
            offset: this.offset,
            code: this.code,
            selection: this.selection || undefined,
            key: event.key
        };
        
        const result = await executeAction(action, ctx);
        this.applyEditResult(result);
    }
    
    private getActionFromKey(event: KeyboardEvent): Action | null {
        const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

        // Shortcuts
        if (metaKey) {
            if (shiftKey && key.toLowerCase() === 'z') 
                return Action.REDO;
            if (key.toLowerCase() === '/') 
                    return Action.COMMENT;
            
            switch (key.toLowerCase()) {
                case 'z': return Action.UNDO;
                case 'a': return Action.SELECT_ALL;
                case 'c': return Action.COPY;
                case 'v': return Action.PASTE;
                case 'x': return Action.CUT;
                default: return null;
            }
        }
        
        // Navigation
        if (!shiftKey) {
            if (altKey) {
                switch (key) {
                    case "ArrowLeft": return Action.ARROW_LEFT_ALT;
                    case "ArrowRight": return Action.ARROW_RIGHT_ALT;
                }
            } else {
                switch (key) {
                    case "ArrowLeft": return Action.ARROW_LEFT;
                    case "ArrowRight": return Action.ARROW_RIGHT;
                    case "ArrowUp": return Action.ARROW_UP;
                    case "ArrowDown": return Action.ARROW_DOWN;
                }
            } 
        } else {
            if (shiftKey && key === 'Tab') 
                return Action.UNTAB;
        }
        
        // Editing
        switch (key) {
            case "Backspace": return Action.BACKSPACE;
            case "Delete": return Action.DELETE;
            case "Enter": return Action.ENTER;
            case "Tab": return Action.TAB;
        }
        
        // Text input
        if (key.length === 1 && !ctrlKey) {
            return Action.TEXT_INPUT;
        }
        
        return null;
    }
    
    private applyEditResult(result: ActionResult) {
    
        if (result.changed) {
            this.code = result.ctx.code;
            this.renderChanges();
        }
        
        if (result.ctx.offset !== this.offset) {
            this.offset = result.ctx.offset;
            this.updateCursor(false);
        }
        
        if (this.selection !== result.ctx.selection) {
            this.selection = result.ctx.selection || null;
            
            const lines = this.getLines();
            if (this.selection) {
                setSelectionFromOffsets(this.selection, lines, this.code);
            }
            this.ignoreNextSelection = true;
        }
    }
    
}