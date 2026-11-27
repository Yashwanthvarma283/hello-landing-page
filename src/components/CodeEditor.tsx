import Editor, { OnMount } from '@monaco-editor/react';
import { useTheme } from '@/lib/theme-context';
import { useEffect, useRef } from 'react';
import { useEditorSettings, getEditorSettings } from '@/lib/editor-settings';
import { completionGroups } from '@/lib/java-completions';

let completionsRegistered = false;
function registerJavaCompletions(monaco: any) {
  if (completionsRegistered) return;
  completionsRegistered = true;
  const K = monaco.languages.CompletionItemKind;
  monaco.languages.registerCompletionItemProvider('java', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const g = completionGroups(getEditorSettings());
      const Rule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      return {
        suggestions: [
          ...g.templates.map((t) => ({ label: t.key, kind: K.Snippet, detail: t.description, documentation: t.body.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d/g, ''), insertText: t.body, insertTextRules: Rule, range, sortText: '0' + t.key })),
          ...g.keywords.map((k) => ({ label: k, kind: K.Keyword, insertText: k, range, sortText: '1' + k })),
          ...g.classes.map((c) => ({ label: c, kind: K.Class, insertText: c, range, sortText: '2' + c })),
        ],
      };
    },
  });
}

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  practiceMode?: boolean;
}

const CodeEditor = ({ code, onChange, practiceMode = false }: CodeEditorProps) => {
  const { theme } = useTheme();
  const settings = useEditorSettings();
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
    registerJavaCompletions(monaco);
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
        fontSize: settings.fontSize,
        fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
        fontLigatures: false,
        letterSpacing: 0,
        lineHeight: Math.round(settings.fontSize * 1.6),
        automaticLayout: true,
        minimap: { enabled: settings.minimap, scale: 1, renderCharacters: false },
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: true,
        showFoldingControls: 'mouseover',
        autoClosingBrackets: settings.autoCloseBrackets ? 'languageDefined' : 'never',
        autoClosingQuotes: settings.autoCloseBrackets ? 'languageDefined' : 'never',
        autoClosingOvertype: 'always',
        autoClosingDelete: 'always',
        autoSurround: settings.autoCloseBrackets ? 'languageDefined' : 'never',
        autoIndent: 'full',
        tabSize: 4,
        insertSpaces: true,
        formatOnPaste: false,
        formatOnType: false,
        scrollBeyondLastLine: false,
        wordWrap: settings.wordWrap ? 'on' : 'off',
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'all',
        renderWhitespace: 'selection',
        guides: { indentation: true, bracketPairs: 'active', highlightActiveIndentation: true },
        bracketPairColorization: { enabled: true },
        matchBrackets: 'always',
        stickyScroll: { enabled: settings.stickyScroll },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorStyle: 'line',
        cursorWidth: 2,
        cursorSmoothCaretAnimation: 'on',
        mouseWheelZoom: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        overviewRulerBorder: false,
        contextmenu: true,
        quickSuggestions: settings.suggestions || settings.liveTemplates ? { other: true, comments: false, strings: false } : false,
        suggestOnTriggerCharacters: settings.suggestions,
        wordBasedSuggestions: settings.suggestions ? 'currentDocument' : 'off',
        snippetSuggestions: settings.liveTemplates ? 'top' : 'none',
        suggest: { showWords: settings.suggestions, showKeywords: settings.suggestions, showSnippets: settings.liveTemplates, preview: true, insertMode: 'replace' },
        acceptSuggestionOnEnter: practiceMode ? 'smart' : 'on',
        acceptSuggestionOnCommitCharacter: false,
        tabCompletion: settings.liveTemplates ? 'on' : 'off',
        parameterHints: { enabled: settings.suggestions },
      }}
    />
  );
};

export default CodeEditor;
