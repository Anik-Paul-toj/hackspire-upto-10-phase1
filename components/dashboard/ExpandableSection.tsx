"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ExpandableSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: 'default' | 'alert' | 'success' | 'warning';
  actions?: React.ReactNode;
}

export function ExpandableSection({
  title,
  icon,
  badge,
  children,
  defaultExpanded = true,
  variant = 'default',
  actions
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantStyles = {
    default: 'border-l-blue-500 bg-blue-50/30',
    alert: 'border-l-red-500 bg-red-50/30',
    success: 'border-l-green-500 bg-green-50/30',
    warning: 'border-l-yellow-500 bg-yellow-50/30'
  };

  const headerBgStyles = {
    default: 'bg-blue-50/50',
    alert: 'bg-red-50/50',
    success: 'bg-green-50/50',
    warning: 'bg-yellow-50/50'
  };

  return (
    <Card className={`border-l-4 ${variantStyles[variant]} shadow-sm hover:shadow-md transition-all duration-200`}>
      <CardHeader 
        className={`pb-3 cursor-pointer ${headerBgStyles[variant]} border-b select-none`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <div className="shrink-0">{icon}</div>}
            <CardTitle className="text-sm sm:text-base font-bold truncate">
              {title}
            </CardTitle>
            {badge !== undefined && (
              <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ${
                variant === 'alert' ? 'bg-red-100 text-red-800 border border-red-300' :
                variant === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
                variant === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                'bg-blue-100 text-blue-800 border border-blue-300'
              }`}>
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/50"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <CardContent className="pt-4">
          {children}
        </CardContent>
      </div>
    </Card>
  );
}
