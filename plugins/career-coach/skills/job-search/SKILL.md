---
name: job-search
description: This skill should be used when the user asks about "resume", "resume review", "ATS optimization", "applicant tracking system", "cover letter", "job search", "job application", "LinkedIn profile", "networking", "informational interview", "keyword optimization", "action verbs", "resume formatting", "job description", "career search", or mentions improving their resume, applying for jobs, or optimizing application materials. Provides resume writing frameworks, ATS optimization rules, and job search strategy tools.
version: 1.0.0
tags: [career, resume, job-search, ats, networking]
---

# Job Search

## Overview

Provide structured guidance for job search strategy, resume optimization, and professional networking. Covers resume construction, ATS compatibility, cover letters, LinkedIn, and networking approaches. All guidance is framework-based — adapt to your industry, experience level, and target roles.

> **Disclaimer**: Resume and job search advice varies by industry and region. These frameworks cover common patterns across most professional fields. Specialized fields (academia, federal government, creative industries) have additional conventions not fully covered here.

## Resume Structure Framework

### Section Ordering by Career Stage

**Entry-level (0-3 years):**
Contact → Summary/Objective → Education → Experience → Skills → Projects/Activities

**Mid-career (3-10 years):**
Contact → Summary → Experience → Skills → Education → Certifications

**Senior/Executive (10+ years):**
Contact → Executive Summary → Key Achievements → Experience → Education → Board/Advisory Roles

### Formatting Rules

- One page for <10 years experience, two pages max for 10+
- Consistent date formatting (Month Year or Year only — pick one)
- Standard section headers (Experience, Education, Skills — not creative alternatives)
- 10-12pt font, 0.5-1" margins, no columns or tables (ATS compatibility)
- No photos, graphics, or icons (unless creative/design industry)
- PDF format for submission unless specifically asked for .docx

## ATS Optimization

Applicant Tracking Systems parse resumes before a human sees them. Understanding how they work is essential for getting past the initial screen.

### How ATS Works

1. Parser extracts text from the document
2. Fields are mapped to structured data (name, email, work history, education)
3. Keywords from the resume are matched against the job description
4. A relevance score determines whether the resume reaches a human reviewer

### What Breaks ATS Parsers

- Tables, columns, text boxes, headers/footers — content gets scrambled or lost
- Images, icons, graphs — invisible to text extraction
- Creative section headers — "Where I've Been" instead of "Experience"
- Non-standard file formats — always use .pdf or .docx

### Keyword Matching Rules

- **Exact match matters**: "project management" in JD needs "project management" in resume, not just "managed projects"
- **Include both acronyms and full terms**: "PMP (Project Management Professional)"
- **Mirror the JD's language**: if they say "cross-functional collaboration," use that phrase, not a synonym
- **Skills section is keyword-dense**: list technical skills, tools, certifications explicitly
- **Frequency signals importance**: if a term appears 3x in the JD, it should appear in your resume

Use `scripts/resume_keyword_analyzer.py` to compare your resume against a job description and identify keyword gaps.

See `references/ats-keyword-guide.md` for keyword taxonomies by field and detailed formatting rules.

## Impact-Driven Bullet Points

Every bullet should follow this formula:

**Action Verb + What You Did + Measurable Result**

| Weak | Strong |
|------|--------|
| Responsible for managing team | Led cross-functional team of 8 engineers to deliver platform migration 2 weeks ahead of schedule |
| Helped with customer issues | Resolved 150+ customer escalations monthly, improving satisfaction scores from 3.2 to 4.6 |
| Worked on the marketing campaign | Designed and executed email campaign reaching 50K subscribers, generating $200K in pipeline |

### Impact Metrics to Include

- Revenue generated or influenced
- Cost savings or efficiency gains
- Time saved (hours, days, percentage)
- Scale (users served, transactions processed, team size)
- Quality improvements (error reduction, satisfaction scores)
- Growth (percentage increases, before/after comparisons)

See `references/resume-action-verbs.md` for verbs organized by impact type and a weak verb blacklist.

## Cover Letter Structure

Three paragraphs, each with a specific purpose:

**Paragraph 1 — Hook**: Why this specific role at this specific company interests you. Reference something concrete — a product, mission, recent news, mutual connection. Not "I'm excited to apply for the position."

**Paragraph 2 — Evidence**: 2-3 specific accomplishments that directly map to the role's key requirements. Use the same impact-driven format as resume bullets. This is the "why you should hire me" paragraph.

**Paragraph 3 — Close**: Reiterate enthusiasm, mention availability, thank them. Keep it brief.

Total length: under one page, 250-400 words. Match the tone to the company culture — formal for finance/law, conversational for startups.

## LinkedIn Optimization

### Headline Formula

`[Current Title] | [Value Proposition] | [Key Expertise]`

Examples:
- "Senior Product Manager | Building B2B SaaS Products Users Love | Data-Driven Decision Making"
- "Software Engineer | Full-Stack TypeScript & Python | Open Source Contributor"

Not: "Seeking New Opportunities" or just your job title.

### About Section

- First 2-3 lines are visible before "see more" — make them count
- Write in first person, conversational tone
- Cover: what you do, what you're known for, what you're looking for
- Include keywords naturally (recruiters search LinkedIn like a search engine)
- 200-300 words optimal

### Skills Section

- Add up to 50 skills — prioritize the ones most relevant to your target roles
- Pin your top 3 skills (these show first)
- Include both broad ("Data Analysis") and specific ("Tableau", "SQL", "Python") skills

## Networking Strategy

### The Hidden Job Market

An often-cited estimate suggests 70-80% of positions are filled through networking and referrals before or alongside public postings, though the exact figure is debated. Networking isn't optional — it's the primary job search channel.

### Approach Types

**Warm outreach** — People you know or share a connection with:
- Former colleagues, classmates, mutual connections
- LinkedIn "2nd degree" connections with a shared group or company
- Conference/event contacts

**Cold outreach** — People you don't know but want to learn from:
- Informational interviews (not job asks — learning conversations)
- Alumni networks (shared school is a strong connector)
- Industry community members (Slack groups, meetups, forums)

### Informational Interviews

The most underused job search tool. 20-30 minute conversations to learn about a role, company, or industry — not to ask for a job.

Key rules:
- Ask to learn, not for a job
- Prepare 5-7 specific questions
- Respect the time limit
- Follow up with a thank-you within 24 hours
- Share something useful in return when possible

See `references/networking-scripts.md` for LinkedIn message templates, informational interview questions, and follow-up cadences.

## Keyword Analysis Workflow

When a user provides both a resume and job description:

1. Run `scripts/resume_keyword_analyzer.py` to get match rate and missing keywords
2. Review the top missing keywords — prioritize those that appear most frequently in the JD
3. For each missing keyword, suggest where in the resume it could be added naturally
4. Check for semantic synonyms the tool can't catch (e.g., "managed" vs "led" vs "oversaw")
5. Rerun after edits to verify improvement

## Tools

- `scripts/resume_keyword_analyzer.py` — Compare resume keywords against job description, report match rate and gaps

## References

- `references/ats-keyword-guide.md` — ATS parsing mechanics, formatting rules, keyword taxonomies by field
- `references/resume-action-verbs.md` — Action verbs by impact type, weak verb blacklist
- `references/networking-scripts.md` — LinkedIn templates, informational interview scripts, follow-up cadences
