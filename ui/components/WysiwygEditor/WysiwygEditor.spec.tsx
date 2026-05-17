// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import {
  WysiwygContent,
  WysiwygEditor,
  createWysiwygDocument,
  normalizeWysiwygDocument,
} from './WysiwygEditor';

function selectTextRange(textNode: Node, start: number, end: number) {
  const selection = window.getSelection();
  const range = document.createRange();

  if (!selection) {
    throw new Error('Expected browser selection to exist.');
  }

  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('WysiwygEditor document model', () => {
  test('creates and normalizes a versioned paragraph document', () => {
    expect(createWysiwygDocument('Add descriptive text for this dashboard.')).toEqual({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            {
              text: 'Add descriptive text for this dashboard.',
            },
          ],
        },
      ],
    });

    expect(normalizeWysiwygDocument({ blocks: [{ id: '', type: 'bad', spans: [{ text: 42 }] }] })).toEqual({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            {
              text: '',
            },
          ],
        },
      ],
    });
  });

  test('normalizes inline marks on text spans', () => {
    expect(normalizeWysiwygDocument({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Important', marks: ['underline', 'bad', 'bold', 'bold'] },
          ],
        },
      ],
    })).toEqual({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Important', marks: ['bold', 'underline'] },
          ],
        },
      ],
    });
  });

  test('preserves intentional empty paragraph blocks during normalization', () => {
    expect(normalizeWysiwygDocument({
      version: 1,
      blocks: [
        { id: 'one', type: 'paragraph', spans: [{ text: 'Before' }] },
        { id: 'two', type: 'paragraph', spans: [{ text: '' }] },
        { id: 'three', type: 'paragraph', spans: [{ text: 'After' }] },
      ],
    })).toEqual({
      version: 1,
      blocks: [
        { id: 'one', type: 'paragraph', spans: [{ text: 'Before' }] },
        { id: 'two', type: 'paragraph', spans: [{ text: '' }] },
        { id: 'three', type: 'paragraph', spans: [{ text: 'After' }] },
      ],
    });
  });
});

