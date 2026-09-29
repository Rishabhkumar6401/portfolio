// Single source of truth for everything the site says about Rishabh.
// The page and the /api/rishabh endpoint both read from here, so they never disagree.

export const links = {
  email: "rishabh6401@gmail.com",
  linkedin: "https://www.linkedin.com/in/rishabh-kumar-28b6371bb",
  github: "https://github.com/Rishabhkumar6401",
  resume: "/resume.pdf",
  yourgpt: "https://yourgpt.ai/",
} as const;

export const hero = {
  greeting: "Hi, I'm Rishabh — based in Chandigarh",
  intro:
    "I build REST APIs, background jobs and integrations — currently for YourGPT, an AI chatbot platform, at Delta4 Infotech.",
} as const;

export const stats = [
  { to: 3, suffix: "+", label: "years of production Node.js" },
  { to: 8, suffix: "", label: "messaging channels integrated" },
  { to: 18, suffix: "", label: "third-party integrations built" },
  { to: 3, suffix: " of 4", label: "internal hackathons won" },
] as const;

export const facts = [
  { label: "Experience", value: "3+ years" },
  { label: "Based in", value: "Chandigarh, India" },
  { label: "Focus", value: "APIs & integrations" },
  { label: "Main stack", value: "Node.js · MySQL · Redis" },
] as const;

export type Job = {
  role: string;
  company: string;
  companyNote?: string;
  link?: { label: string; href: string };
  dates: string;
  place: string;
  bullets: string[];
};

export const experience: Job[] = [
  {
    role: "Node.js Backend Developer",
    company: "Delta4 Infotech",
    companyNote: "AI product company",
    link: { label: "YourGPT.ai", href: links.yourgpt },
    dates: "Jan 2025 — Present",
    place: "Chandigarh · On-site",
    bullets: [
      "Built the platform's public REST API with token auth, scoped permissions and Redis caching.",
      "Developed a multi-channel campaign engine for email, WhatsApp, SMS and voice delivery.",
      "Implemented async conversation export as a background job, zipping sessions to AWS S3.",
      "Integrated WhatsApp, Instagram, Messenger, Telegram and Discord webhook pipelines.",
      "Delivered real-time chat and session updates to the dashboard via Socket.IO and Redis.",
      "Built a TypeScript OAuth 2.0 library for Google, Microsoft 365, HubSpot and Zoho actions.",
      "Hardened APIs with input validation, SSRF protection and per-token rate limiting.",
    ],
  },
  {
    role: "Software Developer",
    company: "Gozoom Technologies Pvt. Ltd.",
    dates: "Aug 2023 — Jan 2025",
    place: "Remote",
    bullets: [
      "Built REST APIs and backend modules in Node.js and Express for a B2B e-commerce app.",
      "Modelled catalogue, order and customer data across MySQL and MongoDB.",
      "Implemented authentication, role-based access control and admin workflows.",
      "Built React screens on the same APIs and supported AWS deployment and releases.",
    ],
  },
];

export type Project = {
  icon: "lock" | "send" | "chat" | "brain";
  title: string;
  summary: string;
  points: string[];
  tags: string[];
};

