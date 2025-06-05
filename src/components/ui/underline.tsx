import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { Suggestion } from "~/schemas/writingCoach";
import { CATEGORY_CONFIG } from "~/schemas/writingCoach";

interface UnderlineProps {
  children: React.ReactNode;
  suggestion: Suggestion;
  onApply?: () => void;
}

export function Underline({ children, suggestion, onApply }: UnderlineProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const categoryConfig = CATEGORY_CONFIG[suggestion.category];
  
  // Generate underline colors based on category
  const getUnderlineColor = (category: string) => {
    const colorMap: Record<string, string> = {
      go_deeper: "decoration-blue-500 hover:decoration-blue-600",
      be_specific: "decoration-purple-500 hover:decoration-purple-600", 
      technical_terms: "decoration-green-500 hover:decoration-green-600",
      constructive_tone: "decoration-yellow-500 hover:decoration-yellow-600",
      actionable: "decoration-orange-500 hover:decoration-orange-600",
      clarity: "decoration-gray-500 hover:decoration-gray-600",
      balance: "decoration-pink-500 hover:decoration-pink-600",
      focus: "decoration-indigo-500 hover:decoration-indigo-600"
    };
    return colorMap[category] || "decoration-gray-500 hover:decoration-gray-600";
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`
              relative inline-block cursor-pointer transition-all duration-200
              underline decoration-2 underline-offset-2 decoration-dashed
              ${getUnderlineColor(suggestion.category)}
              hover:scale-[1.02] hover:shadow-sm
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onApply}
          >
            {/* Original text with conditional strikethrough on hover */}
            <span className={`transition-all duration-200 ${isHovered ? 'opacity-40 line-through' : ''}`}>
              {children}
            </span>
            
            {/* Replacement text that fades in on hover */}
            {isHovered && (
              <span className="absolute inset-0 transition-all duration-200 animate-in fade-in-0">
                {suggestion.replacement}
              </span>
            )}
          </span>
        </TooltipTrigger>
        
        <TooltipContent 
          className={`max-w-xs p-3 border-2 transition-all duration-200 ${categoryConfig.bgColor}`}
          side="top"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{categoryConfig.icon}</span>
              <span className={`text-xs font-semibold uppercase tracking-wide ${categoryConfig.color}`}>
                {categoryConfig.label}
              </span>
            </div>
            
            <p className="text-sm font-medium text-gray-900">
              {suggestion.explanation}
            </p>
            
            <div className="border-t pt-2">
              <p className="text-xs text-gray-600 mb-1">Suggested improvement:</p>
              <p className="text-sm font-medium text-gray-900 bg-white rounded px-2 py-1 border">
                "{suggestion.replacement}"
              </p>
            </div>
            
            <p className="text-xs text-gray-500 italic">
              Click to apply • {categoryConfig.description}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}