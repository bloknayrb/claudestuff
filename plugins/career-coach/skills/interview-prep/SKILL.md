---
name: interview-prep
description: This skill should be used when the user asks about "interview preparation", "mock interview", "behavioral interview", "STAR method", "STAR format", "interview questions", "interview practice", "salary negotiation", "negotiate offer", "job offer evaluation", "compensation negotiation", "tell me about a time", "interview coaching", "panel interview", or mentions practicing for interviews, preparing answers, or evaluating job offers. Provides STAR method frameworks, mock interview process, salary negotiation strategies, and offer evaluation tools.
version: 1.0.0
tags: [career, interview, star-method, negotiation, salary]
---

# Interview Preparation

## Overview

Provide structured interview preparation covering the STAR method, story banking, mock interview practice, salary negotiation, and offer evaluation. All guidance uses established frameworks — adapt to your industry, level, and specific interview format.

> **Disclaimer**: Interview norms vary by company, industry, and region. These frameworks cover common patterns for professional roles. Highly specialized formats (case interviews, whiteboarding, portfolio reviews) have additional conventions beyond this skill's scope.

## STAR Method

The standard framework for behavioral interview answers. Every competency-based question expects this structure:

**Situation (20%)** — Set the scene briefly. When, where, what was the context?
- Keep it to 2-3 sentences
- Include enough context for the interviewer to understand the stakes
- Don't over-explain the company or project background

**Task (10%)** — What was YOUR specific responsibility?
- Use "I" not "we" — interviewers want to know YOUR role
- Be specific about what you were expected to deliver
- This should be 1-2 sentences max

**Action (60%)** — What did YOU do? This is the meat of the answer.
- Step-by-step walkthrough of your approach
- First-person language throughout: "I decided...", "I built...", "I coordinated..."
- Include decision-making rationale: "I chose X because..."
- Show problem-solving: obstacles faced and how you addressed them
- This should be the longest section by far

**Result (10%)** — What happened? What was the impact?
- Quantify whenever possible: numbers, percentages, timeframes
- Include both the direct outcome and any broader impact
- Add a reflection: "What I learned was..." or "If I did it again, I would..."
- Even if the outcome was negative, show what you learned

### Pacing Rule: 20/10/60/10

Candidates' most common mistake is spending too long on Situation and Task, leaving insufficient time for Action and Result. Practice timing: a 2-minute answer should spend ~70 seconds on Action.

## Building a Story Bank

Prepare 8-12 flexible stories that can be adapted to different competency questions. A good story bank covers:

### Core Competencies to Cover

| Competency | Sample Question Stem |
|-----------|---------------------|
| Leadership | "Tell me about a time you led a team..." |
| Teamwork | "Describe a situation where you collaborated..." |
| Conflict Resolution | "Tell me about a disagreement with a colleague..." |
| Problem-Solving | "Walk me through a complex problem you solved..." |
| Failure/Learning | "Tell me about a time something didn't go as planned..." |
| Communication | "Describe a time you had to explain something complex..." |
| Adaptability | "Tell me about a time you had to adjust to a major change..." |
| Initiative | "Describe a time you went above and beyond..." |

### Story-to-Competency Matrix

Each story should flex to 2-3 competencies. A story about leading a project through a crisis could demonstrate leadership, problem-solving, and adaptability. Map your stories to competencies in a grid to ensure full coverage.

See `references/behavioral-question-bank.md` for 57 behavioral questions organized by competency.

## Interview Types

### Behavioral
Questions about past behavior: "Tell me about a time when..." Use STAR method. This is the most common format for professional roles.

### Situational
Hypothetical scenarios: "What would you do if..." Think through the approach step by step. Draw on similar past experiences.

### Technical
Domain-specific knowledge and problem-solving. Format varies widely by field — coding challenges, case analyses, system design, portfolio reviews.

### Case
Structured problem-solving (common in consulting and strategy roles). Framework: clarify → structure → analyze → recommend.

### Culture/Values
Assessing alignment with company values: "What kind of work environment do you thrive in?" Be authentic — culture misalignment hurts both parties.

