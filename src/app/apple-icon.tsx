import { ImageResponse } from "next/og";

// The home-screen icon for iPhones and iPads. Apple rounds the corners itself,
// so this fills the whole square with the logo's coral and draws the waves on top.
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
          alignItems: "center",
          justifyContent: "center",
          background: "#dc532d",
        }}
      >
        <svg
          width="112"
          height="112"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fefbf8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" />
          <path d="M2 19q2.5 2 5 0t5 0 5 0 5 0" />
          <path d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />
        </svg>
      </div>
    ),
    size
  );
}
