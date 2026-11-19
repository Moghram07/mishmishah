import type { Metadata } from "next";
import { NotFound } from "@/components/layout/NotFound";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة | Page not found",
};

export default function NotFoundPage() {
  return <NotFound />;
}
