'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ClipboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { twMerge } from 'tailwind-merge';
import './wysiwygEditor.css';

export type WysiwygBlockType = 'heading' | 'paragraph' | 'subheading';
export type WysiwygTextMark = 'bold' | 'italic' | 'underline';

export interface WysiwygTextSpan {
  text: string;
  marks?: WysiwygTextMark[];
}

export interface WysiwygBlock {
  id: string;
  type: WysiwygBlockType;
  spans: WysiwygTextSpan[];
}

export interface WysiwygDocument {
  version: 1;
  blocks: WysiwygBlock[];
}

interface WysiwygContentProps {
  value: WysiwygDocument;
  emptyText?: string;
  showOverflowFade?: boolean;
  twStyles?: string;
}

interface WysiwygEditorProps {
  value: WysiwygDocument;
  onChange: (value: WysiwygDocument) => void;
  label?: string;
  twStyles?: string;
}

const WYSIWYG_BLOCK_TYPES = new Set<WysiwygBlockType>(['heading', 'paragraph', 'subheading']);
const WYSIWYG_TEXT_MARKS = ['bold', 'italic', 'underline'] satisfies WysiwygTextMark[];
const WYSIWYG_TEXT_MARK_SET = new Set<WysiwygTextMark>(WYSIWYG_TEXT_MARKS);
const WYSIWYG_BLOCK_TYPE_OPTIONS = [
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'paragraph', label: 'Paragraph' },
] satisfies ReadonlyArray<{ value: WysiwygBlockType; label: string }>;
const WYSIWYG_TEXT_MARK_OPTIONS = [
  { value: 'bold', label: 'Bold', icon: 'B', iconClassName: 'font-bold' },
  { value: 'italic', label: 'Italic', icon: 'I', iconClassName: 'italic' },
  { value: 'underline', label: 'Underline', icon: 'U', iconClassName: 'underline underline-offset-4' },
] satisfies ReadonlyArray<{ value: WysiwygTextMark; label: string; icon: string; iconClassName: string }>;

function ChevronDownIcon(): ReactElement {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 7.5 10 12l5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBlockType(value: unknown): WysiwygBlockType {
  return typeof value === 'string' && WYSIWYG_BLOCK_TYPES.has(value as WysiwygBlockType)
    ? value as WysiwygBlockType
    : 'paragraph';
}

function normalizeMarks(value: unknown): WysiwygTextMark[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const validMarks = new Set(
    value.filter((mark): mark is WysiwygTextMark => (
      typeof mark === 'string' && WYSIWYG_TEXT_MARK_SET.has(mark as WysiwygTextMark)
    )),
  );
  const marks = WYSIWYG_TEXT_MARKS.filter((mark) => validMarks.has(mark));

  return marks.length > 0 ? marks : undefined;
}

function normalizeSpans(value: unknown): WysiwygTextSpan[] {
  if (!Array.isArray(value)) {
    return [{ text: '' }];
  }

  const spans = value
    .filter(isRecord)
    .map((span) => {
      const marks = normalizeMarks(span.marks);

      return {
        text: typeof span.text === 'string' ? span.text : '',
        ...(marks ? { marks } : {}),
      };
    });

  return spans.length > 0 ? mergeAdjacentSpans(spans) : [{ text: '' }];
}

function areMarksEqual(left: WysiwygTextMark[] | undefined, right: WysiwygTextMark[] | undefined): boolean {
  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((mark, index) => normalizedRight[index] === mark);
}

function mergeAdjacentSpans(spans: WysiwygTextSpan[]): WysiwygTextSpan[] {
  return spans.reduce<WysiwygTextSpan[]>((currentSpans, span) => {
    const previous = currentSpans.at(-1);
    if (!previous || !areMarksEqual(previous.marks, span.marks)) {
      return [...currentSpans, span];
    }

    return [
      ...currentSpans.slice(0, -1),
      {
        ...previous,
        text: `${previous.text}${span.text}`,
      },
    ];
  }, []);
}

export function createWysiwygDocument(text = ''): WysiwygDocument {
  return {
    version: 1,
    blocks: [
      {
        id: 'block-1',
        type: 'paragraph',
        spans: [
          {
            text,
          },
        ],
      },
    ],
  };
}

export function normalizeWysiwygDocument(value: unknown): WysiwygDocument {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    return createWysiwygDocument();
  }

  const blocks = value.blocks
    .filter(isRecord)
    .map((block, index) => ({
      id: typeof block.id === 'string' && block.id.trim() ? block.id : `block-${index + 1}`,
      type: normalizeBlockType(block.type),
      spans: normalizeSpans(block.spans),
    }));

  return {
    version: 1,
    blocks: blocks.length > 0 ? blocks : createWysiwygDocument().blocks,
  };
}

function serializeWysiwygDocument(value: WysiwygDocument): string {
  return JSON.stringify(normalizeWysiwygDocument(value));
}

function getBlockText(block: WysiwygBlock): string {
  return block.spans.map((span) => span.text).join('');
}

