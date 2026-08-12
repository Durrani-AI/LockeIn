/**
 * industry-data.ts
 *
 * Static data definitions for the 4 supported industries:
 * types, keyword lists, track definitions, and industry definitions.
 *
 * Separated from industry-logic.ts so that data (which changes infrequently)
 * lives apart from filtering / matching functions (which evolve with features).
 */

// ── Types ──────────────────────────────────────────────────────────

export type Category = "finance" | "technology" | "law" | "graduate";
export type JobType = "internship" | "placement" | "graduate";
export type Industry = "technology" | "finance" | "law" | "engineering-science";

export interface TrackDefinition {
  key: string;
  label: string;
  description: string;
  keywords: string[];
}

export interface IndustryDefinition {
  key: Industry;
  label: string;
  description: string;
  note: string;
  accentClass: string;
  mappedCategories: Category[];
  matchKeywords?: string[];
  excludeKeywords?: string[];
  emptyState: string;
  syncLabel: string;
  syncPlaceholder: string;
  tracks: TrackDefinition[];
}

export interface JobRow {
  id: string;
  company: string;
  role_title: string;
  category: Category;
  job_type: JobType;
  location: string;
  deadline: string | null;
  created_at: string;
  posted_at: string | null;
  short_summary: string;
  requirements: string | null;
}

export interface SavedRow {
  job_id: string;
  status: string | null;
}

// ── UI constants ───────────────────────────────────────────────────

export const TYPE_TABS: { key: "all" | JobType; label: string }[] = [
  { key: "all", label: "All Roles" },
  { key: "internship", label: "Summer Internships" },
  { key: "placement", label: "Industrial Placements" },
  { key: "graduate", label: "Graduate Schemes" },
];

export const STATUS_OPTIONS = [
  "Not Applied",
  "Saved",
  "Application Submitted",
  "Interviewing",
  "Offer",
  "Rejected",
] as const;

export const AUTO_SYNC_STORAGE_KEY = "lockedin:auto-jsearch-sync-at";
export const AUTO_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT = 28;

export const INDUSTRY_ORDER: Industry[] = ["technology", "finance", "law", "engineering-science"];

// ── Keyword lists ──────────────────────────────────────────────────

const TECHNOLOGY_KEYWORDS = [
  "software",
  "developer",
  "frontend",
  "backend",
  "full stack",
  "full-stack",
  "product engineer",
  "machine learning",
  "artificial intelligence",
  "data science",
  "data engineer",
  "cloud",
  "devops",
  "site reliability",
  "cyber",
  "information security",
  "security operations",
  "network engineer",
  "platform engineer",
];

const LEGAL_KEYWORDS = [
  "law",
  "legal",
  "law firm",
  "solicitor",
  "paralegal",
  "training contract",
  "vacation scheme",
  "disputes",
  "litigation",
];

const ENGINEERING_SCIENCE_KEYWORDS = [
  "mechanical engineering",
  "electrical engineering",
  "electronic engineering",
  "civil engineering",
  "chemical engineering",
  "aerospace engineering",
  "manufacturing engineering",
  "automotive engineering",
  "biomedical engineering",
  "scientist",
  "research",
  "laboratory",
  "lab",
  "life science",
  "life sciences",
  "pharmaceutical",
  "biotech",
  "materials",
  "process engineer",
  "design engineer",
  "quality engineer",
  "field engineer",
  "systems engineer",
  "physics",
  "chemistry",
  "biology",
];

// ── Industry definitions ───────────────────────────────────────────

