"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  stats: {
    activeAlerts: number;
    totalTourists: number;
    verifiedAlerts: number;
    resolvedAlerts: number;
  };
}

export function DashboardSidebar({
  isCollapsed,
  onToggle,
  activeSection,
  onSectionChange,
  stats
}: DashboardSidebarProps) {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      badge: null
    },
    {
      id: 'map',
      label: 'Live Map',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      badge: null
    },
    {
      id: 'sos',
      label: 'SOS Alerts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      badge: stats.activeAlerts,
      badgeColor: 'bg-red-500 text-white'
    },
    {
      id: 'tourists',
      label: 'Tourists',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      badge: stats.totalTourists,
      badgeColor: 'bg-green-500 text-white'
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      badge: stats.verifiedAlerts,
      badgeColor: 'bg-blue-500 text-white'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      badge: null
    }
  ];

  return (
    <aside
      className={`
        sticky top-0 left-0 h-screen
        bg-white border-r border-gray-200 shadow-lg
        transition-all duration-300 ease-in-out z-40
        ${isCollapsed ? 'w-16' : 'w-64'}
        overflow-hidden shrink-0
      `}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <div className={`p-3 border-b border-gray-200 flex ${isCollapsed ? 'justify-center' : 'justify-between items-center'}`}>
          {!isCollapsed && (
            <h2 className="font-bold text-gray-900 text-sm tracking-tight">Navigation</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="hover:bg-gray-100 h-8 w-8 p-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200 group relative
                ${activeSection === item.id
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }
                ${isCollapsed ? 'justify-center' : 'justify-start'}
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={`shrink-0 ${activeSection === item.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-900'}`}>
                {item.icon}
              </span>
              
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium text-sm">
                    {item.label}
                  </span>
                  {item.badge !== null && item.badge > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      activeSection === item.id 
                        ? 'bg-white/20 text-white' 
                        : item.badgeColor
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {isCollapsed && item.badge !== null && item.badge > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] rounded-full font-bold ${item.badgeColor} shadow-lg`}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Stats (when expanded) */}
        {!isCollapsed && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Active Alerts</span>
                <span className="font-bold text-red-600">{stats.activeAlerts}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Tourists</span>
                <span className="font-bold text-green-600">{stats.totalTourists}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Resolved</span>
                <span className="font-bold text-gray-600">{stats.resolvedAlerts}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