function getContentClassName(type: WysiwygBlockType): string {
  if (type === 'heading') {
    return 'section_title text-text';
  }

  if (type === 'subheading') {
    return 'body_text_emphasis text-text';
  }

  return 'body_text_relaxed text-text-soft';
}

function getBlockTypeTypographyClassName(type: WysiwygBlockType): string {
  if (type === 'heading') {
    return 'section_title';
  }

  if (type === 'subheading') {
    return 'body_text_emphasis';
  }

  return 'body_text_relaxed';
}

function renderMarkedText(text: string, marks: WysiwygTextMark[] = []): ReactNode {
  return marks.reduce<ReactNode>((content, mark) => {
    if (mark === 'bold') {
      return <strong>{content}</strong>;
    }

    if (mark === 'italic') {
      return <em>{content}</em>;
    }

    return <u>{content}</u>;
  }, text);
}

function serializeMarks(marks: WysiwygTextMark[] | undefined): string | undefined {
  return marks?.length ? marks.join(' ') : undefined;
}

function parseSerializedMarks(value: string | undefined): WysiwygTextMark[] | undefined {
  return normalizeMarks(value?.split(' '));
}

function getEditableMarkClassName(marks: WysiwygTextMark[] | undefined): string | undefined {
  if (!marks?.length) {
    return undefined;
  }

  return twMerge(
    marks.includes('bold') && 'font-bold',
    marks.includes('italic') && 'italic',
    marks.includes('underline') && 'underline',
  );
}

function renderInlineSpans(spans: WysiwygTextSpan[]): ReactNode {
  return spans.map((span, index) => (
    <span key={`${index}-${span.text}`}>
      {renderMarkedText(span.text, span.marks)}
    </span>
  ));
}

export function WysiwygContent({
  value,
  emptyText = 'No text configured.',
  showOverflowFade = false,
  twStyles,
}: WysiwygContentProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const blocks = useMemo(() => normalizeWysiwygDocument(value).blocks, [value]);
  const hasVisibleText = blocks.some((block) => getBlockText(block).trim().length > 0);

  useEffect(() => {
    if (!showOverflowFade) {
      return;
    }

    const measuredElement = containerRef.current;
    if (!measuredElement) {
      return;
    }
    const element: HTMLDivElement = measuredElement;

    function updateOverflow() {
      setIsOverflowing(element.scrollHeight > element.clientHeight + 1);
    }

    const animationFrame = window.requestAnimationFrame(updateOverflow);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateOverflow);

    resizeObserver?.observe(element);
    window.addEventListener('resize', updateOverflow);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [blocks, showOverflowFade]);

  if (!hasVisibleText) {
    return <p className={twMerge('body_text text-text-soft', twStyles)}>{emptyText}</p>;
  }

  return (
    <div
      ref={containerRef}
      className={twMerge(
        'grid content-start gap-3',
        showOverflowFade && 'relative max-h-full min-h-0 overflow-hidden pr-1',
        twStyles,
      )}
    >
      {blocks.map((block) => {
        if (!getBlockText(block).trim()) {
          return null;
        }

        if (block.type === 'heading') {
          return <h3 key={block.id} className={getContentClassName(block.type)}>{renderInlineSpans(block.spans)}</h3>;
        }

        if (block.type === 'subheading') {
          return <h4 key={block.id} className={getContentClassName(block.type)}>{renderInlineSpans(block.spans)}</h4>;
        }

        return <p key={block.id} className={getContentClassName(block.type)}>{renderInlineSpans(block.spans)}</p>;
      })}
      {showOverflowFade && isOverflowing ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-dashboard-panel-bg"
        />
      ) : null}
    </div>
  );
}

function updateEditableBlockElementType(element: HTMLElement, type: WysiwygBlockType) {
  element.dataset.wysiwygBlockType = type;
  element.className = twMerge('outline-none', getContentClassName(type));
}

function renderEditableBlocks(editorElement: HTMLElement, blocks: WysiwygBlock[]) {
  const nextChildren = blocks.map((block) => {
    const element = document.createElement('div');
    element.dataset.wysiwygBlock = '';
    updateEditableBlockElementType(element, block.type);
    block.spans.forEach((span) => {
      if (!span.marks?.length) {
        if (span.text) {
          element.append(document.createTextNode(span.text));
        }
        return;
      }

      const spanElement = document.createElement('span');
      spanElement.dataset.wysiwygSpan = '';
      spanElement.dataset.wysiwygMarks = serializeMarks(span.marks);
      spanElement.className = getEditableMarkClassName(span.marks) ?? '';
      spanElement.textContent = span.text;
      element.append(spanElement);
    });
    if (!element.textContent) {
      element.append(document.createElement('br'));
    }
    return element;
  });

  editorElement.replaceChildren(...nextChildren);
}

function isEditableBlockElement(node: ChildNode): node is HTMLElement {
  return node instanceof HTMLElement && node.dataset.wysiwygBlock !== undefined;
}

function hasUnstructuredEditorChildren(editorElement: HTMLElement): boolean {
  return Array.from(editorElement.childNodes).some((child) => !isEditableBlockElement(child));
}

function getBlockTypeFromElement(element: HTMLElement): WysiwygBlockType {
  return normalizeBlockType(element.dataset.wysiwygBlockType);
}

