import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Brain,
  Send,
  Loader2,
  AlertCircle,
  Trash2,
  Copy,
  ArrowUpRight,
  Volume2,
  VolumeX,
  GraduationCap,
  Settings2,
  PlayCircle,
  StopCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  analyzeCode,
  getHints as getAIHints,
  detectMistakes,
  detectPatterns,
  chat as aiChat,
  checkBackendStatus,
} from "@/lib/ai-backend";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";

// Mermaid Initializer
mermaid.initialize({
  startOnLoad: true,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const Mermaid = memo(({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chart) {
      setError(null);
      // Clean up common AI hallucinations in Mermaid
      const cleanedChart = chart
        .replace(/^[ \t]*graph [TLR][D]/gm, "graph TD")
        .replace(/^\s+|\s+$/g, "");

      mermaid
        .render(
          `mermaid-${Math.random().toString(36).substring(2, 9)}`,
          cleanedChart,
        )
        .then(({ svg }) => {
          setSvg(svg);
        })
        .catch((e) => {
          console.error("Mermaid render error:", e);
          setError("Invalid diagram syntax. Showing raw logic below.");
        });
    }
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <div className="flex items-center gap-2 mb-2 text-destructive font-bold text-xs">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
        <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap bg-black/20 p-2 rounded border border-white/5">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-4 p-4 rounded-xl bg-black/20 border border-white/5 overflow-x-auto shadow-inner transition-all duration-500 hover:border-primary/20">
      <div
        className="flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
});

Mermaid.displayName = "Mermaid";

interface MessageBubbleProps {
  msg: ChatMessage;
  onInsertCode: (code: string) => void;
}

const MessageBubble = memo(({ msg, onInsertCode, onRepeat }: MessageBubbleProps & { onRepeat: (text: string) => void }) => {
  const isAssistant = msg.role === "assistant";
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  const [isThisSpeaking, setIsThisSpeaking] = useState(false);

  const handleRepeat = () => {
    onRepeat(msg.content);
  };

  const markdownComponents = useMemo(
    () => ({
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        const codeStr = String(children).replace(/\n$/, "");
        if (!inline && match && match[1] === "mermaid") {
          return <Mermaid chart={codeStr} />;
        }
        const isBlock = !inline && match;
        const isJava = match && match[1] === "java";
        if (isBlock) {
          return (
            <div className="relative group/code mt-2 mb-2">
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10"
                  onClick={() => {
                    navigator.clipboard.writeText(codeStr);
                    toast.success("Copied to clipboard");
                  }}
                  title="Copy code"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {isJava && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7 bg-primary/30 hover:bg-primary/50 backdrop-blur-md border border-primary/30"
                    onClick={() => onInsertCode(codeStr)}
                    title="Insert into editor"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-white" />
                  </Button>
                )}
              </div>
              <pre
                className="!bg-[#0d1117] !text-gray-100 rounded-xl p-4 overflow-x-auto text-[11.5px] font-mono border border-white/10"
                {...props}
              >
                <code className="!text-gray-100 font-mono">{children}</code>
              </pre>
            </div>
          );
        }
        return (
          <code
            className="bg-secondary/40 text-primary px-1 py-0.5 rounded text-[11px] font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [onInsertCode],
  );

  return (
    <div
      className={`mb-6 flex flex-col group ${isUser ? "items-end" : "items-start"}`}
    >
      <div className={`flex items-center gap-2 mb-1.5 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {isAssistant && (
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transition-transform group-hover:scale-110">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          {isUser ? "User" : isAssistant ? "AI Architect" : "System"}
        </span>
        {isAssistant && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
              onClick={handleRepeat}
              title="Repeat Speech"
            >
              <PlayCircle className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              onClick={() => window.speechSynthesis.cancel()}
              title="Stop Speech"
            >
              <StopCircle className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div
        className={`relative max-w-[95%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-300 backdrop-blur-md border ${
          isUser
            ? "bg-primary/90 text-primary-foreground border-primary/20 rounded-tr-none"
            : isSystem
              ? "bg-warning/10 text-warning border-warning/20 rounded-tl-none italic"
              : "bg-card/50 text-card-foreground border-panel-border rounded-tl-none"
        }`}
      >
        {isAssistant ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert text-[12.5px] leading-relaxed 
            [&_pre]:mt-3 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#0d1117] [&_pre]:p-4 [&_pre]:border [&_pre]:border-white/10 [&_pre]:shadow-inner [&_pre]:text-gray-100
            [&_code]:font-mono [&_code]:text-[11.5px] [&_code]:text-gray-100 [&_table]:mt-3 [&_table]:mb-3 [&_table]:border-collapse [&_th]:bg-secondary/20 [&_th]:p-2 [&_td]:p-2 [&_td]:border [&_td]:border-panel-border"
          >
            <ReactMarkdown components={markdownComponents}>
              {msg.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span>{msg.content}</span>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

interface AIChatPanelProps {
  code: string;
  problemId: string | null;
  problemDescription?: string;
  problemTitle?: string;
  problemExamples?: any[];
  problemConstraints?: string[];
  module?: string;
  aiEnabled?: boolean;
}

// Quick action bar removed by design — all AI features live in the upper "AI" dropdown.
// Internal prompt sentinels still used (dispatched from the workspace dropdown):
//   __dry_run__ (Logic Trace), __hints__ (Hints), __optimal__ (Optimal Approach),
//   __mistakes__ (Find Bugs), __patterns__ (Patterns), __generate_tests__ (handled in workspace),
//   __analyze__ (Complexity Analysis).


const AIChatPanel = ({
  code,
  problemId,
  problemDescription,
  problemTitle,
  problemExamples,
  problemConstraints,
  module,
  aiEnabled = true,
}: AIChatPanelProps) => {
  const chatContext = useMemo(() => ({
    problemTitle, problemExamples, problemConstraints, module,
  }), [problemTitle, problemExamples, problemConstraints, module]);
  const [backendOnline, setBackendOnline] = useState(true);
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [voiceRate, setVoiceRate] = useState(1.1);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isTutorMode, setIsTutorMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef(code);

  // Sync ref with prop
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Initialize and filter voices for EXACT selection (English Male/Female only)
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      
      // 1. Get all English voices
      const englishVoices = allVoices.filter(v => v.lang.startsWith("en"));

      if (englishVoices.length === 0) {
        setAvailableVoices(allVoices.slice(0, 2));
        return;
      }

      // 2. Identify best Male and Female English voices
      const maleVoice = englishVoices.find(v => 
        v.name.toLowerCase().includes("male") || 
        v.name.toLowerCase().includes("david") || 
        v.name.toLowerCase().includes("mark") ||
        v.name.toLowerCase().includes("guy")
      ) || englishVoices[0];

      const femaleVoice = englishVoices.find(v => 
        v.name.toLowerCase().includes("female") || 
        v.name.toLowerCase().includes("zira") || 
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("aria")
      ) || (englishVoices[1] || englishVoices[0]);

      // Set exactly two voices
      const finalTwo = [maleVoice, femaleVoice].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
      setAvailableVoices(finalTwo);
      
      if (finalTwo.length > 0 && !selectedVoice) {
        setSelectedVoice(finalTwo[0].name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice]);

  useEffect(() => {
    const check = async () => {
      setChecking(true);
      const online = await checkBackendStatus();
      setBackendOnline(online);
      setChecking(false);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleExplain = (e: any) => {
      const prompt = e.detail || "__analyze__";
      handleSend(prompt);
    };
    window.addEventListener("trigger-explain", handleExplain);
    return () => window.removeEventListener("trigger-explain", handleExplain);
  }, [backendOnline, problemId, problemDescription]); // Removed code from dependencies

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Persist messages whenever they change
    if (problemId && messages.length > 0) {
      localStorage.setItem(`ai-chat-history-${problemId}`, JSON.stringify(messages));
    }
  }, [messages, problemId]);

  // Load persisted history on mount
  useEffect(() => {
    if (problemId) {
      const saved = localStorage.getItem(`ai-chat-history-${problemId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
            // Derive hint level from previous hints in chat
            const hints = parsed.filter(m => m.role === "user" && m.content.includes("💡 Hint")).length;
            setHintLevel(hints);
          }
        } catch (e) {
          console.error("Failed to load chat history", e);
        }
      }
    }
  }, [problemId]);

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();

    // SMART SPEECH CLEANING:
    // 1. Remove all code blocks entirely (they are hard to follow via audio)
    // 2. Remove inline code backticks
    // 3. Remove markdown headers, bold, and italics
    // 4. Remove technical symbols that sound robotic
    const smartText = text
      .replace(/```[\s\S]*?```/g, " [Code block skipped] ") // Skip full code blocks
      .replace(/`([^`]+)`/g, "$1") // Remove backticks but keep inline names
      .replace(/[#*_-]/g, "") // Remove markdown syntax
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Remove links but keep text
      .replace(/>/g, "Quote: ") // Friendly quote prefix
      .trim();

    if (!smartText) return;

    const utterance = new SpeechSynthesisUtterance(smartText);
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    
    // Explicitly find and set the voice object
    const voice = availableVoices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
  };

  const addMessage = (
    role: ChatMessage["role"],
    content: string,
  ): ChatMessage => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    if (role === "assistant") speak(content);
    return msg;
  };

  const handleInsertCode = useCallback((newCode: string) => {
    window.dispatchEvent(new CustomEvent("update-code", { detail: newCode }));
    toast.success("Code inserted into editor!");
  }, []);

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || input.trim();
    if (!text || isLoading) return;

    if (!backendOnline) {
      addMessage(
        "system",
        "⚠️ AI service is unavailable. Server may be waking up. Please try again in a moment.",
      );
      return;
    }

    if (!customPrompt) setInput("");
    setIsLoading(true);

    const buildHistoryForAPI = () => {
      return messages.map(m => ({ 
        role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user', 
        content: m.content 
      }));
    };

    const history = buildHistoryForAPI();

    const tutorInstructions = isTutorMode
      ? "TUTOR MODE ACTIVE: Do NOT provide full code solutions or direct answers. Instead, use the Socratic method: ask guiding questions, point out logic gaps, and nudge the user toward the answer. NEVER provide a complete Java code block."
      : "NORMAL MODE: You are a helpful expert mentor. Always provide clear examples with CORRECT, functional Java code blocks when explaining or suggesting solutions.";

    const contextPrefix = `[CONTEXT: Problem: ${problemId || 'Unknown'}, Description: ${problemDescription || 'Available in history'}]\n[RULES: ${tutorInstructions}]\n\n`;

    const currentCode = codeRef.current;

    // Free-form chat: send the user's message as-is. The problem/code context is
    // already delivered to the backend separately, so the model can pick it up when
    // the user says "explain this code" without us stuffing the code into the prompt.
    const finalPrompt = isTutorMode ? `[RULES: ${tutorInstructions}]\n\n${text}` : text;


    try {
      if (text === "__analyze__") {
        addMessage("user", "🔍 Run Deep Java Analysis");
        const result = await analyzeCode(currentCode, problemId);
        addMessage("assistant", result.summary);
      } else if (text === "__dry_run__") {
        addMessage("user", "⚙️ Logic Trace — explain my code step by step");
        const prompt =
          `${contextPrefix}\n` +
          `LOGIC TRACE MODE.\n\n` +
          `[JAVA CODE TO TRACE]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\`\n\n` +
          `Walk through the Java code above line-by-line / block-by-block.\n` +
          `For each meaningful step:\n` +
          `  • State exactly what that line/block does.\n` +
          `  • Mark it ✅ Correct, ⚠️ Suspicious, or ❌ Error and explain why.\n` +
          `  • Show how key variables change (use a small markdown table when useful).\n` +
          `Focus only on explaining and validating the user's own code.`;
        const result = await aiChat(currentCode, prompt, problemId, history, problemDescription, chatContext);
        addMessage("assistant", result);
      } else if (text === "__hints__") {
        if (hintLevel >= 4) {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: consumed } = await (supabase as any).rpc('consume_extra_hint');
          if (consumed) {
            addMessage("user", "💡 Bonus Hint (Extra Hint Slot)");
            const bonusPrompt =
              `${contextPrefix}\n` +
              `BONUS HINT MODE — User unlocked an EXTRA hint via the Store.\n` +
              `Give a SPECIFIC, targeted hint pointing precisely at what's missing in their code.\n\n` +
              `[JAVA CODE CONTEXT]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\``;
            const hint = await aiChat(currentCode, bonusPrompt, problemId, history, problemDescription, chatContext);
            addMessage("assistant", `### ✨ Bonus Hint (from your Extra Hint Slot)\n\n${hint}`);
          } else {
            addMessage("user", "💡 Hint");
            addMessage(
              "assistant",
              `### All 4 hints used\n\nYou've used the maximum of 4 hints. Buy **Extra Hint Slot** in the Store for a bonus targeted hint.`,
            );
          }
        } else {
          const nextLevel = hintLevel + 1;
          addMessage("user", `💡 Hint ${nextLevel} of 4`);
          const prompt =
            `${contextPrefix}\n` +
            `HINT MODE — Give ONLY hint #${nextLevel} of 4 (progressive).\n\n` +
            `[JAVA CODE CONTEXT]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\`\n\n` +
            `Hint 1 = nudge about the data structure / pattern to consider.\n` +
            `Hint 2 = describe the high-level approach in 2–3 sentences (no code).\n` +
            `Hint 3 = outline the algorithm steps as a short bullet list (no code).\n` +
            `Hint 4 = pseudocode-level outline (still no full Java solution).\n` +
            `Return ONLY hint ${nextLevel}. Do not include other hints. Keep it short and focused.`;
          const hint = await aiChat(currentCode, prompt, problemId, history, problemDescription, chatContext);
          addMessage(
            "assistant",
            `### 💡 Hint ${nextLevel} of 4\n\n${hint}\n\n_${4 - nextLevel} hint${4 - nextLevel === 1 ? "" : "s"} remaining._`,
          );
          setHintLevel(nextLevel);
        }
      } else if (text === "__optimal__" || text === "__solution_optimal__") {
        addMessage("user", "🏆 Optimal Approach");
        const prompt =
          `${contextPrefix}\n` +
          `OPTIMAL APPROACH MODE.\n\n` +
          `[JAVA CODE CONTEXT]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\`\n\n` +
          `Respond in this exact structure:\n` +
          `### 🏆 Optimal Approach: <name of the approach / algorithm>\n` +
          `**Time:** O(...)  •  **Space:** O(...)\n\n` +
          `**Why this is optimal:** 2–3 sentences.\n\n` +
          `**Logic / intuition:**\n` +
          `- step-by-step bullet list explaining the algorithm in plain English.\n\n` +
          `**Key data structures:** comma-separated list.\n\n` +
          `IMPORTANT: If NOT in tutor mode, you MUST include a complete code block at the end. If IN tutor mode, do NOT include any code.`;
        const result = await aiChat(currentCode, prompt, problemId, history, problemDescription, chatContext);
        addMessage("assistant", result);
      } else if (text === "__mistakes__") {
        addMessage("user", "🐛 Find Bugs");
        const prompt =
          `${contextPrefix}\n` +
          `BUG-FINDING MODE — report GENUINE bugs only.\n\n` +
          `[JAVA CODE TO REVIEW]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\`\n\n` +
          `A genuine bug = the code fails to compile, throws at runtime, produces a wrong answer for some valid input, ` +
          `misses an edge case that the problem constraints actually allow, or exceeds the required complexity.\n\n` +
          `DO NOT report: style, naming, formatting, comments, missing javadoc, "could be more readable", ` +
          `input validation the problem does not require, defensive null checks for inputs the constraints guarantee, ` +
          `micro-optimizations, or preference-based suggestions. Do not invent hypothetical problems.\n\n` +
          `Before listing anything, mentally trace the code on the problem's examples. Only list an issue if you can name ` +
          `a concrete input that breaks it (or an exact compile/runtime failure).\n\n` +
          `If the code is correct, reply exactly: "### ✅ No genuine bugs found" plus one sentence on why it is correct.\n\n` +
          `Otherwise, for each real bug output:\n` +
          `  • **Location:** line number or method + the offending snippet (≤ 1 line).\n` +
          `  • **Type:** compile error / runtime error / logic bug / edge-case miss / complexity.\n` +
          `  • **Failing input:** a concrete input that breaks it (or the exact error).\n` +
          `  • **Why it's wrong:** 1–2 sentences.\n` +
          `  • **Fix:** short description` + (`\n\n`) +
          `  - If NOT in tutor mode, you MAY add a 2–3 line code fix per bug. In tutor mode, no code.`;
        const result = await aiChat(currentCode, prompt, problemId, history, problemDescription, chatContext);

        addMessage("assistant", result);
      } else if (text === "__patterns__") {
        addMessage("user", "📚 Patterns");
        const prompt =
          `${contextPrefix}\n` +
          `PATTERN ANALYSIS MODE.\n\n` +
          `[JAVA CODE CONTEXT]\n\`\`\`java\n${currentCode || '// No code provided'}\n\`\`\`\n\n` +
          `Respond in this exact structure (markdown):\n\n` +
          `### 📚 Patterns Applicable to This Problem\n` +
          `Bullet list of every relevant DSA pattern.\n\n` +
          `### 🔍 Pattern Detected in Your Code\n` +
          `Name the pattern the user is currently using.\n\n` +
          `### ✅ Is It Optimal?\n` +
          `Compare and give a verdict (Optimal / Sub-optimal / Brute-force).`;
        const result = await aiChat(currentCode, prompt, problemId, history, problemDescription, chatContext);
        addMessage("assistant", result);
      } else if (text === "__generate_tests__" || text === "__testcases__") {
        addMessage("user", "🧪 Generate Test Cases");
        addMessage(
          "assistant",
          `Generating test cases and adding them to the **Tests** tab. They'll run together with the built-in cases when you click **Run Tests** or **Submit**.`,
        );
      } else {
        addMessage("user", text);
        const response = await aiChat(currentCode, finalPrompt, problemId, history, problemDescription, chatContext);
        addMessage("assistant", response);
      }

    } catch (err: any) {
      console.error("AI Chat Error:", err);
      addMessage(
        "system",
        `⚠️ ${err.message || "AI service is temporarily unavailable."}`,
      );
    }

    setIsLoading(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setHintLevel(0);
    if (problemId) {
      localStorage.removeItem(`ai-chat-history-${problemId}`);
    }
    window.speechSynthesis.cancel();
  };

  return (
    <div className="flex h-full flex-col bg-ide-sidebar overflow-hidden relative">
      <div className="flex items-center justify-between border-b border-panel-border bg-gradient-to-r from-background to-secondary/10 px-4 py-3 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
            <Brain className="h-4 w-4 text-primary animate-pulse relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary leading-none drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]">
              AI Architect
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              High-Level Java Mentor
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-full transition-all duration-300 ${isVoiceEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                title="Voice Settings"
              >
                {isVoiceEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-72 p-0 bg-ide-sidebar/95 backdrop-blur-2xl border-panel-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] rounded-2xl" 
              align="end"
              sideOffset={8}
            >
              <div className="p-4 border-b border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/20">
                      <Volume2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Speech Engine</h4>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">Configure your personal Java mentor's voice</p>
              </div>

              <div className="p-4 space-y-5">
                <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground ml-1">Enable Voice</span>
                  <Button
                    variant={isVoiceEnabled ? "default" : "secondary"}
                    size="sm"
                    className="h-7 px-3 text-[10px] rounded-lg font-bold transition-all"
                    onClick={() => {
                      setIsVoiceEnabled(!isVoiceEnabled);
                      if (isVoiceEnabled) window.speechSynthesis.cancel();
                      toast.info(`Voice Tutor ${!isVoiceEnabled ? "Enabled" : "Disabled"}`);
                    }}
                  >
                    {isVoiceEnabled ? "ON" : "OFF"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-[9px] text-primary uppercase font-black tracking-widest">Select Voice Profile</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="h-9 text-[11px] bg-background/40 border-panel-border rounded-xl focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="Select Voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-ide-sidebar border-panel-border rounded-xl z-[150]">
                      {availableVoices.map(v => {
                        const isFemale = v.name.toLowerCase().includes("female") || 
                                         v.name.toLowerCase().includes("zira") || 
                                         v.name.toLowerCase().includes("samantha") ||
                                         v.name.toLowerCase().includes("aria");
                                         
                        const label = `English (${isFemale ? "Female" : "Male"})`;
                        
                        return (
                          <SelectItem key={v.name} value={v.name} className="text-[11px] focus:bg-primary/10">
                            <div className="flex flex-col">
                              <span className="font-bold text-primary">{label}</span>
                              <span className="opacity-40 text-[9px]">{v.name.split(' - ')[0]}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-primary uppercase font-black tracking-widest">
                      <Label>Speed</Label>
                      <span className="opacity-60">{voiceRate.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[voiceRate]}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      onValueChange={([v]) => setVoiceRate(v)}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-primary uppercase font-black tracking-widest">
                      <Label>Pitch</Label>
                      <span className="opacity-60">{voicePitch.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[voicePitch]}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      onValueChange={([v]) => setVoicePitch(v)}
                      className="py-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-primary/5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground font-bold">JDK 17+ Optimized</span>
                <div className="flex gap-1">
                   <div className={`h-1.5 w-1.5 rounded-full ${isVoiceEnabled ? "bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30"}`} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-full transition-all duration-300 ${isTutorMode ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground"}`}
            onClick={() => {
              setIsTutorMode(!isTutorMode);
              toast.success(
                `Tutor Mode ${!isTutorMode ? "Enabled" : "Disabled"}`,
              );
            }}
            title="Toggle Tutor Mode (Socratic Method)"
          >
            <GraduationCap className="h-3.5 w-3.5" />
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={clearChat}
              title="Clear workspace"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <div
            className={`h-2 w-2 rounded-full ${checking ? "bg-secondary animate-pulse" : backendOnline ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-panel-border">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center px-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative p-7 rounded-3xl border border-primary/20 bg-card/10 backdrop-blur-md shadow-2xl">
                <Brain className="h-14 w-14 text-primary/40" />
              </div>
            </div>
            <div className="max-w-[220px] space-y-2">
              <p className="text-sm font-black text-foreground tracking-tight italic">
                E P I C A I M O D E
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                I can explain logic, hunt bugs, and even{" "}
                <span className="text-primary font-bold underline decoration-primary/30">
                  visualize your code
                </span>
                . How can I assist?
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onInsertCode={handleInsertCode}
            onRepeat={(text) => {
              window.speechSynthesis.cancel();
              // SMART SPEECH CLEANING for re-play
              const smartText = text
                .replace(/```[\s\S]*?```/g, " [Code block skipped] ")
                .replace(/`([^`]+)`/g, "$1")
                .replace(/[#*_-]/g, "")
                .trim();

              const utterance = new SpeechSynthesisUtterance(smartText);
              utterance.rate = voiceRate;
              utterance.pitch = voicePitch;
              const voice = availableVoices.find(v => v.name === selectedVoice);
              if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang;
              }
              window.speechSynthesis.speak(utterance);
              toast.info("Replaying smart speech...");
            }}
          />
        ))}

        {isLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-3 px-1">
            <div className="flex items-center gap-2 text-[10px] text-primary font-bold uppercase tracking-widest">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing Epic Insights...
            </div>
            <Skeleton className="h-4 w-full rounded-full bg-primary/10" />
            <Skeleton className="h-4 w-5/6 rounded-full bg-primary/5" />
            <Skeleton className="h-4 w-4/6 rounded-full bg-primary/5" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick-action chip strip removed by design — all AI features now live
          in the upper "AI" dropdown in the workspace header. */}


      <div className="p-3 bg-ide-sidebar border-t border-panel-border backdrop-blur-2xl pb-safe">
        <div className="relative group transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl overflow-hidden shadow-sm border border-white/5 inset-shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about Java..."
            rows={1}
            className="w-full resize-none border-none bg-secondary/20 px-4 py-3.5 pr-14 text-xs placeholder:text-muted-foreground/50 focus:outline-none scrollbar-none min-h-[50px] max-h-[150px]"
          />
          <div className="absolute bottom-2.5 right-2.5">
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 rounded-xl bg-primary shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 group-hover:shadow-primary/40"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[9px] text-center text-muted-foreground/40 font-bold uppercase tracking-tighter">
          Epic AI • Context-aware for {problemId || "current workspace"}
        </p>
      </div>
    </div>
  );
};

export default AIChatPanel;
