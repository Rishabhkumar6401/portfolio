"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

// The 3D scene only makes sense in a browser, and its library is large, so it loads after the page text.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/** The objects are decoration. If the scene fails for any reason, the page carries on without them. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SceneLoader({ slides }: { slides: number }) {
  return (
    <SceneBoundary>
      <Scene slides={slides} />
    </SceneBoundary>
  );
}
