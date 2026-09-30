import Link from "next/link";
import CopyEmail from "@/components/CopyEmail";
import Dock from "@/components/Dock";
import IdCard from "@/components/IdCard";
import SceneLoader from "@/components/SceneLoader";
import Statement from "@/components/Statement";
import ThemeToggle from "@/components/ThemeToggle";
import ToolList from "@/components/ToolList";
import Work from "@/components/Work";
import { about, badge, contact, experience, hero, links, projects, projectsNote, statement, toolbox } from "@/content/profile";
import { tools } from "@/content/tools";

export default function Home() {
  return (
    <>
      <SceneLoader slides={projects.length} />

      <header className="top" id="top">
        <a className="me" href="#top">
          Rishabh Kumar
        </a>
        <nav className="top-links" aria-label="Site">
          <Link href="/tools">Tools</Link>
          <ThemeToggle />
        </nav>
      </header>

      <Dock resume={links.resume} />

      <main>
        {/* ================= HERO ================= */}
        <section className="hero">
          <div className="rise">
            <span className="tag">{hero.tag}</span>
            <h1 className="disp">
              {hero.headline.first}
              <br />
              {hero.headline.before}
              <i>{hero.headline.accent}</i>
              {hero.headline.after}
            </h1>
            <p>{hero.intro}</p>
            <div className="cta">
              <a className="btn" href="#work">
                See my work ↓
              </a>
              <a className="btn light" href={links.resume} target="_blank" rel="noopener">
                Resume ↗
              </a>
            </div>
          </div>
        </section>

        <Statement text={statement} />

        <Work projects={projects} note={projectsNote} />

        {/* ================= EXPERIENCE ================= */}
        <section className="block" id="experience">
          <h2 className="disp reveal">
            Where I have <i>worked</i>.
          </h2>
          {experience.map((job) => (
            <div className="xp reveal" key={job.role}>
              <span className="when">{job.dates}</span>
              <h3>
                {job.role}
                <span>{job.place}</span>
              </h3>
              <ul>
                {job.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ================= ABOUT ================= */}
        <section className="block" id="about">
          <h2 className="disp reveal">
            About <i>me</i>.
          </h2>
          <div className="about">
            <IdCard {...badge} />
            <div className="about-text">
              <p className="reveal">{about}</p>
              <dl className="kit reveal">
                {toolbox.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.items}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ================= TOOLS ================= */}
        <section className="block" id="tools">
          <h2 className="disp reveal">
            Tools you can <i>use</i>.
          </h2>
          <p className="block-lead reveal">
            Working tools on this site, free for anyone. The first two run on a backend I wrote for them.
          </p>
          <ToolList tools={tools} className="reveal" />
        </section>

        {/* ================= CONTACT ================= */}
        <section className="contact" id="contact">
          <div>
            <h2 className="disp reveal">
              Get in <i>touch</i>.
            </h2>
            <p className="lead reveal">{contact.lead}</p>
            <CopyEmail email={links.email} />
            <div className="out reveal">
              <a href={links.linkedin} target="_blank" rel="noopener">
                LinkedIn ↗
              </a>
              <a href={links.github} target="_blank" rel="noopener">
                GitHub ↗
              </a>
              <a href={links.resume} target="_blank" rel="noopener">
                Resume ↗
              </a>
            </div>
            <p className="end">{new Date().getFullYear()} Rishabh Kumar</p>
          </div>
        </section>
      </main>
    </>
  );
}
