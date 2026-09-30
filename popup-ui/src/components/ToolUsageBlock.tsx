import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ToolUsageEntry } from "../db";

interface ToolUsageBlockProps {
  entries: ToolUsageEntry[];
}

function ToolUsageBlock({ entries }: ToolUsageBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (entries.length === 0) return null;

  // Group consecutive entries into a single block

  return (
    <div
      style={{
        margin: "12px 0",
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        backgroundColor: "#f9f9f9",
        overflow: "hidden",
      }}
    >
      {/* Header - Click to expand/collapse */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#f0f0f0",
          borderBottom: isExpanded ? "1px solid #e0e0e0" : "none",
          userSelect: "none",
        }}
      >
        {isExpanded ? (
          <ChevronDown size={16} color="#666" />
        ) : (
          <ChevronRight size={16} color="#666" />
        )}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#555",
          }}
        >
          Tool Usage ({entries.length} action{entries.length !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Content - Tool usage logs */}
      {isExpanded && (
        <div
          style={{
            padding: "12px",
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.6",
            color: "#333",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {entries.map((entry, idx) => {
            const isToolResult = entry.type === "tool_result";
            const isThinking = entry.type === "thinking";

            return (
              <div
                key={idx}
                style={{
                  marginBottom: entry.type === "tool_result" ? "8px" : "2px",
                  paddingLeft: isToolResult ? "16px" : "0",
                  color: isThinking
                    ? "#888"
                    : isToolResult
                      ? "#666"
                      : "#333",
                  fontStyle: isThinking ? "italic" : "normal",
                }}
              >
                {entry.message}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ToolUsageBlock;
