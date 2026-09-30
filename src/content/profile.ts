// Single source of truth for everything the site says about Rishabh.
// The page, the link-preview image and the /api/rishabh endpoint all read from here, so they never disagree.

export const links = {
  email: "rishabh6401@gmail.com",
  linkedin: "https://www.linkedin.com/in/rishabh-kumar-28b6371bb",
  github: "https://github.com/Rishabhkumar6401",
  resume: "/resume.pdf",
} as const;

export const hero = {
  tag: "3+ years in production",
  // Rendered on two lines: I'm Rishabh, / a <i>backend</i> engineer.
  headline: { first: "I'm Rishabh,", before: "a ", accent: "backend", after: " engineer." },
  intro: "I build REST APIs, background jobs and webhook integrations for web products.",
} as const;

// The one sentence under the hero. It lights up word by word as the visitor scrolls.
export const statement =
  "Behind every product is a backend. I build that part: the APIs, the queues that carry the work, and the limits that keep costs in check.";

export type Project = {
  tag: string;
  title: string;
  problem: string;
  built: string;
  how: string;
  stack: string;
};

// Four projects, one per slide. Each slide is paired with a 3D object in components/Scene.tsx, in this order.
export const projects: Project[] = [
  {
    tag: "API platform",
    title: "Public REST API",
    problem: "Customers could use the product only through its dashboard. They needed to reach it from their own code.",
    built: "A token-based REST API with per-project permissions, so a key can do only what it was issued for.",
    how: "Only a hash of each token is stored. Lookups are cached in Redis and cleared the moment a token is revoked. Each token is limited to 1,000 requests an hour.",
    stack: "Node.js, Express, MySQL, Redis",
  },
  {
    tag: "Messaging",
    title: "Campaign engine",
    problem: "Teams wanted to message thousands of contacts at once, on more than one channel.",
    built: "An engine that sends campaigns over email, WhatsApp, SMS and voice. It began as my hackathon prototype and went to production.",
    how: "Contacts are processed 100 at a time in background jobs. A paused campaign resumes from the exact contact where it stopped, and credits are checked before each group of messages.",
    stack: "Node.js, background jobs, MySQL",
  },
  {
    tag: "Integrations",
    title: "Messaging channels",
    problem: "Customers write in on many different apps, and every app has its own API and webhook format.",
    built: "Webhook pipelines that connect one chatbot to 8 channels, including WhatsApp, Instagram, Messenger, Telegram and Discord.",
    how: "Each channel has its own pipeline for incoming messages and media. New messages reach the team's dashboard live.",
    stack: "Webhooks, Socket.IO, Redis",
  },
  {
    tag: "AI agents",
    title: "Agent action library",
    problem: "AI agents had to do real tasks in other tools, such as creating a calendar event or updating a CRM record.",
    built: "A TypeScript library of actions for Google, Microsoft 365, HubSpot and Zoho.",
    how: "Sign-in uses OAuth 2.0 with automatic token refresh. Every action's input is validated before it runs.",
    stack: "TypeScript, OAuth 2.0, MCP",
  },
];

export const projectsNote = "Built at Delta4 Infotech";

export type Job = {
  dates: string;
  role: string;
  place: string;
  bullets: string[];
};

export const experience: Job[] = [
  {
    dates: "Jan 2025 to now",
    role: "Node.js Backend Developer",
    place: "Delta4 Infotech, on the YourGPT AI chatbot platform",
    bullets: [
      "Built the platform's public REST API with token auth, scoped permissions, Redis caching and per-token rate limits.",
      "Developed a campaign engine that delivers over email, WhatsApp, SMS and voice.",
      "Integrated 8 messaging channels through webhook pipelines, with live dashboard updates over Socket.IO and Redis.",
      "Wrote a TypeScript OAuth 2.0 library that lets AI agents act in Google, Microsoft 365, HubSpot and Zoho.",
      "Built conversation export as a background job that zips sessions to AWS S3.",
      "Won three internal hackathons in 2025. All three projects went to production.",
    ],
  },
  {
    dates: "Aug 2023 to Jan 2025",
    role: "Software Developer",
    place: "Gozoom Technologies, remote",
    bullets: [
      "Built REST APIs and backend modules in Node.js and Express for a B2B e-commerce app.",
      "Modelled catalogue, order and customer data across MySQL and MongoDB.",
      "Implemented authentication, role-based access control and admin workflows.",
      "Built React screens on the same APIs and supported AWS deployments.",
    ],
  },
  {
    dates: "2019 to 2023",
    role: "B.Tech, Information Technology",
    place: "Ajay Kumar Garg Engineering College, Ghaziabad",
    bullets: [],
  },
];

export const about =
  "I am a backend engineer with three years of production experience, most recently on an AI product. Most of my work sits where a product meets the outside world: authentication, webhooks, queues and rate limits. I validate every input, keep slow work in background jobs, and write code the next person can read.";

// The ID card that hangs in the About section.
export const badge = { photo: "/me.jpg", name: "Rishabh Kumar", role: "Backend Engineer", id: "RK-2023" } as const;

export const toolbox = [
  { label: "Languages", items: "JavaScript, TypeScript, SQL" },
  { label: "Backend", items: "Node.js, Express, REST APIs, Socket.IO" },
  { label: "Databases", items: "MySQL, MongoDB, Redis, Sequelize, Mongoose" },
  { label: "Cloud", items: "AWS S3, Lambda, EventBridge, Step Functions, Docker, CI/CD" },
  { label: "Security", items: "JWT, OAuth 2.0, API keys, role-based access, rate limiting" },
  { label: "AI", items: "OpenAI, Anthropic, Gemini, MCP" },
] as const;

export const contact = {
  lead: "Email is the fastest way to reach me. I usually reply within a day.",
} as const;

// What GET /api/rishabh returns, and what the link-preview image is built from.
export const apiProfile = {
  name: "Rishabh Kumar",
  role: "Backend Engineer",
  experience: "3+ years",
  currentlyAt: "Delta4 Infotech",
  stack: ["Node.js", "TypeScript", "Express", "MySQL", "Redis", "AWS"],
  email: links.email,
} as const;