function getSpansFromEditableBlockElement(element: HTMLElement): WysiwygTextSpan[] {
  const spans = Array.from(element.childNodes).reduce<WysiwygTextSpan[]>((currentSpans, child) => {
    if (child instanceof HTMLElement) {
      const marks = parseSerializedMarks(child.dataset.wysiwygMarks);

      return [
        ...currentSpans,
        {
          text: child.textContent ?? '',
          ...(marks ? { marks } : {}),
        },
      ];
    }

    return [
      ...currentSpans,
      {
        text: child.textContent ?? '',
      },
    ];
  }, []);

  return spans.length > 0 ? mergeAdjacentSpans(spans) : [{ text: '' }];
}

function createBlocksFromEditableElement(
  editorElement: HTMLElement,
  previousBlocks: WysiwygBlock[],
): WysiwygBlock[] {
  const childNodes = Array.from(editorElement.childNodes);

  if (childNodes.length === 0) {
    return createWysiwygDocument(editorElement.textContent ?? '').blocks;
  }

  const blocks = childNodes.reduce<WysiwygBlock[]>((currentBlocks, child) => {
    const index = currentBlocks.length;

    if (child instanceof HTMLElement) {
      return [
        ...currentBlocks,
        {
          id: previousBlocks[index]?.id ?? `block-${index + 1}`,
          type: getBlockTypeFromElement(child),
          spans: getSpansFromEditableBlockElement(child),
        },
      ];
    }

    const text = child.textContent ?? '';
    if (!text.trim()) {
      return currentBlocks;
    }

    return [
      ...currentBlocks,
      {
        id: previousBlocks[index]?.id ?? `block-${index + 1}`,
        type: previousBlocks[index]?.type ?? 'paragraph',
        spans: [
          {
            text,
          },
        ],
      },
    ];
  }, []);

  return blocks.length > 0 ? blocks : createWysiwygDocument().blocks;
}

function getEditableBlockElementForNode(editorElement: HTMLElement, node: Node | null): HTMLElement | null {
  if (!node || !editorElement.contains(node)) {
    return null;
  }

  const selectedElement = node instanceof HTMLElement ? node : node.parentElement;
  const blockElement = selectedElement?.closest('[data-wysiwyg-block]');

  return blockElement instanceof HTMLElement && blockElement.parentElement === editorElement
    ? blockElement
    : null;
}

function getEditableBlockIndex(editorElement: HTMLElement, blockElement: HTMLElement): number {
  return Math.max(0, Array.from(editorElement.children).findIndex((child) => child === blockElement));
}

function getTextOffsetWithinBlock(blockElement: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(blockElement);
  range.setEnd(node, offset);

  return range.toString().length;
}

function getTextOffsetWithinElement(element: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(node, offset);

  return range.toString().length;
}

function blockSelectionHasMark(block: WysiwygBlock, startOffset: number, endOffset: number, mark: WysiwygTextMark): boolean {
  let textOffset = 0;
  const selectedSpans = block.spans.filter((span) => {
    const spanStart = textOffset;
    const spanEnd = spanStart + span.text.length;
    textOffset = spanEnd;

    return spanEnd > startOffset && spanStart < endOffset;
  });

  return selectedSpans.length > 0 && selectedSpans.every((span) => span.marks?.includes(mark));
}

function setMarkOnSpan(marks: WysiwygTextMark[] | undefined, mark: WysiwygTextMark, enabled: boolean): WysiwygTextMark[] | undefined {
  const currentMarks = new Set(marks ?? []);
  if (enabled) {
    currentMarks.add(mark);
  } else {
    currentMarks.delete(mark);
  }

  const nextMarks = WYSIWYG_TEXT_MARKS.filter((item) => currentMarks.has(item));
  return nextMarks.length ? nextMarks : undefined;
}

function mergeTextMarks(
  currentMarks: WysiwygTextMark[] | undefined,
  marksToAdd: WysiwygTextMark[],
): WysiwygTextMark[] | undefined {
  const nextMarks = new Set(currentMarks ?? []);
  marksToAdd.forEach((mark) => nextMarks.add(mark));

  const marks = WYSIWYG_TEXT_MARKS.filter((mark) => nextMarks.has(mark));
  return marks.length > 0 ? marks : undefined;
}

function applyMarkToBlock(
  block: WysiwygBlock,
  startOffset: number,
  endOffset: number,
  mark: WysiwygTextMark,
): WysiwygBlock {
  const shouldRemoveMark = blockSelectionHasMark(block, startOffset, endOffset, mark);
  let textOffset = 0;
  const nextSpans = block.spans.flatMap<WysiwygTextSpan>((span) => {
    const spanStart = textOffset;
    const spanEnd = spanStart + span.text.length;
    textOffset = spanEnd;

    if (spanEnd <= startOffset || spanStart >= endOffset) {
      return [span];
    }

    const selectedStart = Math.max(startOffset, spanStart) - spanStart;
    const selectedEnd = Math.min(endOffset, spanEnd) - spanStart;
    const beforeText = span.text.slice(0, selectedStart);
    const selectedText = span.text.slice(selectedStart, selectedEnd);
    const afterText = span.text.slice(selectedEnd);
    const nextMarks = setMarkOnSpan(span.marks, mark, !shouldRemoveMark);
    const markedSpan: WysiwygTextSpan = {
      text: selectedText,
      ...(nextMarks ? { marks: nextMarks } : {}),
    };

    return [
      ...(beforeText ? [{ ...span, text: beforeText }] : []),
      ...(selectedText ? [markedSpan] : []),
      ...(afterText ? [{ ...span, text: afterText }] : []),
    ];
  });

  return {
    ...block,
    spans: mergeAdjacentSpans(nextSpans),
  };
}

