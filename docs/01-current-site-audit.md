# Current site audit (zokorp.com)

## Audit metadata
- Audited on: 2026-03-01 (America/Chicago)
- Sources: live public site + Playwright page snapshots + live HTTP/DNS checks
- Scope: inspection only (no content changes made)

## Domain and routing behavior
- Canonical domain currently resolves to `https://www.zokorp.com/`
- `https://zokorp.com` returns `301` redirect to `https://www.zokorp.com/`
- Public site is currently served by Squarespace

## Top-level navigation
- Home (`/`)
- About Us (`/about-us`)
- Our Services (`/our-services`)
- Blog (`/blog`)
- Contact Us (`/contact-us`)

## Home page inventory (`/`)
- Headings:
  - `AWS AI/ML Engineer and Consultant`
  - `Schedule a Consultation Today` (clickable CTA to `/contact-us`)
  - `Zohaib Khawaja`
  - `AI in Education`
- Services section:
  - `AWS Consultation`
  - `APN Consultation`
  - `AWS Products`
  - `Learn More` CTA to `/our-services`
- AI in Education section:
  - Embedded video player with controls (play/mute/settings/fullscreen)
  - Long-form paragraph about AI/LLM adoption in education
- Footer:
  - Name: `Zohaib Khawaja`
  - Location shown: `Houston, TX 77479`
  - Contact shown: `zkhawaja@zokorp.com`
  - Footer sign-off text: `Thank you!`

## About page inventory (`/about-us`)
- Primary content:
  - Long biography heading describing Zohaib’s AWS AI/ML background and ZoKorp mission
  - Multi-paragraph narrative on AWS Partner Solutions Architect role, ZoKorp services/products, and mission
- UI elements:
  - Carousel controls (`Previous` / `Next`)
- Footer repeats:
  - `Zohaib Khawaja`, `Houston, TX 77479`, `zkhawaja@zokorp.com`

## Services page inventory (`/our-services`)
- Page title heading: `Our Services`
- Service blocks:
  - `AWS Consultation` (external link to AWS Marketplace product page)
  - `APN Consulting` (external link to AWS Marketplace product page)
  - `AWS ML Products` (external link to AWS Marketplace search results for ZoKorp)
- Service copy includes APN support tier descriptions and AWS AI/ML consulting scope
- Footer repeats:
  - `Zohaib Khawaja`, `Houston, TX 77479`, `zkhawaja@zokorp.com`

## Blog inventory (`/blog`)
- Blog listing heading: `Blog`
- Confirmed listed articles include:
  - `Meta’s AI Journey`
  - `Unlock Rapid App Development with AWS App Studio`
  - `Introducing Gemma 2: New AI Model in 9B & 27B Sizes`
  - `Introducing Kling: A Game-Changer in the World of AI Video Generation`
  - `AI in the Healthcare Industry`
  - `Difference between AI, ML, GenAI, and Deep Learning`
- Category/tag links visible on posts include:
  - `Artificial Intelligence`, `AI`, `AI/ML`, `ML`, `AWS`, `APP Studio`
- Footer repeats:
  - `Zohaib Khawaja`, `Houston, TX 77479`, `zkhawaja@zokorp.com`

## Contact page inventory (`/contact-us`)
- Primary heading: `Schedule a Consultation`
- Contact card block includes:
  - `ZoKorp`
  - `Sugar Land, TX 77479`
  - `zkhawaja@zokorp.com`
  - Social link: LinkedIn (`https://www.linkedin.com/in/zohaib-khawaja/`)
- Form fields visible:
  - First Name (required)
  - Last Name (required)
  - Email (required)
  - Additional Message (optional)
  - Submit button
- Footer repeats:
  - `Zohaib Khawaja`, `Houston, TX 77479`, `zkhawaja@zokorp.com`

## Brand cues to preserve (inferred)
- Logo and brand name: `ZoKorp`
- Color variables extracted from live CSS:
  - `accent-hsl: 176.9, 28.16%, 59.61%` (approx `#7bb5b2`)
  - `lightAccent-hsl: 214.37, 74.1%, 72.75%` (approx `#86b2ed`)
  - `darkAccent-hsl: 211.46, 49.76%, 40.59%` (approx `#34659b`)
  - `black-hsl: 60, 3.45%, 17.06%` (approx `#2d2d2a`)
  - `white-hsl: 41.54, 23.64%, 89.22%` (approx `#eae6dd`)
- Font families found in compiled CSS include:
  - `Clarkson`
  - `kepler-std`
  - fallback stacks based on `Helvetica` / `Arial` / `sans-serif`

## Preserve list for rebuild
- Navigation architecture and page slugs
- Home hero messaging and consultation CTA flow
- Services section names and external AWS Marketplace destinations
- Blog index + article content migration
- Contact page fields and LinkedIn profile link
- Footer identity/contact data
- Existing brand palette and typography direction
- AI in Education video embed and supporting copy

## Risk notes
- Email/DNS is active (Zoho MX/SPF/DKIM/DMARC); DNS changes must avoid mail-impacting records.
- Multiple verification TXT records are present (Microsoft/OpenAI/Zoho); these must remain during hosting cutover.
- Contact location appears as both `Houston` and `Sugar Land`; keep current content now and normalize later only with owner approval.
