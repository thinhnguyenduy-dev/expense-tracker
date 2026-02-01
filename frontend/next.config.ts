import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  scope: "/",
  sw: "sw.js",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});
 
const withNextIntl = createNextIntlPlugin();
 
const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Trigger restart for UI update
};
 
export default withPWA(withNextIntl(nextConfig));