export const projects: Project[] = [
  {
    icon: "lock",
    title: "Public API platform",
    summary: "A token-based REST API so customers can use the platform from their own code, not just the dashboard.",
    points: [
      "API tokens stored as hashes, with per-project permissions",
      "Token checks cached in Redis for fast requests",
      "Rate limit of 1,000 requests per hour per token",
    ],
    tags: ["Node.js", "Express", "MySQL", "Redis"],
  },
  {
    icon: "send",
    title: "Multi-channel campaign engine",
    summary:
      "Sends email, WhatsApp, SMS and voice campaigns to thousands of contacts — started as my winning hackathon prototype.",
    points: [
      "Sends in batches as background jobs, never inside a request",
      "Campaigns can be paused and resumed mid-send",
      "Credits charged per delivered message, safely",
    ],
    tags: ["Node.js", "Background jobs", "MySQL"],
  },
  {
    icon: "chat",
    title: "Messaging channel integrations",
    summary: "Connects the chatbot to the apps people already use, so one bot can answer everywhere.",
    points: [
      "WhatsApp, Instagram, Messenger, Telegram and Discord",
      "Webhook pipelines for incoming messages and media",
      "Live dashboard updates over Socket.IO",
    ],
    tags: ["Webhooks", "Socket.IO", "Redis"],
  },
  {
    icon: "brain",
    title: "Integration library for AI agents",
    summary: "Lets AI agents take real actions — create calendar events, update CRMs — in the tools a company already uses.",
    points: [
      "Google, Microsoft 365, HubSpot and Zoho services",
      "OAuth 2.0 sign-in with automatic token refresh",
      "Every action's input is validated before it runs",
    ],
    tags: ["TypeScript", "OAuth 2.0", "MCP"],
  },
];

export const principles = [
  {
    title: "Design for failure",
    body: "Networks drop, providers time out, jobs crash halfway. Retries, timeouts and idempotency come first, so users never notice.",
  },
  {
    title: "Measure, then optimise",
    body: "Logs and query plans before opinions. Most slow endpoints are one missing index away from fast.",
  },
  {
    title: "Boring is a feature",
    body: "Proven tools and simple code the next engineer can own. Clever is fun until it breaks at 3 a.m.",
  },
  {
    title: "Secure by default",
    body: "Validate every input, hash every secret, rate-limit every public door. Trust is earned per request.",
  },
] as const;

export const quotes: [text: string, by: string][] = [
  ["Everything fails, all the time.", "Werner Vogels, CTO of Amazon"],
  ["There are only two hard things in computer science: cache invalidation and naming things.", "Phil Karlton"],
  ["Premature optimization is the root of all evil.", "Donald Knuth"],
  ["Simplicity is prerequisite for reliability.", "Edsger W. Dijkstra"],
  ["Make it work, make it right, make it fast.", "Kent Beck"],
  ["Talk is cheap. Show me the code.", "Linus Torvalds"],
  [
    "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    "Martin Fowler",
  ],
  ["Hope is not a strategy.", "Traditional SRE saying"],
  ["Weeks of coding can save you hours of planning.", "Every project, at least once"],
  ["It works on my machine.", "Every developer, right before learning about Docker"],
];

export const skills = [
  { group: "Languages", items: ["JavaScript", "TypeScript", "SQL"] },
  { group: "Backend", items: ["Node.js", "Express.js", "REST APIs", "Socket.IO", "Microservices"] },
  { group: "Databases & caching", items: ["MySQL", "MongoDB", "Redis", "Sequelize", "Mongoose"] },
  { group: "Cloud & DevOps", items: ["AWS S3", "Lambda", "EventBridge", "Step Functions", "Docker", "CI/CD", "Git"] },
  { group: "Security & auth", items: ["JWT", "OAuth 2.0", "API keys", "RBAC", "Rate limiting"] },
  { group: "AI", items: ["OpenAI", "Anthropic", "Gemini", "MCP", "Claude Code", "Cursor"] },
] as const;

export const education = {
  degree: "B.Tech, Information Technology",
  school: "Ajay Kumar Garg Engineering College (AKTU), Ghaziabad · 2019 — 2023",
} as const;

// What GET /api/rishabh returns. Keep it short enough to read in the hero card.
export const apiProfile = {
  name: "Rishabh Kumar",
  role: "Backend Engineer",
  experience: "3+ years",
  currentlyAt: "Delta4 Infotech",
  product: "YourGPT — AI chatbots",
  stack: ["Node.js", "TypeScript", "Express", "MySQL", "Redis", "AWS"],
  location: "Chandigarh, India",
  email: links.email,
} as const;
