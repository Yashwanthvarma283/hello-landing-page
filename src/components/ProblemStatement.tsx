import ReactMarkdown from 'react-markdown';
import type { ProblemDetail } from '@/lib/striver-problem-details';

type StatementDetail = ProblemDetail & { constraints?: string[]; hints?: string[]; approach?: string };

export default function ProblemStatement({ detail }: { detail: StatementDetail }) {
  return (
    <div className="space-y-8 min-w-0 text-sm leading-7 text-foreground">
      <section className="problem-prose min-w-0">
        <ReactMarkdown>{detail.description.replace(/\r\n/g, '\n')}</ReactMarkdown>
      </section>
      {detail.examples.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Examples</h3>
          {detail.examples.map((example, index) => (
            <div key={index} className="rounded-md border border-border bg-muted/40 p-4 space-y-4 min-w-0">
              <h4 className="text-sm font-semibold">Example {index + 1}</h4>
              <dl className="space-y-3">
                {(['input', 'output'] as const).map(field => (
                  <div key={field} className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground capitalize">{field}</dt>
                    <dd className="font-mono text-xs leading-6 whitespace-pre-wrap break-words">{example[field]}</dd>
                  </div>
                ))}
              </dl>
              {example.explanation && <div className="border-t border-border pt-3 problem-prose"><p className="text-xs font-medium text-muted-foreground mb-1">Explanation</p><ReactMarkdown>{example.explanation}</ReactMarkdown></div>}
            </div>
          ))}
        </section>
      )}
      {!!detail.constraints?.length && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Constraints</h3>
          <ul className="list-disc pl-5 space-y-2">
            {detail.constraints.map((constraint, index) => <li key={index} className="problem-prose text-xs leading-6"><ReactMarkdown>{constraint}</ReactMarkdown></li>)}
          </ul>
        </section>
      )}
      {!!detail.hints?.length && (
        <section className="divide-y divide-border border-y border-border">
          {detail.hints.map((hint, index) => (
            <details key={index} className="py-3">
              <summary className="cursor-pointer text-sm font-medium">Hint {index + 1}</summary>
              <div className="problem-prose mt-3 text-muted-foreground"><ReactMarkdown>{hint}</ReactMarkdown></div>
            </details>
          ))}
        </section>
      )}
      {detail.approach && <details className="border-t border-border pt-4"><summary className="cursor-pointer font-medium">Approach &amp; Complexity</summary><div className="problem-prose mt-4"><ReactMarkdown>{detail.approach}</ReactMarkdown></div></details>}
    </div>
  );
}