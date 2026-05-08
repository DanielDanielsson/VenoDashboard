'use client';

import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { SegmentedSelector } from '@ui/base/SegmentedSelector';
import type { SegmentedSelectorOptions } from '@ui/base/SegmentedSelector/SegmentedSelector.types';

export type RichTextBlockType = 'heading1' | 'heading2' | 'paragraph';

export interface RichTextBlock {
  id: string;
  type: RichTextBlockType;
  text: string;
}

export interface RichTextDocument {
  blocks: RichTextBlock[];
}

interface RichTextEditorProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  label?: string;
  twStyles?: string;
}

interface RichTextContentProps {
  value: RichTextDocument;
  emptyText?: string;
  twStyles?: string;
}

const RICH_TEXT_BLOCK_TYPES = [
  { value: 'paragraph', label: 'Text' },
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
] satisfies SegmentedSelectorOptions<RichTextBlockType>;

const EMPTY_DOCUMENT: RichTextDocument = {
  blocks: [
    {
      id: 'block-1',
      type: 'paragraph',
      text: '',
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createBlockId(blocks: RichTextBlock[]): string {
  let nextIndex = blocks.length + 1;
  let nextId = `block-${nextIndex}`;
  const existingIds = new Set(blocks.map((block) => block.id));

  while (existingIds.has(nextId)) {
    nextIndex += 1;
    nextId = `block-${nextIndex}`;
  }

  return nextId;
}

function normalizeBlockType(value: unknown): RichTextBlockType {
  return RICH_TEXT_BLOCK_TYPES.some((option) => option.value === value)
    ? value as RichTextBlockType
    : 'paragraph';
}

export function createRichTextDocument(text = ''): RichTextDocument {
  return {
    blocks: [
      {
        ...EMPTY_DOCUMENT.blocks[0],
        text,
      },
    ],
  };
}

export function normalizeRichTextDocument(value: unknown): RichTextDocument {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    return createRichTextDocument();
  }

  const blocks = value.blocks
    .filter(isRecord)
    .map((block, index) => ({
      id: typeof block.id === 'string' && block.id.trim() ? block.id : `block-${index + 1}`,
      type: normalizeBlockType(block.type),
      text: typeof block.text === 'string' ? block.text : '',
    }));

  return {
    blocks: blocks.length > 0 ? blocks : createRichTextDocument().blocks,
  };
}

function updateBlock(
  value: RichTextDocument,
  blockId: string,
  updater: (block: RichTextBlock) => RichTextBlock,
): RichTextDocument {
  return {
    blocks: value.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
  };
}

function getTextareaClassName(type: RichTextBlockType): string {
  if (type === 'heading1') {
    return 'section_title';
  }

  if (type === 'heading2') {
    return 'body_text_emphasis';
  }

  return 'body_text';
}

function getContentClassName(type: RichTextBlockType): string {
  if (type === 'heading1') {
    return 'section_title text-text';
  }

  if (type === 'heading2') {
    return 'body_text_emphasis text-text';
  }

  return 'body_text_relaxed text-text-soft';
}

export function RichTextEditor({
  value,
  onChange,
  label = 'Text content',
  twStyles,
}: RichTextEditorProps): ReactElement {
  const normalizedValue = normalizeRichTextDocument(value);

  return (
    <div className={twMerge('grid gap-3', twStyles)}>
      <span className="ui_micro_label text-text-soft">{label}</span>
      <div className="grid gap-3">
        {normalizedValue.blocks.map((block, index) => (
          <div
            key={block.id}
            className="grid-drag-cancel grid gap-2 rounded-[4px] border border-border bg-surface-muted p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedSelector
                ariaLabel={`Text style for block ${index + 1}`}
                options={RICH_TEXT_BLOCK_TYPES}
                value={block.type}
                onChange={(type) => {
                  onChange(updateBlock(normalizedValue, block.id, (current) => ({
                    ...current,
                    type,
                  })));
                }}
              />
              <Button
                ariaLabel={`Remove block ${index + 1}`}
                disabled={normalizedValue.blocks.length === 1}
                twStyles="ui_caption rounded-[4px] border border-border px-2 py-1 text-text-soft transition-colors hover:bg-bg hover:text-text"
                onClick={() => {
                  onChange({
                    blocks: normalizedValue.blocks.filter((current) => current.id !== block.id),
                  });
                }}
              >
                Remove
              </Button>
            </div>
            <textarea
              aria-label={`Text block ${index + 1}`}
              className={twMerge(
                'min-h-24 resize-y rounded-[4px] border border-border bg-bg p-3 text-text outline-none transition-colors focus:border-dashboard-time-picker-border',
                getTextareaClassName(block.type),
              )}
              value={block.text}
              onChange={(event) => {
                onChange(updateBlock(normalizedValue, block.id, (current) => ({
                  ...current,
                  text: event.target.value,
                })));
              }}
            />
          </div>
        ))}
      </div>
      <Button
        ariaLabel="Add text block"
        twStyles="ui_caption w-fit rounded-[4px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg px-3 py-2 text-dashboard-time-picker-text transition-colors hover:bg-dashboard-time-picker-bg-hover"
        onClick={() => {
          onChange({
            blocks: [
              ...normalizedValue.blocks,
              {
                id: createBlockId(normalizedValue.blocks),
                type: 'paragraph',
                text: '',
              },
            ],
          });
        }}
      >
        Add block
      </Button>
    </div>
  );
}

export function RichTextContent({
  value,
  emptyText = 'No text configured.',
  twStyles,
}: RichTextContentProps): ReactElement {
  const blocks = normalizeRichTextDocument(value).blocks;
  const hasVisibleText = blocks.some((block) => block.text.trim().length > 0);

  if (!hasVisibleText) {
    return <p className={twMerge('body_text text-text-soft', twStyles)}>{emptyText}</p>;
  }

  return (
    <div className={twMerge('grid gap-3', twStyles)}>
      {blocks.map((block) => {
        const text = block.text.trim();
        if (!text) {
          return null;
        }

        if (block.type === 'heading1') {
          return <h3 key={block.id} className={getContentClassName(block.type)}>{text}</h3>;
        }

        if (block.type === 'heading2') {
          return <h4 key={block.id} className={getContentClassName(block.type)}>{text}</h4>;
        }

        return <p key={block.id} className={getContentClassName(block.type)}>{text}</p>;
      })}
    </div>
  );
}
