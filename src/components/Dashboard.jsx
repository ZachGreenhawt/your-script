import { useEffect } from "react";
import { GA_EVENTS } from "../analytics.js";

// Empty-state dashboard.  Once we add session persistence (localStorage
// or a backend), this is where the user's past runs will live.  For
// now it points back to /upload so the link in the upload page has a
// real destination.
export default function Dashboard() {
  useEffect(() => {
    GA_EVENTS.dashboardOpened();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <main className="practice-page is-paper dashboard-page">
      <div className="paper-backdrop" aria-hidden="true">
        <span className="paper-margin" />
        <span className="paper-rules" />
      </div>

      <header className="site-chrome practice-chrome">
        <a className="chrome-link chrome-mark squiggle-hover" href="/">
          Your Script
        </a>
        <span className="chrome-center">Dashboard</span>
        <div className="chrome-right">
          <a className="chrome-link chrome-cta squiggle-hover" href="/upload">
            Upload
            <svg
              className="chrome-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </header>

      <section className="practice-shell on-paper">
        <div className="paper-stage dashboard-stage">
          <header className="paper-heading">
            <p className="paper-eyebrow">Your Script</p>
            <h1>Dashboard</h1>
            <svg
              className="paper-heading-rule hand-underline"
              viewBox="0 0 268 24"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </header>

          <div className="dashboard-empty">
            <img
              src="/mascots/listening.svg"
              alt=""
              aria-hidden="true"
              className="dashboard-empty-mascot"
            />
            <p className="dashboard-empty-line">Nothing here yet!</p>
            <a className="dashboard-empty-cta" href="/upload">
              Upload a script to get started
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                className="dashboard-empty-arrow"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <div className="grain-layer" aria-hidden="true" />
    </main>
  );
}
