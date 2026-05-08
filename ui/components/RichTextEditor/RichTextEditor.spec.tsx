// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  RichTextContent,
  RichTextEditor,
  normalizeRichTextDocument,
  type RichTextDocument,
} from './RichTextEditor';

describe('RichTextEditor', () => {
  test('renders heading and paragraph blocks as content', () => {
    render(
      <RichTextContent
        value={{
          blocks: [
            { id: 'one', type: 'heading1', text: 'Dashboard notes' },
            { id: 'two', type: 'heading2', text: 'Today' },
            { id: 'three', type: 'paragraph', text: 'Glucose was steady.' },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard notes', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today', level: 4 })).toBeInTheDocument();
    expect(screen.getByText('Glucose was steady.')).toBeInTheDocument();
  });

  test('updates block style and text', () => {
    const handleChange = vi.fn();
    const value: RichTextDocument = {
      blocks: [
        { id: 'one', type: 'paragraph', text: 'Initial text' },
      ],
    };

    render(<RichTextEditor value={value} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Heading 1' }));
    expect(handleChange).toHaveBeenLastCalledWith({
      blocks: [
        { id: 'one', type: 'heading1', text: 'Initial text' },
      ],
    });

    fireEvent.change(screen.getByLabelText('Text block 1'), {
      target: { value: 'Updated text' },
    });
    expect(handleChange).toHaveBeenLastCalledWith({
      blocks: [
        { id: 'one', type: 'paragraph', text: 'Updated text' },
      ],
    });
  });

  test('normalizes invalid documents to one paragraph block', () => {
    expect(normalizeRichTextDocument({ blocks: [{ id: '', type: 'bad', text: 42 }] })).toEqual({
      blocks: [
        { id: 'block-1', type: 'paragraph', text: '' },
      ],
    });
  });
});
