# ATS Keyword Guide

Applicant Tracking Systems (ATS) are software platforms used by employers to manage job applications. Understanding how they work is essential for getting your resume past the initial automated screen.

## How ATS Parsing Works

1. **Text extraction** — The ATS reads your file and extracts raw text
2. **Field mapping** — Extracted text is mapped to structured fields (name, email, work history, education, skills)
3. **Keyword indexing** — Skills, titles, and qualifications are indexed
4. **Scoring/ranking** — Your resume is scored against the job description
5. **Human review** — Only resumes above a threshold reach a recruiter

## What Breaks ATS Parsers

### Formatting Issues (Avoid These)

| Problem | Why It Breaks | Fix |
|---------|--------------|-----|
| Tables and columns | Text extraction scrambles cell order | Use single-column layout |
| Text boxes | Content may be invisible to parser | Use standard paragraphs |
| Headers and footers | Many ATS skip these entirely | Put contact info in body |
| Images, icons, graphics | Invisible to text extraction | Remove all non-text elements |
| Fancy fonts or symbols | May not render correctly | Use standard fonts (Arial, Calibri, Times) |
| Creative section headers | "My Journey" instead of "Experience" | Use standard headers |
| Non-standard file formats | .pages, .odt may not parse | Use .pdf or .docx only |

### Safe Formatting

- **Font**: 10-12pt, standard fonts (Arial, Calibri, Georgia, Times New Roman)
- **Margins**: 0.5-1 inch
- **Layout**: Single column, no tables
- **Headers**: Standard names (see below)
- **Dates**: Consistent format (e.g., "Jan 2020 - Present" or "2020 - Present")
- **File type**: PDF (preferred) or .docx

### Standard Section Headers

Use these exact headers — ATS systems look for them:

- **Contact Information** (or just your name at top)
- **Summary** or **Professional Summary** (not "About Me")
- **Experience** or **Work Experience** (not "Where I've Been")
- **Education** (not "Academic Background")
- **Skills** or **Technical Skills** (not "What I Know")
- **Certifications** (not "Credentials")
- **Projects** (acceptable as-is)
- **Volunteer Experience** (acceptable as-is)

## Keyword Matching Rules

### Exact Match Matters

ATS matching is primarily lexical (exact word matching):

- JD says "project management" → Your resume needs "project management" (not just "managed projects")
- JD says "cross-functional collaboration" → Use that exact phrase
- JD says "CI/CD" → Include "CI/CD" (not just "continuous integration")

### Include Both Forms

Always include acronyms AND full terms:

- "PMP (Project Management Professional)"
- "AWS (Amazon Web Services)"
- "SQL (Structured Query Language)"
- "CI/CD (Continuous Integration/Continuous Deployment)"

### Mirror the JD's Language

- If they say "stakeholder management," use "stakeholder management"
- If they say "agile methodology," use "agile methodology"
- Don't assume synonyms are equivalent — "led" and "managed" may not match

### Frequency Signals Importance

If a term appears 3+ times in the JD, it's likely a high-priority keyword. Ensure it appears at least once (ideally 2-3 times) in your resume across different sections.

### Skills Section is Keyword-Dense

Use your Skills section to list technical terms explicitly:

```
Skills: Python, JavaScript, TypeScript, React, Node.js, PostgreSQL, Redis,
AWS (EC2, S3, Lambda), Docker, Kubernetes, CI/CD, Agile/Scrum, System Design
```

## Keyword Taxonomies by Field

### Technology / Software Engineering

**Languages & Frameworks:** Python, Java, JavaScript, TypeScript, Go, Rust, C++, React, Angular, Vue, Node.js, Django, Spring Boot, .NET

**Infrastructure:** AWS, Azure, GCP, Docker, Kubernetes, Terraform, CI/CD, Jenkins, GitHub Actions, Linux

**Data:** SQL, PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Kafka, Spark, data pipeline, ETL

**Practices:** Agile, Scrum, TDD, code review, system design, microservices, REST API, GraphQL, observability

### Marketing

**Digital:** SEO, SEM, PPC, Google Analytics, Google Ads, social media marketing, content marketing, email marketing, marketing automation, A/B testing, conversion rate optimization

**Strategy:** brand management, market research, competitive analysis, go-to-market, product marketing, demand generation, lead generation, funnel optimization

**Tools:** HubSpot, Salesforce, Marketo, Mailchimp, Hootsuite, Semrush, Google Tag Manager

### Finance / Accounting

**Core:** financial analysis, financial modeling, forecasting, budgeting, variance analysis, P&L, balance sheet, cash flow, GAAP, IFRS

**Tools:** Excel, SAP, Oracle, QuickBooks, Bloomberg, Power BI, Tableau

**Certifications:** CPA, CFA, CMA, Series 7, Series 63

### Operations / Project Management

**Core:** project management, program management, process improvement, change management, risk management, vendor management, stakeholder management, resource allocation

**Methodologies:** Agile, Scrum, Kanban, Lean, Six Sigma, Waterfall, PRINCE2

**Tools:** Jira, Asana, Monday.com, Confluence, Microsoft Project, Smartsheet

**Certifications:** PMP, Scrum Master (CSM), ITIL, Lean Six Sigma

## Optimization Workflow

1. Copy the job description into a text file
2. Run the keyword analyzer to compare against your resume
3. Identify the top 10-15 missing keywords
4. For each missing keyword, determine where it fits naturally in your resume
5. Add keywords to bullet points where you can truthfully claim the experience
6. If you lack experience with a keyword, consider adding it to a "Familiar With" or "Exposure" section — but only if true
7. Re-run the analyzer to verify improvement
8. Have a human review for readability — keyword-stuffed resumes feel unnatural

## Important Caveats

- ATS is one filter, not the only one — a human will read your resume if it passes
- Don't keyword-stuff — recruiters notice and it looks desperate
- Only include keywords you can genuinely discuss in an interview
- Different ATS systems have different capabilities — there's no universal standard
- Some companies barely use ATS filtering — networking can bypass it entirely
