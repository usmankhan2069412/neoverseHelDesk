# Neoverse AI Desk PRD

## Problem Statement
Support teams need premium tool for AI customer support, system monitoring, and knowledge management. Current tools lack visual excellence and integrated intelligence.

## Solution
Unified SaaS dashboard with futuristic UI. Core: Nura AI companion, real-time performance metrics, and archive management.

### Company Dashboard (Control Center)
The dashboard serves as the control center for Neoverse staff, providing real-time and daily metrics including:
- **Total Queries**: Count of queries received today.
- **Satisfaction Rate**: Resolution rate percentage and positive feedback ratio.
- **Unanswered / Escalated**: Number of queries flagged as unanswered or escalated.
- **Query Trends**: Hourly/daily volume charts showing query and resolution rates over time.
- **Top Recurring Issues**: Intent distribution and most frequently asked queries.
- **Knowledge Base Utilization**: Which documents are being used most in RAG retrieval.
- **Query Threads**: Admins can view individual query details including intent, sources, and timestamp.
- **Manual Resolution**: Admins can acknowledge, dismiss, or escalate flagged knowledge gaps.
- **Filters**: All data is filterable by date range (24h / 7d / 30d / all), query status (all / answered / unanswered), and searchable by query text.

## User Stories
1. As support agent, I want chat with Nura, so I get AI-driven query resolution.
2. As system admin, I want Control Center, so I monitor performance real-time.
3. As researcher, I want Archive, so I access historical knowledge base.
4. As user, I want Dark/Light mode, so interface comfortable in all conditions.
5. As user, I want responsive sidebar, so I maximize workspace real-estate.
6. As support lead, I want cinematic Nura interface, so customer trust and engagement increase.
7. As Neoverse admin, I want a real-time Company Dashboard in Control Center, so I can monitor daily query metrics including total queries received, satisfaction rates, unanswered/escalated counts, and resolution rate percentages.
8. As Neoverse admin, I want to view query trends over time and top recurring issues in the dashboard, so I can identify patterns and prioritize knowledge base improvements.
9. As Neoverse admin, I want to see which knowledge base documents are being used most frequently, so I can understand content utilization and identify gaps.
10. As Neoverse admin, I want to view individual query threads and manually resolve flagged queries, so I can ensure quality control and handle edge cases.
11. As Neoverse admin, I want to filter dashboard data by date range (24h, 7d, 30d, all), query type (status: all/answered/unanswered), and query intent, so I can focus on specific time periods and query categories.

## Implementation Decisions
- **Vite/React Shell**: Single entry `main.tsx`. `App.tsx` handle layout + view routing.
- **View Architecture**: Separate views for `FrontDesk`, `ControlCenter`, `Archive`.
- **Nura AI Component**: 3D mascot + CSS animations (float, glow, particles).
- **Design System**: Tailwind HSL variables + custom glassmorphism utilities.
- **State Management**: React `useState`/`useCallback`. Theme via `ThemeContext`.

## Testing Decisions
- **External Behavior Only**: Test view switching and chat response loops.
- **Performance**: Build check via `npm run build`.
- **Lints**: Validate via `npm run lint`.

## Out of Scope
- Backend implementation (mock data used).
- Multi-tenancy auth.
- External API integrations.

## Further Notes
Focus on premium aesthetics. Nura integration must feel like part of OS.
