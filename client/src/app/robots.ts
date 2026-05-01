import { MetadataRoute } from "next";

const BASE_URL = "https://edge.nexoral.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/dashboard", "/settings", "/loadbalancers", "/onboarding"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
