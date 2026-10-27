import { Suspense } from "react";
import type { Metadata } from "next";
import { DiscoverClient } from "@/components/discover/DiscoverClient";

export const metadata: Metadata = {
  title: "تصفّح الأقمشة | Discover fabrics",
  description:
    "ابحث في الأقمشة حسب اللون والنقشة والخامة والفئة. " +
    "Search fabrics by color, pattern, material and category.",
};

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="container-wide py-20" />}>
      <DiscoverClient />
    </Suspense>
  );
}