function addMarksToBlockRange(
  block: WysiwygBlock,
  startOffset: number,
  endOffset: number,
  marks: WysiwygTextMark[],
): WysiwygBlock {
  if (marks.length === 0 || endOffset <= startOffset) {
    return block;
  }

  let textOffset = 0;
  const nextSpans = block.spans.flatMap<WysiwygTextSpan>((span) => {
    const spanStart = textOffset;
    const spanEnd = spanStart + span.text.length;
    textOffset = spanEnd;

    if (spanEnd <= startOffset || spanStart >= endOffset) {
      return [span];
    }

    const selectedStart = Math.max(startOffset, spanStart) - spanStart;
    const selectedEnd = Math.min(endOffset, spanEnd) - spanStart;
    const beforeText = span.text.slice(0, selectedStart);
    const selectedText = span.text.slice(selectedStart, selectedEnd);
    const afterText = span.text.slice(selectedEnd);
    const nextMarks = mergeTextMarks(span.marks, marks);
    const markedSpan: WysiwygTextSpan = {
      text: selectedText,
      ...(nextMarks ? { marks: nextMarks } : {}),
    };

    return [
      ...(beforeText ? [{ ...span, text: beforeText }] : []),
      ...(selectedText ? [markedSpan] : []),
      ...(afterText ? [{ ...span, text: afterText }] : []),
    ];
  });

  return {
    ...block,
    spans: mergeAdjacentSpans(nextSpans),
  };
}

function getInsertedRange(previousText: string, nextText: string): [number, number] | null {
  if (nextText.length <= previousText.length) {
    return null;
  }

  let prefixLength = 0;
  while (
    prefixLength < previousText.length
    && prefixLength < nextText.length
    && previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffixIndex = previousText.length;
  let nextSuffixIndex = nextText.length;
  while (
    previousSuffixIndex > prefixLength
    && nextSuffixIndex > prefixLength
    && previousText[previousSuffixIndex - 1] === nextText[nextSuffixIndex - 1]
  ) {
    previousSuffixIndex -= 1;
    nextSuffixIndex -= 1;
  }

  return [prefixLength, nextSuffixIndex];
}

function applyActiveMarksToInsertedText(
  previousBlock: WysiwygBlock | undefined,
  nextBlock: WysiwygBlock,
  activeMarks: WysiwygTextMark[],
): WysiwygBlock {
  const insertedRange = getInsertedRange(previousBlock ? getBlockText(previousBlock) : '', getBlockText(nextBlock));

  return insertedRange
    ? addMarksToBlockRange(nextBlock, insertedRange[0], insertedRange[1], activeMarks)
    : nextBlock;
}

function createBlockId(blocks: WysiwygBlock[]): string {
  let nextIndex = blocks.length + 1;
  let nextId = `block-${nextIndex}`;
  const existingIds = new Set(blocks.map((block) => block.id));

  while (existingIds.has(nextId)) {
    nextIndex += 1;
    nextId = `block-${nextIndex}`;
  }

  return nextId;
}

function splitSpansAtOffset(spans: WysiwygTextSpan[], offset: number): [WysiwygTextSpan[], WysiwygTextSpan[]] {
  let textOffset = 0;
  const beforeSpans: WysiwygTextSpan[] = [];
  const afterSpans: WysiwygTextSpan[] = [];

  spans.forEach((span) => {
    const spanStart = textOffset;
    const spanEnd = spanStart + span.text.length;
    textOffset = spanEnd;

    if (spanEnd <= offset) {
      beforeSpans.push(span);
      return;
    }

    if (spanStart >= offset) {
      afterSpans.push(span);
      return;
    }

    const splitOffset = offset - spanStart;
    const beforeText = span.text.slice(0, splitOffset);
    const afterText = span.text.slice(splitOffset);

    if (beforeText) {
      beforeSpans.push({ ...span, text: beforeText });
    }

    if (afterText) {
      afterSpans.push({ ...span, text: afterText });
    }
  });

  return [
    beforeSpans.length > 0 ? mergeAdjacentSpans(beforeSpans) : [{ text: '' }],
    afterSpans.length > 0 ? mergeAdjacentSpans(afterSpans) : [{ text: '' }],
  ];
}

function createTextSpans(text: string, marks: WysiwygTextMark[]): WysiwygTextSpan[] {
  return [
    {
      text,
      ...(marks.length > 0 ? { marks } : {}),
    },
  ];
}

function insertPlainTextIntoBlocks(
  blocks: WysiwygBlock[],
  blockIndex: number,
  splitOffset: number,
  text: string,
  activeMarks: WysiwygTextMark[],
): WysiwygBlock[] {
  const currentBlock = blocks[blockIndex] ?? blocks[0] ?? createWysiwygDocument().blocks[0];
  const [beforeSpans, afterSpans] = splitSpansAtOffset(currentBlock.spans, splitOffset);
  const pastedLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const baseBlocks = blocks.filter((_, index) => index !== blockIndex);
  const existingIds = new Set(blocks.map((block) => block.id));
  let nextIdIndex = blocks.length + 1;

  function allocateBlockId(): string {
    let nextId = `block-${nextIdIndex}`;
    while (existingIds.has(nextId)) {
      nextIdIndex += 1;
      nextId = `block-${nextIdIndex}`;
    }
    existingIds.add(nextId);
    nextIdIndex += 1;
    return nextId;
  }

  const insertedBlocks = pastedLines.map<WysiwygBlock>((line, lineIndex) => {
    const isFirst = lineIndex === 0;
    const isLast = lineIndex === pastedLines.length - 1;
    const spans = [
      ...(isFirst ? beforeSpans.filter((span) => span.text || span.marks?.length) : []),
      ...createTextSpans(line, activeMarks),
      ...(isLast ? afterSpans.filter((span) => span.text || span.marks?.length) : []),
    ];

    return {
      id: isFirst ? currentBlock.id : allocateBlockId(),
      type: currentBlock.type,
      spans: mergeAdjacentSpans(spans.length > 0 ? spans : [{ text: '' }]),
    };
  });

  return [
    ...baseBlocks.slice(0, blockIndex),
    ...insertedBlocks,
    ...baseBlocks.slice(blockIndex),
  ];
}

function getPlainTextPasteCaretPosition(
  text: string,
  blockIndex: number,
  splitOffset: number,
): { blockIndex: number; offset: number } {
  const pastedLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lastLine = pastedLines.at(-1) ?? '';

  return {
    blockIndex: blockIndex + pastedLines.length - 1,
    offset: pastedLines.length === 1 ? splitOffset + lastLine.length : lastLine.length,
  };
}

function getShortcutMark(event: KeyboardEvent<HTMLDivElement>): WysiwygTextMark | null {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === 'b') {
    return 'bold';
  }

  if (key === 'i') {
    return 'italic';
  }

  if (key === 'u') {
    return 'underline';
  }

  return null;
}