export const INDUSTRY_DEFINITIONS: Record<Industry, IndustryDefinition> = {
  technology: {
    key: "technology",
    label: "Technology",
    description: "Software, data, AI, cloud, cyber, and platform roles.",
    note: "For users targeting software-led internships, placements, and graduate schemes.",
    accentClass: "border-sky-500/30 bg-sky-500/10",
    mappedCategories: ["technology"],
    matchKeywords: TECHNOLOGY_KEYWORDS,
    emptyState: "No technology roles match this mix of filters yet.",
    syncLabel: "Refresh feed",
    syncPlaceholder: "Optional query personalised Searches",
    tracks: [
      {
        key: "software-engineering",
        label: "Software Engineering",
        description: "Frontend, backend, full-stack, mobile, and product engineering.",
        keywords: ["software", "frontend", "backend", "full stack", "full-stack", "developer", "mobile", "product engineer"],
      },
      {
        key: "ai-data",
        label: "AI & Data",
        description: "Machine learning, AI, analytics, and data engineering roles.",
        keywords: ["machine learning", "artificial intelligence", "ai", "ml", "data scientist", "data science", "data engineer", "analytics"],
      },
      {
        key: "cloud-platform",
        label: "Cloud & Platform",
        description: "Cloud, infrastructure, DevOps, and site reliability roles.",
        keywords: ["cloud", "devops", "site reliability", "sre", "infrastructure", "kubernetes", "azure", "aws", "gcp", "platform engineer"],
      },
      {
        key: "cyber-network",
        label: "Cyber & Network",
        description: "Cybersecurity, information security, and networking roles.",
        keywords: ["cyber", "security", "network", "soc", "security operations", "information security"],
      },
    ],
  },
  finance: {
    key: "finance",
    label: "Finance",
    description: "Banking, markets, asset management, and risk roles.",
    note: "For finance, economics, and quantitative applicants tracking structured programmes.",
    accentClass: "border-emerald-500/30 bg-emerald-500/10",
    mappedCategories: ["finance"],
    emptyState: "No finance roles match your current filters.",
    syncLabel: "Refresh finance feed",
    syncPlaceholder: "Optional query for finance roles, for example investment banking internship united kingdom",
    tracks: [
      {
        key: "investment-banking",
        label: "Investment Banking",
        description: "Summer analyst, M&A, and corporate finance programmes.",
        keywords: ["investment banking", "summer analyst", "m&a", "corporate finance", "banking analyst"],
      },
      {
        key: "markets-trading",
        label: "Markets & Trading",
        description: "Sales and trading, research, and global markets roles.",
        keywords: ["trading", "markets", "sales and trading", "equity research", "fixed income"],
      },
      {
        key: "asset-management",
        label: "Asset Management",
        description: "Investment management, portfolio, and wealth roles.",
        keywords: ["asset management", "investment management", "wealth", "portfolio", "pensions"],
      },
      {
        key: "risk-compliance",
        label: "Risk & Compliance",
        description: "Risk, audit, controls, and regulatory roles.",
        keywords: ["risk", "compliance", "audit", "controls", "regulatory"],
      },
    ],
  },
  law: {
    key: "law",
    label: "Law & Law Firms",
    description: "Training contracts, vacation schemes, and legal roles at firms or in-house teams.",
    note: "A dedicated legal feed rather than a mixed advisory bucket.",
    accentClass: "border-amber-500/30 bg-amber-500/10",
    mappedCategories: ["law"],
    matchKeywords: LEGAL_KEYWORDS,
    emptyState: "No legal roles match the selected filters right now.",
    syncLabel: "Refresh law feed",
    syncPlaceholder: "Optional query for law roles, for example law vacation scheme united kingdom",
    tracks: [
      {
        key: "training-contracts",
        label: "Training Contracts",
        description: "Training contract and trainee solicitor pathways.",
        keywords: ["training contract", "trainee solicitor", "solicitor"],
      },
      {
        key: "vacation-schemes",
        label: "Vacation Schemes",
        description: "Vacation schemes, insight weeks, and legal internships.",
        keywords: ["vacation scheme", "vac scheme", "insight week", "legal internship"],
      },
      {
        key: "commercial-law",
        label: "Commercial Law",
        description: "Corporate, disputes, competition, and commercial law roles.",
        keywords: ["commercial", "corporate", "disputes", "litigation", "competition"],
      },
      {
        key: "legal-operations",
        label: "Legal Operations",
        description: "Paralegal, compliance, and legal operations roles.",
        keywords: ["legal operations", "compliance", "regulatory", "paralegal"],
      },
    ],
  },
  "engineering-science": {
    key: "engineering-science",
    label: "Engineering, Science & Biotech",
    description: "Engineering, scientific research, laboratory, manufacturing, biotech, and life-science roles.",
    note: "For users targeting engineering placements, technical graduate schemes, biotech, and science-focused programmes.",
    accentClass: "border-fuchsia-500/30 bg-fuchsia-500/10",
    mappedCategories: ["technology", "graduate"],
    matchKeywords: ENGINEERING_SCIENCE_KEYWORDS,
    excludeKeywords: TECHNOLOGY_KEYWORDS,
    emptyState: "No engineering or science roles match the current filters.",
    syncLabel: "Refresh engineering, science & biotech feed",
    syncPlaceholder: "Optional query for engineering, science, or biotech roles, for example biotech internship united kingdom",
    tracks: [
      {
        key: "mechanical-manufacturing",
        label: "Mechanical & Manufacturing",
        description: "Mechanical, manufacturing, automotive, and production engineering roles.",
        keywords: ["mechanical engineering", "manufacturing", "automotive", "production", "design engineer"],
      },
      {
        key: "civil-built-environment",
        label: "Civil & Built Environment",
        description: "Civil, structural, construction, and infrastructure roles.",
        keywords: ["civil engineering", "structural", "construction", "infrastructure", "built environment"],
      },
      {
        key: "electrical-systems",
        label: "Electrical & Systems",
        description: "Electrical, electronic, embedded, and systems engineering roles.",
        keywords: ["electrical engineering", "electronic engineering", "embedded", "systems engineer", "field engineer"],
      },
      {
        key: "science-research",
        label: "Science, Research & Biotech",
        description: "Research, laboratory, biotech, pharmaceutical, and scientific roles.",
        keywords: ["scientist", "research", "laboratory", "lab", "biotech", "pharmaceutical", "life science", "physics", "chemistry", "biology"],
      },
    ],
  },
};
