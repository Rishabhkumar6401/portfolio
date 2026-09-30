// Every tool's name and page text. The tool itself is a component in src/components/tools.

export type Tool = {
  slug: string;
  name: string;
  tagline: string; // one line, shown in lists
  title: string; // browser tab and search result title
  description: string; // search result description
  intro: string; // under the page heading
  where: string; // where the work happens: in the browser, or on the server
  sections: { heading: string; body: string[] }[];
  faq: { q: string; a: string }[];
  behind?: { stack: string; points: { label: string; text: string }[] }; // what the backend does, for tools that have one
};

export const tools: Tool[] = [
  {
    slug: "webhook-tester",
    name: "Webhook tester",
    tagline: "Get a temporary URL and see every request sent to it.",
    title: "Webhook Tester: inspect webhook requests online",
    description:
      "Create a temporary URL, point Stripe, GitHub or any service at it, and see each request with its headers and body. Check signatures and test retries. Free, no sign-up.",
    intro:
      "Create a temporary URL and point any service at it. Each request shows up here with its method, headers and body.",
    where: "Requests are stored on the server for 24 hours, then deleted.",
    sections: [
      {
        heading: "How to use it",
        body: [
          "Create a test URL and paste it where the other service asks for a webhook URL, for example in the Stripe or GitHub settings. Then trigger an event there. The request appears on this page within a few seconds.",
          "Any method works, and so does any path after the URL. Open a request to see its headers, query parameters and body.",
        ],
      },
      {
        heading: "Check a signature",
        body: [
          "Most services sign their webhooks so you can prove a request is really from them. Open a request, enter your signing secret, and the page tells you whether the signature matches. It knows the GitHub and Stripe formats, and any header that carries an HMAC SHA-256 of the body.",
          "The secret is used in your browser only. It is never sent to the server.",
        ],
      },
      {
        heading: "Test how a sender retries",
        body: [
          "Set the URL to reply with an error such as 500 or 503. The sender will treat the delivery as failed, and you can watch when and how often it tries again.",
        ],
      },
    ],
    faq: [
      {
        q: "How long does a test URL last?",
        a: "24 hours. After that the URL and everything it received are deleted. You can also delete it yourself at any time.",
      },
      {
        q: "Who can see the requests?",
        a: "Only your browser. The URL you paste into other services can add requests but cannot read them. Reading needs a separate key that stays in your browser, and the server stores only a hash of it.",
      },
      {
        q: "Are there limits?",
        a: "A test URL keeps its 50 newest requests and accepts 60 requests a minute. Bodies larger than 16 KB are cut at 16 KB.",
      },
      {
        q: "Should I send real secrets to it?",
        a: "No. Use it with test data. The requests are stored on a server for up to 24 hours.",
      },
    ],
    behind: {
      stack: "Next.js route handlers, Redis, Lua, Zod, Vercel Cron",
      points: [
        {
          label: "Storage",
          text: "Requests are kept in Redis. Every key carries a 24-hour expiry, so old data removes itself and no cleanup job is needed.",
        },
        {
          label: "One step per request",
          text: "Storing a request checks that the URL exists, counts it against the rate limit, saves it and trims the list to 50, all inside one Lua script. Requests that arrive together cannot slip past a limit.",
        },
        {
          label: "Write-only URL",
          text: "The URL you hand to another service can only add requests. Reading them needs a second key that stays in your browser. The server stores only its SHA-256 hash.",
        },
        {
          label: "Limits",
          text: "New URLs per visitor and per day, requests per URL per minute, and reads per visitor are all capped. Visitors are counted by a salted hash of their IP address.",
        },
        {
          label: "Large uploads",
          text: "A body is read only up to 16 KB. The rest of the upload is dropped without being read, so one huge request cannot fill the store.",
        },
        {
          label: "Live updates",
          text: "The site runs on serverless functions, which cannot hold a connection open. The page asks for anything newer than the last request it has, slows down when nothing arrives, and stops in a background tab.",
        },
        {
          label: "Scheduled job",
          text: "A daily cron job pings the Redis database so the free plan does not archive it for inactivity.",
        },
      ],
    },
  },
  {
    slug: "cache-test",
    name: "Live cache test",
    tagline: "Run 100 real database lookups with and without a Redis cache and see the measured times.",
    title: "Live Cache Test: Postgres with and without Redis",
    description:
      "Run a real test on a live backend: the same report on 100,000 rows, 100 times straight from Postgres and 100 times through a Redis cache. See total time, median, slowest 5% and database queries.",
    intro: "One click runs the same database report 100 times straight from Postgres, then 100 times through a Redis cache, and shows the measured times.",
    where: "Runs on the server, against a real Postgres database and a real Redis cache. Nothing is simulated.",
    sections: [
      {
        heading: "What the test does",
        body: [
          "The report is the top 5 products by revenue across 100,000 orders. Postgres has to add up every order each time it is asked, so every lookup costs the same.",
          "With the cache, the first lookups find nothing stored, run the report once and save the answer. Every lookup after that reads the saved answer and never reaches the database.",
        ],
      },
    ],
    faq: [
      {
        q: "Are the numbers real?",
        a: "Yes. Every lookup is timed on the server while it happens. You can watch the results arrive in your browser's network tab.",
      },
      {
        q: "Why are some cached lookups slow?",
        a: "The first few arrive before the answer is saved, so they wait for the one database query that fills the cache. They show up in the slowest 5%.",
      },
      {
        q: "Why only 100 lookups?",
        a: "The site runs on free database plans. 100 lookups, 10 at a time, is enough to show the difference without using them up.",
      },
    ],
    behind: {
      stack: "Next.js route handler, PostgreSQL, Redis, streamed JSON",
      points: [
        {
          label: "Cache first",
          text: "A lookup reads Redis first. On a miss it runs the report in Postgres and saves the answer for 60 seconds.",
        },
        {
          label: "No stampede",
          text: "Lookups that miss at the same moment wait for one shared query. Without this, ten visitors arriving together would each run the expensive report.",
        },
        {
          label: "Measured, not estimated",
          text: "Each lookup is timed on the server. The page shows the total, the median and the slowest 5%, because an average hides the slow requests users actually feel.",
        },
        {
          label: "Same answer check",
          text: "The two results are compared at the end. A cache that returns the wrong answer quickly is worse than no cache.",
        },
        {
          label: "Streaming",
          text: "Progress and results are sent to the page one line at a time while the test runs, over a single response.",
        },
        {
          label: "Limits",
          text: "One run at a time for the whole site, 3 runs per visitor per hour and 100 per day. One Postgres function checks all three behind a lock, before Redis is touched.",
        },
      ],
    },
  },
  {
    slug: "json-formatter",
    name: "JSON formatter",
    tagline: "Format, validate and minify JSON.",
    title: "JSON Formatter and Validator",
    description:
      "Format, validate and minify JSON in your browser. Shows the line and column of a syntax error and keeps large numbers exact. Nothing is uploaded.",
    intro: "Paste JSON to format it, check it, or minify it.",
    where: "Runs in your browser. Nothing you paste is uploaded.",
    sections: [
      {
        heading: "What it does",
        body: [
          "It checks that the text is valid JSON and rewrites it with clean indentation, or on one line with no spaces. If the JSON is broken, it shows where the problem is.",
          "Numbers are copied exactly as written. Many formatters read the JSON into JavaScript numbers first, which silently changes a large ID such as 12345678901234567890. This one does not.",
        ],
      },
    ],
    faq: [
      {
        q: "Why is my JSON invalid?",
        a: "The usual causes are a comma after the last item, single quotes instead of double quotes, keys without quotes, and comments. None of these are allowed in JSON.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The formatting is done by your browser on your device.",
      },
    ],
  },
  {
    slug: "jwt-decoder",
    name: "JWT decoder",
    tagline: "Read a JSON Web Token and check its expiry and signature.",
    title: "JWT Decoder: read and verify JSON Web Tokens",
    description:
      "Decode a JSON Web Token in your browser. See the header, the claims and the expiry time in plain words, and verify HS256, HS384 or HS512 signatures. The token is never uploaded.",
    intro: "Paste a JSON Web Token to read its header and claims, see when it expires, and check its signature.",
    where: "Runs in your browser. The token and the secret are never uploaded.",
    sections: [
      {
        heading: "What a JWT contains",
        body: [
          "A token has three parts separated by dots: a header that names the signing algorithm, a payload with the claims, and a signature. The header and payload are only encoded, not encrypted, so anyone holding the token can read them.",
          "The signature is what makes a token trustworthy. A server must verify it before believing any claim.",
        ],
      },
    ],
    faq: [
      {
        q: "What do exp, iat and nbf mean?",
        a: "They are times in seconds since 1 January 1970 UTC. exp is when the token expires, iat is when it was issued, and nbf is the earliest time it may be used.",
      },
      {
        q: "Can this tool verify any token?",
        a: "It verifies tokens signed with a shared secret: HS256, HS384 and HS512. Tokens signed with a private key, such as RS256 or ES256, are decoded but not verified.",
      },
      {
        q: "Is it safe to paste a real token?",
        a: "The token stays in your browser. Still, a valid token is a credential, so prefer an expired or test token.",
      },
    ],
  },
  {
    slug: "base64",
    name: "Base64 encoder and decoder",
    tagline: "Convert text to Base64 and back.",
    title: "Base64 Encode and Decode",
    description:
      "Encode text to Base64 or decode Base64 to text in your browser. Handles emoji and every language correctly, and supports the URL-safe alphabet. Nothing is uploaded.",
    intro: "Convert text to Base64, or Base64 back to text.",
    where: "Runs in your browser. Nothing you type is uploaded.",
    sections: [
      {
        heading: "What Base64 is for",
        body: [
          "Base64 writes any bytes using 64 plain characters, so binary data can travel through places that only accept text, such as JSON, URLs and email. It makes data about a third larger.",
          "It is an encoding, not encryption. Anyone can decode it.",
        ],
      },
    ],
    faq: [
      {
        q: "What is URL-safe Base64?",
        a: "Standard Base64 uses + and /, which have special meanings in URLs. The URL-safe form uses - and _ instead and usually drops the = padding. JSON Web Tokens use it.",
      },
      {
        q: "Why does decoding give strange characters?",
        a: "The data is probably not text. Base64 often carries images, keys or compressed data. This tool tells you when the result is binary.",
      },
    ],
  },
  {
    slug: "unix-timestamp",
    name: "Unix timestamp converter",
    tagline: "Convert between Unix time and a readable date.",
    title: "Unix Timestamp Converter",
    description:
      "Convert a Unix timestamp to a date, or a date to a Unix timestamp. Detects seconds, milliseconds, microseconds and nanoseconds, and shows UTC and your local time.",
    intro: "Convert a Unix timestamp to a readable date, or a date to a timestamp.",
    where: "Runs in your browser.",
    sections: [
      {
        heading: "What a Unix timestamp is",
        body: [
          "It is the number of seconds since midnight on 1 January 1970, UTC. It has no time zone, which is why APIs and databases use it to store a moment in time.",
          "JavaScript and many APIs count in milliseconds instead, which gives a number with 13 digits instead of 10. This tool detects the unit from the length.",
        ],
      },
    ],
    faq: [
      {
        q: "Seconds or milliseconds?",
        a: "Today a timestamp in seconds has 10 digits and one in milliseconds has 13. Mixing them up is a common bug: a seconds value read as milliseconds lands in January 1970.",
      },
      {
        q: "What is the year 2038 problem?",
        a: "Systems that store the timestamp in a signed 32-bit number run out of room on 19 January 2038. Modern systems use 64 bits and are not affected.",
      },
    ],
  },
  {
    slug: "cron-expression",
    name: "Cron expression explainer",
    tagline: "See what a cron schedule means and when it runs next.",
    title: "Cron Expression Explainer: next run times",
    description:
      "Paste a cron expression to read it in plain words and see its next run times in your time zone or UTC. Supports ranges, steps, lists and names.",
    intro: "Type a cron expression to read it in plain words and see when it runs next.",
    where: "Runs in your browser.",
    sections: [
      {
        heading: "The five fields",
        body: [
          "A cron expression has five fields: minute, hour, day of the month, month, and day of the week. A star means every value. A list such as 1,15 picks values, a range such as 9-17 covers a span, and a step such as */5 means every fifth value.",
        ],
      },
    ],
    faq: [
      {
        q: "What happens when both day fields are set?",
        a: "The job runs when either one matches. For example, 0 9 1 * 1 runs at 09:00 on the first of the month and also on every Monday. This surprises many people.",
      },
      {
        q: "Which time zone does cron use?",
        a: "The time zone of the machine that runs it. Most hosted schedulers, including Vercel Cron and GitHub Actions, use UTC.",
      },
      {
        q: "Does it support seconds?",
        a: "No. This tool reads the standard five-field format, which has a smallest step of one minute.",
      },
    ],
  },
];

export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug);
