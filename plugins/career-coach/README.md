# Career Coach Plugin

A Claude Code plugin for career development coaching — career exploration, resume optimization, STAR interview practice, salary negotiation, and career pathing using established coaching frameworks.

> **Disclaimer**: This plugin provides career coaching frameworks, not professional counseling. All guidance follows ICF (International Coach Federation) ethical principles. For significant career decisions with financial or legal implications, consider working with a certified career coach or counselor.

## What's Included

### Skills (3)

**Career Development** — GROW coaching model, Holland RIASEC interest assessment, Skill-Will Matrix, IC vs Management decision framework, NACE competency self-assessment, career transition planning (transferable skills, gap analysis, bridge roles).

**Job Search** — Resume structure by career stage, ATS optimization (parsing mechanics, formatting rules, keyword matching), impact-driven bullet points, cover letter framework, LinkedIn optimization, networking strategy (informational interviews, outreach scripts).

**Interview Prep** — STAR method with 20/10/60/10 pacing rule, story bank development, interview type guides (behavioral, situational, case, panel), mock interview process, salary negotiation framework, offer evaluation with total comp comparison.

### Agents (3)

**career-coach** — Orchestrator agent for career exploration and pathing. Routes to frameworks based on user need: GROW model for exploration, RIASEC for interest assessment, career ladders for IC vs management decisions, transition planning for career changers. Triggers on career direction, professional development, and growth questions.

**resume-reviewer** — Autonomous resume analyst. Reads resume content, runs keyword analysis against job descriptions, evaluates structure and ATS compatibility, scores bullet point impact, and generates prioritized recommendations. Triggers on resume files, paste content, or ATS optimization requests.

**mock-interviewer** — Interactive interview coach with two modes: STAR practice (question selection, response scoring, per-component feedback, session summaries) and salary negotiation roleplay (hiring manager simulation with objection scripts and debriefing). Triggers on interview preparation and mock practice requests.

### Scripts (4)

| Script | Purpose |
|--------|---------|
| `career-development/scripts/riasec_scorer.py` | Score RIASEC interest assessment, generate Holland code |
| `job-search/scripts/resume_keyword_analyzer.py` | Compare resume keywords against job description, report gaps |
| `interview-prep/scripts/salary_comparator.py` | Compare job offers with Year 1 vs Year 2+ breakdown |
| `interview-prep/scripts/star_scorer.py` | Heuristic STAR response scoring with per-component feedback |

### Reference Files (9)

| File | Content |
|------|---------|
| `career-development/references/grow-model.md` | GROW phases, coaching questions, facilitation tips |
| `career-development/references/riasec-framework.md` | Six Holland types, self-assessment questions, career families |
| `career-development/references/career-ladder-templates.md` | IC and management ladders, Skill-Will Matrix, IC vs Mgmt decision guide |
| `job-search/references/ats-keyword-guide.md` | ATS parsing mechanics, formatting rules, keyword taxonomies by field |
| `job-search/references/resume-action-verbs.md` | Action verbs by impact type, weak verb blacklist, impact formula |
| `job-search/references/networking-scripts.md` | LinkedIn templates, informational interview scripts, follow-up cadences |
| `interview-prep/references/behavioral-question-bank.md` | 57 behavioral questions organized by competency |
| `interview-prep/references/salary-negotiation-playbook.md` | Objection-handling scripts, email templates, negotiation tactics |
| `interview-prep/references/star-rubric.md` | 1-5 scoring rubric per STAR component with examples |

## Installation

Add to your Claude Code configuration:

```bash
claude --plugin-dir /path/to/claudestuff/plugins/career-coach
```

Or add to `.claude/settings.json`:

```json
{
  "plugins": ["/path/to/claudestuff/plugins/career-coach"]
}
```

## Usage Examples

**Career Exploration:**
- "I've been a software engineer for 5 years and I'm not sure what's next"
- "Should I go into management or stay on the IC track?"
- "I want to switch from teaching to tech — where do I start?"

**Resume & Job Search:**
- "Here's my resume and the JD — how well do I match?"
- "Review my resume for ATS compatibility"
- "Help me rewrite my bullet points to be more impactful"

**Interview Prep:**
- "I have a behavioral interview at Amazon next week — let's practice"
- "Can we do a mock interview? I want to get better at STAR answers"
- "I got an offer and want to practice negotiating before the call"

**Salary & Offers:**
- "Compare these two job offers side by side"
- "How should I negotiate a higher base salary?"
- "What should I focus on besides base pay?"

## Scripts

All scripts run with `uv` and require Python 3.12+. No external dependencies.

```bash
# RIASEC interest assessment
uv run skills/career-development/scripts/riasec_scorer.py --responses '{"R":4,"I":9,"A":6,"S":5,"E":7,"C":3}' --mode rate

# Resume keyword analysis
uv run skills/job-search/scripts/resume_keyword_analyzer.py --inline-resume 'Your resume text...' --inline-jd 'Job description text...'

# Salary comparison
uv run skills/interview-prep/scripts/salary_comparator.py --base 100000 --options '[{"name":"Acme","base":120000,"bonus_pct":10,"equity_annual":15000,"signing_bonus":10000}]'

# STAR response scoring
uv run skills/interview-prep/scripts/star_scorer.py --response 'In my previous role...' --competency leadership --verbose
```

## Philosophy

This plugin follows core principles:

- **Coaching over prescribing** — present frameworks and ask questions, don't dictate answers
- **ICF ethical principles** — client autonomy, non-directive exploration, bias awareness
- **Honest and direct** — build confidence while being straightforward about gaps
- **Action-oriented** — every conversation ends with something concrete to do
- **Know your limits** — transparent about what AI coaching can and cannot do
