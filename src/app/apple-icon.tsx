import { ImageResponse } from "next/og";

// The home-screen icon for iPhones and iPads. Apple rounds the corners itself,
// so this fills the whole square with the logo's coral and draws the rings on top.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#dc532d",
        }}
      >
        {/* Same drawing as src/app/icon.svg: rings spreading from a drop in the lower-left corner. */}
        <svg width="180" height="180" viewBox="0 0 32 32" fill="none" stroke="#fefbf8" strokeWidth="3">
          <circle cx="9" cy="23" r="7" />
          <circle cx="9" cy="23" r="14" strokeOpacity="0.7" />
          <circle cx="9" cy="23" r="21" strokeOpacity="0.45" />
          <circle cx="9" cy="23" r="2.6" fill="#fefbf8" stroke="none" />
        </svg>
      </div>
    ),
    size
  );
}