function getTextPositionInBlock(blockElement: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT);
  let remainingOffset = offset;
  let lastTextNode: Text | null = null;
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    lastTextNode = textNode;
    if (remainingOffset <= textNode.data.length) {
      return { node: textNode, offset: remainingOffset };
    }

    remainingOffset -= textNode.data.length;
    currentNode = walker.nextNode();
  }

  const fallbackTextNode = lastTextNode ?? document.createTextNode('');
  if (!lastTextNode) {
    blockElement.append(fallbackTextNode);
  }

  return { node: fallbackTextNode, offset: fallbackTextNode.data.length };
}

function setCaretInBlock(editorElement: HTMLElement, blockIndex: number, offset: number) {
  const blockElement = editorElement.children[blockIndex];
  const selection = window.getSelection();
  if (!(blockElement instanceof HTMLElement) || !selection) {
    return;
  }

  editorElement.focus();
  const caretPosition = getTextPositionInBlock(blockElement, offset);
  const range = document.createRange();
  range.setStart(caretPosition.node, caretPosition.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getBlockPositionFromTextOffset(
  blocks: WysiwygBlock[],
  textOffset: number,
): { blockIndex: number; offset: number } {
  let remainingOffset = textOffset;

  for (let index = 0; index < blocks.length; index += 1) {
    const blockLength = getBlockText(blocks[index]).length;
    if (remainingOffset <= blockLength) {
      return { blockIndex: index, offset: remainingOffset };
    }

    remainingOffset -= blockLength;
  }

  const lastBlockIndex = Math.max(0, blocks.length - 1);
  return {
    blockIndex: lastBlockIndex,
    offset: getBlockText(blocks[lastBlockIndex] ?? createWysiwygDocument().blocks[0]).length,
  };
}

function getEditorSelectionPosition(
  editorElement: HTMLElement,
  range: Range,
  blocks: WysiwygBlock[],
): { blockIndex: number; offset: number } {
  const blockElement = getEditableBlockElementForNode(editorElement, range.startContainer);
  if (blockElement) {
    return {
      blockIndex: getEditableBlockIndex(editorElement, blockElement),
      offset: getTextOffsetWithinBlock(blockElement, range.startContainer, range.startOffset),
    };
  }

  return getBlockPositionFromTextOffset(
    blocks,
    getTextOffsetWithinElement(editorElement, range.startContainer, range.startOffset),
  );
}

export function WysiwygEditor({
  value,
  onChange,
  label = 'Text content',
  twStyles,
}: WysiwygEditorProps): ReactElement {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blockTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const previousBlocksRef = useRef<WysiwygBlock[]>([]);
  const lastLocalDocumentSignatureRef = useRef<string | null>(null);
  const lastEditorRangeRef = useRef<Range | null>(null);
  const blockTypeMenuId = useId();
  const normalizedValue = useMemo(() => normalizeWysiwygDocument(value), [value]);
  const [selectedBlockType, setSelectedBlockType] = useState<WysiwygBlockType>(
    normalizedValue.blocks[0]?.type ?? 'paragraph',
  );
  const [selectedMarks, setSelectedMarks] = useState<WysiwygTextMark[]>([]);
  const [isBlockTypeMenuOpen, setIsBlockTypeMenuOpen] = useState(false);
  const selectedBlockTypeOption = WYSIWYG_BLOCK_TYPE_OPTIONS.find((option) => option.value === selectedBlockType)
    ?? WYSIWYG_BLOCK_TYPE_OPTIONS[0];

  useEffect(() => {
    const editorElement = editorRef.current;
    if (!editorElement) {
      return;
    }

    previousBlocksRef.current = normalizedValue.blocks;
    const nextSignature = serializeWysiwygDocument(normalizedValue);
    if (lastLocalDocumentSignatureRef.current === nextSignature) {
      lastLocalDocumentSignatureRef.current = null;
      return;
    }

    renderEditableBlocks(editorElement, normalizedValue.blocks);
    const animationFrame = window.requestAnimationFrame(() => {
      setSelectedBlockType(normalizedValue.blocks[0]?.type ?? 'paragraph');
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [normalizedValue]);

  useEffect(() => {
    if (!isBlockTypeMenuOpen) {
      return undefined;
    }

    function handleMouseDown(event: MouseEvent) {
      if (blockTypeMenuRef.current && !blockTypeMenuRef.current.contains(event.target as Node)) {
        setIsBlockTypeMenuOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsBlockTypeMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBlockTypeMenuOpen]);

  function commitDocument(nextDocument: WysiwygDocument) {
    const normalizedDocument = normalizeWysiwygDocument(nextDocument);

    previousBlocksRef.current = normalizedDocument.blocks;
    lastLocalDocumentSignatureRef.current = serializeWysiwygDocument(normalizedDocument);
    onChange(normalizedDocument);
  }

  function syncEditorValue() {
    const editorElement = editorRef.current;
    if (!editorElement) {
      return;
    }
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const nextBlocks = createBlocksFromEditableElement(editorElement, previousBlocksRef.current);
    const selectionPosition = range && editorElement.contains(range.startContainer)
      ? getEditorSelectionPosition(editorElement, range, nextBlocks)
      : null;
    const blocksWithActiveMarks = selectedMarks.length > 0
      ? nextBlocks.map((block, index) => applyActiveMarksToInsertedText(
        previousBlocksRef.current[index],
        block,
        selectedMarks,
      ))
      : nextBlocks;
    const activeMarksChangedDocument = serializeWysiwygDocument({ version: 1, blocks: nextBlocks })
      !== serializeWysiwygDocument({ version: 1, blocks: blocksWithActiveMarks });

    if (activeMarksChangedDocument || hasUnstructuredEditorChildren(editorElement)) {
      renderEditableBlocks(editorElement, blocksWithActiveMarks);
      if (selectionPosition) {
        setCaretInBlock(editorElement, selectionPosition.blockIndex, selectionPosition.offset);
      }
    }

    commitDocument({ version: 1, blocks: blocksWithActiveMarks });
  }

  function syncSelectionState() {
    const editorElement = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchorNode = selection?.anchorNode ?? null;
    if (
      !editorElement
      || !range
      || !anchorNode
      || !editorElement.contains(anchorNode)
      || !editorElement.contains(range.startContainer)
      || !editorElement.contains(range.endContainer)
    ) {
      return;
    }

    lastEditorRangeRef.current = range.cloneRange();
    const blockElement = getEditableBlockElementForNode(editorElement, anchorNode);
    if (blockElement) {
      setSelectedBlockType(getBlockTypeFromElement(blockElement));
    }

    const selectedElement = anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
    const markedElement = selectedElement?.closest('[data-wysiwyg-marks]');
    setSelectedMarks(
      markedElement instanceof HTMLElement
        ? parseSerializedMarks(markedElement.dataset.wysiwygMarks) ?? []
        : [],
    );
  }

  function getEditorSelectionRange(editorElement: HTMLElement): Range | null {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (
      range
      && editorElement.contains(range.startContainer)
      && editorElement.contains(range.endContainer)
    ) {
      lastEditorRangeRef.current = range.cloneRange();
      return range;
    }

    const lastRange = lastEditorRangeRef.current;
    if (
      lastRange
      && editorElement.contains(lastRange.startContainer)
      && editorElement.contains(lastRange.endContainer)
    ) {
      return lastRange.cloneRange();
    }

    return null;
  }

  function restoreEditorSelection(editorElement: HTMLElement, range: Range) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    editorElement.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    lastEditorRangeRef.current = range.cloneRange();
  }

  function applySelectedBlockType(type: WysiwygBlockType) {
    const editorElement = editorRef.current;
    const range = editorElement ? getEditorSelectionRange(editorElement) : null;
    const currentBlocks = editorElement
      ? createBlocksFromEditableElement(editorElement, previousBlocksRef.current)
      : previousBlocksRef.current;
    let startBlockIndex = 0;
    let endBlockIndex = 0;

    if (editorElement && range) {
      const startBlockElement = getEditableBlockElementForNode(editorElement, range.startContainer);
      const endBlockElement = getEditableBlockElementForNode(editorElement, range.endContainer);
      if (startBlockElement && endBlockElement) {
        startBlockIndex = getEditableBlockIndex(editorElement, startBlockElement);
        endBlockIndex = getEditableBlockIndex(editorElement, endBlockElement);
      }
    }

    const nextDocument: WysiwygDocument = {
      version: 1,
      blocks: currentBlocks.map((block, index) => (
        index >= startBlockIndex && index <= endBlockIndex
          ? { ...block, type }
          : block
      )),
    };

    if (editorElement) {
      Array.from(editorElement.children).forEach((child, index) => {
        if (child instanceof HTMLElement && index >= startBlockIndex && index <= endBlockIndex) {
          updateEditableBlockElementType(child, type);
        }
      });
    }

    setSelectedBlockType(type);
    commitDocument(nextDocument);
    editorRef.current?.focus();
  }

  function handleBlockTypeTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsBlockTypeMenuOpen(true);
    }
  }

  function applyTextMark(mark: WysiwygTextMark) {
    const editorElement = editorRef.current;
    const range = editorElement ? getEditorSelectionRange(editorElement) : null;
    if (!editorElement) {
      return;
    }

    if (!range) {
      editorElement.focus();
      setSelectedMarks((currentMarks) => setMarkOnSpan(currentMarks, mark, !currentMarks.includes(mark)) ?? []);
      return;
    }

    if (range.collapsed) {
      restoreEditorSelection(editorElement, range);
      setSelectedMarks((currentMarks) => setMarkOnSpan(currentMarks, mark, !currentMarks.includes(mark)) ?? []);
      return;
    }

    const startBlockElement = getEditableBlockElementForNode(editorElement, range.startContainer);
    const endBlockElement = getEditableBlockElementForNode(editorElement, range.endContainer);
    if (!startBlockElement || !endBlockElement) {
      return;
    }

    const currentBlocks = createBlocksFromEditableElement(editorElement, previousBlocksRef.current);
    const startBlockIndex = getEditableBlockIndex(editorElement, startBlockElement);
    const endBlockIndex = getEditableBlockIndex(editorElement, endBlockElement);
    const startOffset = getTextOffsetWithinBlock(startBlockElement, range.startContainer, range.startOffset);
    const endOffset = getTextOffsetWithinBlock(endBlockElement, range.endContainer, range.endOffset);
    const nextBlocks = currentBlocks.map((block, index) => {
      if (index < startBlockIndex || index > endBlockIndex) {
        return block;
      }

      return applyMarkToBlock(
        block,
        index === startBlockIndex ? startOffset : 0,
        index === endBlockIndex ? endOffset : getBlockText(block).length,
        mark,
      );
    });
    const nextDocument = { version: 1, blocks: nextBlocks } satisfies WysiwygDocument;

    renderEditableBlocks(editorElement, nextBlocks);
    setSelectedMarks((currentMarks) => setMarkOnSpan(currentMarks, mark, true) ?? []);
    commitDocument(nextDocument);
    setCaretInBlock(editorElement, endBlockIndex, endOffset);
  }

  function splitCurrentBlockAtSelection() {
    const editorElement = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editorElement || !range) {
      return;
    }

    const currentBlocks = createBlocksFromEditableElement(editorElement, previousBlocksRef.current);
    const selectionPosition = getEditorSelectionPosition(editorElement, range, currentBlocks);
    const blockIndex = selectionPosition.blockIndex;
    const currentBlock = currentBlocks[blockIndex] ?? currentBlocks[0] ?? createWysiwygDocument().blocks[0];
    const splitOffset = selectionPosition.offset;
    const [beforeSpans, afterSpans] = splitSpansAtOffset(currentBlock.spans, splitOffset);
    const nextBlock: WysiwygBlock = {
      id: createBlockId(currentBlocks),
      type: currentBlock.type,
      spans: afterSpans,
    };
    const nextBlocks = [
      ...currentBlocks.slice(0, blockIndex),
      { ...currentBlock, spans: beforeSpans },
      nextBlock,
      ...currentBlocks.slice(blockIndex + 1),
    ];

    renderEditableBlocks(editorElement, nextBlocks);
    commitDocument({ version: 1, blocks: nextBlocks });
    setCaretInBlock(editorElement, blockIndex + 1, 0);
  }

  function pastePlainTextAtSelection(text: string) {
    const editorElement = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editorElement || !range) {
      return;
    }

    const blockElement = getEditableBlockElementForNode(editorElement, range.startContainer);
    if (!blockElement) {
      return;
    }

    const currentBlocks = createBlocksFromEditableElement(editorElement, previousBlocksRef.current);
    const blockIndex = getEditableBlockIndex(editorElement, blockElement);
    const splitOffset = getTextOffsetWithinBlock(blockElement, range.startContainer, range.startOffset);
    const nextBlocks = insertPlainTextIntoBlocks(currentBlocks, blockIndex, splitOffset, text, selectedMarks);
    const caretPosition = getPlainTextPasteCaretPosition(text, blockIndex, splitOffset);

    renderEditableBlocks(editorElement, nextBlocks);
    commitDocument({ version: 1, blocks: nextBlocks });
    setCaretInBlock(editorElement, caretPosition.blockIndex, caretPosition.offset);
  }

  function handleEditorPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    pastePlainTextAtSelection(event.clipboardData.getData('text/plain'));
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      splitCurrentBlockAtSelection();
      return;
    }

    const shortcutMark = getShortcutMark(event);
    if (!shortcutMark) {
      return;
    }

    event.preventDefault();
    applyTextMark(shortcutMark);
  }

  return (
    <div className={twMerge('grid gap-3', twStyles)}>
      <span className="ui_micro_label text-wysiwyg-editor-label">{label}</span>
      <div className="grid-drag-cancel overflow-hidden rounded-[4px] border border-wysiwyg-editor-border bg-wysiwyg-editor-editor-bg">
        <div className="flex flex-wrap items-center gap-2 border-b border-wysiwyg-editor-divider bg-wysiwyg-editor-toolbar-bg px-4 py-3">
          <div ref={blockTypeMenuRef} className="relative">
            <button
              type="button"
              aria-controls={isBlockTypeMenuOpen ? blockTypeMenuId : undefined}
              aria-expanded={isBlockTypeMenuOpen}
              aria-haspopup="menu"
              aria-label={`Text block type: ${selectedBlockTypeOption.label}`}
              className={twMerge(
                'body_text flex h-9 min-w-28 cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-transparent px-3 text-wysiwyg-editor-text-muted transition-colors hover:bg-wysiwyg-editor-button-bg-hover hover:text-wysiwyg-editor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wysiwyg-editor-button-active-border',
                isBlockTypeMenuOpen && 'bg-wysiwyg-editor-button-active-bg text-wysiwyg-editor-button-active-text',
              )}
              onKeyDown={handleBlockTypeTriggerKeyDown}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsBlockTypeMenuOpen((isOpen) => !isOpen)}
            >
              <span>{selectedBlockTypeOption.label}</span>
              <ChevronDownIcon />
            </button>
            {isBlockTypeMenuOpen ? (
              <div
                id={blockTypeMenuId}
                role="menu"
                className="wysiwyg-editor-menu absolute left-0 top-[calc(100%+0.55rem)] z-30 grid min-w-56 gap-1 rounded-[4px] border border-wysiwyg-editor-border p-2 shadow-lg"
              >
                {WYSIWYG_BLOCK_TYPE_OPTIONS.map((option) => {
                  const isSelected = option.value === selectedBlockType;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      aria-label={option.label}
                      className={twMerge(
                        'flex cursor-pointer items-center rounded-[4px] px-3 py-2.5 text-left text-wysiwyg-editor-text-muted transition-colors hover:bg-wysiwyg-editor-button-bg-hover hover:text-wysiwyg-editor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wysiwyg-editor-button-active-border',
                        isSelected && 'bg-wysiwyg-editor-button-active-bg text-wysiwyg-editor-button-active-text',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        applySelectedBlockType(option.value);
                        setIsBlockTypeMenuOpen(false);
                      }}
                    >
                      <span className={twMerge(getBlockTypeTypographyClassName(option.value), 'text-inherit')}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <span className="h-7 w-px bg-wysiwyg-editor-divider" aria-hidden="true" />
          {WYSIWYG_TEXT_MARK_OPTIONS.map((option) => {
            const isSelected = selectedMarks.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={isSelected}
                className={twMerge(
                  'ui_caption flex h-9 w-9 cursor-pointer items-center justify-center rounded-[4px] border border-transparent text-wysiwyg-editor-text-muted transition-colors hover:bg-wysiwyg-editor-button-bg-hover hover:text-wysiwyg-editor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wysiwyg-editor-button-active-border',
                  isSelected && 'border-wysiwyg-editor-button-active-border bg-wysiwyg-editor-button-active-bg text-wysiwyg-editor-button-active-text',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyTextMark(option.value)}
              >
                <span className={twMerge('text-base leading-none', option.iconClassName)}>{option.icon}</span>
              </button>
            );
          })}
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          className="body_text min-h-56 bg-wysiwyg-editor-editor-bg px-6 py-5 text-wysiwyg-editor-text caret-accent outline-none transition-colors [&>[data-wysiwyg-block]+[data-wysiwyg-block]]:mt-3"
          onKeyDown={handleEditorKeyDown}
          onKeyUp={syncSelectionState}
          onInput={syncEditorValue}
          onBlur={syncEditorValue}
          onPaste={handleEditorPaste}
          onClick={syncSelectionState}
          onFocus={syncSelectionState}
          onMouseUp={syncSelectionState}
        />
      </div>
    </div>
  );
}
