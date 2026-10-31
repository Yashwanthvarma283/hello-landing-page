import Editor, { OnMount } from '@monaco-editor/react';
import { useTheme } from '@/lib/theme-context';
import { useEffect, useRef } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  practiceMode?: boolean;
}

const CodeEditor = ({ code, onChange, practiceMode = false }: CodeEditorProps) => {
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    document.fonts.ready.then(() => {
      if (!disposed) editorRef.current?.updateOptions({ fontFamily: "'JetBrains Mono', monospace" });
    });
    return () => { disposed = true; editorRef.current = null; };
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    document.fonts.ready.then(() => {
      if (editorRef.current === editor) {
        monaco.editor.remeasureFonts();
        editor.layout();
      }
    });

    // Add custom context menu actions
    editor.addAction({
      id: 'select-all-custom',
      label: 'Select All',
      contextMenuOrder: 1,
      contextMenuGroupId: 'navigation',
      run: () => {
        editor.setSelection(editor.getModel()?.getFullModelRange() || { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      },
    });

    editor.addAction({
      id: 'copy-all-custom',
      label: 'Copy All Code',
      contextMenuOrder: 2,
      contextMenuGroupId: 'navigation',
      run: () => {
        const fullCode = editor.getValue();
        navigator.clipboard.writeText(fullCode);
      },
    });

    editor.addAction({
      id: 'explain-ai-custom',
      label: '✨ Explain Selection with AI',
      contextMenuOrder: 3,
      contextMenuGroupId: 'navigation',
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection || { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
        if (selectedText) {
          window.dispatchEvent(new CustomEvent('trigger-explain', { detail: `Please explain this specific section of my code:\n\n${selectedText}` }));
        } else {
          window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__analyze__' }));
        }
      },
    });

    editor.addAction({
      id: 'find-bugs-custom',
      label: '🐛 Find Bugs in This Selection',
      contextMenuOrder: 4,
      contextMenuGroupId: 'navigation',
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection || { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
        if (selectedText) {
          window.dispatchEvent(new CustomEvent('trigger-explain', { detail: `__mistakes__\n(Focus on this section: ${selectedText})` }));
        } else {
          window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__mistakes__' }));
        }
      },
    });

    // Ensure global shortcuts work when editor is focused
    // Run Code: Ctrl + Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    });

    // Save: Ctrl + S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    });

    // Explain: Ctrl + Shift + E
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => {
      window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__analyze__' }));
    });

    // Run Tests: Ctrl + Shift + T
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true, bubbles: true }));
    });
  };

  return (
    <Editor
      height="100%"
      language="java"
      value={code}
      onChange={(v) => onChange(v || '')}
      onMount={handleEditorDidMount}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        fontLigatures: false,
        letterSpacing: 0,
        lineHeight: 22,
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        autoClosingBrackets: practiceMode ? 'never' : 'languageDefined',
        autoClosingQuotes: practiceMode ? 'never' : 'languageDefined',
        autoSurround: practiceMode ? 'never' : 'languageDefined',
        autoIndent: 'full',
        formatOnPaste: false,
        formatOnType: false,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 12 },
        renderLineHighlight: 'line',
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorBlinking: 'blink',
        cursorSmoothCaretAnimation: 'off',
        contextmenu: true,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: practiceMode ? 'off' : 'on',
        acceptSuggestionOnCommitCharacter: !practiceMode,
        tabCompletion: 'off',
      }}
    />
  );
};

export default CodeEditor;
