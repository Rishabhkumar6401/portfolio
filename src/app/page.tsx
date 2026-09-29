import ApiCard from "@/components/ApiCard";
import ContactForm from "@/components/ContactForm";
import { ArrowRight, Check, GitHub, LinkedIn, Mail, ProjectIcon } from "@/components/Icons";
import Nav from "@/components/Nav";
import QuoteCard from "@/components/QuoteCard";
import Stats from "@/components/Stats";
import { education, experience, facts, hero, links, principles, projects, skills } from "@/content/profile";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        {/* ================= HERO ================= */}
        <div className="wrap hero">
          <div className="reveal">
            <span className="hi">
              <span className="avatar" aria-hidden="true">RK</span>
              {hero.greeting}
            </span>
            <h1>
              Backend engineer building <span className="grad">reliable APIs</span> for AI products.
            </h1>
            <p className="intro">
              <b>3+ years of Node.js in production.</b> I build REST APIs, background jobs and integrations — currently
              for <b>YourGPT</b>, an AI chatbot platform, at Delta4 Infotech.
            </p>
            <div className="hero-cta">
              <a className="btn primary" href="#work">
                See my work <ArrowRight />
              </a>
              <a className="btn" href="#contact">Get in touch</a>
            </div>
            <div className="socials">
              <span>Find me on</span>
              <a className="icon-btn" href={links.linkedin} target="_blank" rel="noopener" aria-label="LinkedIn"><LinkedIn /></a>
              <a className="icon-btn" href={links.github} target="_blank" rel="noopener" aria-label="GitHub"><GitHub /></a>
              <a className="icon-btn" href={`mailto:${links.email}`} aria-label="Email"><Mail /></a>
            </div>
          </div>
          <ApiCard />
        </div>

        <Stats />

        {/* ================= ABOUT ================= */}
        <section id="about">
          <div className="wrap">
            <div className="head reveal">
              <div className="label">About</div>
              <h2>I like the part of software nobody sees — until it breaks.</h2>
            </div>
            <div className="about">
              <div className="reveal">
                <p>
                  I&apos;m a backend engineer with <b>3+ years of Node.js experience</b>. I started at Gozoom
                  Technologies building APIs for a B2B e-commerce product, and today I work at <b>Delta4 Infotech</b> on
                  YourGPT — an AI chatbot platform companies use for customer support and sales.
                </p>
                <p>
                  Most of my work is the plumbing that keeps a product dependable: a <b>public REST API</b> customers
                  integrate with, <b>background jobs</b> that send thousands of messages safely, and <b>integrations</b>{" "}
                  with WhatsApp, Instagram, Telegram, Discord and tools like Google and HubSpot.
                </p>
                <p>I care about systems that are simple to reason about, fast under load, and honest when something goes wrong.</p>
              </div>
              <div className="facts reveal">
                {facts.map((f) => (
                  <div className="fact" key={f.label}>
                    <small>{f.label}</small>
                    <b>{f.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= EXPERIENCE ================= */}
        <section id="experience">
          <div className="wrap">
            <div className="head reveal">
              <div className="label">Experience</div>
              <h2>Where I&apos;ve worked</h2>
            </div>
            <div className="timeline">
              {experience.map((job) => (
                <article className="job reveal" key={job.company}>
                  <div className="job-top">
                    <div>
                      <h3>{job.role}</h3>
                      <div className="co">
                        {job.company}
                        {job.companyNote && <> · {job.companyNote}</>}
                        {job.link && (
                          <>
                            {" · "}
                            <a href={job.link.href} target="_blank" rel="noopener">{job.link.label}</a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="when">
                      <b>{job.dates}</b>
                      <span>{job.place}</span>
                    </div>
                  </div>
                  <ul>
                    {job.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ================= WORK ================= */}
        <section id="work">
          <div className="wrap">
            <div className="head reveal">
              <div className="label">Selected work</div>
              <h2>Things I&apos;ve built</h2>
              <p className="sec-intro">Production systems from my day job — what they do, and how they work underneath.</p>
            </div>
            <div className="projects">
              {projects.map((p) => (
                <article className="proj reveal" key={p.title}>
                  <div className="ico"><ProjectIcon name={p.icon} /></div>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <ul>
                    {p.points.map((pt) => (
                      <li key={pt}><Check />{pt}</li>
                    ))}
                  </ul>
                  <div className="tags">
                    {p.tags.map((t) => (
                      <span className="tag" key={t}>{t}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ================= PRINCIPLES ================= */}
        <section id="principles">
          <div className="wrap">
            <div className="head reveal">
              <div className="label">How I work</div>
              <h2>How I build backends</h2>
              <p className="sec-intro">3+ years of production taught me these — mostly the hard way.</p>
            </div>
            <div className="principles">
              {principles.map((pr, i) => (
                <article className="pr reveal" key={pr.title}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{pr.title}</h3>
                  <p>{pr.body}</p>
                </article>
              ))}
            </div>
            <QuoteCard />
          </div>
        </section>

        {/* ================= SKILLS ================= */}
        <section id="skills">
          <div className="wrap">
            <div className="head reveal">
              <div className="label">Skills</div>
              <h2>What I work with</h2>
            </div>
            <div className="skills">
              {skills.map((s) => (
                <div className="sk reveal" key={s.group}>
                  <h3>{s.group}</h3>
                  <div className="tags">
                    {s.items.map((it) => (
                      <span className="tag" key={it}>{it}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= EDUCATION + ACHIEVEMENT ================= */}
        <section id="education">
          <div className="wrap">
            <div className="duo">
              <div className="card reveal">
                <small>Education</small>
                <h3>{education.degree}</h3>
                <p>{education.school}</p>
              </div>
              <div className="card reveal">
                <small>Achievement</small>
                <div className="big-num">3 of 4</div>
                <h3>Internal hackathons won at Delta4 · 2025</h3>
                <p>All three winning projects are now live in production.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CONTACT ================= */}
        <section id="contact">
          <div className="wrap">
            <div className="contact reveal">
              <div className="contact-copy">
                <div className="label">Contact</div>
                <h2>Let&apos;s build something reliable.</h2>
                <p>Hiring for a backend role, or curious about anything on this page? Send a message — it goes straight to my inbox.</p>
                <div className="direct">
                  <a className="btn primary" href={`mailto:${links.email}`}><Mail />Email me</a>
                  <a className="btn" href={links.linkedin} target="_blank" rel="noopener">LinkedIn</a>
                </div>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>© {new Date().getFullYear()} Rishabh Kumar</span>
          <span>No servers were harmed in the making of this site.</span>
        </div>
      </footer>
    </>
  );
}
