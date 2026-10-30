import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGatewayFetch } from "../_shared/ai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code } = await req.json();

    const response = await aiGatewayFetch("recursion-tree", req, {
        messages: [
          {
            role: "system",
            content: `You are a recursion visualization expert. Given Java code containing recursive functions, generate a visual recursion tree using ASCII art.

For each recursive call, show:
1. The function name and arguments
2. The return value
3. The tree structure showing parent-child call relationships

Format the tree like:
\`\`\`
fib(5)
├── fib(4)
│   ├── fib(3)
│   │   ├── fib(2) → 1
│   │   └── fib(1) → 1
│   │   = 2
│   └── fib(2) → 1
│   = 3
└── fib(3)
    ├── fib(2) → 1
    └── fib(1) → 1
    = 2
= 5
\`\`\`

After the tree, explain:
- Total recursive calls made
- Which calls are repeated (overlapping subproblems)
- Time complexity based on the tree structure
- How memoization/DP could optimize it

Use small input values to keep the tree readable. Be thorough but concise.`
          },
          {
            role: "user",
            content: `Visualize the recursion tree for this Java code:\n\n${code}`
          }
        ],
        stream: true,
      });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("recursion-tree error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