### Panel
Multiple interviewers simultaneously. Address the question-asker but make eye contact with all panelists. Note names and roles.

## Mock Interview Process

The structured practice loop for building interview skills:

1. **Select question** — Match to target role competencies (from `references/behavioral-question-bank.md`)
2. **Respond** — Answer as you would in a real interview (timed: aim for 90-120 seconds)
3. **Score** — Evaluate each STAR component using the rubric (from `references/star-rubric.md`)
4. **Feedback** — Specific, actionable notes per component (not just "good job")
5. **Retry or advance** — Option to try the same question again or move to the next
6. **Session summary** — After 3-5 questions, identify patterns and improvement areas

Use `scripts/star_scorer.py` for heuristic scoring of STAR responses.

See `references/star-rubric.md` for the 1-5 scoring rubric with criteria per level and examples.

## Salary Negotiation Framework

### Before the Negotiation

1. **Research the market** — Use levels.fyi, Glassdoor, Payscale, LinkedIn Salary Insights, and your network
2. **Know your range** — Bottom (walk-away number), target (what you'd be happy with), stretch (best case)
3. **Calculate total compensation** — Base + bonus + equity + benefits + perks. Compare apples to apples.
4. **Identify your leverage** — Competing offers, specialized skills, urgency to fill the role, internal equity

### During the Negotiation

**Anchoring**: Let them make the first offer if possible. If pressed for a number, give a range with your target as the bottom: "Based on my research, I'd expect $120K-$140K for this role."

**Never accept immediately**: "Thank you, I'm excited about this opportunity. I'd like to take a day to review the full package."

**Negotiate base first**: Base compounds over your career. A $5K base increase is worth far more than a $5K signing bonus over time.

**Use "we" language**: "How can we get closer to $X?" frames it as collaborative, not adversarial.

### Common Objections and Responses

| Objection | Response Strategy |
|-----------|------------------|
| "That's above our budget" | "I understand budgets have constraints. What flexibility exists in other areas — equity, signing bonus, review timeline?" |
| "We pay everyone at this level the same" | "I appreciate the structure. Could we discuss an accelerated review cycle or a signing bonus to bridge the gap?" |
| "This is our best offer" | "I'd like to understand the full package. Can you walk me through the bonus structure, equity vesting, and benefits?" |
| "What are you making now?" | "I'd prefer to focus on the value I'll bring to this role. Based on market data, I'm targeting the $X-Y range." |

See `references/salary-negotiation-playbook.md` for detailed objection scripts, email templates, and negotiation tactics.

## Offer Evaluation

When comparing offers, normalize to a common framework:

### Total Compensation (Annual)

| Component | Offer A | Offer B |
|-----------|---------|---------|
| Base salary | | |
| Annual bonus (expected) | | |
| Equity (annual vesting value) | | |
| Signing bonus (amortized over stay) | | |
| **Total Year 1** | | |
| **Total Year 2+** | | |

### Non-Monetary Factors

Rate each 1-5 and weight by personal importance:
- Work-life balance / flexibility
- Growth opportunity / learning
- Team and manager quality
- Company stability and trajectory
- Mission alignment
- Commute / location / remote policy
- Benefits (health, retirement match, PTO)

Use `scripts/salary_comparator.py` to generate formatted offer comparison tables.

### Decision Framework

If total comp is within 10% between offers, non-monetary factors should drive the decision. The best offer is the one that optimizes for your current priorities — which may be compensation, learning, flexibility, or career positioning.

## Tools

- `scripts/star_scorer.py` — Score STAR responses with heuristic rubric, per-component feedback
- `scripts/salary_comparator.py` — Compare job offers with Year 1 vs Year 2+ breakdown

## References

- `references/behavioral-question-bank.md` — 57 behavioral questions organized by competency
- `references/salary-negotiation-playbook.md` — Objection scripts, anchoring strategy, email templates
- `references/star-rubric.md` — 1-5 scoring rubric for each STAR component with examples
