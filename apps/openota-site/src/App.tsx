import { Reveal } from "./Reveal";
import { SyncTerminal } from "./SyncTerminal";
import { GitHubIcon, LinkedInIcon } from "./icons";

const GITHUB_URL = "https://github.com/HarshaJrDev";
const LINKEDIN_URL =
  "https://www.linkedin.com/public-profile/settings/?trk=d_flagship3_profile_self_view_public_profile&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base%3BKf5aXnzhTpWtfPX7SUcujg%3D%3D";

const INSTALL_COMMAND = "npx openota init && openota release --version 1.2.0";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Build",
    body: "Metro bundles JS + assets, hashes the output, writes a versioned manifest.",
  },
  {
    num: "02",
    title: "Check",
    body: "Device asks your server for the active version against its own runtime version.",
  },
  {
    num: "03",
    title: "Download",
    body: "Package streams to disk with live progress, resumable on flaky networks.",
  },
  {
    num: "04",
    title: "Verify",
    body: "SHA-256 of the extracted bundle is checked against the signed manifest before anything runs.",
  },
  {
    num: "05",
    title: "Activate",
    body: "Bundle swaps in on next launch; a boot-loop trips automatic rollback to the last good version.",
  },
];

const FEATURES = [
  {
    tag: "SERVER",
    title: "Self-hosted release store",
    body: "Express + your own storage. Upload, list, check, download, rollback, delete — a plain REST API you already know how to operate.",
  },
  {
    tag: "CLI",
    title: "doctor · build · release · rollback",
    body: "One binary drives Metro, packages the manifest and assets into a zip, and talks to the server — scriptable in any CI.",
  },
  {
    tag: "SDK",
    title: "Drop-in OTA.sync()",
    body: "A single call runs check → download → verify → install on-device, with hooks for progress and rollout gating.",
  },
  {
    tag: "NATIVE RUNTIME",
    title: "Crash-safe by construction",
    body: "Kotlin state machine tracks boot health; a bundle that crashes on launch is automatically abandoned for the last known-good one.",
  },
];

function copyInstallCommand() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(INSTALL_COMMAND);
  }
}

export default function App() {
  return (
    <>
      <nav className="top-nav">
        <div className="wrap">
          <div className="brand">
            <span className="dot" />
            OpenOTA
          </div>
          <div className="navlinks">
            <a href="#pipeline">How it works</a>
            <a href="#features">Features</a>
            <a href="#manifest">Manifest</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
          <a className="btn btn-primary" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            Star on GitHub
          </a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div>
            <Reveal>
              <span className="eyebrow">● open source · react native</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="headline">
                Ship JS updates
                <br />
                without the <span className="accent-word">review queue</span>.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lede">
                OpenOTA is self-hosted over-the-air infrastructure for React Native: build a signed
                bundle, push it to your own server, and let devices sync, verify, and roll back on
                their own — no App Store review, no vendor lock-in.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero-ctas">
                <a className="btn btn-primary" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
                <a className="btn btn-ghost" href="#pipeline">
                  See the pipeline ↓
                </a>
              </div>
              <div className="install-line">
                <span className="prompt">$</span>
                <span className="cmd">{INSTALL_COMMAND}</span>
                <button className="copy-btn" onClick={copyInstallCommand}>
                  copy
                </button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <SyncTerminal />
          </Reveal>
        </div>
      </header>

      <section className="pipeline" id="pipeline">
        <div className="wrap">
          <Reveal className="section-head">
            <div className="section-kicker">the release pipeline</div>
            <h2 className="section-title">Five steps, one command, no black box.</h2>
            <p className="section-sub">
              <code>openota release</code> builds and uploads a versioned bundle; every installed
              app runs the same five steps to adopt it — the exact sequence traced in the panel
              above.
            </p>
          </Reveal>
          <div className="pipeline-row">
            {PIPELINE_STEPS.map((step, index) => (
              <Reveal key={step.num} delay={index * 70} className="pstep-wrap">
                <div className="pstep">
                  <div className="pnum">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {index < PIPELINE_STEPS.length - 1 && <span className="arrow">›</span>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="wrap">
          <Reveal className="section-head">
            <div className="section-kicker">what's in the box</div>
            <h2 className="section-title">One repo, four pieces, no vendor.</h2>
          </Reveal>
          <div className="feat-grid">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.tag} delay={index * 70} className="feat-wrap">
                <div className="feat">
                  <div className="ftag">{feature.tag}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="manifest" id="manifest">
        <div className="wrap manifest-grid">
          <Reveal className="manifest-copy">
            <div className="section-kicker">the contract</div>
            <h2 className="section-title">Every release is just a manifest.</h2>
            <p className="section-sub">
              No proprietary format, no dashboard-only state. The manifest is the single source of
              truth the CLI writes, the server stores, and the device verifies against —
              inspectable at every hop.
            </p>
            <ul className="checklist">
              <li>
                <span className="mk">✓</span> Bundle hash verified after extraction, not before
              </li>
              <li>
                <span className="mk">✓</span> Rollback moves a pointer — it never deletes a release
              </li>
              <li>
                <span className="mk">✓</span> Runtime version gates compatibility, per platform
              </li>
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="json-card">
              <span className="c">// manifest.json</span>
              {"\n"}
              {"{\n"}
              {"  "}
              <span className="k">"bundleVersion"</span>: <span className="s">"1.2.0"</span>,{"\n"}
              {"  "}
              <span className="k">"platform"</span>: <span className="s">"android"</span>,{"\n"}
              {"  "}
              <span className="k">"runtimeVersion"</span>: <span className="s">"0.1.0"</span>,{"\n"}
              {"  "}
              <span className="k">"sha256"</span>: <span className="s">"0d04b201e29d…8a"</span>,{"\n"}
              {"  "}
              <span className="k">"size"</span>: <span className="n">895873</span>,{"\n"}
              {"  "}
              <span className="k">"bundleName"</span>: <span className="s">"index.android.bundle"</span>
              {"\n}"}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="author">
        <div className="wrap">
          <Reveal className="author-card">
            <div className="author-id">
              <div className="avatar">H</div>
              <div>
                <div className="author-name">Built by Harsha</div>
                <div className="author-role">Maintainer, OpenOTA</div>
              </div>
            </div>
            <div className="author-links">
              <a className="link-pill" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                GitHub
              </a>
              <a className="link-pill" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                <LinkedInIcon />
                LinkedIn
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          <span>OpenOTA — MIT licensed.</span>
          <span className="flinks">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