describe('WysiwygContent', () => {
  test('renders heading, subheading, and paragraph blocks from the document', () => {
    render(
      <WysiwygContent
        value={{
          version: 1,
          blocks: [
            { id: 'heading', type: 'heading', spans: [{ text: 'Dashboard notes' }] },
            { id: 'subheading', type: 'subheading', spans: [{ text: 'Today' }] },
            { id: 'paragraph', type: 'paragraph', spans: [{ text: 'Glucose was steady.' }] },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard notes', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today', level: 4 })).toBeInTheDocument();
    expect(screen.getByText('Glucose was steady.')).toBeInTheDocument();
  });

  test('renders bold, italic, and underlined text spans', () => {
    render(
      <WysiwygContent
        value={{
          version: 1,
          blocks: [
            {
              id: 'paragraph',
              type: 'paragraph',
              spans: [
                { text: 'Bold', marks: ['bold'] },
                { text: ' italic', marks: ['italic'] },
                { text: ' underline', marks: ['underline'] },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('underline').tagName).toBe('U');
  });

  test('shows an overflow fade when the content is taller than the container', async () => {
    const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(24);
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(96);

    const { container } = render(
      <WysiwygContent
        showOverflowFade
        value={{
          version: 1,
          blocks: [
            {
              id: 'one',
              type: 'paragraph',
              spans: [{ text: 'A long note that needs more height than the panel provides.' }],
            },
          ],
        }}
      />,
    );

    await waitFor(() => expect(container.querySelector('.bg-gradient-to-b')).toBeInTheDocument());

    clientHeight.mockRestore();
    scrollHeight.mockRestore();
  });
});

describe('WysiwygEditor', () => {
  test('renders a compact toolbar with a plain block type dropdown and icon mark buttons', () => {
    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Text block type: Paragraph' })).toHaveTextContent('Paragraph');
    expect(screen.getByRole('button', { name: 'Text block type: Paragraph' })).toHaveClass('cursor-pointer');
    expect(screen.queryByRole('button', { name: 'Paragraph' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveTextContent('B');
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass('cursor-pointer');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveTextContent('I');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveClass('cursor-pointer');
    expect(screen.getByRole('button', { name: 'Underline' })).toHaveTextContent('U');
    expect(screen.getByRole('button', { name: 'Underline' })).toHaveClass('cursor-pointer');
  });

  test('renders block type menu options as opaque styled text labels', () => {
    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Text block type: Paragraph' }));

    expect(screen.getByRole('menu')).toHaveClass('wysiwyg-editor-menu');
    expect(screen.getAllByRole('menuitem').map((option) => option.textContent)).toEqual([
      'Heading',
      'Subheading',
      'Paragraph',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveTextContent('Paragraph');
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).not.toHaveTextContent('PParagraph');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveTextContent('Heading');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).not.toHaveTextContent('HHeading');
    expect(screen.getByRole('menuitem', { name: 'Subheading' })).toHaveTextContent('Subheading');
    expect(screen.getByRole('menuitem', { name: 'Subheading' })).not.toHaveTextContent('SSubheading');
  });

  test('keeps typed text in order when the parent echoes each change', async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState(createWysiwygDocument(''));

      return <WysiwygEditor value={value} onChange={setValue} />;
    }

    render(<ControlledEditor />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    await user.click(editor);
    await user.keyboard('Hello');

    expect(editor).toHaveTextContent('Hello');
  });

  test('uses one editor surface and emits the new JSON document when text changes', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Initial')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    expect(editor).toHaveAttribute('contenteditable', 'true');

    editor.innerHTML = '<div data-wysiwyg-block="" data-wysiwyg-block-type="paragraph">Edited</div>';
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            {
              text: 'Edited',
            },
          ],
        },
      ],
    });
  });

  test('normalizes browser inserted root text into an editable block', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    editor.textContent = 'Hello';
    const textNode = editor.firstChild;
    if (!textNode) {
      throw new Error('Expected browser inserted text to exist.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.input(editor);

    const blocks = editor.querySelectorAll('[data-wysiwyg-block]');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveTextContent('Hello');
    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Hello' },
          ],
        },
      ],
    });
  });

  test('applies the selected block type to the current text block', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Initial')} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Text block type: Paragraph' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'heading',
          spans: [
            {
              text: 'Initial',
            },
          ],
        },
      ],
    });
    expect(screen.getByRole('button', { name: 'Text block type: Heading' })).toHaveTextContent('Heading');
  });

  test('applies bold to selected text and emits split spans', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Hello world')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 6, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Hello ' },
            { text: 'world', marks: ['bold'] },
          ],
        },
      ],
    });
  });

  test('shows selected text marks inside the editable surface', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Hello world')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 6, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    const markedText = editor.querySelector('[data-wysiwyg-marks="bold"]');
    expect(markedText).toHaveTextContent('world');
    expect(markedText).toHaveClass('font-bold');
  });

  test('does not spread a selected text mark to the rest of the block on blur', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Hello world')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 6, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.blur(editor);

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Hello ' },
            { text: 'world', marks: ['bold'] },
          ],
        },
      ],
    });
  });

  test('applies active bold state to text typed after toggling a collapsed caret', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    editor.innerHTML = '<div data-wysiwyg-block="" data-wysiwyg-block-type="paragraph">Typed</div>';
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Typed', marks: ['bold'] },
          ],
        },
      ],
    });
  });

  test('shows active marks on newly inserted text without changing earlier text', async () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Hello')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.mouseUp(editor);
    const boldButton = screen.getByRole('button', { name: 'Bold' });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true'));
    editor.innerHTML = '<div data-wysiwyg-block="" data-wysiwyg-block-type="paragraph">Hello!</div>';
    fireEvent.input(editor);

    expect(editor.querySelector('[data-wysiwyg-block]')).toHaveTextContent('Hello!');
    const markedText = editor.querySelector('[data-wysiwyg-marks="bold"]');
    expect(markedText).toHaveTextContent('!');
    expect(markedText).toHaveClass('font-bold');
    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Hello' },
            { text: '!', marks: ['bold'] },
          ],
        },
      ],
    });
  });

  test('uses keyboard shortcuts for inline marks inside the editor', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('Hello world')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 6, 11);
    const wasNotPrevented = fireEvent.keyDown(editor, { key: 'i', ctrlKey: true });

    expect(wasNotPrevented).toBe(false);
    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          spans: [
            { text: 'Hello ' },
            { text: 'world', marks: ['italic'] },
          ],
        },
      ],
    });
  });

  test('applies block type changes across selected blocks', () => {
    const handleChange = vi.fn();

    render(
      <WysiwygEditor
        value={{
          version: 1,
          blocks: [
            { id: 'one', type: 'paragraph', spans: [{ text: 'First' }] },
            { id: 'two', type: 'paragraph', spans: [{ text: 'Second' }] },
          ],
        }}
        onChange={handleChange}
      />,
    );

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const firstTextNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    const secondTextNode = editor.querySelectorAll('[data-wysiwyg-block]')[1]?.firstChild;
    const selection = window.getSelection();
    const range = document.createRange();
    if (!firstTextNode || !secondTextNode || !selection) {
      throw new Error('Expected editable block text to render.');
    }

    range.setStart(firstTextNode, 0);
    range.setEnd(secondTextNode, 6);
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.click(screen.getByRole('button', { name: 'Text block type: Paragraph' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Subheading' }));

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'one', type: 'subheading', spans: [{ text: 'First' }] },
        { id: 'two', type: 'subheading', spans: [{ text: 'Second' }] },
      ],
    });
  });

  test('reflects active inline marks from the current selection', () => {
    render(
      <WysiwygEditor
        value={{
          version: 1,
          blocks: [
            { id: 'one', type: 'paragraph', spans: [{ text: 'Bold text', marks: ['bold'] }] },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const markedTextNode = editor.querySelector('[data-wysiwyg-marks="bold"]')?.firstChild;
    if (!markedTextNode) {
      throw new Error('Expected marked text to render in the editable surface.');
    }

    selectTextRange(markedTextNode, 0, 4);
    fireEvent.keyUp(editor);

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('creates a new text block when pressing Enter at the caret', () => {
    const handleChange = vi.fn();

    render(
      <WysiwygEditor
        value={{
          version: 1,
          blocks: [
            { id: 'one', type: 'subheading', spans: [{ text: 'First' }] },
          ],
        }}
        onChange={handleChange}
      />,
    );

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'one', type: 'subheading', spans: [{ text: 'First' }] },
        { id: 'block-2', type: 'subheading', spans: [{ text: '' }] },
      ],
    });
  });

  test('splits browser inserted root text when pressing Enter', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    editor.textContent = 'First';
    const textNode = editor.firstChild;
    if (!textNode) {
      throw new Error('Expected browser inserted text to exist.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.keyDown(editor, { key: 'Enter' });

    const blocks = editor.querySelectorAll('[data-wysiwyg-block]');
    expect(blocks[0]).toHaveTextContent('First');
    expect(blocks[1]).toHaveTextContent('');
    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'block-1', type: 'paragraph', spans: [{ text: 'First' }] },
        { id: 'block-2', type: 'paragraph', spans: [{ text: '' }] },
      ],
    });
  });

  test('keeps the caret in the new text block after pressing Enter', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('First')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.keyDown(editor, { key: 'Enter' });

    const blocks = editor.querySelectorAll('[data-wysiwyg-block]');
    expect(blocks[0]).toHaveTextContent('First');
    expect(blocks[1]).toHaveTextContent('');
    expect(blocks[1].contains(window.getSelection()?.anchorNode ?? null)).toBe(true);

    blocks[1].textContent = 'Second';
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'block-1', type: 'paragraph', spans: [{ text: 'First' }] },
        { id: 'block-2', type: 'paragraph', spans: [{ text: 'Second' }] },
      ],
    });
  });

  test('splits a block in the middle and preserves surrounding marks', () => {
    const handleChange = vi.fn();

    render(
      <WysiwygEditor
        value={{
          version: 1,
          blocks: [
            { id: 'one', type: 'paragraph', spans: [{ text: 'HelloWorld', marks: ['bold'] }] },
          ],
        }}
        onChange={handleChange}
      />,
    );

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-marks="bold"]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected marked editable block text to render.');
    }

    selectTextRange(textNode, 5, 5);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'one', type: 'paragraph', spans: [{ text: 'Hello', marks: ['bold'] }] },
        { id: 'block-2', type: 'paragraph', spans: [{ text: 'World', marks: ['bold'] }] },
      ],
    });
  });

  test('pastes plain text only and turns line breaks into blocks', () => {
    const handleChange = vi.fn();

    render(<WysiwygEditor value={createWysiwygDocument('')} onChange={handleChange} />);

    const editor = screen.getByRole('textbox', { name: 'Text content' });
    const textNode = editor.querySelector('[data-wysiwyg-block]')?.firstChild;
    if (!textNode) {
      throw new Error('Expected editable block text to render.');
    }

    selectTextRange(textNode, 0, 0);
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'Plain\n\nText' : '<strong>HTML</strong>'),
      },
    });

    expect(handleChange).toHaveBeenLastCalledWith({
      version: 1,
      blocks: [
        { id: 'block-1', type: 'paragraph', spans: [{ text: 'Plain' }] },
        { id: 'block-2', type: 'paragraph', spans: [{ text: '' }] },
        { id: 'block-3', type: 'paragraph', spans: [{ text: 'Text' }] },
      ],
    });

    const blocks = editor.querySelectorAll('[data-wysiwyg-block]');
    const pastedTextNode = blocks[2]?.firstChild;
    const selection = window.getSelection();
    expect(selection?.anchorNode).toBe(pastedTextNode);
    expect(selection?.anchorOffset).toBe(4);
  });
});
