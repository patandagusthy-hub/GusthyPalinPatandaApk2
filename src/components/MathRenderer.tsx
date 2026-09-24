import React, { useMemo } from "react";
import katex from "katex";

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

/**
 * Splits text into plain text segments and LaTeX segments ($...$ or $$...$$).
 * Seamlessly renders LaTeX formulas using KaTeX with graceful error recovery.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  className = "",
  inline = false,
}) => {
  const renderedElements = useMemo(() => {
    if (!text && (text as unknown) !== 0) return null;
    const safeText = typeof text === "string" ? text : String(text || "");
    if (!safeText) return null;

    // Quick exit if no math markers or MathML are detected
    if (!safeText.includes("$") && !safeText.includes("\\(") && !safeText.includes("\\[") && !safeText.includes("<math")) {
      return <span>{safeText}</span>;
    }

    // Tokenize string for display math ($$..$$ or \[..\]) and inline math ($..$ or \(..\))
    // Regex matches:
    // 1) $$ ... $$ (display)
    // 2) \[ ... \] (display)
    // 3) $ ... $   (inline, non-empty)
    // 4) \( ... \) (inline)
    const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?!\$)[\s\S]+?\$|\\\([\s\S]+?\\\))/g;

    const parts = safeText.split(mathRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Display math $$...$$
      if (part.startsWith("$$") && part.endsWith("$$") && part.length >= 4) {
        const mathContent = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(mathContent, {
            displayMode: true,
            throwOnError: false,
            output: "htmlAndMathml",
          });
          return (
            <span
              key={index}
              className="my-2 block overflow-x-auto text-center font-serif text-blue-200"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code key={index} className="text-rose-400 font-mono text-xs">
              {part}
            </code>
          );
        }
      }

      // Display math \[...\]
      if (part.startsWith("\\[") && part.endsWith("\\]") && part.length >= 4) {
        const mathContent = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(mathContent, {
            displayMode: true,
            throwOnError: false,
            output: "htmlAndMathml",
          });
          return (
            <span
              key={index}
              className="my-2 block overflow-x-auto text-center font-serif text-blue-200"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code key={index} className="text-rose-400 font-mono text-xs">
              {part}
            </code>
          );
        }
      }

      // Inline math $...$
      if (part.startsWith("$") && part.endsWith("$") && part.length >= 2 && !part.startsWith("$$")) {
        const mathContent = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(mathContent, {
            displayMode: false,
            throwOnError: false,
            output: "htmlAndMathml",
          });
          return (
            <span
              key={index}
              className="inline-block px-1 font-serif text-blue-300"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code key={index} className="text-rose-400 font-mono text-xs">
              {part}
            </code>
          );
        }
      }

      // Inline math \(...\)
      if (part.startsWith("\\(") && part.endsWith("\\)") && part.length >= 4) {
        const mathContent = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(mathContent, {
            displayMode: false,
            throwOnError: false,
            output: "htmlAndMathml",
          });
          return (
            <span
              key={index}
              className="inline-block px-1 font-serif text-blue-300"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code key={index} className="text-rose-400 font-mono text-xs">
              {part}
            </code>
          );
        }
      }

      // Regular text (support standard line breaks)
      return <span key={index}>{part}</span>;
    });
  }, [text]);

  const Tag = inline ? "span" : "div";

  return <Tag className={className}>{renderedElements}</Tag>;
};
