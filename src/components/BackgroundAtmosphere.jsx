import { useEffect, useState } from "react";

// A quiet sketchbook backdrop.  Just paper grain — the discipline lives in
// the negative space, not in decorative doodles.  Clears completely when
// the mascot loader takes over.
export default function BackgroundAtmosphere() {
  const [loaderActive, setLoaderActive] = useState(false);
  useEffect(() => {
    const onClick = () => setLoaderActive(true);
    window.addEventListener("newScriptClick", onClick);
    return () => window.removeEventListener("newScriptClick", onClick);
  }, []);

  return (
    <div
      className="bg-atmosphere"
      aria-hidden="true"
      style={{ "--atmo-opacity": loaderActive ? 0 : 1 }}
    >
      <div className="bg-grain" />
    </div>
  );
}
