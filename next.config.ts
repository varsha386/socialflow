import type { NextConfig } from "next";

// Security headers sent with every page.
const securityHeaders = [
  // Don't let other websites show SocialFlow inside a frame (stops "clickjacking").
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'", // same as above, for modern browsers
      "base-uri 'self'", // stop injected <base> tags from redirecting links
      "form-action 'self'", // forms can only submit to SocialFlow
      "object-src 'none'", // no old-style plugins (Flash, etc.)
    ].join("; "),
  },
  // Browsers must trust the file type we send, not guess it.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only see "socialflow-uhru.vercel.app", never full page addresses.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SocialFlow never needs the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
