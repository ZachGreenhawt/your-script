import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function useScrollTimeline(containerRef, enabled = true) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      return undefined;
    }

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => setProgress(self.progress),
    });

    ScrollTrigger.refresh();

    return () => {
      trigger.kill();
    };
  }, [containerRef, enabled]);

  return progress;
}
