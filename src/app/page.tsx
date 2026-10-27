import { Hero } from "@/components/home/Hero";
import { SearchBand } from "@/components/home/SearchBand";
import { FeaturedFabrics } from "@/components/home/FeaturedFabrics";
import { PopularCategories } from "@/components/home/PopularCategories";
import { WhyMishmishah } from "@/components/home/WhyMishmishah";
import { BecomeSeller } from "@/components/home/BecomeSeller";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SearchBand />
      <FeaturedFabrics />
      <PopularCategories />
      <WhyMishmishah />
      <BecomeSeller />
    </>
  );
}
