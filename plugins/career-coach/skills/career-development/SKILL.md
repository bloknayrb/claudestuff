---
name: career-development
description: This skill should be used when the user asks about "career exploration", "career path", "career change", "career transition", "what should I do with my career", "IC vs management", "should I go into management", "GROW model", "RIASEC", "Holland code", "career ladder", "skill assessment", "career readiness", "transferable skills", or mentions career coaching, career direction, or professional development planning. Provides career coaching frameworks, interest assessments, and career pathing tools.
version: 1.0.0
tags: [career, coaching, development, pathing, assessment]
---

# Career Development

## Overview

Provide structured career development coaching using established frameworks. Help users explore career interests, evaluate transitions, compare IC vs management paths, and build development plans. All guidance is educational — frameworks and self-reflection tools, not prescriptive career advice.

> **Disclaimer**: This skill provides career coaching frameworks, not professional counseling. For significant career decisions, consider working with a certified career coach (ICF-credentialed) or career counselor.

## GROW Model

A structured coaching conversation framework (Goal → Reality → Options → Will) used by professional coaches worldwide. Progresses from clarifying what someone wants, through honest assessment of where they are, brainstorming options without judgment, to committing to specific actions with deadlines. Key principle: if commitment to an action is below 7/10, the action isn't right — adjust until commitment is genuine.

See `references/grow-model.md` for the full framework with 8-10 coaching questions per phase and facilitation tips.

## Holland RIASEC Interest Assessment

A framework for matching personality types to career environments. Everyone has a combination of all six types — the dominant 2-3 form a "Holland code" that maps to compatible career families.

| Type | Orientation | Environment |
|------|------------|-------------|
| **R**ealistic | Hands-on, practical | Physical tasks, tools, outdoors |
| **I**nvestigative | Analytical, curious | Research, problem-solving, data |
| **A**rtistic | Creative, expressive | Design, writing, performing |
| **S**ocial | Helping, teaching | People-focused, collaborative |
| **E**nterprising | Leading, persuading | Business, management, sales |
| **C**onventional | Organizing, detailed | Systems, processes, data management |

Use `scripts/riasec_scorer.py` to calculate a Holland code from user responses and get career family suggestions.

See `references/riasec-framework.md` for detailed type descriptions, combination interpretations, and self-assessment questions.

## Skill-Will Matrix

A 2x2 framework for assessing where someone stands on a particular skill or career move:

|  | **High Will** | **Low Will** |
|--|--------------|-------------|
| **High Skill** | Ready for autonomy — delegate and support | Bored/disengaged — needs new challenge or motivation |
| **Low Skill** | Eager learner — invest in development | Wrong fit — consider redirect |

Useful for evaluating: Should I pursue this path? Where should I invest development time? Why am I stuck?

## IC vs Management Decision Framework

A structured comparison for the most common career fork:

**Individual Contributor Track**: Jr → Mid → Senior → Staff → Principal → Distinguished
- Increasing technical depth, scope of influence, architectural authority
- Impact through expertise, mentorship, and technical leadership
- Direct hands-on work remains central to the role

**Management Track**: Tech Lead → Engineering Manager → Director → VP
- Increasing organizational scope, people responsibility, strategic authority
- Impact through team building, process design, and organizational health
- Hands-on work decreases; communication and decision-making increase

Key questions for the decision:
- What energizes you more — solving a hard technical problem or helping someone grow?
- Do you measure a good day by what you built or by how the team performed?
- Are you drawn to management because you want it, or because it seems like "the only way up"?

See `references/career-ladder-templates.md` for detailed skill expectations per level and a structured decision matrix.

## NACE Career Readiness Competencies

Eight competencies that employers consistently value, regardless of industry. Use for self-assessment and development planning:

1. **Critical Thinking** — Analyze information, evaluate options, make sound decisions
2. **Communication** — Clearly convey ideas in written and verbal form
3. **Teamwork** — Collaborate effectively across diverse groups
4. **Technology** — Leverage tools and platforms appropriately for the task
5. **Leadership** — Inspire and guide others toward a shared goal
6. **Professionalism** — Demonstrate integrity, accountability, and work ethic
7. **Career & Self-Development** — Proactively manage your own growth
8. **Equity & Inclusion** — Value diverse perspectives and create inclusive environments

Self-assessment approach: Rate each 1-5 (beginner to expert), identify the top 2 strengths and bottom 2 gaps, then build a development plan targeting the gaps with specific actions and timelines.

## Career Transition Planning

For career changers — a structured approach to moving between fields:

**Step 1: Transferable Skills Inventory**
Map current skills to target role requirements. Most skills transfer more than people expect:
- Project management → any industry
- Data analysis → any analytical role
- Client management → account management, customer success
- Teaching/training → L&D, product education, technical writing

**Step 2: Gap Analysis**
Compare your inventory to the target role's requirements. Categorize gaps as:
- Quick fills (online course, certification, side project — 1-3 months)
- Medium investment (bootcamp, part-time study — 3-12 months)
- Long-term (degree, extensive experience — 1-3 years)

**Step 3: Bridge Roles**
Often the shortest path isn't direct. Bridge roles combine existing expertise with target-field exposure:
- Teacher → Corporate Trainer → L&D Manager → HR Director
- Accountant → Financial Analyst → FP&A → Strategy
- Developer → Developer Advocate → Product Manager

**Step 4: Timeline and Milestones**
Set realistic timelines with checkpoints. Career transitions typically take 6-18 months for adjacent moves, 1-3 years for major pivots.

## Tools

- `scripts/riasec_scorer.py` — Calculate Holland code from interest ratings or rankings, with career family suggestions

## References

- `references/grow-model.md` — Full GROW coaching questions and facilitation guide
- `references/riasec-framework.md` — Detailed RIASEC types, combinations, and self-assessment
- `references/career-ladder-templates.md` — IC and management ladders with skill expectations per level
